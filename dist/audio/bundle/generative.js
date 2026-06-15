import { BRIGHT_MELODY_SCALE, WARM_MELODY_SCALE } from "../scales.js";
import { makeMonoVoice } from "../scale-melody-player.js";
import { disposeToneNodes } from "../types.js";
import { jitterSeconds } from "./helpers.js";
import { AUDIO_BUNDLE_DESCRIPTIONS, AUDIO_BUNDLE_LABELS } from "./types.js";
class MarkovMelodyPlayer {
    constructor(scale, playNote) {
        this.scale = scale;
        this.playNote = playNote;
        this.nodes = [];
        this.index = Math.floor(scale.length / 2);
    }
    registerNode(node) {
        this.nodes.push(node);
    }
    play(now) {
        const stayNear = Math.random() < 0.72;
        if (stayNear) {
            const step = Math.random() < 0.5 ? -1 : 1;
            this.index = Math.max(0, Math.min(this.scale.length - 1, this.index + step));
        }
        else {
            this.index = Math.floor(Math.random() * this.scale.length);
        }
        const note = this.scale[this.index];
        const duration = 0.05 + Math.random() * 0.28;
        const velocity = 0.28 + Math.random() * 0.55;
        this.playNote(note, duration, now, velocity);
    }
    reset() {
        this.index = Math.floor(this.scale.length / 2);
    }
    dispose() {
        disposeToneNodes(this.nodes);
    }
}
export class GenerativeBundle {
    constructor(ctx) {
        this.id = "generative";
        this.label = AUDIO_BUNDLE_LABELS.generative;
        this.description = AUDIO_BUNDLE_DESCRIPTIONS.generative;
        this.nodes = [];
        this.lastMelodyBob1 = 0;
        this.lastMelodyBob2 = 0;
        this.lastClick = 0;
        this.bob1CrossAt = -1;
        this.bob1FlipAt = -1;
        this.melodyCooldown = 0.11;
        this.clickCooldown = 0.035;
        this.pairWindow = 0.22;
        this.frameAccum = 0;
        const blueOut = ctx.mixer.output("melodyBlue");
        const pinkOut = ctx.mixer.output("melodyPink");
        const clickOut = ctx.mixer.output("click");
        const kickOut = ctx.mixer.output("kick");
        const snareOut = ctx.mixer.output("snare");
        const hiHatOut = ctx.mixer.output("hiHat");
        const blueNodes = [];
        const pinkNodes = [];
        const blueFilter = new Tone.Filter(1200, "bandpass");
        blueFilter.connect(blueOut);
        blueNodes.push(blueFilter);
        const pinkFilter = new Tone.Filter(900, "bandpass");
        pinkFilter.connect(pinkOut);
        pinkNodes.push(pinkFilter);
        const voiceOpts = {
            oscillator: { type: "triangle" },
            filter: { Q: 2, type: "lowpass", rolloff: -12 },
            envelope: { attack: 0.004, decay: 0.2, sustain: 0.04, release: 0.14 },
            filterEnvelope: {
                attack: 0.002,
                decay: 0.12,
                sustain: 0.02,
                release: 0.08,
                baseFrequency: 220,
                octaves: 2.8,
            },
        };
        const blueVoice = makeMonoVoice(blueFilter, voiceOpts, blueNodes);
        this.blue = new MarkovMelodyPlayer(BRIGHT_MELODY_SCALE, (note, dur, t, vel) => {
            blueVoice.play(note, dur, t + jitterSeconds(), vel);
        });
        for (const n of blueNodes)
            this.blue.registerNode(n);
        const pinkVoice = makeMonoVoice(pinkFilter, { ...voiceOpts, oscillator: { type: "sine" } }, pinkNodes);
        this.pink = new MarkovMelodyPlayer(WARM_MELODY_SCALE, (note, dur, t, vel) => {
            pinkVoice.play(note, dur, t + jitterSeconds(18), vel * 0.92);
        });
        for (const n of pinkNodes)
            this.pink.registerNode(n);
        this.clickSynth = new Tone.MetalSynth({
            envelope: { attack: 0.001, decay: 0.04, release: 0.02 },
            harmonicity: 5.1,
            modulationIndex: 32,
            resonance: 4000,
            octaves: 1.2,
        }).connect(clickOut);
        this.nodes.push(this.clickSynth);
        this.kick = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 4,
            envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.08 },
        }).connect(kickOut);
        this.snare = new Tone.NoiseSynth({
            noise: { type: "pink" },
            envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.06 },
        }).connect(snareOut);
        this.hiHat = new Tone.MetalSynth({
            envelope: { attack: 0.001, decay: 0.025, release: 0.01 },
            harmonicity: 12,
            modulationIndex: 40,
            resonance: 5000,
            octaves: 0.5,
        }).connect(hiHatOut);
        this.nodes.push(this.kick, this.snare, this.hiHat);
    }
    applyUiPresets(target) {
        target.setReverbWet(0.38);
        target.setMixerLevel("melodyBlue", 0.72);
        target.setMixerLevel("melodyPink", 0.68);
        target.setMixerLevel("click", 0.55);
        target.setMixerLevel("kick", 0.78);
        target.setMixerLevel("snare", 0.62);
        target.setMixerLevel("hiHat", 0.58);
    }
    onDynamics(now, events, snap) {
        const flash = { bob1: false, bob2: false };
        if (events.bob1Cross)
            this.bob1CrossAt = now;
        if (events.omega1Flip)
            this.bob1FlipAt = now;
        if (events.bob1Cross && now - this.lastMelodyBob1 > this.melodyCooldown) {
            this.blue.play(now + jitterSeconds(8));
            this.lastMelodyBob1 = now;
            flash.bob1 = true;
        }
        if (this.pairedWithinWindow(this.bob1CrossAt, this.bob1FlipAt, now) &&
            now - this.lastClick > this.clickCooldown) {
            this.clickSynth.triggerAttackRelease("32n", now + jitterSeconds(6), 0.4);
            this.lastClick = now;
            this.bob1CrossAt = -1;
            this.bob1FlipAt = -1;
            flash.bob1 = true;
        }
        if (events.bob2Cross && now - this.lastMelodyBob2 > this.melodyCooldown) {
            this.pink.play(now + jitterSeconds(10));
            this.lastMelodyBob2 = now;
            flash.bob2 = true;
        }
        return flash;
    }
    onBallCollisions(now, events, snap) {
        const velScale = Math.min(1, snap.ballSpeed / 220);
        if (events.wallHit) {
            this.kick.triggerAttackRelease("C1", "8n", now + jitterSeconds(), 0.55 + velScale * 0.35);
        }
        if (events.bobHit) {
            this.snare.triggerAttackRelease("16n", now + jitterSeconds(12), 0.45 + velScale * 0.3);
        }
        if (events.lineCross) {
            this.hiHat.triggerAttackRelease("32n", now + jitterSeconds(8), 0.25 + velScale * 0.25);
        }
    }
    onFrame(now, snap) {
        if (snap.isStill)
            return;
        this.frameAccum += snap.dt;
        const rate = Math.min(0.35, snap.totalSpeed * 0.04);
        if (Math.random() < rate * snap.dt * 60) {
            const note = ["C2", "D2", "G2"][Math.floor(Math.random() * 3)];
            this.kick.triggerAttackRelease(note, "32n", now, 0.12 + snap.totalSpeed * 0.04);
        }
    }
    reset() {
        this.blue.reset();
        this.pink.reset();
        this.bob1CrossAt = -1;
        this.bob1FlipAt = -1;
        this.lastMelodyBob1 = 0;
        this.lastMelodyBob2 = 0;
        this.lastClick = 0;
        this.frameAccum = 0;
    }
    dispose() {
        this.blue.dispose();
        this.pink.dispose();
        disposeToneNodes(this.nodes);
    }
    pairedWithinWindow(crossAt, flipAt, now) {
        if (crossAt < 0 || flipAt < 0)
            return false;
        if (now - crossAt > this.pairWindow || now - flipAt > this.pairWindow)
            return false;
        return Math.abs(crossAt - flipAt) <= this.pairWindow;
    }
}
export function createGenerativeBundle(ctx) {
    return new GenerativeBundle(ctx);
}
