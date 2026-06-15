import { createAmbientSoundBank } from "./banks/ambient.js";
import { createGlitchSoundBank } from "./banks/glitch.js";
import { createOriginalSoundBank } from "./banks/original.js";
import { createTechnoSoundBank } from "./banks/techno.js";
import type { AudioMixer } from "./mixer.js";
import type { MixerOutputs, SoundBank, SoundBankId } from "./types.js";

function mixerOutputs(mixer: AudioMixer): MixerOutputs {
  return {
    melodyBlue: mixer.output("melodyBlue"),
    melodyPink: mixer.output("melodyPink"),
    click: mixer.output("click"),
    snare: mixer.output("snare"),
    hiHat: mixer.output("hiHat"),
    kick: mixer.output("kick"),
  };
}

export function createSoundBank(id: SoundBankId, mixer: AudioMixer): SoundBank {
  const outputs = mixerOutputs(mixer);
  switch (id) {
    case "techno":
      return createTechnoSoundBank(outputs);
    case "ambient":
      return createAmbientSoundBank(outputs);
    case "glitch":
      return createGlitchSoundBank(outputs);
    case "original":
    default:
      return createOriginalSoundBank(outputs);
  }
}
