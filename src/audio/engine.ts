import { createAudioBundle } from "./bundle/factory.js";
import {
  type AudioBundle,
  type AudioBundleId,
  type UiPresetTarget,
  isClassicBundle,
  parseAudioBundleId,
} from "./bundle/types.js";
import { DynamicsEventTracker, type ExtendedDynamicsEvents } from "./physics-events.js";
import type { SimulationSnapshot } from "./simulation-snapshot.js";
import { AudioMixer } from "./mixer.js";
import type { BallCollisionEvents, MixerChannelId, SoundBankId } from "./types.js";

export { parseAudioBundleId };
export type { AudioBundleId, ExtendedDynamicsEvents, SimulationSnapshot };
export {
  AUDIO_BUNDLE_DESCRIPTIONS,
  AUDIO_BUNDLE_LABELS,
  AUDIO_BUNDLE_ORDER,
  AUDIO_BUNDLE_STORAGE_KEY,
} from "./bundle/types.js";

export class AudioEngine {
  private readonly mixer = new AudioMixer();
  private bundle: AudioBundle;
  private readonly dynamicsTracker = new DynamicsEventTracker();
  private readonly uiTarget: UiPresetTarget;

  constructor(
    bundleId: AudioBundleId = "classic",
    soundBankId: SoundBankId = "original",
    uiTarget?: UiPresetTarget,
  ) {
    this.uiTarget = uiTarget ?? {
      setMixerLevel: (channel, level) => this.setMixerLevel(channel, level),
      setReverbWet: (level) => this.setReverbWet(level),
    };
    this.bundle = createAudioBundle(bundleId, this.mixer, { soundBankId });
    this.applyBundlePresets();
  }

  getBundleId(): AudioBundleId {
    return this.bundle.id;
  }

  getSoundBankId(): SoundBankId | null {
    return isClassicBundle(this.bundle) ? this.bundle.getSoundBankId() : null;
  }

  setBundle(id: AudioBundleId, soundBankId?: SoundBankId): void {
    if (id === this.bundle.id && id === "classic" && soundBankId === undefined) return;
    if (id === this.bundle.id && id !== "classic") return;

    this.bundle.dispose();
    const options =
      id === "classic" ? { soundBankId: soundBankId ?? this.getSoundBankId() ?? "original" } : {};
    this.bundle = createAudioBundle(id, this.mixer, options);
    this.dynamicsTracker.reset();
    this.applyBundlePresets();
    this.resetTriggers();
  }

  setSoundBank(id: SoundBankId): void {
    if (!isClassicBundle(this.bundle)) return;
    this.bundle.setSoundBank(id);
    this.resetTriggers();
  }

  setMixerLevel(channel: MixerChannelId, level: number): void {
    this.mixer.setLevel(channel, level);
  }

  setReverbWet(level: number): void {
    this.mixer.setReverbWet(level);
  }

  setDelayWet(channel: MixerChannelId, level: number): void {
    this.mixer.setDelayWet(channel, level);
  }

  resetTriggers(): void {
    this.dynamicsTracker.reset();
    this.bundle.reset();
  }

  detectDynamics(
    now: number,
    prevState: { omega1: number; omega2: number; theta2: number },
    stepState: { omega1: number; omega2: number; theta2: number },
    prevGeom: { x1: number; y1: number; x2: number; y2: number },
    nextGeom: { x1: number; y1: number; x2: number; y2: number },
    kineticEnergy: number,
  ): ExtendedDynamicsEvents {
    return this.dynamicsTracker.detect(
      now,
      prevState,
      stepState,
      prevGeom,
      nextGeom,
      kineticEnergy,
    );
  }

  onDynamics(
    now: number,
    events: ExtendedDynamicsEvents,
    snap: SimulationSnapshot,
  ): { bob1: boolean; bob2: boolean } {
    return this.bundle.onDynamics(now, events, snap);
  }

  onBallCollisions(now: number, events: BallCollisionEvents, snap: SimulationSnapshot): void {
    this.bundle.onBallCollisions(now, events, snap);
  }

  onFrame(now: number, snap: SimulationSnapshot): void {
    this.bundle.onFrame?.(now, snap);
  }

  private applyBundlePresets(): void {
    this.bundle.applyUiPresets?.(this.uiTarget);
  }
}
