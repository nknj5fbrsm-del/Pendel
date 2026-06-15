import { BRIGHT_MELODY_SCALE, WARM_MELODY_SCALE } from "../scales.js";
import { makeMonoVoice, ScaleMelodyPlayer } from "../scale-melody-player.js";
import { disposeToneNodes } from "../types.js";
class TechnoPendulumVoice {
    constructor(outputs) {
        const blueNodes = [];
        const pinkNodes = [];
        const blueDistort = new Tone.Distortion(0.18);
        blueDistort.connect(outputs.melodyBlue);
        blueNodes.push(blueDistort);
        const pinkDistort = new Tone.Distortion(0.14);
        pinkDistort.connect(outputs.melodyPink);
        pinkNodes.push(pinkDistort);
        const sawOpts = {
            oscillator: { type: "sawtooth" },
            filter: { Q: 1.8, type: "lowpass", rolloff: -24 },
            envelope: { attack: 0.003, decay: 0.18, sustain: 0.05, release: 0.12 },
            filterEnvelope: {
                attack: 0.002,
                decay: 0.14,
                sustain: 0.02,
                release: 0.1,
                baseFrequency: 280,
                octaves: 3.5,
            },
        };
        const blueSaw = makeMonoVoice(blueDistort, sawOpts, blueNodes);
        const blueSquare = makeMonoVoice(blueDistort, { ...sawOpts, oscillator: { type: "square" } }, blueNodes);
        blueSquare.weight = 0.35;
        blueSaw.weight = 0.65;
        this.blue = new ScaleMelodyPlayer(BRIGHT_MELODY_SCALE, [blueSaw, blueSquare], [0.06, 0.22], [0.35, 0.75]);
        for (const n of blueNodes)
            this.blue.registerNode(n);
        this.pink = new ScaleMelodyPlayer(WARM_MELODY_SCALE, [makeMonoVoice(pinkDistort, sawOpts, pinkNodes)], [0.08, 0.28], [0.3, 0.68]);
        for (const n of pinkNodes)
            this.pink.registerNode(n);
        this.clickSynth = new Tone.MembraneSynth({
            pitchDecay: 0.008,
            octaves: 2,
            oscillator: { type: "square" },
            envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.02 },
        }).connect(outputs.click);
    }
    playMelodyBlue(now) {
        this.blue.play(now);
    }
    playMelodyPink(now) {
        this.pink.play(now);
    }
    playClick(now) {
        this.clickSynth.triggerAttackRelease("G5", 0.012, now, 0.35);
    }
    reset() {
        this.blue.reset();
        this.pink.reset();
    }
    dispose() {
        this.blue.dispose();
        this.pink.dispose();
        this.clickSynth.dispose();
    }
}
class TechnoBallVoice {
    constructor(outputs) {
        this.kick = new Tone.MembraneSynth({
            pitchDecay: 0.02,
            octaves: 8,
            oscillator: { type: "sine" },
            envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.18 },
        }).connect(outputs.kick);
        this.snareNoise = new Tone.NoiseSynth({
            noise: { type: "white" },
            envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.06 },
        }).connect(outputs.snare);
        this.snareBody = new Tone.MembraneSynth({
            pitchDecay: 0.04,
            octaves: 2,
            oscillator: { type: "triangle" },
            envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
        }).connect(outputs.snare);
        this.hiHat = new Tone.MetalSynth({
            frequency: 400,
            envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
            harmonicity: 5.5,
            modulationIndex: 32,
            resonance: 6000,
            octaves: 1,
        }).connect(outputs.hiHat);
    }
    playKick(now) {
        this.kick.triggerAttackRelease("C1", 0.14, now, 0.95);
    }
    playSnare(now) {
        this.snareNoise.triggerAttackRelease(0.08, now, 0.55);
        this.snareBody.triggerAttackRelease("G2", 0.06, now, 0.25);
    }
    playHiHat(now) {
        this.hiHat.triggerAttackRelease(420, 0.04, now, 0.75);
    }
    dispose() {
        disposeToneNodes([this.kick, this.snareNoise, this.snareBody, this.hiHat]);
    }
}
export function createTechnoSoundBank(outputs) {
    return {
        id: "techno",
        label: "Classic Techno",
        pendulum: new TechnoPendulumVoice(outputs),
        ball: new TechnoBallVoice(outputs),
        dispose() {
            this.pendulum.dispose();
            this.ball.dispose();
        },
    };
}
