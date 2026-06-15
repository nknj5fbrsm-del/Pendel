import { createSoundBank } from "./factory.js";
import { AudioMixer } from "./mixer.js";
import type {
  BallCollisionEvents,
  DynamicsEvents,
  MixerChannelId,
  SoundBank,
  SoundBankId,
} from "./types.js";

export class AudioEngine {
  private readonly mixer = new AudioMixer();
  private bank: SoundBank;
  private lastMelodyBob1Time = 0;
  private lastMelodyBob2Time = 0;
  private lastClickBob1 = 0;
  private bob1CrossAt = -1;
  private bob1FlipAt = -1;
  private bob2CrossAt = -1;
  private bob2FlipAt = -1;
  private readonly clickCooldown = 0.04;
  private readonly melodyCooldown = 0.14;
  private readonly pairWindow = 0.25;

  constructor(bankId: SoundBankId = "original") {
    this.bank = createSoundBank(bankId, this.mixer);
    this.bank.applyMixerPresets?.(this.mixer);
  }

  getSoundBankId(): SoundBankId {
    return this.bank.id;
  }

  setSoundBank(id: SoundBankId): void {
    if (id === this.bank.id) return;
    this.bank.dispose();
    this.bank = createSoundBank(id, this.mixer);
    this.bank.applyMixerPresets?.(this.mixer);
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
    this.bob1CrossAt = -1;
    this.bob1FlipAt = -1;
    this.bob2CrossAt = -1;
    this.bob2FlipAt = -1;
    this.lastClickBob1 = 0;
    this.lastMelodyBob1Time = 0;
    this.lastMelodyBob2Time = 0;
    this.bank.pendulum.reset();
  }

  onDynamics(now: number, events: DynamicsEvents): { bob1: boolean; bob2: boolean } {
    const flash = { bob1: false, bob2: false };

    if (events.bob1Cross) this.bob1CrossAt = now;
    if (events.omega1Flip) this.bob1FlipAt = now;
    if (events.bob2Cross) this.bob2CrossAt = now;
    if (events.omega2Flip) this.bob2FlipAt = now;

    if (events.bob1Cross && now - this.lastMelodyBob1Time > this.melodyCooldown) {
      this.bank.pendulum.playMelodyBlue(now);
      this.lastMelodyBob1Time = now;
      flash.bob1 = true;
    }

    if (
      this.pairedWithinWindow(this.bob1CrossAt, this.bob1FlipAt, now) &&
      now - this.lastClickBob1 > this.clickCooldown
    ) {
      this.bank.pendulum.playClick(now);
      this.lastClickBob1 = now;
      this.bob1CrossAt = -1;
      this.bob1FlipAt = -1;
      flash.bob1 = true;
    }

    if (events.bob2Cross && now - this.lastMelodyBob2Time > this.melodyCooldown) {
      this.bank.pendulum.playMelodyPink(now);
      this.lastMelodyBob2Time = now;
      flash.bob2 = true;
    }

    return flash;
  }

  onBallCollisions(now: number, events: BallCollisionEvents): void {
    if (events.wallHit) this.bank.ball.playKick(now);
    if (events.bobHit) this.bank.ball.playSnare(now);
    if (events.lineCross) this.bank.ball.playHiHat(now);
  }

  private pairedWithinWindow(crossAt: number, flipAt: number, now: number): boolean {
    if (crossAt < 0 || flipAt < 0) return false;
    if (now - crossAt > this.pairWindow || now - flipAt > this.pairWindow) return false;
    return Math.abs(crossAt - flipAt) <= this.pairWindow;
  }
}
