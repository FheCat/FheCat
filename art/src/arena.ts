import { ART } from './art';
import { decodeDna } from './render';

/**
 * The Blind Arena's rules in plain TypeScript: the same arithmetic FheCatArena runs under FHE.
 * The mint site uses it to show a holder who has seen their cat what its instincts are, and the
 * contract tests use it as the reference.
 */

/** Tactics by their on-chain number. Each beats the next one: Pounce > Trick > Guard > Pounce. */
export const TACTICS = ['Pounce', 'Trick', 'Guard'] as const;
export type Tactic = 0 | 1 | 2;

/** Whether tactic a beats tactic b. */
export function beats(a: Tactic, b: Tactic): boolean {
  return b === (a + 1) % 3;
}

/** The two traits (indices into ART.traits) behind each tactic's instinct, in tactic order. */
export const INSTINCT_TRAITS: readonly (readonly [number, number])[] = [
  [2, 3], // Pounce: Pattern + Eyes
  [4, 5], // Trick: Mouth + Headwear
  [6, 7], // Guard: Accessory + Aura
];

/**
 * The DNA byte from which each trait counts toward an instinct: where the rarer half of its
 * options starts (options run from most common to rarest). Background and Fur never count.
 * FheCatArena hard-codes the same numbers.
 */
export const INSTINCT_FROM: readonly number[] = [256, 256, 126, 120, 116, 130, 132, 154];

/** The first option that counts toward an instinct, for each trait that has one. */
export function instinctFromOption(traitIndex: number): string | null {
  const from = INSTINCT_FROM[traitIndex];
  const t = ART.traits[traitIndex];
  let start = 0;
  for (let k = 0; k < t.weights.length; k++) {
    if (start === from) return t.names[k];
    start += t.weights[k];
  }
  return null;
}

/** Whether a trait (by index) of this DNA counts toward its tactic's instinct. */
export function countsForInstinct(dna: bigint, traitIndex: number): boolean {
  return Number((dna >> BigInt(8 * traitIndex)) & 0xffn) >= INSTINCT_FROM[traitIndex];
}

/** The cat's instinct (0-2) for each tactic, in tactic order. */
export function instinctsOf(dna: bigint): [number, number, number] {
  return INSTINCT_TRAITS.map(([a, b]) => Number(countsForInstinct(dna, a)) + Number(countsForInstinct(dna, b))) as [
    number,
    number,
    number,
  ];
}

/** Rock-paper-scissors points in a duel: 2 for the tactic that wins, 0 otherwise. */
export const RPS_POINTS = 2;

/**
 * A duel's outcome: 1 if the challenger wins, 2 if the opponent does. `luck` is the duel's random
 * draw (bit 0 the challenger's luck, bit 1 the opponent's, bit 2 the coin); out-of-range tactics
 * count as Pounce, as on chain.
 */
export function duelOutcome(p: {
  challengerDna: bigint;
  opponentDna: bigint;
  challengerTactic: number;
  opponentTactic: number;
  luck: bigint;
  challengerSealed: boolean;
  opponentSealed: boolean;
}): 1 | 2 {
  const a = (p.challengerTactic < 3 ? p.challengerTactic : 0) as Tactic;
  const b = (p.opponentTactic < 3 ? p.opponentTactic : 0) as Tactic;
  const scoreA = (beats(a, b) ? RPS_POINTS : 0) + instinctsOf(p.challengerDna)[a] + Number(p.luck & 1n);
  const scoreB = (beats(b, a) ? RPS_POINTS : 0) + instinctsOf(p.opponentDna)[b] + Number((p.luck >> 1n) & 1n);
  if (scoreA !== scoreB) return scoreA > scoreB ? 1 : 2;
  if (p.challengerSealed !== p.opponentSealed) return p.challengerSealed ? 1 : 2;
  return ((p.luck >> 2n) & 1n) === 1n ? 2 : 1;
}

/** The trait names that count toward each instinct, for a DNA (for "why" hints). */
export function instinctReasons(dna: bigint): string[][] {
  const options = decodeDna(dna);
  return INSTINCT_TRAITS.map((pair) =>
    pair.filter((i) => countsForInstinct(dna, i)).map((i) => ART.traits[i].names[options[i]]),
  );
}
