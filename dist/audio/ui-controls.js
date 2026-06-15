import { SOUND_BANK_LABELS, SOUND_BANK_ORDER } from "./types.js";
export function updateFaderVisual(input, readout, text) {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    const span = max - min || 1;
    const pct = ((value - min) / span) * 100;
    input.style.setProperty("--fader-pct", `${pct}%`);
    if (readout)
        readout.textContent = text;
}
export function faderReadout(input) {
    return input.closest(".fader")?.querySelector(".fader-readout") ?? null;
}
export class MixerController {
    constructor(setLevel, root) {
        this.setLevel = setLevel;
        root.querySelectorAll("[data-mixer]").forEach((input) => {
            const channel = input.dataset.mixer;
            const apply = () => {
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
    constructor(setReverb, setDelay, root) {
        this.setReverb = setReverb;
        this.setDelay = setDelay;
        const reverbInput = root.querySelector('[data-effect="reverb"]');
        if (reverbInput) {
            const applyReverb = () => {
                const percent = Number(reverbInput.value);
                updateFaderVisual(reverbInput, faderReadout(reverbInput), String(percent));
                this.setReverb(percent / 100);
            };
            reverbInput.addEventListener("input", applyReverb);
            applyReverb();
        }
        root.querySelectorAll("[data-delay]").forEach((input) => {
            const channel = input.dataset.delay;
            const apply = () => {
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
    constructor(onSelect, root, initialId) {
        this.onSelect = onSelect;
        root.querySelectorAll("[data-sound-bank]").forEach((button) => {
            const id = button.dataset.soundBank;
            button.textContent = SOUND_BANK_LABELS[id] ?? id;
            button.classList.toggle("active", id === initialId);
            button.addEventListener("click", () => {
                root.querySelectorAll("[data-sound-bank]").forEach((b) => {
                    b.classList.toggle("active", b === button);
                });
                this.onSelect(id);
            });
        });
    }
    static renderButtons(container) {
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
