/** Skalenbasierter Melodiespieler mit injizierbaren Stimmen. */
export class ScaleMelodyPlayer {
    constructor(scale, voices, durationRange = [0.08, 0.36], velocityRange = [0.22, 0.7], maxStep = 4) {
        this.scale = scale;
        this.voices = voices;
        this.durationRange = durationRange;
        this.velocityRange = velocityRange;
        this.maxStep = maxStep;
        this.nodes = [];
        this.scaleIndex = Math.floor(scale.length / 2);
    }
    registerNode(node) {
        this.nodes.push(node);
    }
    play(now) {
        this.scaleIndex = this.pickNextIndex();
        const note = this.scale[this.scaleIndex];
        const voice = this.pickVoice();
        const duration = this.durationRange[0] + Math.random() * (this.durationRange[1] - this.durationRange[0]);
        const velocity = this.velocityRange[0] + Math.random() * (this.velocityRange[1] - this.velocityRange[0]);
        voice.play(note, duration, now, velocity);
    }
    reset() {
        this.scaleIndex = Math.floor(this.scale.length / 2);
    }
    dispose() {
        for (const node of this.nodes) {
            try {
                node.dispose();
            }
            catch {
                // Bereits freigegeben.
            }
        }
        this.nodes.length = 0;
    }
    pickVoice() {
        const r = Math.random();
        let sum = 0;
        for (const voice of this.voices) {
            sum += voice.weight;
            if (r <= sum)
                return voice;
        }
        return this.voices[this.voices.length - 1];
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
function connectChain(nodes, output) {
    if (nodes.length === 0)
        return output;
    for (let i = 0; i < nodes.length - 1; i += 1) {
        nodes[i].connect(nodes[i + 1]);
    }
    nodes[nodes.length - 1].connect(output);
    return nodes[0];
}
export function makeMonoVoice(output, options, nodes) {
    const synth = new Tone.MonoSynth(options);
    const chain = [];
    connectChain(chain, output);
    synth.connect(chain[0] ?? output);
    nodes.push(synth, ...chain);
    return {
        weight: 1,
        play: (note, duration, now, velocity) => {
            synth.triggerAttackRelease(note, duration, now, velocity);
        },
    };
}
export function makeFmVoice(output, options, weight, nodes) {
    const synth = new Tone.FMSynth(options);
    synth.connect(output);
    nodes.push(synth);
    return {
        weight,
        play: (note, duration, now, velocity) => {
            synth.triggerAttackRelease(note, duration, now, velocity);
        },
    };
}
export function makePluckVoice(output, options, weight, nodes, through) {
    const synth = new Tone.PluckSynth(options);
    if (through) {
        synth.connect(through);
        through.connect(output);
        nodes.push(synth, through);
    }
    else {
        synth.connect(output);
        nodes.push(synth);
    }
    return {
        weight,
        play: (note, duration, now, velocity) => {
            synth.triggerAttackRelease(note, duration, now, velocity);
        },
    };
}
export { connectChain };
