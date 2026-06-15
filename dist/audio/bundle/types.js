export const AUDIO_BUNDLE_LABELS = {
    classic: "Classic",
    generative: "Generative",
    continuous: "Continuous Drone",
    extended: "Extended Physics",
    granular: "Granular",
    polyphonic: "Polyphonic Chaos",
};
export const AUDIO_BUNDLE_DESCRIPTIONS = {
    classic: "Event-basiert wie bisher — 4 Soundbanks, Crossings & Flugkugel-Drums.",
    generative: "Markov-Melodien, stochastische Drums & Micro-Timing-Jitter.",
    continuous: "Dauer-Drone moduliert durch Winkel & Energie — weniger One-Shots.",
    extended: "Zusätzliche Physik-Trigger: Energie-Sprünge, Nahe-Kollision, Peaks.",
    granular: "Kurze Grain-Bursts & verzerrte Texturen bei jedem Event.",
    polyphonic: "Euklidische Polymeter — Pendel & Kugel in verschiedenen Taktzyklen.",
};
export const AUDIO_BUNDLE_ORDER = [
    "classic",
    "generative",
    "continuous",
    "extended",
    "granular",
    "polyphonic",
];
export const AUDIO_BUNDLE_STORAGE_KEY = "pendel-audio-bundle";
export function parseAudioBundleId(value) {
    if (value === "classic" ||
        value === "generative" ||
        value === "continuous" ||
        value === "extended" ||
        value === "granular" ||
        value === "polyphonic") {
        return value;
    }
    return "classic";
}
export function isClassicBundle(bundle) {
    return bundle.id === "classic";
}
