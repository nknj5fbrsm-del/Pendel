import type { AudioMixer } from "../mixer.js";
import type { ExtendedDynamicsEvents } from "../physics-events.js";
import type { SimulationSnapshot } from "../simulation-snapshot.js";
import type { BallCollisionEvents, MixerChannelId, SoundBankId } from "../types.js";

export type AudioBundleId =
  | "classic"
  | "generative"
  | "continuous"
  | "extended"
  | "granular"
  | "polyphonic";

export type SoundFlash = { bob1: boolean; bob2: boolean };

export type UiPresetTarget = {
  setMixerLevel(channel: MixerChannelId, level: number): void;
  setReverbWet(level: number): void;
};

export interface AudioBundle {
  readonly id: AudioBundleId;
  readonly label: string;
  readonly description: string;

  applyUiPresets?(target: UiPresetTarget): void;

  onDynamics(
    now: number,
    events: ExtendedDynamicsEvents,
    snap: SimulationSnapshot,
  ): SoundFlash;

  onBallCollisions(
    now: number,
    events: BallCollisionEvents,
    snap: SimulationSnapshot,
  ): void;

  onFrame?(now: number, snap: SimulationSnapshot): void;

  reset(): void;
  dispose(): void;
}

export interface ClassicAudioBundle extends AudioBundle {
  readonly id: "classic";
  getSoundBankId(): SoundBankId;
  setSoundBank(id: SoundBankId): void;
}

export type BundleFactoryOptions = {
  soundBankId?: SoundBankId;
};

export const AUDIO_BUNDLE_LABELS: Record<AudioBundleId, string> = {
  classic: "Classic",
  generative: "Generative",
  continuous: "Continuous Drone",
  extended: "Extended Physics",
  granular: "Granular",
  polyphonic: "Polyphonic Chaos",
};

export const AUDIO_BUNDLE_DESCRIPTIONS: Record<AudioBundleId, string> = {
  classic: "Event-basiert wie bisher — 4 Soundbanks, Crossings & Flugkugel-Drums.",
  generative: "Markov-Melodien, stochastische Drums & Micro-Timing-Jitter.",
  continuous: "Dauer-Drone moduliert durch Winkel & Energie — weniger One-Shots.",
  extended: "Zusätzliche Physik-Trigger: Energie-Sprünge, Nahe-Kollision, Peaks.",
  granular: "Kurze Grain-Bursts & verzerrte Texturen bei jedem Event.",
  polyphonic: "Euklidische Polymeter — Pendel & Kugel in verschiedenen Taktzyklen.",
};

export const AUDIO_BUNDLE_ORDER: AudioBundleId[] = [
  "classic",
  "generative",
  "continuous",
  "extended",
  "granular",
  "polyphonic",
];

export const AUDIO_BUNDLE_STORAGE_KEY = "pendel-audio-bundle";

export function parseAudioBundleId(value: string | null): AudioBundleId {
  if (
    value === "classic" ||
    value === "generative" ||
    value === "continuous" ||
    value === "extended" ||
    value === "granular" ||
    value === "polyphonic"
  ) {
    return value;
  }
  return "classic";
}

export function isClassicBundle(bundle: AudioBundle): bundle is ClassicAudioBundle {
  return bundle.id === "classic";
}

export type BundleContext = {
  mixer: AudioMixer;
  options: BundleFactoryOptions;
};
