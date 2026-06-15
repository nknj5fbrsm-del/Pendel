import { AudioEngine, AUDIO_BUNDLE_STORAGE_KEY, parseAudioBundleId, } from "./audio/engine.js";
import { createSnapshot } from "./audio/simulation-snapshot.js";
import { BundleController, EffectsController, faderReadout, MixerController, SoundBankController, syncMixerFaderDom, syncReverbFaderDom, updateFaderVisual, } from "./audio/ui-controls.js";
import { parseSoundBankId, SOUND_BANK_STORAGE_KEY } from "./audio/types.js";
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
    getSpeed() {
        return Math.hypot(this.vx, this.vy);
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
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        this.ctx.lineWidth = 0.6;
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
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
        this.ctx.lineWidth = 0.65;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        for (let deg = 0; deg < 360; deg += 15) {
            const rad = (deg * Math.PI) / 180;
            const major = deg % 30 === 0;
            const tickLen = major ? 8 : 5;
            const sin = Math.sin(rad);
            const cos = Math.cos(rad);
            this.ctx.strokeStyle = major
                ? "rgba(255, 255, 255, 0.48)"
                : "rgba(255, 255, 255, 0.24)";
            this.ctx.lineWidth = major ? 0.75 : 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(cx + radius * sin, cy + radius * cos);
            this.ctx.lineTo(cx + (radius - tickLen) * sin, cy + (radius - tickLen) * cos);
            this.ctx.stroke();
            if (major) {
                const labelR = radius + 10;
                this.ctx.fillStyle = "rgba(255, 255, 255, 0.52)";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(`${deg}°`, cx + labelR * sin, cy + labelR * cos);
            }
        }
        this.ctx.restore();
    }
    fadeTrail(trail) {
        for (const p of trail) {
            p.life *= 0.995;
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
        this.ctx.lineWidth = 0.7;
        for (let i = 1; i < trail.length; i += 1) {
            const prev = trail[i - 1];
            const p = trail[i];
            const dx = p.x - prev.x;
            const dy = p.y - prev.y;
            if (dx * dx + dy * dy < 0.25)
                continue;
            const t = i / trail.length;
            const alpha = Math.max(0, p.life * (0.14 + t * 0.5));
            this.ctx.strokeStyle = `rgba(255, 85, 130, ${alpha})`;
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
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.44)";
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
function syncMobileTransportInset() {
    const transport = document.querySelector(".transport");
    const main = document.querySelector(".main");
    if (!transport || !main)
        return;
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    if (mobile) {
        main.style.paddingTop = `${transport.offsetHeight}px`;
    }
    else {
        main.style.paddingTop = "";
    }
}
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
    window.addEventListener("resize", () => {
        renderer.resize();
        syncMobileTransportInset();
    });
    syncMobileTransportInset();
    window.addEventListener("load", syncMobileTransportInset);
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
    const savedBundle = parseAudioBundleId(localStorage.getItem(AUDIO_BUNDLE_STORAGE_KEY));
    const savedSoundBank = parseSoundBankId(localStorage.getItem(SOUND_BANK_STORAGE_KEY));
    let selectedBundle = savedBundle;
    let selectedSoundBank = savedSoundBank;
    const mixerEl = document.getElementById("mixer");
    const effectsEl = document.getElementById("effects");
    const soundBankSection = document.getElementById("soundBankSection");
    const syncSoundBankVisibility = (bundleId) => {
        soundBankSection.hidden = bundleId !== "classic";
    };
    syncSoundBankVisibility(savedBundle);
    const audioUiTarget = {
        setMixerLevel: (channel, level) => {
            audioEngine?.setMixerLevel(channel, level);
            syncMixerFaderDom(mixerEl, channel, level);
        },
        setReverbWet: (level) => {
            audioEngine?.setReverbWet(level);
            syncReverbFaderDom(effectsEl, level);
        },
    };
    const audioBundlesEl = document.getElementById("audioBundles");
    const bundleDescriptionEl = document.getElementById("bundleDescription");
    BundleController.renderButtons(audioBundlesEl);
    new BundleController((id) => {
        selectedBundle = id;
        audioEngine?.setBundle(id);
        localStorage.setItem(AUDIO_BUNDLE_STORAGE_KEY, id);
        syncSoundBankVisibility(id);
    }, audioBundlesEl, bundleDescriptionEl, savedBundle);
    const soundBanksEl = document.getElementById("soundBanks");
    SoundBankController.renderButtons(soundBanksEl);
    new SoundBankController((id) => {
        selectedSoundBank = id;
        audioEngine?.setSoundBank(id);
        localStorage.setItem(SOUND_BANK_STORAGE_KEY, id);
    }, soundBanksEl, savedSoundBank);
    new MixerController((channel, level) => audioEngine?.setMixerLevel(channel, level), mixerEl);
    new EffectsController((level) => audioEngine?.setReverbWet(level), (channel, level) => audioEngine?.setDelayWet(channel, level), effectsEl);
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
                const subSnap = createSnapshot(stepState, simulation.kineticEnergy(), {
                    x: flyingBall.getState().x,
                    y: flyingBall.getState().y,
                    speed: flyingBall.getSpeed(),
                }, still, dt / subSteps);
                const events = audioEngine?.detectDynamics(Tone.now(), previousState, stepState, prevGeom, nextGeom, simulation.kineticEnergy());
                const flash = events ? audioEngine?.onDynamics(Tone.now(), events, subSnap) : undefined;
                if (flash)
                    renderer.applySoundFlash(flash);
                previousState = stepState;
            }
            const latestGeom = getPendulumGeometry(simulation.getState(), params);
            const bob1 = { x: latestGeom.x1 * scale, y: latestGeom.y1 * scale, r: BOB1_DISPLAY_RADIUS };
            const bob2 = { x: latestGeom.x2 * scale, y: latestGeom.y2 * scale, r: BOB2_DISPLAY_RADIUS };
            const ballEvents = flyingBall.step(dt, Tone.now(), boundaryRadius, bob1, bob2);
            const frameSnap = createSnapshot(simulation.getState(), simulation.kineticEnergy(), {
                x: flyingBall.getState().x,
                y: flyingBall.getState().y,
                speed: flyingBall.getSpeed(),
            }, still, dt);
            audioEngine?.onBallCollisions(Tone.now(), ballEvents, frameSnap);
            audioEngine?.onFrame(Tone.now(), frameSnap);
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
                audioEngine = new AudioEngine(selectedBundle, selectedSoundBank, audioUiTarget);
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
