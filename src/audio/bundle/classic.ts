import { createSoundBank } from "../factory.js";
import type { ExtendedDynamicsEvents } from "../physics-events.js";
import type { SimulationSnapshot } from "../simulation-snapshot.js";
import type { BallCollisionEvents, SoundBank, SoundBankId } from "../types.js";
import type {
  AudioBundle,
  BundleContext,
  ClassicAudioBundle,
  SoundFlash,
  UiPresetTarget,
} from "./types.js";

export class ClassicBundle implements ClassicAudioBundle {
  readonly id = "classic" as const;
  readonly label = "Classic";
  readonly description =
    "Event-basiert wie bisher — 4 Soundbanks, Crossings & Flugkugel-Drums.";

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

  constructor(private readonly ctx: BundleContext) {
    const bankId = ctx.options.soundBankId ?? "original";
    this.bank = createSoundBank(bankId, ctx.mixer);
    this.bank.applyMixerPresets?.(ctx.mixer);
  }

  getSoundBankId(): SoundBankId {
    return this.bank.id;
  }

  setSoundBank(id: SoundBankId): void {
    if (id === this.bank.id) return;
    this.bank.dispose();
    this.bank = createSoundBank(id, this.ctx.mixer);
    this.bank.applyMixerPresets?.(this.ctx.mixer);
    this.resetTriggerState();
  }

  applyUiPresets(_target: UiPresetTarget): void {
    this.bank.applyMixerPresets?.(this.ctx.mixer);
  }

  onDynamics(now: number, events: ExtendedDynamicsEvents, _snap: SimulationSnapshot): SoundFlash {
    const flash: SoundFlash = { bob1: false, bob2: false };

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

  onBallCollisions(now: number, events: BallCollisionEvents, _snap: SimulationSnapshot): void {
    if (events.wallHit) this.bank.ball.playKick(now);
    if (events.bobHit) this.bank.ball.playSnare(now);
    if (events.lineCross) this.bank.ball.playHiHat(now);
  }

  reset(): void {
    this.resetTriggerState();
    this.bank.pendulum.reset();
  }

  dispose(): void {
    this.bank.dispose();
  }

  private resetTriggerState(): void {
    this.bob1CrossAt = -1;
    this.bob1FlipAt = -1;
    this.bob2CrossAt = -1;
    this.bob2FlipAt = -1;
    this.lastClickBob1 = 0;
    this.lastMelodyBob1Time = 0;
    this.lastMelodyBob2Time = 0;
  }

  private pairedWithinWindow(crossAt: number, flipAt: number, now: number): boolean {
    if (crossAt < 0 || flipAt < 0) return false;
    if (now - crossAt > this.pairWindow || now - flipAt > this.pairWindow) return false;
    return Math.abs(crossAt - flipAt) <= this.pairWindow;
  }
}

export function createClassicBundle(ctx: BundleContext): AudioBundle {
  return new ClassicBundle(ctx);
}
