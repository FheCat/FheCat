import { ART } from '@art';

/** Builds the DNA that selects option `picks[i]` for trait i (e.g. to illustrate a trait). */
export function dnaFor(picks: number[]): bigint {
  return ART.traits.reduce((dna, trait, i) => {
    const k = picks[i] ?? 0;
    const start = trait.weights.slice(0, k).reduce((a, b) => a + b, 0);
    return dna | (BigInt(start) << BigInt(8 * i));
  }, 0n);
}

/** Option index by name, for readable illustrations. */
export function pick(trait: number, name: string): number {
  const i = ART.traits[trait].names.indexOf(name);
  if (i < 0) throw new Error(`unknown ${ART.traits[trait].label} "${name}"`);
  return i;
}

/** [background, fur, pattern, eyes, mouth, headwear, accessory, aura] by name. */
export function dnaNamed(names: [string, string, string, string, string, string, string, string]): bigint {
  return dnaFor(names.map((n, i) => pick(i, n)));
}
