import { Encryptable, type CofheClient } from '@cofhe/sdk';
import { TACTICS, type Tactic } from '@art';
import type { Rows } from '../pixel/fc';
import { failure } from './format';

/**
 * The Blind Arena on the site: tactics, badges, and locking a tactic. The rules themselves
 * (instincts, scoring) live in /art/src/arena.ts, shared with the contract tests.
 */

export const TACTIC_LIST: { id: Tactic; name: string; beats: string; from: string; icon: Rows }[] = [
  {
    id: 0,
    name: TACTICS[0],
    beats: TACTICS[1],
    from: 'Pattern + Eyes',
    // a paw, mid-swipe
    icon: ['.X.X.', 'X...X', '.XXX.', 'XXXXX', '.XXX.'],
  },
  {
    id: 1,
    name: TACTICS[1],
    beats: TACTICS[2],
    from: 'Mouth + Headwear',
    // a question
    icon: ['.XXX.', 'X...X', '...X.', '..X..', '.....', '..X..'],
  },
  {
    id: 2,
    name: TACTICS[2],
    beats: TACTICS[0],
    from: 'Accessory + Aura',
    // a shield
    icon: ['XXXXX', 'X...X', 'X...X', '.X.X.', '..X..'],
  },
];

/** FheCatArena badge bits, with what earns them. */
export const BADGES = [
  { bit: 1, name: 'First Blood', about: 'Won a duel.' },
  { bit: 2, name: 'Won Blind', about: 'Won with a sealed box: nobody had ever seen the cat.' },
  { bit: 4, name: 'Hat-trick', about: 'Three wins in a row.' },
  { bit: 8, name: 'Sealed Legend', about: 'Five wins without ever being seen.' },
  { bit: 16, name: 'Weekly Crown', about: 'Top of a week’s table.' },
] as const;

export const badgesOf = (bits: number) => BADGES.filter((b) => (bits & b.bit) !== 0);

/** Weekly points, as FheCatArena counts them. */
export const POINTS = { win: 3, sealedWin: 4, loss: 1 } as const;

/** How long a challenge stays open (FheCatArena.OPEN_FOR). */
export const OPEN_FOR = 3 * 24 * 3600;

/** FheCatArena's errors, in the holder's words. */
const ERRORS: Record<string, string> = {
  NotHolder: 'That cat is not in this wallet.',
  NotInArena: 'That cat has not entered the arena yet.',
  SameCat: 'A cat cannot fight itself.',
  SameHolder: 'Both cats are yours. Duels are between two holders.',
  AlreadyChallenging: 'This cat already has an open challenge. Withdraw it first.',
  AlreadyMetThisWeek: 'These two cats already met this week. Pick another rival, or wait for Monday.',
  DuelNotOpen: 'That challenge is no longer open.',
  DuelExpired: 'That challenge has expired.',
  NotChallenged: 'That challenge is for another cat.',
  ChallengerMoved: 'The challenging cat changed hands, so the challenge is void.',
  WeekNotOver: 'A week can be crowned one day after it ends.',
  AlreadyCrowned: 'That week already has its crown.',
  NoLeader: 'Nobody scored that week.',
  AlreadySettled: 'Already settled.',
  InvalidDecryptionProof: 'The decryption proof did not check out. Try again.',
};

/** What to tell the holder when an arena action fails. */
export function arenaFailure(e: unknown): string {
  const reason = failure(e);
  return ERRORS[reason] ?? reason;
}

/** Encrypts a tactic in the browser for the arena contract; only the wallet that encrypted it can use it. */
export async function lockTactic(c: CofheClient, arena: `0x${string}`, tactic: Tactic) {
  const [hash, proof] = await c.encryptInputs([Encryptable.uint8(BigInt(tactic))]).setConsumingContract(arena).execute();
  return [hash as `0x${string}`, proof as `0x${string}`] as const;
}

/** "2d 4h", "3h 20m", "12m" until `until` (unix seconds). */
export function timeLeft(until: number, now = Date.now() / 1000): string {
  const s = Math.max(0, Math.floor(until - now));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(m, 1)}m`;
}
