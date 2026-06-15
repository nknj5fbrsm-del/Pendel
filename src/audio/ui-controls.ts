import type { AudioBundleId } from "./bundle/types.js";
import { AUDIO_BUNDLE_DESCRIPTIONS, AUDIO_BUNDLE_LABELS, AUDIO_BUNDLE_ORDER } from "./bundle/types.js";
import type { MixerChannelId, SoundBankId } from "./types.js";
import { SOUND_BANK_LABELS, SOUND_BANK_ORDER } from "./types.js";

export function updateFaderVisual(input: HTMLInputElement, readout: Element | null, text: string): void {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const span = max - min || 1;
  const pct = ((value - min) / span) * 100;
  input.style.setProperty("--fader-pct", `${pct}%`);
  if (readout) readout.textContent = text;
}

export function faderReadout(input: HTMLInputElement): Element | null {
  return input.closest(".fader")?.querySelector(".fader-readout") ?? null;
}

export class MixerController {
  constructor(
    private readonly setLevel: (channel: MixerChannelId, level: number) => void,
    root: HTMLElement,
  ) {
    root.querySelectorAll<HTMLInputElement>("[data-mixer]").forEach((input) => {
      const channel = input.dataset.mixer as MixerChannelId;

      const apply = (): void => {
        const percent = Number(input.value);
        updateFaderVisual(input, faderReadout(input), String(percent));
        this.setLevel(channel, percent / 100);
      };

      input.addEventListener("input", apply);
      apply();
    });
  }
}

export class EffectsController {
  constructor(
    private readonly setReverb: (level: number) => void,
    private readonly setDelay: (channel: MixerChannelId, level: number) => void,
    root: HTMLElement,
  ) {
    const reverbInput = root.querySelector<HTMLInputElement>('[data-effect="reverb"]');

    if (reverbInput) {
      const applyReverb = (): void => {
        const percent = Number(reverbInput.value);
        updateFaderVisual(reverbInput, faderReadout(reverbInput), String(percent));
        this.setReverb(percent / 100);
      };
      reverbInput.addEventListener("input", applyReverb);
      applyReverb();
    }

    root.querySelectorAll<HTMLInputElement>("[data-delay]").forEach((input) => {
      const channel = input.dataset.delay as MixerChannelId;

      const apply = (): void => {
        const percent = Number(input.value);
        updateFaderVisual(input, faderReadout(input), String(percent));
        this.setDelay(channel, percent / 100);
      };

      input.addEventListener("input", apply);
      apply();
    });
  }
}

export class SoundBankController {
  constructor(
    private readonly onSelect: (id: SoundBankId) => void,
    root: HTMLElement,
    initialId: SoundBankId,
  ) {
    root.querySelectorAll<HTMLButtonElement>("[data-sound-bank]").forEach((button) => {
      const id = button.dataset.soundBank as SoundBankId;
      button.textContent = SOUND_BANK_LABELS[id] ?? id;
      button.classList.toggle("active", id === initialId);
      button.addEventListener("click", () => {
        root.querySelectorAll<HTMLButtonElement>("[data-sound-bank]").forEach((b) => {
          b.classList.toggle("active", b === button);
        });
        this.onSelect(id);
      });
    });
  }

  static renderButtons(container: HTMLElement): void {
    container.innerHTML = "";
    for (const id of SOUND_BANK_ORDER) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bank-chip";
      button.dataset.soundBank = id;
      button.textContent = SOUND_BANK_LABELS[id];
      container.appendChild(button);
    }
  }
}

function syncFaderInput(input: HTMLInputElement | null, percent: number): void {
  if (!input) return;
  input.value = String(percent);
  updateFaderVisual(input, faderReadout(input), String(percent));
}

export class BundleController {
  constructor(
    private readonly onSelect: (id: AudioBundleId) => void,
    private readonly bundleRoot: HTMLElement,
    descriptionEl: HTMLElement | null,
    initialId: AudioBundleId,
  ) {
    this.updateDescription(descriptionEl, initialId);

    this.bundleRoot.querySelectorAll<HTMLButtonElement>("[data-audio-bundle]").forEach((button) => {
      const id = button.dataset.audioBundle as AudioBundleId;
      button.textContent = AUDIO_BUNDLE_LABELS[id] ?? id;
      button.classList.toggle("active", id === initialId);
      button.addEventListener("click", () => {
        this.bundleRoot.querySelectorAll<HTMLButtonElement>("[data-audio-bundle]").forEach((b) => {
          b.classList.toggle("active", b === button);
        });
        this.updateDescription(descriptionEl, id);
        this.onSelect(id);
      });
    });
  }

  static renderButtons(container: HTMLElement): void {
    container.innerHTML = "";
    for (const id of AUDIO_BUNDLE_ORDER) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bank-chip";
      button.dataset.audioBundle = id;
      button.textContent = AUDIO_BUNDLE_LABELS[id];
      container.appendChild(button);
    }
  }

  private updateDescription(el: HTMLElement | null, id: AudioBundleId): void {
    if (el) el.textContent = AUDIO_BUNDLE_DESCRIPTIONS[id] ?? "";
  }
}

export function syncMixerFaderDom(root: HTMLElement, channel: MixerChannelId, level: number): void {
  syncFaderInput(root.querySelector<HTMLInputElement>(`[data-mixer="${channel}"]`), Math.round(level * 100));
}

export function syncReverbFaderDom(root: HTMLElement, level: number): void {
  syncFaderInput(root.querySelector<HTMLInputElement>('[data-effect="reverb"]'), Math.round(level * 100));
}
