import { BRIGHT_MELODY_SCALE, WARM_MELODY_SCALE } from "../scales.js";
import { ScaleMelodyPlayer, makeMonoVoice } from "../scale-melody-player.js";
import type { ExtendedDynamicsEvents } from "../physics-events.js";
import type { SimulationSnapshot } from "../simulation-snapshot.js";
import type { BallCollisionEvents } from "../types.js";
import { disposeToneNodes } from "../types.js";
import { euclideanHit } from "./helpers.js";
import type { AudioBundle, BundleContext, SoundFlash, UiPresetTarget } from "./types.js";
import { AUDIO_BUNDLE_DESCRIPTIONS, AUDIO_BUNDLE_LABELS } from "./types.js";

export class PolyphonicBundle implements AudioBundle {
  readonly id = "polyphonic" as const;
  readonly label = AUDIO_BUNDLE_LABELS.polyphonic;
  readonly description = AUDIO_BUNDLE_DESCRIPTIONS.polyphonic;

  private readonly blue: ScaleMelodyPlayer;
  private readonly pink: ScaleMelodyPlayer;
  private readonly kick: any;
  private readonly snare: any;
  private readonly hiHat: any;
  private readonly click: any;
  private readonly nodes: Array<{ dispose(): void }> = [];

  private stepBob1 = 0;
  private stepBob2 = 0;
  private stepBall = 0;
  private lastMelodyBob1 = 0;
  private lastMelodyBob2 = 0;
  private readonly melodyCooldown = 0.12;

  constructor(ctx: BundleContext) {
    const blueOut = ctx.mixer.output("melodyBlue");
    const pinkOut = ctx.mixer.output("melodyPink");
    const clickOut = ctx.mixer.output("click");
    const kickOut = ctx.mixer.output("kick");
    const snareOut = ctx.mixer.output("snare");
    const hiHatOut = ctx.mixer.output("hiHat");

    const blueNodes: any[] = [];
    const pinkNodes: any[] = [];
    this.blue = new ScaleMelodyPlayer(
      BRIGHT_MELODY_SCALE,
      [
        makeMonoVoice(
          blueOut,
          {
            oscillator: { type: "sawtooth" },
            filter: { Q: 1.2, type: "lowpass", rolloff: -24 },
            envelope: { attack: 0.003, decay: 0.14, sustain: 0.06, release: 0.1 },
            filterEnvelope: {
              attack: 0.002,
              decay: 0.1,
              sustain: 0.02,
              release: 0.08,
              baseFrequency: 350,
              octaves: 2.5,
            },
          },
          blueNodes,
        ),
      ],
      [0.07, 0.24],
      [0.32, 0.68],
    );
    for (const n of blueNodes) this.blue.registerNode(n);

    this.pink = new ScaleMelodyPlayer(
      WARM_MELODY_SCALE,
      [
        makeMonoVoice(
          pinkOut,
          {
            oscillator: { type: "triangle" },
            filter: { Q: 1.5, type: "lowpass", rolloff: -12 },
            envelope: { attack: 0.004, decay: 0.18, sustain: 0.05, release: 0.12 },
            filterEnvelope: {
              attack: 0.003,
              decay: 0.12,
              sustain: 0.02,
              release: 0.1,
              baseFrequency: 200,
              octaves: 2.2,
            },
          },
          pinkNodes,
        ),
      ],
      [0.08, 0.3],
      [0.28, 0.62],
    );
    for (const n of pinkNodes) this.pink.registerNode(n);

    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4.5,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.08 },
    }).connect(kickOut);
    this.snare = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    }).connect(snareOut);
    this.hiHat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.02, release: 0.01 },
      harmonicity: 10,
      modulationIndex: 35,
      resonance: 4800,
      octaves: 0.6,
    }).connect(hiHatOut);
    this.click = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.015 },
    }).connect(clickOut);
    this.nodes.push(this.kick, this.snare, this.hiHat, this.click);
  }

  applyUiPresets(target: UiPresetTarget): void {
    target.setReverbWet(0.4);
    target.setMixerLevel("melodyBlue", 0.7);
    target.setMixerLevel("melodyPink", 0.7);
    target.setMixerLevel("click", 0.6);
    target.setMixerLevel("kick", 0.85);
    target.setMixerLevel("snare", 0.72);
    target.setMixerLevel("hiHat", 0.68);
  }

  onDynamics(now: number, events: ExtendedDynamicsEvents, _snap: SimulationSnapshot): SoundFlash {
    const flash: SoundFlash = { bob1: false, bob2: false };

    if (events.bob1Cross) {
      this.stepBob1 += 1;
      if (euclideanHit(3, 7, this.stepBob1) && now - this.lastMelodyBob1 > this.melodyCooldown) {
        this.blue.play(now);
        this.lastMelodyBob1 = now;
        flash.bob1 = true;
      }
      if (euclideanHit(2, 5, this.stepBob1)) {
        this.click.triggerAttackRelease("C5", "32n", now, 0.32);
      }
    }

    if (events.bob2Cross) {
      this.stepBob2 += 1;
      if (euclideanHit(4, 9, this.stepBob2) && now - this.lastMelodyBob2 > this.melodyCooldown) {
        this.pink.play(now);
        this.lastMelodyBob2 = now;
        flash.bob2 = true;
      }
      if (euclideanHit(3, 8, this.stepBob2)) {
        this.snare.triggerAttackRelease("16n", now, 0.38);
      }
    }

    return flash;
  }

  onBallCollisions(now: number, events: BallCollisionEvents, _snap: SimulationSnapshot): void {
    if (events.wallHit || events.bobHit || events.lineCross) {
      this.stepBall += 1;
    }
    if (events.wallHit && euclideanHit(5, 13, this.stepBall)) {
      this.kick.triggerAttackRelease("C1", "8n", now, 0.72);
    }
    if (events.bobHit && euclideanHit(2, 11, this.stepBall)) {
      this.snare.triggerAttackRelease("16n", now, 0.48);
    }
    if (events.lineCross && euclideanHit(7, 16, this.stepBall)) {
      this.hiHat.triggerAttackRelease("32n", now, 0.32);
    }
  }

  reset(): void {
    this.blue.reset();
    this.pink.reset();
    this.stepBob1 = 0;
    this.stepBob2 = 0;
    this.stepBall = 0;
    this.lastMelodyBob1 = 0;
    this.lastMelodyBob2 = 0;
  }

  dispose(): void {
    this.blue.dispose();
    this.pink.dispose();
    disposeToneNodes(this.nodes);
  }
}

export function createPolyphonicBundle(ctx: BundleContext): AudioBundle {
  return new PolyphonicBundle(ctx);
}
