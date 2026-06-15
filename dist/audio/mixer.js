export const MIXER_DEFAULTS = {
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
export class AudioMixer {
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
