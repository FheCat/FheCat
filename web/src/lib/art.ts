import { ART } from '@art';

/** Builds the DNA that selects option `picks[i]` for trait i (e.g. to illustrate a trait). */
export function dnaFor(picks: number[]): bigint {
  return ART.traits.reduce((dna, trait, i) => {
    const k = picks[i] ?? 0;
    const start = trait.weights.slice(0, k).reduce((a, b) => a + b, 0);
    return dna | (BigInt(start) << BigInt(8 * i));
  }, 0n);
}
