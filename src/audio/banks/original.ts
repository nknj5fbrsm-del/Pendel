import { BRIGHT_MELODY_SCALE, WARM_MELODY_SCALE } from "../scales.js";
import type { BallVoice, MixerOutputs, PendulumVoice, SoundBank } from "../types.js";
import { disposeToneNodes } from "../types.js";

type ToneColor = "bright" | "warm";

type MelodyVoiceKind =
  | "fm"
  | "am"
  | "pluckModern"
  | "pluckAcoustic"
  | "marimba"
  | "string"
  | "kalimba";

type VoiceWeight = { kind: MelodyVoiceKind; weight: number };

const BRIGHT_VOICE_WEIGHTS: VoiceWeight[] = [
  { kind: "pluckModern", weight: 0.28 },
  { kind: "pluckAcoustic", weight: 0.18 },
  { kind: "fm", weight: 0.18 },
  { kind: "am", weight: 0.14 },
  { kind: "marimba", weight: 0.12 },
  { kind: "string", weight: 0.1 },
];

const WARM_VOICE_WEIGHTS: VoiceWeight[] = [
  { kind: "pluckAcoustic", weight: 0.2 },
  { kind: "pluckModern", weight: 0.16 },
  { kind: "kalimba", weight: 0.15 },
  { kind: "string", weight: 0.15 },
  { kind: "fm", weight: 0.13 },
  { kind: "am", weight: 0.11 },
  { kind: "marimba", weight: 0.1 },
];

class OriginalMelodyGenerator {
  private readonly color: ToneColor;
  private readonly scale: string[];
  private readonly voices: Partial<Record<MelodyVoiceKind, any>>;
  private readonly voiceWeights: VoiceWeight[];
  private readonly disposeList: any[] = [];
  private scaleIndex: number;
  private readonly maxStep = 4;

