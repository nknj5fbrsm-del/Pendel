import { disposeToneNodes } from "../types.js";
import { jitterSeconds } from "./helpers.js";
import { AUDIO_BUNDLE_DESCRIPTIONS, AUDIO_BUNDLE_LABELS } from "./types.js";
export class GranularBundle {
    constructor(ctx) {
        this.id = "granular";
        this.label = AUDIO_BUNDLE_LABELS.granular;
        this.description = AUDIO_BUNDLE_DESCRIPTIONS.granular;
        this.nodes = [];
        this.lastMelodyBob1 = 0;
        this.lastMelodyBob2 = 0;
        this.lastClick = 0;
        this.bob1CrossAt = -1;
        this.bob1FlipAt = -1;
        this.melodyCooldown = 0.09;
        this.clickCooldown = 0.03;
        this.pairWindow = 0.22;
        const makeGrain = (output, filterFreq) => {
            const filter = new Tone.Filter(filterFreq, "bandpass");
            filter.Q.value = 2.2;
            const synth = new Tone.NoiseSynth({
                noise: { type: "pink" },
                envelope: { attack: 0.002, decay: 0.07, sustain: 0, release: 0.05 },
            });
            synth.connect(filter);
            filter.connect(output);
            this.nodes.push(filter, synth);
            return { synth, filter, baseFreq: filterFreq };
        };
        this.grainBlue = makeGrain(ctx.mixer.output("melodyBlue"), 1400);
        this.grainPink = makeGrain(ctx.mixer.output("melodyPink"), 900);
        this.grainClick = makeGrain(ctx.mixer.output("click"), 2200);
        this.grainKick = makeGrain(ctx.mixer.output("kick"), 220);
        this.grainSnare = makeGrain(ctx.mixer.output("snare"), 2800);
        this.grainHat = makeGrain(ctx.mixer.output("hiHat"), 5200);
    }
    applyUiPresets(target) {
        target.setReverbWet(0.52);
        target.setMixerLevel("melodyBlue", 0.75);
        target.setMixerLevel("melodyPink", 0.72);
        target.setMixerLevel("click", 0.65);
        target.setMixerLevel("kick", 0.8);
        target.setMixerLevel("snare", 0.7);
        target.setMixerLevel("hiHat", 0.68);
    }
    onDynamics(now, events, snap) {
        const flash = { bob1: false, bob2: false };
        if (events.bob1Cross)
            this.bob1CrossAt = now;
        if (events.omega1Flip)
            this.bob1FlipAt = now;
        if (events.bob1Cross && now - this.lastMelodyBob1 > this.melodyCooldown) {
            this.fireGrain(this.grainBlue, now, 0.04 + snap.totalSpeed * 0.008, 0.55);
            this.lastMelodyBob1 = now;
            flash.bob1 = true;
        }
        if (this.pairedWithinWindow(this.bob1CrossAt, this.bob1FlipAt, now) &&
            now - this.lastClick > this.clickCooldown) {
            this.fireGrain(this.grainClick, now + jitterSeconds(4), 0.03, 0.62);
            this.lastClick = now;
            this.bob1CrossAt = -1;
            this.bob1FlipAt = -1;
            flash.bob1 = true;
        }
        if (events.bob2Cross && now - this.lastMelodyBob2 > this.melodyCooldown) {
            this.fireGrain(this.grainPink, now, 0.05 + snap.totalSpeed * 0.01, 0.52);
            this.lastMelodyBob2 = now;
            flash.bob2 = true;
        }
        return flash;
    }
    onBallCollisions(now, events, snap) {
        const v = snap.ballSpeed / 280;
        if (events.wallHit)
            this.fireGrain(this.grainKick, now, 0.1 + v * 0.05, 0.68);
        if (events.bobHit)
            this.fireGrain(this.grainSnare, now, 0.04 + v * 0.025, 0.58);
        if (events.lineCross)
            this.fireGrain(this.grainHat, now, 0.022, 0.42 + v * 0.22);
    }
    reset() {
        this.bob1CrossAt = -1;
        this.bob1FlipAt = -1;
        this.lastMelodyBob1 = 0;
        this.lastMelodyBob2 = 0;
        this.lastClick = 0;
    }
    dispose() {
        disposeToneNodes(this.nodes);
    }
    fireGrain(grain, now, duration, velocity) {
        grain.filter.frequency.value = grain.baseFreq * (0.88 + Math.random() * 0.28);
        grain.synth.triggerAttackRelease(duration, now, Math.min(1, velocity));
    }
    pairedWithinWindow(crossAt, flipAt, now) {
        if (crossAt < 0 || flipAt < 0)
            return false;
        if (now - crossAt > this.pairWindow || now - flipAt > this.pairWindow)
            return false;
        return Math.abs(crossAt - flipAt) <= this.pairWindow;
    }
}
export function createGranularBundle(ctx) {
    return new GranularBundle(ctx);
}
