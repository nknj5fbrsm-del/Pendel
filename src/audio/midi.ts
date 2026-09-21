/** Minimal Type-1 MIDI writer and pendulum cue capture. */

import type { ExtendedDynamicsEvents } from "./physics-events.js";
import { BRIGHT_MELODY_SCALE, WARM_MELODY_SCALE } from "./scales.js";
import type { SimulationSnapshot } from "./simulation-snapshot.js";
import type { BallCollisionEvents } from "./types.js";

const TPQ = 480;
const DEFAULT_BPM = 120;
const NOTE_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export type MidiNote = {
  timeSec: number;
  durationSec: number;
  midi: number;
  channel: number;
  velocity: number;
  program?: number;
};

export function noteNameToMidi(name: string): number {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(name.trim());
  if (!match) return 60;
  const letter = match[1];
  const acc = match[2];
  const octave = Number(match[3]);
  let pc = NOTE_PC[letter] ?? 0;
  if (acc === "#") pc += 1;
  if (acc === "b") pc -= 1;
  return (octave + 1) * 12 + pc;
}

export function pitchFromAngle(theta: number, scale: readonly string[]): number {
  if (!scale.length) return 60;
  const tau = Math.PI * 2;
  const wrapped = ((theta % tau) + tau) % tau;
  const idx = Math.min(scale.length - 1, Math.floor((wrapped / tau) * scale.length));
  return noteNameToMidi(scale[idx]);
}

function vlq(value: number): number[] {
  const bytes: number[] = [value & 0x7f];
  let rest = value >>> 7;
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80);
    rest >>>= 7;
  }
  return bytes;
}

function u16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function u32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function secondsToTicks(sec: number, bpm: number): number {
  return Math.max(0, Math.round(sec * (bpm / 60) * TPQ));
}

type TimedEvent = { tick: number; bytes: number[] };

function encodeTrack(events: TimedEvent[]): number[] {
  const sorted = [...events].sort((a, b) => a.tick - b.tick);
  const body: number[] = [];
  let prev = 0;
  for (const event of sorted) {
    const delta = Math.max(0, event.tick - prev);
    body.push(...vlq(delta), ...event.bytes);
    prev = event.tick;
  }
  body.push(...vlq(0), 0xff, 0x2f, 0x00);
  return [
    0x4d, 0x54, 0x72, 0x6b,
    ...u32(body.length),
    ...body,
  ];
}

export function encodeMidi(notes: MidiNote[], bpm = DEFAULT_BPM): Uint8Array {
  const usPerQuarter = Math.round(60_000_000 / Math.max(1, bpm));
  const tempoTrack = encodeTrack([
    {
      tick: 0,
      bytes: [0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff],
    },
    { tick: 0, bytes: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08] },
  ]);

  const byChannel = new Map<number, MidiNote[]>();
  for (const note of notes) {
    const list = byChannel.get(note.channel) ?? [];
    list.push(note);
    byChannel.set(note.channel, list);
  }

  const channels = [...byChannel.keys()].sort((a, b) => a - b);
  const tracks = [tempoTrack];
  const usedChannels = channels.length ? channels : [0];

  for (const channel of usedChannels) {
    const channelNotes = byChannel.get(channel) ?? [];
    const events: TimedEvent[] = [];
    const program = channelNotes.find((item) => item.program !== undefined)?.program;
    if (program !== undefined && channel !== 9) {
      events.push({ tick: 0, bytes: [0xc0 | (channel & 0x0f), program & 0x7f] });
    }
    for (const note of channelNotes) {
      const start = secondsToTicks(note.timeSec, bpm);
      const end = secondsToTicks(note.timeSec + Math.max(0.04, note.durationSec), bpm);
      const vel = Math.max(1, Math.min(127, Math.round(note.velocity)));
      const key = Math.max(0, Math.min(127, Math.round(note.midi)));
      const statusOn = 0x90 | (channel & 0x0f);
      const statusOff = 0x80 | (channel & 0x0f);
      events.push({ tick: start, bytes: [statusOn, key, vel] });
      events.push({ tick: Math.max(start + 1, end), bytes: [statusOff, key, 0] });
    }
    tracks.push(encodeTrack(events));
  }

  const header = [
    0x4d, 0x54, 0x68, 0x64,
    ...u32(6),
    ...u16(1),
    ...u16(tracks.length),
    ...u16(TPQ),
  ];

  const bytes = [...header];
  for (const track of tracks) bytes.push(...track);
  return Uint8Array.from(bytes);
}

