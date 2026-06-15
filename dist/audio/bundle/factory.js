import { createClassicBundle } from "./classic.js";
import { createContinuousBundle } from "./continuous.js";
import { createExtendedBundle } from "./extended.js";
import { createGenerativeBundle } from "./generative.js";
import { createGranularBundle } from "./granular.js";
import { createPolyphonicBundle } from "./polyphonic.js";
export function createAudioBundle(id, mixer, options = {}) {
    const ctx = { mixer, options };
    switch (id) {
        case "generative":
            return createGenerativeBundle(ctx);
        case "continuous":
            return createContinuousBundle(ctx);
        case "extended":
            return createExtendedBundle(ctx);
        case "granular":
            return createGranularBundle(ctx);
        case "polyphonic":
            return createPolyphonicBundle(ctx);
        case "classic":
        default:
            return createClassicBundle(ctx);
    }
}
