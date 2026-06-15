import type { ExtendedDynamicsEvents } from "../physics-events.js";
import type { SimulationSnapshot } from "../simulation-snapshot.js";
import type { BallCollisionEvents } from "../types.js";
import { disposeToneNodes } from "../types.js";
import { jitterSeconds } from "./helpers.js";
import type { AudioBundle, BundleContext, SoundFlash, UiPresetTarget } from "./types.js";
import { AUDIO_BUNDLE_DESCRIPTIONS, AUDIO_BUNDLE_LABELS } from "./types.js";

type GrainVoice = {
  synth: any;
  filter: any;
  baseFreq: number;
};

export class GranularBundle implements AudioBundle {
  readonly id = "granular" as const;
  readonly label = AUDIO_BUNDLE_LABELS.granular;
  readonly description = AUDIO_BUNDLE_DESCRIPTIONS.granular;

  private readonly grainBlue: GrainVoice;
  private readonly grainPink: GrainVoice;
  private readonly grainClick: GrainVoice;
  private readonly grainKick: GrainVoice;
  private readonly grainSnare: GrainVoice;
  private readonly grainHat: GrainVoice;
  private readonly nodes: Array<{ dispose(): void }> = [];

  private lastMelodyBob1 = 0;
  private lastMelodyBob2 = 0;
  private lastClick = 0;
  private bob1CrossAt = -1;
  private bob1FlipAt = -1;
  private readonly melodyCooldown = 0.09;
  private readonly clickCooldown = 0.03;
  private readonly pairWindow = 0.22;

  constructor(ctx: BundleContext) {
    const makeGrain = (output: any, filterFreq: number): GrainVoice => {
      const filter = new Tone.Filter(filterFreq, "bandpass");
      filter.Q.value = 2.2;
      const synth = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.002, decay: 0.07, sustain: 0, release: 0.05 },
      });
      synth.connect(filter);
      filter.connect(output);
      this.nodes.push(filter, synth);
      return { synth, filter, baseFreq: filterFreq };
    };

    this.grainBlue = makeGrain(ctx.mixer.output("melodyBlue"), 1400);
    this.grainPink = makeGrain(ctx.mixer.output("melodyPink"), 900);
    this.grainClick = makeGrain(ctx.mixer.output("click"), 2200);
    this.grainKick = makeGrain(ctx.mixer.output("kick"), 220);
    this.grainSnare = makeGrain(ctx.mixer.output("snare"), 2800);
    this.grainHat = makeGrain(ctx.mixer.output("hiHat"), 5200);
  }

  applyUiPresets(target: UiPresetTarget): void {
    target.setReverbWet(0.52);
    target.setMixerLevel("melodyBlue", 0.75);
    target.setMixerLevel("melodyPink", 0.72);
    target.setMixerLevel("click", 0.65);
    target.setMixerLevel("kick", 0.8);
    target.setMixerLevel("snare", 0.7);
    target.setMixerLevel("hiHat", 0.68);
  }

  onDynamics(now: number, events: ExtendedDynamicsEvents, snap: SimulationSnapshot): SoundFlash {
    const flash: SoundFlash = { bob1: false, bob2: false };
    if (events.bob1Cross) this.bob1CrossAt = now;
    if (events.omega1Flip) this.bob1FlipAt = now;

    if (events.bob1Cross && now - this.lastMelodyBob1 > this.melodyCooldown) {
      this.fireGrain(this.grainBlue, now, 0.04 + snap.totalSpeed * 0.008, 0.55);
      this.lastMelodyBob1 = now;
      flash.bob1 = true;
    }

    if (
      this.pairedWithinWindow(this.bob1CrossAt, this.bob1FlipAt, now) &&
      now - this.lastClick > this.clickCooldown
    ) {
      this.fireGrain(this.grainClick, now + jitterSeconds(4), 0.03, 0.62);
      this.lastClick = now;
      this.bob1CrossAt = -1;
      this.bob1FlipAt = -1;
      flash.bob1 = true;
    }

    if (events.bob2Cross && now - this.lastMelodyBob2 > this.melodyCooldown) {
      this.fireGrain(this.grainPink, now, 0.05 + snap.totalSpeed * 0.01, 0.52);
      this.lastMelodyBob2 = now;
      flash.bob2 = true;
    }

    return flash;
  }

  onBallCollisions(now: number, events: BallCollisionEvents, snap: SimulationSnapshot): void {
    const v = snap.ballSpeed / 280;
    if (events.wallHit) this.fireGrain(this.grainKick, now, 0.1 + v * 0.05, 0.68);
    if (events.bobHit) this.fireGrain(this.grainSnare, now, 0.04 + v * 0.025, 0.58);
    if (events.lineCross) this.fireGrain(this.grainHat, now, 0.022, 0.42 + v * 0.22);
  }

  reset(): void {
    this.bob1CrossAt = -1;
    this.bob1FlipAt = -1;
    this.lastMelodyBob1 = 0;
    this.lastMelodyBob2 = 0;
    this.lastClick = 0;
  }

  dispose(): void {
    disposeToneNodes(this.nodes);
  }

  private fireGrain(grain: GrainVoice, now: number, duration: number, velocity: number): void {
    grain.filter.frequency.value = grain.baseFreq * (0.88 + Math.random() * 0.28);
    grain.synth.triggerAttackRelease(duration, now, Math.min(1, velocity));
  }

  private pairedWithinWindow(crossAt: number, flipAt: number, now: number): boolean {
    if (crossAt < 0 || flipAt < 0) return false;
    if (now - crossAt > this.pairWindow || now - flipAt > this.pairWindow) return false;
    return Math.abs(crossAt - flipAt) <= this.pairWindow;
  }
}

export function createGranularBundle(ctx: BundleContext): AudioBundle {
  return new GranularBundle(ctx);
}
