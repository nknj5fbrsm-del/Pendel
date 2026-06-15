import { GLITCH_SCALE } from "../scales.js";
import { makePluckVoice, ScaleMelodyPlayer } from "../scale-melody-player.js";
import type { BallVoice, MixerOutputs, PendulumVoice, SoundBank } from "../types.js";
import { disposeToneNodes } from "../types.js";

class GlitchPendulumVoice implements PendulumVoice {
  private readonly blue: ScaleMelodyPlayer;
  private readonly pink: ScaleMelodyPlayer;
  private readonly clickNoise: any;

  constructor(outputs: MixerOutputs) {
    const blueNodes: any[] = [];
    const pinkNodes: any[] = [];

    const blueCrush = new Tone.BitCrusher(4);
    blueCrush.connect(outputs.melodyBlue);
    blueNodes.push(blueCrush);

    const pinkCrush = new Tone.BitCrusher(3);
    pinkCrush.connect(outputs.melodyPink);
    pinkNodes.push(pinkCrush);

    const blueCheby = new Tone.Chebyshev(40);
    blueCheby.connect(blueCrush);
    blueNodes.push(blueCheby);

    const pinkCheby = new Tone.Chebyshev(30);
    pinkCheby.connect(pinkCrush);
    pinkNodes.push(pinkCheby);

    this.blue = new ScaleMelodyPlayer(
      GLITCH_SCALE,
      [
        makePluckVoice(
          outputs.melodyBlue,
          { attackNoise: 1.2, dampening: 8000, resonance: 0.98 },
          0.5,
          blueNodes,
          blueCheby,
        ),
        makePluckVoice(
          outputs.melodyBlue,
          { attackNoise: 0.6, dampening: 12000, resonance: 0.92 },
          0.5,
          blueNodes,
          blueCrush,
        ),
      ],
      [0.03, 0.12],
      [0.4, 0.85],
    );
    for (const n of blueNodes) this.blue.registerNode(n);

    this.pink = new ScaleMelodyPlayer(
      GLITCH_SCALE,
      [
        makePluckVoice(
          outputs.melodyPink,
          { attackNoise: 1, dampening: 6000, resonance: 0.96 },
          1,
          pinkNodes,
          pinkCheby,
        ),
      ],
      [0.04, 0.15],
      [0.35, 0.78],
    );
    for (const n of pinkNodes) this.pink.registerNode(n);

    this.clickNoise = new Tone.NoiseSynth({
      noise: { type: "brown" },
      envelope: { attack: 0.001, decay: 0.012, sustain: 0, release: 0.008 },
    }).connect(outputs.click);
  }

  playMelodyBlue(now: number): void {
    this.blue.play(now);
  }

  playMelodyPink(now: number): void {
    this.pink.play(now);
  }

  playClick(now: number): void {
    this.clickNoise.triggerAttackRelease(0.01, now, 0.45);
  }

  reset(): void {
    this.blue.reset();
    this.pink.reset();
  }

  dispose(): void {
    this.blue.dispose();
    this.pink.dispose();
    this.clickNoise.dispose();
  }
}

class GlitchBallVoice implements BallVoice {
  private readonly kick: any;
  private readonly kickDistort: any;
  private readonly snare: any;
  private readonly snareDistort: any;
  private readonly hiHat: any;

  constructor(outputs: MixerOutputs) {
    this.kickDistort = new Tone.Distortion(0.55);
    this.kickDistort.connect(outputs.kick);

    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 6,
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
    }).connect(this.kickDistort);

    this.snareDistort = new Tone.Distortion(0.4);
    this.snareDistort.connect(outputs.snare);
    this.snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    }).connect(this.snareDistort);

    this.hiHat = new Tone.MetalSynth({
      frequency: 620,
      envelope: { attack: 0.001, decay: 0.025, release: 0.008 },
      harmonicity: 8,
      modulationIndex: 48,
      resonance: 8000,
      octaves: 1.5,
    }).connect(outputs.hiHat);
  }

  playKick(now: number): void {
    this.kick.triggerAttackRelease("C1", 0.08, now, 0.9);
  }

  playSnare(now: number): void {
    this.snare.triggerAttackRelease(0.06, now, 0.65);
  }

  playHiHat(now: number): void {
    this.hiHat.triggerAttackRelease(720, 0.025, now, 0.7);
  }

  dispose(): void {
    disposeToneNodes([this.kick, this.kickDistort, this.snare, this.snareDistort, this.hiHat]);
  }
}

export function createGlitchSoundBank(outputs: MixerOutputs): SoundBank {
  return {
    id: "glitch",
    label: "Glitch & Cyberpunk",
    pendulum: new GlitchPendulumVoice(outputs),
    ball: new GlitchBallVoice(outputs),
    dispose() {
      this.pendulum.dispose();
      this.ball.dispose();
    },
  };
}
