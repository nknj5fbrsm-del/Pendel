/** Euklidischer Rhythmus — Bjorklund-Verteilung. */
export function euclideanHit(pulses: number, steps: number, stepIndex: number): boolean {
  if (steps <= 0 || pulses <= 0) return false;
  const idx = ((stepIndex % steps) + steps) % steps;
  const pattern: boolean[] = [];
  let bucket = 0;
  for (let i = 0; i < steps; i += 1) {
    bucket += pulses;
    if (bucket >= steps) {
      bucket -= steps;
      pattern.push(true);
    } else {
      pattern.push(false);
    }
  }
  return pattern[idx] ?? false;
}

/** Zufälliger Timing-Jitter in Sekunden. */
export function jitterSeconds(maxMs = 14): number {
  return ((Math.random() - 0.5) * maxMs) / 1000;
}