  constructor(color: ToneColor, output: any) {
    this.color = color;
    this.scale = color === "bright" ? BRIGHT_MELODY_SCALE : WARM_MELODY_SCALE;
    this.scaleIndex = Math.floor(this.scale.length / 2);
    this.voiceWeights = color === "bright" ? BRIGHT_VOICE_WEIGHTS : WARM_VOICE_WEIGHTS;
    this.voices = {};

    if (color === "bright") {
      const filter = new Tone.Filter({ type: "highpass", frequency: 140, Q: 0.5 });
      filter.connect(output);
      this.disposeList.push(filter);

      this.voices.pluckModern = new Tone.PluckSynth({
        attackNoise: 1,
        dampening: 5600,
        resonance: 0.94,
      }).connect(filter);
      this.disposeList.push(this.voices.pluckModern);

      this.voices.pluckAcoustic = new Tone.MonoSynth({
        oscillator: { type: "triangle" },
        filter: { Q: 2.4, type: "lowpass", rolloff: -24 },
        envelope: { attack: 0.002, decay: 0.14, sustain: 0.02, release: 0.2 },
        filterEnvelope: {
          attack: 0.002,
          decay: 0.12,
          sustain: 0.01,
          release: 0.16,
          baseFrequency: 900,
          octaves: 3.2,
        },
      }).connect(filter);
      this.disposeList.push(this.voices.pluckAcoustic);

      this.voices.fm = new Tone.FMSynth({
        harmonicity: 2.2,
        modulationIndex: 1.6,
        oscillator: { type: "triangle" },
        envelope: { attack: 0.003, decay: 0.2, sustain: 0.03, release: 0.24 },
        modulation: { type: "sine" },
        modulationEnvelope: { attack: 0.003, decay: 0.14, sustain: 0, release: 0.18 },
      }).connect(filter);
      this.disposeList.push(this.voices.fm);

      this.voices.am = new Tone.AMSynth({
        harmonicity: 2,
        oscillator: { type: "square8" },
        envelope: { attack: 0.004, decay: 0.18, sustain: 0.04, release: 0.22 },
        modulation: { type: "sine" },
        modulationEnvelope: { attack: 0.003, decay: 0.11, sustain: 0, release: 0.15 },
      }).connect(filter);
      this.disposeList.push(this.voices.am);

      this.voices.marimba = new Tone.MembraneSynth({
        pitchDecay: 0.018,
        octaves: 3,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.14 },
      }).connect(filter);
      this.disposeList.push(this.voices.marimba);

      this.voices.string = new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        filter: { Q: 0.9, type: "lowpass", rolloff: -12 },
        envelope: { attack: 0.04, decay: 0.22, sustain: 0.06, release: 0.28 },
        filterEnvelope: {
          attack: 0.03,
          decay: 0.18,
          sustain: 0.04,
          release: 0.22,
          baseFrequency: 420,
          octaves: 1.6,
        },
      }).connect(filter);
      this.disposeList.push(this.voices.string);
    } else {
      const filter = new Tone.Filter({ type: "lowpass", frequency: 2600, Q: 0.4 });
      filter.connect(output);
      this.disposeList.push(filter);

      this.voices.pluckAcoustic = new Tone.MonoSynth({
        oscillator: { type: "sine" },
        filter: { Q: 1.4, type: "lowpass", rolloff: -24 },
        envelope: { attack: 0.008, decay: 0.42, sustain: 0.08, release: 0.5 },
        filterEnvelope: {
          attack: 0.006,
          decay: 0.3,
          sustain: 0.06,
          release: 0.35,
          baseFrequency: 220,
          octaves: 2.4,
        },
      }).connect(filter);
      this.disposeList.push(this.voices.pluckAcoustic);

      this.voices.pluckModern = new Tone.PluckSynth({
        attackNoise: 0.85,
        dampening: 2800,
        resonance: 0.88,
      }).connect(filter);
      this.disposeList.push(this.voices.pluckModern);

      this.voices.kalimba = new Tone.FMSynth({
        harmonicity: 2.6,
        modulationIndex: 0.9,
        oscillator: { type: "sine" },
        envelope: { attack: 0.002, decay: 0.45, sustain: 0.04, release: 0.38 },
        modulation: { type: "triangle" },
        modulationEnvelope: { attack: 0.002, decay: 0.32, sustain: 0, release: 0.25 },
      }).connect(filter);
      this.disposeList.push(this.voices.kalimba);

      this.voices.string = new Tone.MonoSynth({
        oscillator: { type: "triangle" },
        filter: { Q: 0.8, type: "lowpass", rolloff: -12 },
        envelope: { attack: 0.05, decay: 0.32, sustain: 0.1, release: 0.38 },
        filterEnvelope: {
          attack: 0.04,
          decay: 0.24,
          sustain: 0.06,
          release: 0.28,
          baseFrequency: 280,
          octaves: 1.4,
        },
      }).connect(filter);
      this.disposeList.push(this.voices.string);

      this.voices.fm = new Tone.FMSynth({
        harmonicity: 1.05,
        modulationIndex: 0.5,
        oscillator: { type: "sine" },
        envelope: { attack: 0.025, decay: 0.45, sustain: 0.14, release: 0.55 },
        modulation: { type: "triangle" },
        modulationEnvelope: { attack: 0.02, decay: 0.32, sustain: 0.05, release: 0.38 },
      }).connect(filter);
      this.disposeList.push(this.voices.fm);

      this.voices.am = new Tone.AMSynth({
        harmonicity: 1.2,
        oscillator: { type: "triangle" },
        envelope: { attack: 0.03, decay: 0.48, sustain: 0.16, release: 0.58 },
        modulation: { type: "sine" },
        modulationEnvelope: { attack: 0.02, decay: 0.3, sustain: 0.05, release: 0.32 },
      }).connect(filter);
      this.disposeList.push(this.voices.am);

      this.voices.marimba = new Tone.MembraneSynth({
        pitchDecay: 0.028,
        octaves: 2.2,
        oscillator: { type: "sine" },
        envelope: { attack: 0.002, decay: 0.38, sustain: 0.02, release: 0.28 },
      }).connect(filter);
      this.disposeList.push(this.voices.marimba);
    }
  }

  play(now: number): void {
    this.silenceAllVoices(now);
    this.scaleIndex = this.pickNextIndex();
    const note = this.scale[this.scaleIndex];
    const kind = this.pickVoiceKind();
    const synth = this.voices[kind] as any;
    if (!synth || !("triggerAttackRelease" in synth)) return;

    this.tweakVoice(synth, kind);
    const velocity = 0.22 + Math.random() * 0.48;
    synth.triggerAttackRelease(note, this.durationFor(kind), now, velocity);
  }

  reset(): void {
    this.scaleIndex = Math.floor(this.scale.length / 2);
    this.silenceAllVoices(Tone.now());
  }

  dispose(): void {
    disposeToneNodes(this.disposeList);
  }

  private silenceAllVoices(now: number): void {
    for (const synth of Object.values(this.voices)) {
      if (!synth) continue;
      const inst = synth as any;
      try {
        if ("releaseAll" in inst && typeof inst.releaseAll === "function") {
          inst.releaseAll(now);
        } else if ("triggerRelease" in inst) {
          inst.triggerRelease(now);
        }
      } catch {
        // Stimme war bereits still.
      }
    }
  }

  private pickVoiceKind(): MelodyVoiceKind {
    const r = Math.random();
    let sum = 0;
    for (const entry of this.voiceWeights) {
      sum += entry.weight;
      if (r <= sum) return entry.kind;
    }
    return this.voiceWeights[this.voiceWeights.length - 1].kind;
  }

  private durationFor(kind: MelodyVoiceKind): number {
    if (kind === "pluckModern" || kind === "pluckAcoustic") {
      return 0.05 + Math.random() * 0.28;
    }
    if (kind === "marimba" || kind === "kalimba") {
      return 0.08 + Math.random() * 0.28;
    }
    if (kind === "string") {
      return 0.12 + Math.random() * 0.28;
    }
    return 0.08 + Math.random() * 0.36;
  }

  private tweakVoice(synth: any, kind: MelodyVoiceKind): void {
    const s = synth as {
      resonance?: number;
      modulationIndex?: { rampTo(v: number, t: number): void };
      harmonicity?: { rampTo(v: number, t: number): void };
    };
    if (kind === "pluckModern" && s.resonance !== undefined) {
      s.resonance = 0.88 + Math.random() * 0.1;
    }
    if (kind === "fm" && s.modulationIndex?.rampTo) {
      const base = this.color === "bright" ? 1.2 : 0.3;
      s.modulationIndex.rampTo(base + Math.random() * 1.8, 0.02);
    }
    if (kind === "am" && s.harmonicity?.rampTo) {
      s.harmonicity.rampTo(1.1 + Math.random() * 1.6, 0.02);
    }
    if (kind === "kalimba" && s.modulationIndex?.rampTo) {
      s.modulationIndex.rampTo(0.5 + Math.random() * 0.8, 0.02);
    }
  }

  private pickNextIndex(): number {
    const leap = Math.random() < 0.22;
    const stepRange = leap ? this.maxStep + 2 : this.maxStep;
    const step = Math.floor(Math.random() * (stepRange * 2 + 1)) - stepRange;
    let next = this.scaleIndex + step;
    next = Math.max(0, Math.min(this.scale.length - 1, next));
    if (next === this.scaleIndex) {
      next = step >= 0 ? Math.min(this.scale.length - 1, next + 1) : Math.max(0, next - 1);
    }
    return next;
  }
}

