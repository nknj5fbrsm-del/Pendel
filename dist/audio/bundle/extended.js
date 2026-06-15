import { BRIGHT_MELODY_SCALE, GLITCH_SCALE, WARM_MELODY_SCALE } from "../scales.js";
import { ScaleMelodyPlayer, makeMonoVoice } from "../scale-melody-player.js";
import { disposeToneNodes } from "../types.js";
import { AUDIO_BUNDLE_DESCRIPTIONS, AUDIO_BUNDLE_LABELS } from "./types.js";
export class ExtendedBundle {
    constructor(ctx) {
        this.id = "extended";
        this.label = AUDIO_BUNDLE_LABELS.extended;
        this.description = AUDIO_BUNDLE_DESCRIPTIONS.extended;
        this.nodes = [];
        this.lastMelodyBob1 = 0;
        this.lastMelodyBob2 = 0;
        this.lastClick = 0;
        this.bob1CrossAt = -1;
        this.bob1FlipAt = -1;
        this.melodyCooldown = 0.13;
        this.clickCooldown = 0.04;
        this.pairWindow = 0.25;
        this.extCooldown = 0.22;
        this.nearCooldown = 0.7;
        this.quadrantCooldown = 0.75;
        this.lastPeak = 0;
        this.lastEnergy = 0;
        this.lastNear = 0;
        this.lastQuadrant = 0;
        const blueOut = ctx.mixer.output("melodyBlue");
        const pinkOut = ctx.mixer.output("melodyPink");
        const clickOut = ctx.mixer.output("click");
        const kickOut = ctx.mixer.output("kick");
        const snareOut = ctx.mixer.output("snare");
        const hiHatOut = ctx.mixer.output("hiHat");
        const blueNodes = [];
        const pinkNodes = [];
        const blueVoice = makeMonoVoice(blueOut, {
            oscillator: { type: "sawtooth" },
            filter: { Q: 1.5, type: "lowpass", rolloff: -24 },
            envelope: { attack: 0.003, decay: 0.16, sustain: 0.05, release: 0.1 },
            filterEnvelope: {
                attack: 0.002,
                decay: 0.1,
                sustain: 0.02,
                release: 0.08,
                baseFrequency: 300,
                octaves: 3,
            },
        }, blueNodes);
        this.blue = new ScaleMelodyPlayer(BRIGHT_MELODY_SCALE, [blueVoice]);
        for (const n of blueNodes)
            this.blue.registerNode(n);
        const pinkVoice = makeMonoVoice(pinkOut, {
            oscillator: { type: "square" },
            filter: { Q: 2, type: "bandpass", rolloff: -12 },
            envelope: { attack: 0.004, decay: 0.2, sustain: 0.04, release: 0.12 },
            filterEnvelope: {
                attack: 0.003,
                decay: 0.14,
                sustain: 0.02,
                release: 0.1,
                baseFrequency: 180,
                octaves: 2.5,
            },
        }, pinkNodes);
        this.pink = new ScaleMelodyPlayer(WARM_MELODY_SCALE, [pinkVoice]);
        for (const n of pinkNodes)
            this.pink.registerNode(n);
        this.clickSynth = new Tone.MembraneSynth({
            pitchDecay: 0.01,
            octaves: 2.5,
            envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
        }).connect(clickOut);
        this.kick = new Tone.MembraneSynth({
            pitchDecay: 0.04,
            octaves: 5,
            envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
        }).connect(kickOut);
        this.snare = new Tone.NoiseSynth({
            noise: { type: "white" },
            envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.08 },
        }).connect(snareOut);
        this.hiHat = new Tone.MetalSynth({
            envelope: { attack: 0.001, decay: 0.03, release: 0.015 },
            harmonicity: 8,
            modulationIndex: 30,
            resonance: 4500,
            octaves: 0.8,
        }).connect(hiHatOut);
        this.peakSynth = new Tone.MetalSynth({
            envelope: { attack: 0.001, decay: 0.2, release: 0.1 },
            harmonicity: 4,
            modulationIndex: 20,
            resonance: 3000,
            octaves: 1.5,
        }).connect(hiHatOut);
        this.energySynth = new Tone.FMSynth({
            harmonicity: 3,
            modulationIndex: 18,
            envelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.15 },
        }).connect(kickOut);
        this.nearSynth = new Tone.Synth({
            oscillator: { type: "triangle" },
            envelope: { attack: 0.02, decay: 0.35, sustain: 0.12, release: 0.28 },
        }).connect(clickOut);
        this.quadrantSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: { attack: 0.01, decay: 0.4, sustain: 0.15, release: 0.35 },
        }).connect(clickOut);
        this.nodes.push(this.clickSynth, this.kick, this.snare, this.hiHat, this.peakSynth, this.energySynth, this.nearSynth, this.quadrantSynth);
    }
    applyUiPresets(target) {
        target.setReverbWet(0.45);
        target.setMixerLevel("melodyBlue", 0.68);
        target.setMixerLevel("melodyPink", 0.68);
        target.setMixerLevel("click", 0.7);
        target.setMixerLevel("kick", 0.82);
        target.setMixerLevel("snare", 0.72);
        target.setMixerLevel("hiHat", 0.65);
    }
    onDynamics(now, events, snap) {
        const flash = { bob1: false, bob2: false };
        if (events.bob1Cross)
            this.bob1CrossAt = now;
        if (events.omega1Flip)
            this.bob1FlipAt = now;
        if (events.bob1Cross && now - this.lastMelodyBob1 > this.melodyCooldown) {
            this.blue.play(now);
            this.lastMelodyBob1 = now;
            flash.bob1 = true;
        }
        if (this.pairedWithinWindow(this.bob1CrossAt, this.bob1FlipAt, now) &&
            now - this.lastClick > this.clickCooldown) {
            this.clickSynth.triggerAttackRelease("G4", 0.015, now, 0.38);
            this.lastClick = now;
            this.bob1CrossAt = -1;
            this.bob1FlipAt = -1;
            flash.bob1 = true;
        }
        if (events.bob2Cross && now - this.lastMelodyBob2 > this.melodyCooldown) {
            this.pink.play(now);
            this.lastMelodyBob2 = now;
            flash.bob2 = true;
        }
        if (events.velocityPeak && now - this.lastPeak > this.extCooldown) {
            const pitch = 400 + snap.totalSpeed * 80;
            this.peakSynth.triggerAttackRelease(pitch, "16n", now, 0.55);
            this.lastPeak = now;
            flash.bob1 = true;
        }
        if (events.energyJump && now - this.lastEnergy > this.extCooldown) {
            const note = GLITCH_SCALE[Math.floor(Math.random() * GLITCH_SCALE.length)];
            this.energySynth.triggerAttackRelease(note, "8n", now, 0.5);
            this.lastEnergy = now;
        }
        if (events.nearCollision && now - this.lastNear > this.nearCooldown) {
            this.nearSynth.triggerAttackRelease("A3", "8n", now, 0.38);
            this.lastNear = now;
            flash.bob1 = true;
            flash.bob2 = true;
        }
        if (events.bob2QuadrantChange && now - this.lastQuadrant > this.quadrantCooldown) {
            const chord = ["C4", "E4", "G4"];
            this.quadrantSynth.triggerAttackRelease(chord, "8n", now, 0.28);
            this.lastQuadrant = now;
            flash.bob2 = true;
        }
        return flash;
    }
    onBallCollisions(now, events, snap) {
        const v = Math.min(1, snap.ballSpeed / 250);
        if (events.wallHit)
            this.kick.triggerAttackRelease("C1", "8n", now, 0.5 + v * 0.4);
        if (events.bobHit)
            this.snare.triggerAttackRelease("16n", now, 0.45 + v * 0.35);
        if (events.lineCross)
            this.hiHat.triggerAttackRelease("32n", now, 0.3 + v * 0.25);
    }
    reset() {
        this.blue.reset();
        this.pink.reset();
        this.bob1CrossAt = -1;
        this.bob1FlipAt = -1;
        this.lastMelodyBob1 = 0;
        this.lastMelodyBob2 = 0;
        this.lastClick = 0;
        this.lastPeak = 0;
        this.lastEnergy = 0;
        this.lastNear = 0;
        this.lastQuadrant = 0;
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
export function createExtendedBundle(ctx) {
    return new ExtendedBundle(ctx);
}
