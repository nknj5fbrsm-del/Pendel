/** Euklidischer Rhythmus — Bjorklund-Verteilung. */
export function euclideanHit(pulses, steps, stepIndex) {
    if (steps <= 0 || pulses <= 0)
        return false;
    const idx = ((stepIndex % steps) + steps) % steps;
    const pattern = [];
    let bucket = 0;
    for (let i = 0; i < steps; i += 1) {
        bucket += pulses;
        if (bucket >= steps) {
            bucket -= steps;
            pattern.push(true);
        }
        else {
            pattern.push(false);
        }
    }
    return pattern[idx] ?? false;
}
/** Zufälliger Timing-Jitter in Sekunden. */
export function jitterSeconds(maxMs = 14) {
    return ((Math.random() - 0.5) * maxMs) / 1000;
}
