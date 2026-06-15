import { BRIGHT_MELODY_SCALE, GLITCH_SCALE, WARM_MELODY_SCALE } from "../scales.js";
import { ScaleMelodyPlayer, makeMonoVoice } from "../scale-melody-player.js";
import type { ExtendedDynamicsEvents } from "../physics-events.js";
import type { SimulationSnapshot } from "../simulation-snapshot.js";
import type { BallCollisionEvents } from "../types.js";
import { disposeToneNodes } from "../types.js";
import type { AudioBundle, BundleContext, SoundFlash, UiPresetTarget } from "./types.js";
import { AUDIO_BUNDLE_DESCRIPTIONS, AUDIO_BUNDLE_LABELS } from "./types.js";

export class ExtendedBundle implements AudioBundle {
  readonly id = "extended" as const;
  readonly label = AUDIO_BUNDLE_LABELS.extended;
  readonly description = AUDIO_BUNDLE_DESCRIPTIONS.extended;

  private readonly blue: ScaleMelodyPlayer;
  private readonly pink: ScaleMelodyPlayer;
  private readonly clickSynth: any;
  private readonly kick: any;
  private readonly snare: any;
  private readonly hiHat: any;
  private readonly peakSynth: any;
  private readonly energySynth: any;
  private readonly nearSynth: any;
  private readonly quadrantSynth: any;
  private readonly nodes: Array<{ dispose(): void }> = [];

  private lastMelodyBob1 = 0;
  private lastMelodyBob2 = 0;
  private lastClick = 0;
  private bob1CrossAt = -1;
  private bob1FlipAt = -1;
  private readonly melodyCooldown = 0.13;
  private readonly clickCooldown = 0.04;
  private readonly pairWindow = 0.25;
  private readonly extCooldown = 0.22;
  private readonly nearCooldown = 0.7;
  private readonly quadrantCooldown = 0.75;

  private lastPeak = 0;
  private lastEnergy = 0;
  private lastNear = 0;
  private lastQuadrant = 0;

