export const SOUND_BANK_LABELS = {
    techno: "Classic Techno",
    ambient: "Ambient Drone",
    glitch: "Glitch & Cyberpunk",
    original: "Original",
};
export const SOUND_BANK_ORDER = ["techno", "ambient", "glitch", "original"];
export const SOUND_BANK_STORAGE_KEY = "pendel-sound-bank";
export function parseSoundBankId(value) {
    if (value === "techno" || value === "ambient" || value === "glitch" || value === "original") {
        return value;
    }
    return "original";
}
export function disposeToneNodes(nodes) {
    for (const node of nodes) {
        if (!node)
            continue;
        try {
            node.dispose();
        }
        catch {
            // Bereits freigegeben.
        }
    }
}
