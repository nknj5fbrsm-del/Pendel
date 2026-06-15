import { disposeToneNodes } from "../types.js";
import { AUDIO_BUNDLE_DESCRIPTIONS, AUDIO_BUNDLE_LABELS } from "./types.js";
export class ContinuousBundle {
    constructor(ctx) {
        this.id = "continuous";
        this.label = AUDIO_BUNDLE_LABELS.continuous;
        this.description = AUDIO_BUNDLE_DESCRIPTIONS.continuous;
        this.nodes = [];
        this.started = false;
        this.lastAccent = 0;
        const blueOut = ctx.mixer.output("melodyBlue");
        const pinkOut = ctx.mixer.output("melodyPink");
        const clickOut = ctx.mixer.output("click");
        const kickOut = ctx.mixer.output("kick");
        this.blueDrone = new Tone.FMSynth({
            harmonicity: 2.01,
            modulationIndex: 8,
            oscillator: { type: "sine" },
            envelope: { attack: 2.5, decay: 0.3, sustain: 0.85, release: 3.5 },
            modulation: { type: "triangle" },
            modulationEnvelope: { attack: 1.2, decay: 0.2, sustain: 0.6, release: 2 },
        }).connect(blueOut);
        this.pinkDrone = new Tone.FMSynth({
            harmonicity: 1.5,
            modulationIndex: 5,
            oscillator: { type: "sine" },
            envelope: { attack: 3, decay: 0.4, sustain: 0.9, release: 4 },
            modulation: { type: "sine" },
            modulationEnvelope: { attack: 1.8, decay: 0.3, sustain: 0.7, release: 2.5 },
        }).connect(pinkOut);
        this.sub = new Tone.Synth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.8, decay: 0.2, sustain: 0.75, release: 2.5 },
        }).connect(kickOut);
        this.click = new Tone.Synth({
            oscillator: { type: "triangle" },
            envelope: { attack: 0.02, decay: 0.35, sustain: 0.1, release: 0.6 },
        }).connect(clickOut);
        this.nodes.push(this.blueDrone, this.pinkDrone, this.sub, this.click);
    }
    applyUiPresets(target) {
        target.setReverbWet(0.62);
        target.setMixerLevel("melodyBlue", 0.55);
        target.setMixerLevel("melodyPink", 0.5);
        target.setMixerLevel("click", 0.35);
        target.setMixerLevel("kick", 0.45);
        target.setMixerLevel("snare", 0.15);
        target.setMixerLevel("hiHat", 0.12);
    }
    onDynamics(now, events, snap) {
        const flash = { bob1: false, bob2: false };
        if (events.bob1Cross && now - this.lastAccent > 0.35) {
            this.click.triggerAttackRelease("A4", "4n", now, 0.22);
            this.lastAccent = now;
            flash.bob1 = true;
        }
        if (events.bob2Cross && now - this.lastAccent > 0.35) {
            this.click.triggerAttackRelease("E4", "4n", now, 0.18);
            this.lastAccent = now;
            flash.bob2 = true;
        }
        return flash;
    }
    onBallCollisions(_now, _events, _snap) {
        // Kontinuierliches Bundle — Kugel nur über onFrame.
    }
    onFrame(now, snap) {
        if (!this.started && !snap.isStill) {
            this.blueDrone.triggerAttack("A2", now);
            this.pinkDrone.triggerAttack("D2", now);
            this.sub.triggerAttack("A1", now);
            this.started = true;
        }
        if (snap.isStill) {
            if (this.started) {
                this.blueDrone.triggerRelease(now + 0.05);
                this.pinkDrone.triggerRelease(now + 0.05);
                this.sub.triggerRelease(now + 0.05);
                this.started = false;
            }
            return;
        }
        const energyNorm = Math.min(1, snap.kineticEnergy / 12);
        const blueFreq = 110 + Math.abs(Math.sin(snap.theta1)) * 180 + snap.totalSpeed * 18;
        const pinkFreq = 73 + Math.abs(Math.cos(snap.theta2)) * 120 + snap.totalSpeed * 12;
        this.blueDrone.frequency.rampTo(blueFreq, 0.08);
        this.pinkDrone.frequency.rampTo(pinkFreq, 0.1);
        this.sub.frequency.rampTo(55 + energyNorm * 30, 0.12);
        const modIndex = 4 + snap.totalSpeed * 2.5;
        this.blueDrone.modulationIndex.rampTo(modIndex, 0.1);
        this.pinkDrone.modulationIndex.rampTo(modIndex * 0.75, 0.1);
    }
    reset() {
        if (this.started) {
            const now = Tone.now();
            this.blueDrone.triggerRelease(now);
            this.pinkDrone.triggerRelease(now);
            this.sub.triggerRelease(now);
        }
        this.started = false;
        this.lastAccent = 0;
    }
    dispose() {
        disposeToneNodes(this.nodes);
    }
}
export function createContinuousBundle(ctx) {
    return new ContinuousBundle(ctx);
}