  constructor(ctx: BundleContext) {
    const blueOut = ctx.mixer.output("melodyBlue");
    const pinkOut = ctx.mixer.output("melodyPink");
    const clickOut = ctx.mixer.output("click");
    const kickOut = ctx.mixer.output("kick");
    const snareOut = ctx.mixer.output("snare");
    const hiHatOut = ctx.mixer.output("hiHat");

    const blueNodes: any[] = [];
    const pinkNodes: any[] = [];
    const blueVoice = makeMonoVoice(
      blueOut,
      {
        oscillator: { type: "sawtooth" },
        filter: { Q: 1.5, type: "lowpass", rolloff: -24 },
        envelope: { attack: 0.003, decay: 0.16, sustain: 0.05, release: 0.1 },
        filterEnvelope: {
          attack: 0.002,
          decay: 0.1,
          sustain: 0.02,
          release: 0.08,
          baseFrequency: 300,
          octaves: 3,
        },
      },
      blueNodes,
    );
    this.blue = new ScaleMelodyPlayer(BRIGHT_MELODY_SCALE, [blueVoice]);
    for (const n of blueNodes) this.blue.registerNode(n);

    const pinkVoice = makeMonoVoice(
      pinkOut,
      {
        oscillator: { type: "square" },
        filter: { Q: 2, type: "bandpass", rolloff: -12 },
        envelope: { attack: 0.004, decay: 0.2, sustain: 0.04, release: 0.12 },
        filterEnvelope: {
          attack: 0.003,
          decay: 0.14,
          sustain: 0.02,
          release: 0.1,
          baseFrequency: 180,
          octaves: 2.5,
        },
      },
      pinkNodes,
    );
    this.pink = new ScaleMelodyPlayer(WARM_MELODY_SCALE, [pinkVoice]);
    for (const n of pinkNodes) this.pink.registerNode(n);

    this.clickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.01,
      octaves: 2.5,
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
    }).connect(clickOut);

    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
    }).connect(kickOut);
    this.snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.08 },
    }).connect(snareOut);
    this.hiHat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.03, release: 0.015 },
      harmonicity: 8,
      modulationIndex: 30,
      resonance: 4500,
      octaves: 0.8,
    }).connect(hiHatOut);

    this.peakSynth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.2, release: 0.1 },
      harmonicity: 4,
      modulationIndex: 20,
      resonance: 3000,
      octaves: 1.5,
    }).connect(hiHatOut);

    this.energySynth = new Tone.FMSynth({
      harmonicity: 3,
      modulationIndex: 18,
      envelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.15 },
    }).connect(kickOut);

    this.nearSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.35, sustain: 0.12, release: 0.28 },
    }).connect(clickOut);

    this.quadrantSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.15, release: 0.35 },
    }).connect(clickOut);

    this.nodes.push(
      this.clickSynth,
      this.kick,
      this.snare,
      this.hiHat,
      this.peakSynth,
      this.energySynth,
      this.nearSynth,
      this.quadrantSynth,
    );
  }

  applyUiPresets(target: UiPresetTarget): void {
    target.setReverbWet(0.45);
    target.setMixerLevel("melodyBlue", 0.68);
    target.setMixerLevel("melodyPink", 0.68);
    target.setMixerLevel("click", 0.7);
    target.setMixerLevel("kick", 0.82);
    target.setMixerLevel("snare", 0.72);
    target.setMixerLevel("hiHat", 0.65);
  }

  onDynamics(now: number, events: ExtendedDynamicsEvents, snap: SimulationSnapshot): SoundFlash {
    const flash: SoundFlash = { bob1: false, bob2: false };

    if (events.bob1Cross) this.bob1CrossAt = now;
    if (events.omega1Flip) this.bob1FlipAt = now;

    if (events.bob1Cross && now - this.lastMelodyBob1 > this.melodyCooldown) {
      this.blue.play(now);
      this.lastMelodyBob1 = now;
      flash.bob1 = true;
    }

    if (
      this.pairedWithinWindow(this.bob1CrossAt, this.bob1FlipAt, now) &&
      now - this.lastClick > this.clickCooldown
    ) {
      this.clickSynth.triggerAttackRelease("G4", 0.015, now, 0.38);
      this.lastClick = now;
      this.bob1CrossAt = -1;
      this.bob1FlipAt = -1;
      flash.bob1 = true;
    }

    if (events.bob2Cross && now - this.lastMelodyBob2 > this.melodyCooldown) {
      this.pink.play(now);
      this.lastMelodyBob2 = now;
      flash.bob2 = true;
    }

    if (events.velocityPeak && now - this.lastPeak > this.extCooldown) {
      const pitch = 400 + snap.totalSpeed * 80;
      this.peakSynth.triggerAttackRelease(pitch, "16n", now, 0.55);
      this.lastPeak = now;
      flash.bob1 = true;
    }

    if (events.energyJump && now - this.lastEnergy > this.extCooldown) {
      const note = GLITCH_SCALE[Math.floor(Math.random() * GLITCH_SCALE.length)];
      this.energySynth.triggerAttackRelease(note, "8n", now, 0.5);
      this.lastEnergy = now;
    }

    if (events.nearCollision && now - this.lastNear > this.nearCooldown) {
      this.nearSynth.triggerAttackRelease("A3", "8n", now, 0.38);
      this.lastNear = now;
      flash.bob1 = true;
      flash.bob2 = true;
    }

    if (events.bob2QuadrantChange && now - this.lastQuadrant > this.quadrantCooldown) {
      const chord = ["C4", "E4", "G4"];
      this.quadrantSynth.triggerAttackRelease(chord, "8n", now, 0.28);
      this.lastQuadrant = now;
      flash.bob2 = true;
    }

    return flash;
  }

  onBallCollisions(now: number, events: BallCollisionEvents, snap: SimulationSnapshot): void {
    const v = Math.min(1, snap.ballSpeed / 250);
    if (events.wallHit) this.kick.triggerAttackRelease("C1", "8n", now, 0.5 + v * 0.4);
    if (events.bobHit) this.snare.triggerAttackRelease("16n", now, 0.45 + v * 0.35);
    if (events.lineCross) this.hiHat.triggerAttackRelease("32n", now, 0.3 + v * 0.25);
  }

  reset(): void {
    this.blue.reset();
    this.pink.reset();
    this.bob1CrossAt = -1;
    this.bob1FlipAt = -1;
    this.lastMelodyBob1 = 0;
    this.lastMelodyBob2 = 0;
    this.lastClick = 0;
    this.lastPeak = 0;
    this.lastEnergy = 0;
    this.lastNear = 0;
    this.lastQuadrant = 0;
  }

  dispose(): void {
    this.blue.dispose();
    this.pink.dispose();
    disposeToneNodes(this.nodes);
  }

  private pairedWithinWindow(crossAt: number, flipAt: number, now: number): boolean {
    if (crossAt < 0 || flipAt < 0) return false;
    if (now - crossAt > this.pairWindow || now - flipAt > this.pairWindow) return false;
    return Math.abs(crossAt - flipAt) <= this.pairWindow;
  }
}

export function createExtendedBundle(ctx: BundleContext): AudioBundle {
  return new ExtendedBundle(ctx);
}
