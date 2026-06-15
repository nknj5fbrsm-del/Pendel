export type MixerChannelId = "melodyBlue" | "melodyPink" | "click" | "snare" | "hiHat" | "kick";

export type SoundBankId = "techno" | "ambient" | "glitch" | "original";

export type DynamicsEvents = {
  bob1Cross: boolean;
  bob2Cross: boolean;
  omega1Flip: boolean;
  omega2Flip: boolean;
};

export type BallCollisionEvents = {
  bobHit: boolean;
  lineCross: boolean;
  wallHit: boolean;
};

export type MixerOutputs = Record<MixerChannelId, any>;

export interface PendulumVoice {
  playMelodyBlue(now: number): void;
  playMelodyPink(now: number): void;
  playClick(now: number): void;
  reset(): void;
  dispose(): void;
}

export interface BallVoice {
  playKick(now: number): void;
  playSnare(now: number): void;
  playHiHat(now: number): void;
  dispose(): void;
}

export interface SoundBank {
  readonly id: SoundBankId;
  readonly label: string;
  pendulum: PendulumVoice;
  ball: BallVoice;
  applyMixerPresets?(mixer: { setReverbWet(level: number): void }): void;
  dispose(): void;
}

export const SOUND_BANK_LABELS: Record<SoundBankId, string> = {
  techno: "Classic Techno",
  ambient: "Ambient Drone",
  glitch: "Glitch & Cyberpunk",
  original: "Original",
};

export const SOUND_BANK_ORDER: SoundBankId[] = ["techno", "ambient", "glitch", "original"];

export const SOUND_BANK_STORAGE_KEY = "pendel-sound-bank";

export function parseSoundBankId(value: string | null): SoundBankId {
  if (value === "techno" || value === "ambient" || value === "glitch" || value === "original") {
    return value;
  }
  return "original";
}

export function disposeToneNodes(nodes: Array<{ dispose(): void } | undefined>): void {
  for (const node of nodes) {
    if (!node) continue;
    try {
      node.dispose();
    } catch {
      // Bereits freigegeben.
    }
  }
}
