import { AMBIENT_BRIGHT_SCALE, AMBIENT_WARM_SCALE } from "../scales.js";
import { makeFmVoice, ScaleMelodyPlayer } from "../scale-melody-player.js";
import { disposeToneNodes } from "../types.js";
class AmbientPendulumVoice {
    constructor(outputs) {
        const blueNodes = [];
        const pinkNodes = [];
        const blueVerb = new Tone.Reverb({ decay: 4, wet: 0.45 });
        blueVerb.connect(outputs.melodyBlue);
        void blueVerb.generate();
        blueNodes.push(blueVerb);
        const pinkVerb = new Tone.Reverb({ decay: 5, wet: 0.5 });
        pinkVerb.connect(outputs.melodyPink);
        void pinkVerb.generate();
        pinkNodes.push(pinkVerb);
        const padOpts = {
            harmonicity: 1.5,
            modulationIndex: 0.4,
            oscillator: { type: "sine" },
            envelope: { attack: 0.12, decay: 0.8, sustain: 0.35, release: 1.8 },
            modulation: { type: "triangle" },
            modulationEnvelope: { attack: 0.1, decay: 0.6, sustain: 0.2, release: 1.2 },
        };
        this.blue = new ScaleMelodyPlayer(AMBIENT_BRIGHT_SCALE, [makeFmVoice(blueVerb, padOpts, 1, blueNodes)], [0.6, 2.2], [0.18, 0.42]);
        for (const n of blueNodes)
            this.blue.registerNode(n);
        this.pink = new ScaleMelodyPlayer(AMBIENT_WARM_SCALE, [
            makeFmVoice(pinkVerb, { ...padOpts, harmonicity: 1.1, modulationIndex: 0.25 }, 1, pinkNodes),
        ], [0.8, 2.8], [0.15, 0.38]);
        for (const n of pinkNodes)
            this.pink.registerNode(n);
        this.clickPad = new Tone.FMSynth({
            harmonicity: 2,
            modulationIndex: 0.2,
            oscillator: { type: "triangle" },
            envelope: { attack: 0.08, decay: 0.5, sustain: 0.1, release: 0.8 },
            modulation: { type: "sine" },
            modulationEnvelope: { attack: 0.06, decay: 0.4, sustain: 0, release: 0.5 },
        }).connect(outputs.click);
    }
    playMelodyBlue(now) {
        this.blue.play(now);
    }
    playMelodyPink(now) {
        this.pink.play(now);
    }
    playClick(now) {
        this.clickPad.triggerAttackRelease("A3", 0.4, now, 0.12);
    }
    reset() {
        this.blue.reset();
        this.pink.reset();
    }
    dispose() {
        this.blue.dispose();
        this.pink.dispose();
        this.clickPad.dispose();
    }
}
class AmbientBallVoice {
    constructor(outputs) {
        this.kick = new Tone.MembraneSynth({
            pitchDecay: 0.08,
            octaves: 3,
            oscillator: { type: "sine" },
            envelope: { attack: 0.02, decay: 0.9, sustain: 0.15, release: 0.6 },
        }).connect(outputs.kick);
        this.snare = new Tone.NoiseSynth({
            noise: { type: "pink" },
            envelope: { attack: 0.02, decay: 0.35, sustain: 0, release: 0.25 },
        }).connect(outputs.snare);
        this.hiHat = new Tone.MetalSynth({
            frequency: 180,
            envelope: { attack: 0.02, decay: 0.2, release: 0.15 },
            harmonicity: 3,
            modulationIndex: 12,
            resonance: 2800,
            octaves: 0.8,
        }).connect(outputs.hiHat);
    }
    playKick(now) {
        this.kick.triggerAttackRelease("C0", 0.55, now, 0.5);
    }
    playSnare(now) {
        this.snare.triggerAttackRelease(0.25, now, 0.28);
    }
    playHiHat(now) {
        this.hiHat.triggerAttackRelease(200, 0.18, now, 0.22);
    }
    dispose() {
        disposeToneNodes([this.kick, this.snare, this.hiHat]);
    }
}
export function createAmbientSoundBank(outputs) {
    return {
        id: "ambient",
        label: "Ambient Drone",
        pendulum: new AmbientPendulumVoice(outputs),
        ball: new AmbientBallVoice(outputs),
        applyMixerPresets(mixer) {
            mixer.setReverbWet(0.32);
        },
        dispose() {
            this.pendulum.dispose();
            this.ball.dispose();
        },
    };
}
