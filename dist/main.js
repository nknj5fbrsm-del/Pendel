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
class MelodyGenerator {
    constructor(color) {
        this.maxStep = 2;
        const out = new Tone.Gain(0.7).toDestination();
        if (color === "bright") {
            this.scale = ["E4", "G4", "B4", "D5", "E5", "G5", "B5", "D6"];
            this.scaleIndex = 3;
            const filter = new Tone.Filter({ type: "highpass", frequency: 180, Q: 0.7 });
            this.synth = new Tone.FMSynth({
                harmonicity: 3.2,
                modulationIndex: 2.4,
                oscillator: { type: "triangle" },
                envelope: { attack: 0.004, decay: 0.2, sustain: 0.03, release: 0.26 },
                modulation: { type: "sine" },
                modulationEnvelope: { attack: 0.004, decay: 0.14, sustain: 0, release: 0.18 },
            }).connect(filter).connect(out);
        }
        else {
            this.scale = ["D3", "E3", "G3", "A3", "B3", "D4", "E4", "G4", "A4"];
            this.scaleIndex = 4;
            const filter = new Tone.Filter({ type: "lowpass", frequency: 2200, Q: 0.5 });
            this.synth = new Tone.FMSynth({
                harmonicity: 1.4,
                modulationIndex: 0.7,
                oscillator: { type: "sine" },
                envelope: { attack: 0.035, decay: 0.42, sustain: 0.14, release: 0.58 },
                modulation: { type: "triangle" },
                modulationEnvelope: { attack: 0.025, decay: 0.38, sustain: 0.06, release: 0.42 },
            }).connect(filter).connect(out);
        }
    }
    play(now) {
        this.scaleIndex = this.pickNextIndex();
        const note = this.scale[this.scaleIndex];
        const velocity = 0.3 + Math.random() * 0.2;
        const duration = 0.16 + Math.random() * 0.24;
        this.synth.triggerAttackRelease(note, duration, now, velocity);
    }
    reset() {
        this.scaleIndex = 4;
    }
    pickNextIndex() {
        const step = Math.floor(Math.random() * (this.maxStep * 2 + 1)) - this.maxStep;
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
        this.melodyBob1 = new MelodyGenerator("bright");
        this.melodyBob2 = new MelodyGenerator("warm");
        this.lastMelodyBob1Time = 0;
        this.lastMelodyBob2Time = 0;
        this.lastClickBob1 = 0;
        this.bob1CrossAt = -1;
        this.bob1FlipAt = -1;
        this.bob2CrossAt = -1;
        this.bob2FlipAt = -1;
        this.clickCooldown = 0.04;
        this.melodyCooldown = 0.1;
        this.pairWindow = 0.25;
        this.clickSynth = new Tone.MembraneSynth({
            pitchDecay: 0.005,
            octaves: 1,
            oscillator: { type: "sine" },
            envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.03 },
        }).toDestination();
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
    pairedWithinWindow(crossAt, flipAt, now) {
        if (crossAt < 0 || flipAt < 0)
            return false;
        if (now - crossAt > this.pairWindow || now - flipAt > this.pairWindow)
            return false;
        return Math.abs(crossAt - flipAt) <= this.pairWindow;
    }
}
class RecorderController {
    constructor(statusEl, downloadsEl) {
        this.statusEl = statusEl;
        this.downloadsEl = downloadsEl;
        this.recorder = null;
        this.chunks = [];
        const rawCtx = Tone.getContext().rawContext;
        this.streamDestination = rawCtx.createMediaStreamDestination();
        Tone.Destination.connect(this.streamDestination);
    }
    start() {
        if (this.recorder && this.recorder.state === "recording") {
            return;
        }
        const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
        const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
        this.chunks = [];
        this.recorder = new MediaRecorder(this.streamDestination.stream, mimeType ? { mimeType } : undefined);
        this.recorder.ondataavailable = (ev) => {
            if (ev.data.size > 0)
                this.chunks.push(ev.data);
        };
        this.recorder.onstop = async () => {
            const blob = new Blob(this.chunks, {
                type: this.recorder?.mimeType || "audio/webm",
            });
            await this.createDownloadLinks(blob);
        };
        this.recorder.start(100);
        this.statusEl.textContent = "Aufnahme laeuft";
    }
    stop() {
        if (!this.recorder || this.recorder.state !== "recording") {
            return;
        }
        this.recorder.stop();
        this.statusEl.textContent = "Aufnahme wird verarbeitet";
    }
    async createDownloadLinks(sourceBlob) {
        this.downloadsEl.innerHTML = "";
        const webmUrl = URL.createObjectURL(sourceBlob);
        this.downloadsEl.appendChild(createAnchor(webmUrl, "pendel-audio.webm", "Download .webm"));
        try {
            const wavBlob = await decodeToWavBlob(sourceBlob);
            const wavUrl = URL.createObjectURL(wavBlob);
            this.downloadsEl.appendChild(createAnchor(wavUrl, "pendel-audio.wav", "Download .wav"));
            this.statusEl.textContent = "Aufnahme bereit (.webm/.wav)";
        }
        catch {
            this.statusEl.textContent = "Aufnahme bereit (.webm)";
        }
    }
}
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.trailBob2 = [];
        this.flashBob1 = 0;
        this.flashBob2 = 0;
        this.rainbowHueBob2 = 0;
        this.bob1Radius = 3.5;
        this.bob2Radius = 4.5;
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
    }
    draw(state, params, appendTrail = true, isStill = false) {
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
            while (this.trailBob2.length > 700)
                this.trailBob2.shift();
        }
        this.ctx.fillStyle = "rgba(6, 4, 12, 0.14)";
        this.ctx.fillRect(0, 0, w, h);
        const angleRadius = this.angleCircleRadius(params, scale);
        this.drawAngleScale(cx, cy, angleRadius);
        this.updateAndDrawRainbowTrail(this.trailBob2, 0.72, 88);
        this.ctx.strokeStyle = "rgba(200, 180, 255, 0.14)";
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, cy);
        this.ctx.lineTo(w, cy);
        this.ctx.stroke();
        this.drawArm(cx, cy, x1, y1, "rgba(126, 184, 255, 0.1)");
        this.drawArm(x1, y1, x2, y2, "rgba(255, 126, 184, 0.08)");
        this.flashBob1 = Math.max(0, this.flashBob1 - 0.08);
        this.flashBob2 = Math.max(0, this.flashBob2 - 0.08);
        const breath = isStill ? 0.5 + 0.5 * Math.sin(performance.now() * 0.0035) : 0;
        const pulseScale = isStill ? 0.82 + breath * 0.28 : 1;
        const pulseAlpha = isStill ? 0.55 + breath * 0.45 : 1;
        if (isStill) {
            this.drawPulseRing(x1, y1, this.bob1Radius, "rgba(126, 184, 255,", breath);
            this.drawPulseRing(x2, y2, this.bob2Radius, "rgba(255, 126, 184,", breath);
        }
        this.drawBob(x1, y1, this.bob1Radius * pulseScale, "#9ec8ff", "#f0f7ff", this.flashBob1, pulseAlpha);
        this.drawBob(x2, y2, this.bob2Radius * pulseScale, "#ff8ec4", "#fff0f7", this.flashBob2, pulseAlpha);
        this.ctx.fillStyle = "rgba(232, 224, 248, 0.75)";
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, this.pivotRadius, 0, Math.PI * 2);
        this.ctx.fill();
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
        this.ctx.font = "500 9px Outfit, system-ui, sans-serif";
        this.ctx.strokeStyle = "rgba(160, 140, 200, 0.14)";
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
                ? "rgba(180, 165, 220, 0.38)"
                : "rgba(180, 165, 220, 0.2)";
            this.ctx.lineWidth = major ? 0.55 : 0.35;
            this.ctx.beginPath();
            this.ctx.moveTo(cx + radius * sin, cy + radius * cos);
            this.ctx.lineTo(cx + (radius - tickLen) * sin, cy + (radius - tickLen) * cos);
            this.ctx.stroke();
            if (major) {
                const labelR = radius + 11;
                this.ctx.fillStyle = "rgba(155, 145, 190, 0.75)";
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
    updateAndDrawRainbowTrail(trail, hueSpeed, saturation) {
        this.fadeTrail(trail);
        this.rainbowHueBob2 = (this.rainbowHueBob2 + hueSpeed) % 360;
        const baseHue = this.rainbowHueBob2;
        this.ctx.shadowBlur = 0;
        for (let i = 1; i < trail.length; i += 1) {
            const prev = trail[i - 1];
            const p = trail[i];
            const hue = (baseHue + i * 0.65) % 360;
            const alpha = Math.max(0, p.life * 0.42);
            this.ctx.strokeStyle = `hsla(${hue}, ${saturation}%, 68%, ${alpha})`;
            this.ctx.lineWidth = this.trailWidth;
            this.ctx.lineCap = "round";
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
        this.ctx.strokeStyle = "rgba(210, 215, 240, 0.38)";
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
    const downloadsEl = document.getElementById("downloads");
    const params = {
        m1: 1,
        m2: 1,
        l1: 1,
        l2: 1,
        g: 9.81,
    };
    const simulation = new DoublePendulumSimulation(params, { ...INITIAL_STATE });
    const renderer = new Renderer(canvas);
    renderer.resize();
    window.addEventListener("resize", () => renderer.resize());
    let audioEngine = null;
    let recorder = null;
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
    };
    const stopSimulation = () => {
        if (recording) {
            recorder?.stop();
            recording = false;
            recordButton.textContent = "Aufnahme";
            recordButton.classList.remove("active");
        }
        running = false;
        paused = false;
        resetSimulation();
        startButton.disabled = false;
        pauseButton.disabled = true;
        stopButton.disabled = true;
        pauseButton.textContent = "Pause";
        statusEl.textContent = "Gestoppt";
        renderer.draw(simulation.getState(), params, false, true);
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
        if (running && !paused) {
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
            renderer.draw(simulation.getState(), params, appendTrail, still);
        }
        else {
            renderer.draw(state, params, false, still);
        }
        requestAnimationFrame(frame);
    };
    startButton.addEventListener("click", async () => {
        await Tone.start();
        if (!audioEngine) {
            audioEngine = new AudioEngine();
            recorder = new RecorderController(statusEl, downloadsEl);
        }
        if (!started) {
            started = true;
        }
        else if (!running) {
            resetSimulation();
        }
        running = true;
        paused = false;
        setUiRunning();
        statusEl.textContent = "Simulation aktiv";
    });
    pauseButton.addEventListener("click", () => {
        if (!started || !running)
            return;
        paused = !paused;
        pauseButton.textContent = paused ? "Weiter" : "Pause";
        statusEl.textContent = paused ? "Pausiert" : "Simulation aktiv";
        renderer.draw(simulation.getState(), params, false, true);
    });
    stopButton.addEventListener("click", () => {
        if (!started)
            return;
        stopSimulation();
    });
    recordButton.addEventListener("click", () => {
        if (!recorder || !started)
            return;
        if (!recording) {
            recorder.start();
            recording = true;
            recordButton.textContent = "Aufnahme ●";
            recordButton.classList.add("active");
            return;
        }
        recorder.stop();
        recording = false;
        recordButton.textContent = "Aufnahme";
        recordButton.classList.remove("active");
    });
    requestAnimationFrame(frame);
}
bootstrap();