class OriginalPendulumVoice implements PendulumVoice {
  private readonly melodyBlue: OriginalMelodyGenerator;
  private readonly melodyPink: OriginalMelodyGenerator;
  private readonly clickSynth: any;

  constructor(outputs: MixerOutputs) {
    this.melodyBlue = new OriginalMelodyGenerator("bright", outputs.melodyBlue);
    this.melodyPink = new OriginalMelodyGenerator("warm", outputs.melodyPink);
    this.clickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.005,
      octaves: 1,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.03 },
    }).connect(outputs.click);
  }

  playMelodyBlue(now: number): void {
    this.melodyBlue.play(now);
  }

  playMelodyPink(now: number): void {
    this.melodyPink.play(now);
  }

  playClick(now: number): void {
    this.clickSynth.triggerAttackRelease("C6", 0.015, now, 0.22);
  }

  reset(): void {
    this.melodyBlue.reset();
    this.melodyPink.reset();
  }

  dispose(): void {
    this.melodyBlue.dispose();
    this.melodyPink.dispose();
    this.clickSynth.dispose();
  }
}

class OriginalBallVoice implements BallVoice {
  private readonly kick: any;
  private readonly snare: any;
  private readonly hiHat: any;

  constructor(outputs: MixerOutputs) {
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.06,
      octaves: 5,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.25 },
    }).connect(outputs.kick);

    this.snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 },
    }).connect(outputs.snare);

    this.hiHat = new Tone.MetalSynth({
      frequency: 320,
      envelope: { attack: 0.001, decay: 0.06, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 28,
      resonance: 5000,
      octaves: 1.2,
    }).connect(outputs.hiHat);
  }

  playKick(now: number): void {
    this.kick.triggerAttackRelease("C1", 0.12, now, 0.85);
  }

  playSnare(now: number): void {
    this.snare.triggerAttackRelease(0.1, now, 0.7);
  }

  playHiHat(now: number): void {
    this.hiHat.triggerAttackRelease(280, 0.07, now, 0.8);
  }

  dispose(): void {
    disposeToneNodes([this.kick, this.snare, this.hiHat]);
  }
}

export function createOriginalSoundBank(outputs: MixerOutputs): SoundBank {
  return {
    id: "original",
    label: "Original",
    pendulum: new OriginalPendulumVoice(outputs),
    ball: new OriginalBallVoice(outputs),
    dispose() {
      this.pendulum.dispose();
      this.ball.dispose();
    },
  };
}
