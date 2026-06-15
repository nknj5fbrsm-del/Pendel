import { createAudioBundle } from "./bundle/factory.js";
import { isClassicBundle, parseAudioBundleId, } from "./bundle/types.js";
import { DynamicsEventTracker } from "./physics-events.js";
import { AudioMixer } from "./mixer.js";
export { parseAudioBundleId };
export { AUDIO_BUNDLE_DESCRIPTIONS, AUDIO_BUNDLE_LABELS, AUDIO_BUNDLE_ORDER, AUDIO_BUNDLE_STORAGE_KEY, } from "./bundle/types.js";
export class AudioEngine {
    constructor(bundleId = "classic", soundBankId = "original", uiTarget) {
        this.mixer = new AudioMixer();
        this.dynamicsTracker = new DynamicsEventTracker();
        this.uiTarget = uiTarget ?? {
            setMixerLevel: (channel, level) => this.setMixerLevel(channel, level),
            setReverbWet: (level) => this.setReverbWet(level),
        };
        this.bundle = createAudioBundle(bundleId, this.mixer, { soundBankId });
        this.applyBundlePresets();
    }
    getBundleId() {
        return this.bundle.id;
    }
    getSoundBankId() {
        return isClassicBundle(this.bundle) ? this.bundle.getSoundBankId() : null;
    }
    setBundle(id, soundBankId) {
        if (id === this.bundle.id && id === "classic" && soundBankId === undefined)
            return;
        if (id === this.bundle.id && id !== "classic")
            return;
        this.bundle.dispose();
        const options = id === "classic" ? { soundBankId: soundBankId ?? this.getSoundBankId() ?? "original" } : {};
        this.bundle = createAudioBundle(id, this.mixer, options);
        this.dynamicsTracker.reset();
        this.applyBundlePresets();
        this.resetTriggers();
    }
    setSoundBank(id) {
        if (!isClassicBundle(this.bundle))
            return;
        this.bundle.setSoundBank(id);
        this.resetTriggers();
    }
    setMixerLevel(channel, level) {
        this.mixer.setLevel(channel, level);
    }
    setReverbWet(level) {
        this.mixer.setReverbWet(level);
    }
    setDelayWet(channel, level) {
        this.mixer.setDelayWet(channel, level);
    }
    resetTriggers() {
        this.dynamicsTracker.reset();
        this.bundle.reset();
    }
    detectDynamics(now, prevState, stepState, prevGeom, nextGeom, kineticEnergy) {
        return this.dynamicsTracker.detect(now, prevState, stepState, prevGeom, nextGeom, kineticEnergy);
    }
    onDynamics(now, events, snap) {
        return this.bundle.onDynamics(now, events, snap);
    }
    onBallCollisions(now, events, snap) {
        this.bundle.onBallCollisions(now, events, snap);
    }
    onFrame(now, snap) {
        this.bundle.onFrame?.(now, snap);
    }
    applyBundlePresets() {
        this.bundle.applyUiPresets?.(this.uiTarget);
    }
}
