"use strict";
class DoublePendulumSimulation {
    constructor(params, initial) {
        this.params = params;
        this.state = { ...initial };
    }
    getState() {
        return { ...this.state };
    }
    reset(initial) {
        this.state = { ...initial };
    }
    step(dt) {
        const deriv = (s) => {
            const { m1, m2, l1, l2, g } = this.params;
            const delta = s.theta2 - s.theta1;
            const dTheta1 = s.omega1;
            const dTheta2 = s.omega2;
            const den1 = (m1 + m2) * l1 - m2 * l1 * Math.cos(delta) * Math.cos(delta);
            const den2 = (l2 / l1) * den1;
            const dOmega1 = (m2 * l1 * s.omega1 * s.omega1 * Math.sin(delta) * Math.cos(delta) +
                m2 * g * Math.sin(s.theta2) * Math.cos(delta) +
                m2 * l2 * s.omega2 * s.omega2 * Math.sin(delta) -
                (m1 + m2) * g * Math.sin(s.theta1)) /
                den1;
            const dOmega2 = (-m2 * l2 * s.omega2 * s.omega2 * Math.sin(delta) * Math.cos(delta) +
                (m1 + m2) *
                    (g * Math.sin(s.theta1) * Math.cos(delta) -
                        l1 * s.omega1 * s.omega1 * Math.sin(delta) -
                        g * Math.sin(s.theta2))) /
                den2;
            return {
                theta1: dTheta1,
                theta2: dTheta2,
                omega1: dOmega1,
                omega2: dOmega2,
            };
        };
        // RK4 liefert stabile Schritte bei chaotischen Systemen.
        const s = this.state;
        const k1 = deriv(s);
        const k2 = deriv(addState(s, scaleState(k1, dt / 2)));
        const k3 = deriv(addState(s, scaleState(k2, dt / 2)));
        const k4 = deriv(addState(s, scaleState(k3, dt)));
        this.state = addState(s, scaleState(addState(k1, addState(scaleState(k2, 2), addState(scaleState(k3, 2), k4))), dt / 6));
        return this.getState();
    }
    kineticEnergy() {
        const { m1, m2, l1, l2 } = this.params;
        const { theta1, theta2, omega1, omega2 } = this.state;
        const v1Sq = (l1 * omega1) ** 2;
        const v2Sq = v1Sq +
            (l2 * omega2) ** 2 +
            2 * l1 * l2 * omega1 * omega2 * Math.cos(theta1 - theta2);
        return 0.5 * m1 * v1Sq + 0.5 * m2 * v2Sq;
    }
}
const DISPLAY_SIZE_FACTOR = 2;
const BOB1_DISPLAY_RADIUS = 3.5 * DISPLAY_SIZE_FACTOR;
const BOB2_DISPLAY_RADIUS = 4.5 * DISPLAY_SIZE_FACTOR;
const FLYING_BALL_RADIUS = 3 * DISPLAY_SIZE_FACTOR;
class FlyingBallSimulation {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.radius = FLYING_BALL_RADIUS;
        this.speed = 155;
        this.lastWallHit = -1;
        this.lastBobHit = -1;
        this.lastLineCross = -1;
        this.hitCooldown = 0.035;
    }
    reset(boundaryRadius) {
        const angle = Math.random() * Math.PI * 2;
        const dist = boundaryRadius * 0.32;
        this.x = Math.cos(angle) * dist;
        this.y = Math.sin(angle) * dist;
        const dir = angle + 0.65;
        this.vx = Math.cos(dir) * this.speed;
        this.vy = Math.sin(dir) * this.speed;
        this.lastWallHit = -1;
        this.lastBobHit = -1;
        this.lastLineCross = -1;
    }
    getState() {
        return { x: this.x, y: this.y };
    }
    setSpeed(speed) {
        this.speed = Math.max(40, Math.min(320, speed));
        const mag = Math.hypot(this.vx, this.vy);
        if (mag > 0.001) {
            const scale = this.speed / mag;
            this.vx *= scale;
            this.vy *= scale;
        }
    }
    step(dt, now, boundaryRadius, bob1, bob2) {
        const events = { bobHit: false, lineCross: false, wallHit: false };
        const subSteps = 3;
        const h = dt / subSteps;
        for (let i = 0; i < subSteps; i += 1) {
            const prevY = this.y;
            this.x += this.vx * h;
            this.y += this.vy * h;
            if (this.crossedReferenceLine(prevY, this.y) && now - this.lastLineCross > this.hitCooldown) {
                events.lineCross = true;
                this.lastLineCross = now;
            }
            const dist = Math.hypot(this.x, this.y);
            const maxDist = boundaryRadius - this.radius;
            if (dist > maxDist && dist > 0.0001) {
                const nx = this.x / dist;
                const ny = this.y / dist;
                const dot = this.vx * nx + this.vy * ny;
                if (dot > 0) {
                    this.vx -= 2 * dot * nx;
                    this.vy -= 2 * dot * ny;
                }
                this.x = nx * maxDist;
                this.y = ny * maxDist;
                if (now - this.lastWallHit > this.hitCooldown) {
                    events.wallHit = true;
                    this.lastWallHit = now;
                }
            }
            this.resolveBobCollision(bob1, events, now);
            this.resolveBobCollision(bob2, events, now);
        }
        return events;
    }
    crossedReferenceLine(prevY, nextY) {
        if (prevY === nextY)
            return false;
        return prevY > 0 !== nextY > 0;
    }
    resolveBobCollision(bob, events, now) {
        const dx = this.x - bob.x;
        const dy = this.y - bob.y;
        const dist = Math.hypot(dx, dy);
        const minDist = this.radius + bob.r;
        if (dist >= minDist || dist < 0.0001)
            return;
        const nx = dx / dist;
        const ny = dy / dist;
        const dot = this.vx * nx + this.vy * ny;
        if (dot < 0) {
            this.vx -= 2 * dot * nx;
            this.vy -= 2 * dot * ny;
        }
        const overlap = minDist - dist;
        this.x += nx * overlap;
        this.y += ny * overlap;
        if (now - this.lastBobHit > this.hitCooldown) {
            events.bobHit = true;
            this.lastBobHit = now;
        }
    }
}
const MIXER_DEFAULTS = {
    melodyBlue: 70,
    melodyPink: 70,
    click: 80,
    snare: 70,
    hiHat: 70,
    kick: 85,
};
const MIXER_CHANNELS = [
    "melodyBlue",
    "melodyPink",
    "click",
    "snare",
    "hiHat",
    "kick",
];
const DELAY_TIMES = {
    melodyBlue: 0.28,
    melodyPink: 0.34,
    click: 0.12,
    kick: 0.18,
    snare: 0.22,
    hiHat: 0.08,
};
class AudioMixer {
    constructor() {
        this.reverb = new Tone.Reverb({ decay: 2.2, preDelay: 0.015, wet: 0 });
        this.reverb.toDestination();
        void this.reverb.generate();
        this.gains = {};
        this.delays = {};
        for (const channel of MIXER_CHANNELS) {
            this.delays[channel] = new Tone.FeedbackDelay({
                delayTime: DELAY_TIMES[channel],
                feedback: 0.28,
                wet: 0,
            });
            this.gains[channel] = new Tone.Gain(MIXER_DEFAULTS[channel] / 100);
            this.gains[channel].connect(this.delays[channel]);
            this.delays[channel].connect(this.reverb);
        }
    }
    output(channel) {
        return this.gains[channel];
    }
    setLevel(channel, level) {
        const clamped = Math.max(0, Math.min(1, level));
        this.gains[channel].gain.rampTo(clamped, 0.04);
    }
    setReverbWet(level) {
        this.reverb.wet.rampTo(Math.max(0, Math.min(1, level)), 0.04);
    }
    setDelayWet(channel, level) {
        this.delays[channel].wet.rampTo(Math.max(0, Math.min(1, level)), 0.04);
    }
}
function updateFaderVisual(input, readout, text) {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    const span = max - min || 1;
    const pct = ((value - min) / span) * 100;
    input.style.setProperty("--fader-pct", `${pct}%`);
    if (readout)
        readout.textContent = text;
}
function faderReadout(input) {
    return input.closest(".fader")?.querySelector(".fader-readout") ?? null;
}
class MixerController {
    constructor(setLevel, root) {
        this.setLevel = setLevel;
        root.querySelectorAll("[data-mixer]").forEach((input) => {
            const channel = input.dataset.mixer;
            const apply = () => {
                const percent = Number(input.value);
                updateFaderVisual(input, faderReadout(input), String(percent));
                this.setLevel(channel, percent / 100);
            };
            input.addEventListener("input", apply);
            apply();
        });
    }
}
class EffectsController {
    constructor(setReverb, setDelay, root) {
        this.setReverb = setReverb;
        this.setDelay = setDelay;
        const reverbInput = root.querySelector('[data-effect="reverb"]');
        if (reverbInput) {
            const applyReverb = () => {
                const percent = Number(reverbInput.value);
                updateFaderVisual(reverbInput, faderReadout(reverbInput), String(percent));
                this.setReverb(percent / 100);
            };
            reverbInput.addEventListener("input", applyReverb);
            applyReverb();
        }
        root.querySelectorAll("[data-delay]").forEach((input) => {
            const channel = input.dataset.delay;
            const apply = () => {
                const percent = Number(input.value);
                updateFaderVisual(input, faderReadout(input), String(percent));
                this.setDelay(channel, percent / 100);
            };
            input.addEventListener("input", apply);
            apply();
        });
    }
}
const BRIGHT_MELODY_SCALE = [
    "E3", "G3", "B3", "D4", "E4", "G4", "B4", "D5", "E5", "G5", "B5", "D6", "E6", "G6", "B6", "D7",
];
const WARM_MELODY_SCALE = [
    "D2", "E2", "G2", "A2", "B2", "D3", "E3", "G3", "A3", "B3",
    "D4", "E4", "G4", "A4", "B4", "D5", "E5", "G5", "A5",
];
const BRIGHT_VOICE_WEIGHTS = [
    { kind: "pluckModern", weight: 0.28 },
    { kind: "pluckAcoustic", weight: 0.18 },
    { kind: "fm", weight: 0.18 },
    { kind: "am", weight: 0.14 },
    { kind: "marimba", weight: 0.12 },
    { kind: "string", weight: 0.1 },
];
const WARM_VOICE_WEIGHTS = [
    { kind: "pluckAcoustic", weight: 0.2 },
    { kind: "pluckModern", weight: 0.16 },
    { kind: "kalimba", weight: 0.15 },
    { kind: "string", weight: 0.15 },
    { kind: "fm", weight: 0.13 },
    { kind: "am", weight: 0.11 },
    { kind: "marimba", weight: 0.1 },
];
class MelodyGenerator {
    constructor(color, output) {
        this.maxStep = 4;
        this.color = color;
        this.scale = color === "bright" ? BRIGHT_MELODY_SCALE : WARM_MELODY_SCALE;
        this.scaleIndex = Math.floor(this.scale.length / 2);
        this.voiceWeights = color === "bright" ? BRIGHT_VOICE_WEIGHTS : WARM_VOICE_WEIGHTS;
        this.voices = {};
        if (color === "bright") {
            const filter = new Tone.Filter({ type: "highpass", frequency: 140, Q: 0.5 }).connect(output);
            this.voices.pluckModern = new Tone.PluckSynth({
                attackNoise: 1,
                dampening: 5600,
                resonance: 0.94,
            }).connect(filter);
            this.voices.pluckAcoustic = new Tone.MonoSynth({
                oscillator: { type: "triangle" },
                filter: { Q: 2.4, type: "lowpass", rolloff: -24 },
                envelope: { attack: 0.002, decay: 0.14, sustain: 0.02, release: 0.2 },
                filterEnvelope: { attack: 0.002, decay: 0.12, sustain: 0.01, release: 0.16, baseFrequency: 900, octaves: 3.2 },
            }).connect(filter);
            this.voices.fm = new Tone.FMSynth({
                harmonicity: 2.2,
                modulationIndex: 1.6,
                oscillator: { type: "triangle" },
                envelope: { attack: 0.003, decay: 0.2, sustain: 0.03, release: 0.24 },
                modulation: { type: "sine" },
                modulationEnvelope: { attack: 0.003, decay: 0.14, sustain: 0, release: 0.18 },
            }).connect(filter);
            this.voices.am = new Tone.AMSynth({
                harmonicity: 2,
                oscillator: { type: "square8" },
                envelope: { attack: 0.004, decay: 0.18, sustain: 0.04, release: 0.22 },
                modulation: { type: "sine" },
                modulationEnvelope: { attack: 0.003, decay: 0.11, sustain: 0, release: 0.15 },
            }).connect(filter);
            this.voices.marimba = new Tone.MembraneSynth({
                pitchDecay: 0.018,
                octaves: 3,
                oscillator: { type: "sine" },
                envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.14 },
            }).connect(filter);
            this.voices.string = new Tone.MonoSynth({
                oscillator: { type: "sawtooth" },
                filter: { Q: 0.9, type: "lowpass", rolloff: -12 },
                envelope: { attack: 0.04, decay: 0.22, sustain: 0.06, release: 0.28 },
                filterEnvelope: { attack: 0.03, decay: 0.18, sustain: 0.04, release: 0.22, baseFrequency: 420, octaves: 1.6 },
            }).connect(filter);
        }
        else {
            const filter = new Tone.Filter({ type: "lowpass", frequency: 2600, Q: 0.4 }).connect(output);
            this.voices.pluckAcoustic = new Tone.MonoSynth({
                oscillator: { type: "sine" },
                filter: { Q: 1.4, type: "lowpass", rolloff: -24 },
                envelope: { attack: 0.008, decay: 0.42, sustain: 0.08, release: 0.5 },
                filterEnvelope: { attack: 0.006, decay: 0.3, sustain: 0.06, release: 0.35, baseFrequency: 220, octaves: 2.4 },
            }).connect(filter);
            this.voices.pluckModern = new Tone.PluckSynth({
                attackNoise: 0.85,
                dampening: 2800,
                resonance: 0.88,
            }).connect(filter);
            this.voices.kalimba = new Tone.FMSynth({
                harmonicity: 2.6,
                modulationIndex: 0.9,
                oscillator: { type: "sine" },
                envelope: { attack: 0.002, decay: 0.45, sustain: 0.04, release: 0.38 },
                modulation: { type: "triangle" },
                modulationEnvelope: { attack: 0.002, decay: 0.32, sustain: 0, release: 0.25 },
            }).connect(filter);
            this.voices.string = new Tone.MonoSynth({
                oscillator: { type: "triangle" },
                filter: { Q: 0.8, type: "lowpass", rolloff: -12 },
                envelope: { attack: 0.05, decay: 0.32, sustain: 0.1, release: 0.38 },
                filterEnvelope: { attack: 0.04, decay: 0.24, sustain: 0.06, release: 0.28, baseFrequency: 280, octaves: 1.4 },
            }).connect(filter);
            this.voices.fm = new Tone.FMSynth({
                harmonicity: 1.05,
                modulationIndex: 0.5,
                oscillator: { type: "sine" },
                envelope: { attack: 0.025, decay: 0.45, sustain: 0.14, release: 0.55 },
                modulation: { type: "triangle" },
                modulationEnvelope: { attack: 0.02, decay: 0.32, sustain: 0.05, release: 0.38 },
            }).connect(filter);
            this.voices.am = new Tone.AMSynth({
                harmonicity: 1.2,
                oscillator: { type: "triangle" },
                envelope: { attack: 0.03, decay: 0.48, sustain: 0.16, release: 0.58 },
                modulation: { type: "sine" },
                modulationEnvelope: { attack: 0.02, decay: 0.3, sustain: 0.05, release: 0.32 },
            }).connect(filter);
            this.voices.marimba = new Tone.MembraneSynth({
                pitchDecay: 0.028,
                octaves: 2.2,
                oscillator: { type: "sine" },
                envelope: { attack: 0.002, decay: 0.38, sustain: 0.02, release: 0.28 },
            }).connect(filter);
        }
    }
    play(now) {
        this.silenceAllVoices(now);
        this.scaleIndex = this.pickNextIndex();
        const note = this.scale[this.scaleIndex];
        const kind = this.pickVoiceKind();
        const synth = this.voices[kind];
        if (!synth)
            return;
        this.tweakVoice(synth, kind);
        const velocity = 0.22 + Math.random() * 0.48;
        synth.triggerAttackRelease(note, this.durationFor(kind), now, velocity);
    }
    reset() {
        this.scaleIndex = Math.floor(this.scale.length / 2);
        this.silenceAllVoices(Tone.now());
    }
    silenceAllVoices(now) {
        for (const synth of Object.values(this.voices)) {
            if (!synth)
                continue;
            try {
                if (typeof synth.releaseAll === "function") {
                    synth.releaseAll(now);
                }
                else if (typeof synth.triggerRelease === "function") {
                    synth.triggerRelease(now);
                }
            }
            catch {
                // Stimme war bereits still.
            }
        }
    }
    pickVoiceKind() {
        const r = Math.random();
        let sum = 0;
        for (const entry of this.voiceWeights) {
            sum += entry.weight;
            if (r <= sum)
                return entry.kind;
        }
        return this.voiceWeights[this.voiceWeights.length - 1].kind;
    }
    durationFor(kind) {
        if (kind === "pluckModern" || kind === "pluckAcoustic") {
            return 0.05 + Math.random() * 0.28;
        }
        if (kind === "marimba" || kind === "kalimba") {
            return 0.08 + Math.random() * 0.28;
        }
        if (kind === "string") {
            return 0.12 + Math.random() * 0.28;
        }
        return 0.08 + Math.random() * 0.36;
    }
    tweakVoice(synth, kind) {
        if (kind === "pluckModern" && synth.resonance !== undefined) {
            synth.resonance = 0.88 + Math.random() * 0.1;
        }
        if (kind === "fm" && synth.modulationIndex?.rampTo) {
            const base = this.color === "bright" ? 1.2 : 0.3;
            synth.modulationIndex.rampTo(base + Math.random() * 1.8, 0.02);
        }
        if (kind === "am" && synth.harmonicity?.rampTo) {
            synth.harmonicity.rampTo(1.1 + Math.random() * 1.6, 0.02);
        }
        if (kind === "kalimba" && synth.modulationIndex?.rampTo) {
            synth.modulationIndex.rampTo(0.5 + Math.random() * 0.8, 0.02);
        }
    }
    pickNextIndex() {
        const leap = Math.random() < 0.22;
        const stepRange = leap ? this.maxStep + 2 : this.maxStep;
        const step = Math.floor(Math.random() * (stepRange * 2 + 1)) - stepRange;
        let next = this.scaleIndex + step;
        next = Math.max(0, Math.min(this.scale.length - 1, next));
        if (next === this.scaleIndex) {
            next = step >= 0 ? Math.min(this.scale.length - 1, next + 1) : Math.max(0, next - 1);
        }
        return next;
    }
}
class AudioEngine {
    constructor() {
        this.mixer = new AudioMixer();
        this.lastMelodyBob1Time = 0;
        this.lastMelodyBob2Time = 0;
        this.lastClickBob1 = 0;
        this.bob1CrossAt = -1;
        this.bob1FlipAt = -1;
        this.bob2CrossAt = -1;
        this.bob2FlipAt = -1;
        this.clickCooldown = 0.04;
        this.melodyCooldown = 0.14;
        this.pairWindow = 0.25;
        this.melodyBob1 = new MelodyGenerator("bright", this.mixer.output("melodyBlue"));
        this.melodyBob2 = new MelodyGenerator("warm", this.mixer.output("melodyPink"));
        this.clickSynth = new Tone.MembraneSynth({
            pitchDecay: 0.005,
            octaves: 1,
            oscillator: { type: "sine" },
            envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.03 },
        }).connect(this.mixer.output("click"));
        this.kickDrum = new Tone.MembraneSynth({
            pitchDecay: 0.06,
            octaves: 5,
            oscillator: { type: "sine" },
            envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.25 },
        }).connect(this.mixer.output("kick"));
        this.snareDrum = new Tone.NoiseSynth({
            noise: { type: "white" },
            envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 },
        }).connect(this.mixer.output("snare"));
        this.hiHat = new Tone.MetalSynth({
            frequency: 320,
            envelope: { attack: 0.001, decay: 0.06, release: 0.01 },
            harmonicity: 5.1,
            modulationIndex: 28,
            resonance: 5000,
            octaves: 1.2,
        }).connect(this.mixer.output("hiHat"));
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
        this.bob1CrossAt = -1;
        this.bob1FlipAt = -1;
        this.bob2CrossAt = -1;
        this.bob2FlipAt = -1;
        this.lastClickBob1 = 0;
        this.lastMelodyBob1Time = 0;
        this.lastMelodyBob2Time = 0;
        this.melodyBob1.reset();
        this.melodyBob2.reset();
    }
    onDynamics(now, events) {
        const flash = { bob1: false, bob2: false };
        if (events.bob1Cross)
            this.bob1CrossAt = now;
        if (events.omega1Flip)
            this.bob1FlipAt = now;
        if (events.bob2Cross)
            this.bob2CrossAt = now;
        if (events.omega2Flip)
            this.bob2FlipAt = now;
        if (events.bob1Cross && now - this.lastMelodyBob1Time > this.melodyCooldown) {
            this.melodyBob1.play(now);
            this.lastMelodyBob1Time = now;
            flash.bob1 = true;
        }
        if (this.pairedWithinWindow(this.bob1CrossAt, this.bob1FlipAt, now) &&
            now - this.lastClickBob1 > this.clickCooldown) {
            this.clickSynth.triggerAttackRelease("C6", 0.015, now, 0.22);
            this.lastClickBob1 = now;
            this.bob1CrossAt = -1;
            this.bob1FlipAt = -1;
            flash.bob1 = true;
        }
        if (events.bob2Cross && now - this.lastMelodyBob2Time > this.melodyCooldown) {
            this.melodyBob2.play(now);
            this.lastMelodyBob2Time = now;
            flash.bob2 = true;
        }
        return flash;
    }
    onBallCollisions(now, events) {
        if (events.wallHit) {
            this.kickDrum.triggerAttackRelease("C1", 0.12, now, 0.85);
        }
        if (events.bobHit) {
            this.snareDrum.triggerAttackRelease(0.1, now, 0.7);
        }
        if (events.lineCross) {
            this.hiHat.triggerAttackRelease(280, 0.07, now, 0.8);
        }
    }
    pairedWithinWindow(crossAt, flipAt, now) {
        if (crossAt < 0 || flipAt < 0)
            return false;
        if (now - crossAt > this.pairWindow || now - flipAt > this.pairWindow)
            return false;
        return Math.abs(crossAt - flipAt) <= this.pairWindow;
    }
}
class RecorderController {
    constructor(setStatus, downloadsEl) {
        this.setStatus = setStatus;
        this.downloadsEl = downloadsEl;
        this.streamDestination = null;
        this.tapConnected = false;
        this.recorder = null;
        this.chunks = [];
    }
    /** Aufnahme-Tap nur während Recording — sonst kein Live-Ton auf iOS. */
    connectTap() {
        const rawCtx = Tone.getContext().rawContext;
        if (!this.streamDestination) {
            this.streamDestination = rawCtx.createMediaStreamDestination();
        }
        if (!this.tapConnected) {
            Tone.Destination.connect(this.streamDestination);
            this.tapConnected = true;
        }
        return this.streamDestination;
    }
    disconnectTap() {
        if (!this.tapConnected || !this.streamDestination)
            return;
        try {
            Tone.Destination.disconnect(this.streamDestination);
        }
        catch {
            // Tap war bereits getrennt.
        }
        this.tapConnected = false;
    }
    start() {
        if (this.recorder && this.recorder.state === "recording") {
            return;
        }
        const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
        const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
        this.chunks = [];
        const tap = this.connectTap();
        this.recorder = new MediaRecorder(tap.stream, mimeType ? { mimeType } : undefined);
        this.recorder.ondataavailable = (ev) => {
            if (ev.data.size > 0)
                this.chunks.push(ev.data);
        };
        this.recorder.onstop = async () => {
            this.disconnectTap();
            const blob = new Blob(this.chunks, {
                type: this.recorder?.mimeType || "audio/webm",
            });
            await this.createDownloadLinks(blob);
        };
        this.recorder.start(100);
        this.setStatus("Aufnahme läuft", "recording");
    }
    stop() {
        if (!this.recorder || this.recorder.state !== "recording") {
            return;
        }
        this.recorder.stop();
        this.setStatus("Aufnahme wird verarbeitet", "processing");
    }
    release() {
        if (this.recorder && this.recorder.state === "recording") {
            this.recorder.stop();
        }
        this.disconnectTap();
    }
    async createDownloadLinks(sourceBlob) {
        this.downloadsEl.innerHTML = "";
        const webmUrl = URL.createObjectURL(sourceBlob);
        this.downloadsEl.appendChild(createAnchor(webmUrl, "pendel-audio.webm", "Download .webm"));
        try {
            const wavBlob = await decodeToWavBlob(sourceBlob);
            const wavUrl = URL.createObjectURL(wavBlob);
            this.downloadsEl.appendChild(createAnchor(wavUrl, "pendel-audio.wav", "Download .wav"));
            this.setStatus("Aufnahme bereit (.webm/.wav)", "active");
        }
        catch {
            this.setStatus("Aufnahme bereit (.webm)", "active");
        }
    }
}
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.trailBob2 = [];
        this.flashBob1 = 0;
        this.flashBob2 = 0;
        this.bob1Radius = BOB1_DISPLAY_RADIUS;
        this.bob2Radius = BOB2_DISPLAY_RADIUS;
        this.pivotRadius = 1.5;
        this.armWidth = 0.65;
        this.trailWidth = 0.5;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            throw new Error("2D Context nicht verfuegbar");
        this.ctx = ctx;
    }
    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.floor(this.canvas.clientWidth * dpr);
        this.canvas.height = Math.floor(this.canvas.clientHeight * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.clearCanvas();
    }
    clearCanvas() {
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        this.ctx.fillStyle = "#000000";
        this.ctx.fillRect(0, 0, w, h);
    }
    applySoundFlash(flash) {
        if (flash.bob1)
            this.flashBob1 = 1;
        if (flash.bob2)
            this.flashBob2 = 1;
    }
    resetVisuals() {
        this.trailBob2.length = 0;
        this.flashBob1 = 0;
        this.flashBob2 = 0;
        this.clearCanvas();
    }
    draw(state, params, appendTrail = true, isStill = false, ball = null) {
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        const cx = w * 0.5;
        const cy = h * 0.5;
        const scale = computeDisplayScale(w, h, params);
        const geom = getPendulumGeometry(state, params);
        const x1 = cx + geom.x1 * scale;
        const y1 = cy + geom.y1 * scale;
        const x2 = cx + geom.x2 * scale;
        const y2 = cy + geom.y2 * scale;
        if (appendTrail) {
            this.trailBob2.push({ x: x2, y: y2, life: 1 });
            while (this.trailBob2.length > 280)
                this.trailBob2.shift();
            this.fadeTrail(this.trailBob2);
        }
        this.clearCanvas();
        const angleRadius = this.angleCircleRadius(params, scale);
        this.drawAngleScale(cx, cy, angleRadius);
        this.updateAndDrawTrail(this.trailBob2);
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, cy);
        this.ctx.lineTo(w, cy);
        this.ctx.stroke();
        this.drawArm(cx, cy, x1, y1, "rgba(10, 132, 255, 0.12)");
        this.drawArm(x1, y1, x2, y2, "rgba(255, 55, 95, 0.1)");
        this.flashBob1 = Math.max(0, this.flashBob1 - 0.08);
        this.flashBob2 = Math.max(0, this.flashBob2 - 0.08);
        const breath = isStill ? 0.5 + 0.5 * Math.sin(performance.now() * 0.0035) : 0;
        const pulseScale = isStill ? 0.82 + breath * 0.28 : 1;
        const pulseAlpha = isStill ? 0.55 + breath * 0.45 : 1;
        if (isStill) {
            this.drawPulseRing(x1, y1, this.bob1Radius, "rgba(10, 132, 255,", breath);
            this.drawPulseRing(x2, y2, this.bob2Radius, "rgba(255, 55, 95,", breath);
        }
        this.drawBob(x1, y1, this.bob1Radius * pulseScale, "#64b5ff", "#f0f7ff", this.flashBob1, pulseAlpha);
        this.drawBob(x2, y2, this.bob2Radius * pulseScale, "#ff6b8a", "#fff0f4", this.flashBob2, pulseAlpha);
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, this.pivotRadius, 0, Math.PI * 2);
        this.ctx.fill();
        if (ball) {
            this.drawFlyingBall(cx + ball.x, cy + ball.y);
        }
    }
    drawFlyingBall(x, y) {
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
        this.ctx.beginPath();
        this.ctx.arc(x, y, FLYING_BALL_RADIUS, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
        this.ctx.lineWidth = 0.45;
        this.ctx.stroke();
    }
    maxBob2ReachPx(params, scale) {
        return (params.l1 + params.l2) * scale;
    }
    /** Kreis umhüllt maximale Bahn der rosa Masse (Mittelpunkt + halbe Spurbreite). */
    angleCircleRadius(params, scale) {
        return this.maxBob2ReachPx(params, scale) + this.trailWidth * 0.5 + 0.5;
    }
    drawAngleScale(cx, cy, radius) {
        this.ctx.save();
        this.ctx.shadowBlur = 0;
        this.ctx.font = '500 9px -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        for (let deg = 0; deg < 360; deg += 15) {
            const rad = (deg * Math.PI) / 180;
            const major = deg % 30 === 0;
            const tickLen = major ? 7 : 4;
            const sin = Math.sin(rad);
            const cos = Math.cos(rad);
            this.ctx.strokeStyle = major
                ? "rgba(255, 255, 255, 0.22)"
                : "rgba(255, 255, 255, 0.1)";
            this.ctx.lineWidth = major ? 0.55 : 0.35;
            this.ctx.beginPath();
            this.ctx.moveTo(cx + radius * sin, cy + radius * cos);
            this.ctx.lineTo(cx + (radius - tickLen) * sin, cy + (radius - tickLen) * cos);
            this.ctx.stroke();
            if (major) {
                const labelR = radius + 10;
                this.ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(`${deg}°`, cx + labelR * sin, cy + labelR * cos);
            }
        }
        this.ctx.restore();
    }
    fadeTrail(trail) {
        for (const p of trail) {
            p.life *= 0.994;
        }
        while (trail.length > 0 && trail[0].life < 0.03) {
            trail.shift();
        }
    }
    updateAndDrawTrail(trail) {
        if (trail.length < 2)
            return;
        this.ctx.shadowBlur = 0;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.lineWidth = 0.45;
        for (let i = 1; i < trail.length; i += 1) {
            const prev = trail[i - 1];
            const p = trail[i];
            const dx = p.x - prev.x;
            const dy = p.y - prev.y;
            if (dx * dx + dy * dy < 0.25)
                continue;
            const t = i / trail.length;
            const alpha = Math.max(0, p.life * (0.06 + t * 0.28));
            this.ctx.strokeStyle = `rgba(255, 75, 120, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.moveTo(prev.x, prev.y);
            this.ctx.lineTo(p.x, p.y);
            this.ctx.stroke();
        }
    }
    drawPulseRing(x, y, baseR, rgb, breath) {
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = `${rgb} ${0.12 + breath * 0.22})`;
        this.ctx.lineWidth = 0.45;
        this.ctx.beginPath();
        this.ctx.arc(x, y, baseR + 2.5 + breath * 2.5, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    drawArm(x0, y0, x1, y1, glow) {
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
        this.ctx.lineWidth = this.armWidth;
        this.ctx.lineCap = "round";
        this.ctx.shadowColor = glow;
        this.ctx.shadowBlur = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x0, y0);
        this.ctx.lineTo(x1, y1);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }
    drawBob(x, y, radius, baseColor, flashColor, flash, alpha = 1) {
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = flash > 0.02 ? mixColor(baseColor, flashColor, flash) : baseColor;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
    }
}
function mixColor(base, flash, t) {
    const parse = (hex) => {
        const h = hex.replace("#", "");
        return [
            parseInt(h.slice(0, 2), 16),
            parseInt(h.slice(2, 4), 16),
            parseInt(h.slice(4, 6), 16),
        ];
    };
    const [r1, g1, b1] = parse(base);
    const [r2, g2, b2] = parse(flash);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r}, ${g}, ${b})`;
}
function computeDisplayScale(width, height, params) {
    const maxReach = params.l1 + params.l2;
    const margin = 24;
    const fitRadius = Math.min(width, height) / 2 - margin;
    return (fitRadius / maxReach) * 0.9;
}
function computeBoundaryRadiusPx(width, height, params) {
    const scale = computeDisplayScale(width, height, params);
    return (params.l1 + params.l2) * scale + 0.25 + 0.5;
}
function getPendulumGeometry(state, params) {
    const x1 = params.l1 * Math.sin(state.theta1);
    const y1 = params.l1 * Math.cos(state.theta1);
    const x2 = x1 + params.l2 * Math.sin(state.theta2);
    const y2 = y1 + params.l2 * Math.cos(state.theta2);
    return { x1, y1, x2, y2 };
}
function didCrossLine(prevY, nextY) {
    return prevY * nextY < 0;
}
function didOmegaFlip(prevOmega, nextOmega) {
    return prevOmega * nextOmega < 0;
}
function addState(a, b) {
    return {
        theta1: a.theta1 + b.theta1,
        theta2: a.theta2 + b.theta2,
        omega1: a.omega1 + b.omega1,
        omega2: a.omega2 + b.omega2,
    };
}
function scaleState(s, k) {
    return {
        theta1: s.theta1 * k,
        theta2: s.theta2 * k,
        omega1: s.omega1 * k,
        omega2: s.omega2 * k,
    };
}
function createAnchor(url, fileName, text) {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.textContent = text;
    return a;
}
/** iOS/Android: AudioContext muss synchron im Tap-Handler angestossen werden. */
function configureMobileAudioSession() {
    const nav = navigator;
    if (nav.audioSession) {
        nav.audioSession.type = "playback";
    }
}
function primeAudioContextSync() {
    configureMobileAudioSession();
    const ctx = Tone.getContext().rawContext;
    if (ctx.state === "running")
        return;
    try {
        const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
    }
    catch {
        // Stille Probe nicht moeglich — resume reicht oft.
    }
    void ctx.resume();
}
async function ensureAudioRunning() {
    configureMobileAudioSession();
    await Tone.start();
    const ctx = Tone.getContext().rawContext;
    if (ctx.state !== "running") {
        await ctx.resume();
    }
    Tone.Destination.volume.value = 1;
    Tone.Destination.mute = false;
    return ctx.state === "running";
}
let lastAudioResumeAttempt = 0;
function keepAudioAlive() {
    const now = performance.now();
    if (now - lastAudioResumeAttempt < 1500)
        return;
    const ctx = Tone.getContext().rawContext;
    if (ctx.state !== "suspended")
        return;
    lastAudioResumeAttempt = now;
    primeAudioContextSync();
    void ctx.resume();
}
async function decodeToWavBlob(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const ctx = new AudioContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const wavBuffer = audioBufferToWav(audioBuffer);
    await ctx.close();
    return new Blob([wavBuffer], { type: "audio/wav" });
}
function audioBufferToWav(buffer) {
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const samples = buffer.length;
    const bytesPerSample = 2;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples * blockAlign;
    const totalSize = 44 + dataSize;
    const out = new ArrayBuffer(totalSize);
    const view = new DataView(out);
    let offset = 0;
    const writeString = (str) => {
        for (let i = 0; i < str.length; i += 1) {
            view.setUint8(offset++, str.charCodeAt(i));
        }
    };
    writeString("RIFF");
    view.setUint32(offset, 36 + dataSize, true);
    offset += 4;
    writeString("WAVE");
    writeString("fmt ");
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint16(offset, channels, true);
    offset += 2;
    view.setUint32(offset, sampleRate, true);
    offset += 4;
    view.setUint32(offset, byteRate, true);
    offset += 4;
    view.setUint16(offset, blockAlign, true);
    offset += 2;
    view.setUint16(offset, 16, true);
    offset += 2;
    writeString("data");
    view.setUint32(offset, dataSize, true);
    offset += 4;
    const interleaved = new Float32Array(samples * channels);
    for (let ch = 0; ch < channels; ch += 1) {
        const channelData = buffer.getChannelData(ch);
        for (let i = 0; i < samples; i += 1) {
            interleaved[i * channels + ch] = channelData[i];
        }
    }
    for (let i = 0; i < interleaved.length; i += 1) {
        const s = Math.max(-1, Math.min(1, interleaved[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
    }
    return out;
}
const INITIAL_STATE = {
    theta1: Math.PI * 0.95,
    theta2: Math.PI * 0.95 + 0.01,
    omega1: 0,
    omega2: 0,
};
function bootstrap() {
    const canvas = document.getElementById("simCanvas");
    const startButton = document.getElementById("startButton");
    const pauseButton = document.getElementById("pauseButton");
    const stopButton = document.getElementById("stopButton");
    const recordButton = document.getElementById("recordButton");
    const statusEl = document.getElementById("status");
    const statusBadge = document.getElementById("statusBadge");
    const downloadsEl = document.getElementById("downloads");
    const setStatus = (text, state) => {
        statusEl.textContent = text;
        statusBadge.dataset.state = state;
    };
    const params = {
        m1: 1,
        m2: 1,
        l1: 1,
        l2: 1,
        g: 9.81,
    };
    const simulation = new DoublePendulumSimulation(params, { ...INITIAL_STATE });
    const flyingBall = new FlyingBallSimulation();
    const ballSpeedInput = document.getElementById("ballSpeed");
    ballSpeedInput.addEventListener("input", () => {
        const speed = Number(ballSpeedInput.value);
        updateFaderVisual(ballSpeedInput, faderReadout(ballSpeedInput), String(speed));
        flyingBall.setSpeed(speed);
    });
    updateFaderVisual(ballSpeedInput, faderReadout(ballSpeedInput), ballSpeedInput.value);
    const renderer = new Renderer(canvas);
    renderer.resize();
    renderer.resetVisuals();
    window.addEventListener("resize", () => renderer.resize());
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && running && !paused) {
            primeAudioContextSync();
            void ensureAudioRunning();
        }
    });
    const unlockOnTouch = () => {
        primeAudioContextSync();
        document.removeEventListener("touchstart", unlockOnTouch, true);
    };
    document.addEventListener("touchstart", unlockOnTouch, { capture: true, passive: true });
    let audioEngine = null;
    let recorder = null;
    let audioBootstrapping = false;
    new MixerController((channel, level) => audioEngine?.setMixerLevel(channel, level), document.getElementById("mixer"));
    new EffectsController((level) => audioEngine?.setReverbWet(level), (channel, level) => audioEngine?.setDelayWet(channel, level), document.getElementById("effects"));
    let started = false;
    let running = false;
    let paused = false;
    let recording = false;
    let lastFrame = performance.now();
    let previousState = simulation.getState();
    const setUiRunning = () => {
        startButton.disabled = true;
        pauseButton.disabled = false;
        stopButton.disabled = false;
        recordButton.disabled = false;
        pauseButton.textContent = "Pause";
    };
    const resetSimulation = () => {
        simulation.reset({ ...INITIAL_STATE });
        previousState = simulation.getState();
        renderer.resetVisuals();
        audioEngine?.resetTriggers();
        const boundary = computeBoundaryRadiusPx(canvas.clientWidth, canvas.clientHeight, params);
        flyingBall.reset(boundary);
    };
    const stopSimulation = () => {
        if (recording) {
            recorder?.release();
            recording = false;
            recordButton.classList.remove("active");
        }
        running = false;
        paused = false;
        resetSimulation();
        startButton.disabled = false;
        pauseButton.disabled = true;
        stopButton.disabled = true;
        recordButton.disabled = true;
        pauseButton.textContent = "Pause";
        setStatus("Gestoppt", "stopped");
        renderer.draw(simulation.getState(), params, false, true, null);
    };
    const isPendulumStill = (state) => {
        if (!running || paused)
            return true;
        return Math.abs(state.omega1) + Math.abs(state.omega2) < 0.08;
    };
    const frame = (t) => {
        const dtRaw = (t - lastFrame) / 1000;
        lastFrame = t;
        const state = simulation.getState();
        const still = isPendulumStill(state);
        const appendTrail = running && !paused;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const scale = computeDisplayScale(w, h, params);
        const boundaryRadius = computeBoundaryRadiusPx(w, h, params);
        let ballState = null;
        if (running && !paused) {
            keepAudioAlive();
            const dt = Math.min(dtRaw, 0.03);
            const subSteps = 3;
            for (let i = 0; i < subSteps; i += 1) {
                const prevGeom = getPendulumGeometry(previousState, params);
                const stepState = simulation.step(dt / subSteps);
                const nextGeom = getPendulumGeometry(stepState, params);
                const events = {
                    bob1Cross: didCrossLine(prevGeom.y1, nextGeom.y1),
                    bob2Cross: didCrossLine(prevGeom.y2, nextGeom.y2),
                    omega1Flip: didOmegaFlip(previousState.omega1, stepState.omega1),
                    omega2Flip: didOmegaFlip(previousState.omega2, stepState.omega2),
                };
                const flash = audioEngine?.onDynamics(Tone.now(), events);
                if (flash)
                    renderer.applySoundFlash(flash);
                previousState = stepState;
            }
            const latestGeom = getPendulumGeometry(simulation.getState(), params);
            const bob1 = { x: latestGeom.x1 * scale, y: latestGeom.y1 * scale, r: BOB1_DISPLAY_RADIUS };
            const bob2 = { x: latestGeom.x2 * scale, y: latestGeom.y2 * scale, r: BOB2_DISPLAY_RADIUS };
            const ballEvents = flyingBall.step(dt, Tone.now(), boundaryRadius, bob1, bob2);
            audioEngine?.onBallCollisions(Tone.now(), ballEvents);
            ballState = flyingBall.getState();
            renderer.draw(simulation.getState(), params, appendTrail, still, ballState);
        }
        else if (running && paused) {
            ballState = flyingBall.getState();
            renderer.draw(state, params, false, still, ballState);
        }
        else {
            renderer.draw(state, params, false, still, null);
        }
        requestAnimationFrame(frame);
    };
    startButton.addEventListener("click", async () => {
        if (audioBootstrapping)
            return;
        audioBootstrapping = true;
        startButton.disabled = true;
        try {
            primeAudioContextSync();
            if (!audioEngine) {
                audioEngine = new AudioEngine();
                recorder = new RecorderController(setStatus, downloadsEl);
            }
            const audioOk = await ensureAudioRunning();
            if (!audioOk) {
                startButton.disabled = false;
                setStatus("Audio blockiert — bitte erneut tippen", "error");
                return;
            }
            if (!started) {
                started = true;
                const boundary = computeBoundaryRadiusPx(canvas.clientWidth, canvas.clientHeight, params);
                flyingBall.reset(boundary);
            }
            else if (!running) {
                resetSimulation();
            }
            running = true;
            paused = false;
            setUiRunning();
            setStatus("Simulation aktiv", "active");
        }
        catch {
            startButton.disabled = false;
            setStatus("Audio konnte nicht starten", "error");
        }
        finally {
            audioBootstrapping = false;
        }
    });
    pauseButton.addEventListener("click", async () => {
        if (!started || !running)
            return;
        paused = !paused;
        if (!paused) {
            primeAudioContextSync();
            await ensureAudioRunning();
        }
        pauseButton.textContent = paused ? "Weiter" : "Pause";
        setStatus(paused ? "Pausiert" : "Simulation aktiv", paused ? "paused" : "active");
        const ballState = running ? flyingBall.getState() : null;
        renderer.draw(simulation.getState(), params, false, true, ballState);
    });
    stopButton.addEventListener("click", () => {
        if (!started)
            return;
        stopSimulation();
    });
    recordButton.addEventListener("click", () => {
        if (!recorder || !started)
            return;
        primeAudioContextSync();
        void ensureAudioRunning();
        if (!recording) {
            recorder.start();
            recording = true;
            recordButton.classList.add("active");
            return;
        }
        recorder.stop();
        recording = false;
        recordButton.classList.remove("active");
    });
    requestAnimationFrame(frame);
}
bootstrap();