function velocityFromSpeed(speed: number): number {
  return Math.max(48, Math.min(112, Math.round(56 + speed * 10)));
}

function melodyDuration(speed: number): number {
  return 0.18 + Math.min(0.28, 0.32 / (1 + speed));
}

export class CueCapture {
  private t0 = 0;
  private active = false;
  private notes: MidiNote[] = [];
  private lastMelodyBlue = -Infinity;
  private lastMelodyPink = -Infinity;
  private lastClick = -Infinity;
  private bob1CrossAt = -1;
  private bob1FlipAt = -1;
  private readonly melodyCooldown = 0.14;
  private readonly clickCooldown = 0.04;
  private readonly pairWindow = 0.25;

  start(now: number): void {
    this.t0 = now;
    this.active = true;
    this.notes = [];
    this.lastMelodyBlue = -Infinity;
    this.lastMelodyPink = -Infinity;
    this.lastClick = -Infinity;
    this.bob1CrossAt = -1;
    this.bob1FlipAt = -1;
  }

  stop(): void {
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  ingestDynamics(now: number, events: ExtendedDynamicsEvents, snap: SimulationSnapshot): void {
    if (!this.active) return;
    const t = Math.max(0, now - this.t0);
    const vel = velocityFromSpeed(snap.totalSpeed);
    const dur = melodyDuration(snap.totalSpeed);

    if (events.bob1Cross) this.bob1CrossAt = now;
    if (events.omega1Flip) this.bob1FlipAt = now;

    if (events.bob1Cross && now - this.lastMelodyBlue > this.melodyCooldown) {
      this.notes.push({
        timeSec: t,
        durationSec: dur,
        midi: pitchFromAngle(snap.theta1, BRIGHT_MELODY_SCALE),
        channel: 0,
        velocity: vel,
        program: 0,
      });
      this.lastMelodyBlue = now;
    }

    if (this.pairedClick(now) && now - this.lastClick > this.clickCooldown) {
      this.notes.push({
        timeSec: t,
        durationSec: 0.06,
        midi: 37,
        channel: 9,
        velocity: Math.min(100, vel),
      });
      this.lastClick = now;
      this.bob1CrossAt = -1;
      this.bob1FlipAt = -1;
    }

    if (events.bob2Cross && now - this.lastMelodyPink > this.melodyCooldown) {
      this.notes.push({
        timeSec: t,
        durationSec: dur,
        midi: pitchFromAngle(snap.theta2, WARM_MELODY_SCALE),
        channel: 1,
        velocity: vel,
        program: 48,
      });
      this.lastMelodyPink = now;
    }
  }

  ingestBall(now: number, events: BallCollisionEvents, snap: SimulationSnapshot): void {
    if (!this.active) return;
    const t = Math.max(0, now - this.t0);
    const vel = velocityFromSpeed(snap.ballSpeed / 80);
    if (events.wallHit) {
      this.notes.push({ timeSec: t, durationSec: 0.08, midi: 36, channel: 9, velocity: vel });
    }
    if (events.bobHit) {
      this.notes.push({ timeSec: t, durationSec: 0.08, midi: 38, channel: 9, velocity: vel });
    }
    if (events.lineCross) {
      this.notes.push({ timeSec: t, durationSec: 0.05, midi: 42, channel: 9, velocity: vel });
    }
  }

  toMidi(): Uint8Array | null {
    if (!this.notes.length) return null;
    return encodeMidi(this.notes);
  }

  private pairedClick(now: number): boolean {
    if (this.bob1CrossAt < 0 || this.bob1FlipAt < 0) return false;
    if (now - this.bob1CrossAt > this.pairWindow || now - this.bob1FlipAt > this.pairWindow) {
      return false;
    }
    return Math.abs(this.bob1CrossAt - this.bob1FlipAt) <= this.pairWindow;
  }
}
