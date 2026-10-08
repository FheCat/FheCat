import { TACTICS, beats, type PoseName, type Tactic } from '@art';
import type { Facing } from './pixels';
import { GROUND, type Fx, type FxKind, type Script, type Seg, type Side } from './stage';

/**
 * Fight choreography: what a viewer may know about a duel (who won, and the two tactics when
 * they hold one of the two cats) turned into a Script for the stage.
 *
 * Each tactic has its moves: Pounce winds up and leaps, Trick vanishes in smoke and strikes from
 * behind, Guard raises a shield. Every pairing is scripted twice, for the expected win and for an
 * upset (the tactic that should lose wins on instinct and luck), and a mirror match has its own
 * dance. Spectators never learn the tactics, so they see a fight cloud and who comes out of it.
 */

export type { Side };

export interface FightPlan {
  /** The two tactics, the challenger's first, when this viewer may see them. */
  tactics?: readonly [Tactic, Tactic] | null;
  /** 0 when the challenger (on the left) won, 1 when the opponent did, null while the arena is deciding. */
  winner: Side | null;
  /** When the clash starts. A live fight waits under FHE until the result is in. */
  clashAt?: number;
}

/** Where the fighters stand, and where they run in from (centre x). */
export const HOME: readonly [number, number] = [52, 108];
const ENTER: readonly [number, number] = [-26, 186];
const MID = 80;
/** Centre to centre when a paw lands, and when it lands on a shield. */
const REACH = 28;
const SHIELD_REACH = 37;
/** A shield's back stands this far in front of its guard; it bulges 6 more. */
const SHIELD_DX = 11;
const SHIELD_Y = 61;

/** The timeline's fixed beats, in seconds. */
export const BEATS = { arrive: 0.9, vs: [1.0, 2.3] as [number, number], lock: 2.4, clash: 3.5 };

const SIDES: readonly Side[] = [0, 1];
const IDLE: PoseName[] = ['idle', 'idle2'];
const RUN: PoseName[] = ['run', 'run2'];

/** +1 for the fighter on the left (it faces right), -1 for the one on the right. */
const toward = (s: Side) => (s === 0 ? 1 : -1);
const rival = (s: Side): Side => (s === 0 ? 1 : 0);
const facingOf = (dx: number): Facing => (dx >= 0 ? 'right' : 'left');
const ahead = (f: Facing) => (f === 'right' ? 1 : -1);

interface Beat {
  /** When the deciding blow lands, and when the winner starts to celebrate. */
  impact: number;
  result: number;
}

/** Two tracks with a time cursor each, and the effects; segments follow on without gaps. */
class Choreo {
  readonly tracks: [Seg[], Seg[]] = [[], []];
  readonly fx: Fx[] = [];
  readonly shakes: Script['shakes'] = [];
  readonly cheers: Script['cheers'] = [];
  readonly x: [number, number] = [ENTER[0], ENTER[1]];
  readonly facing: [Facing, Facing] = ['right', 'left'];
  private readonly t: [number, number] = [0, 0];

  private seg(s: Side, seg: Omit<Seg, 't0' | 'facing'>) {
    const t0 = this.t[s];
    if (seg.t1 <= t0) return;
    this.tracks[s].push({ t0, facing: this.facing[s], ...seg });
    this.t[s] = seg.t1;
  }

  /** Stays where it is until `until`, cycling `poses`. */
  hold(s: Side, until: number, poses: PoseName[] = IDLE, fps = 3, more: Partial<Seg> = {}) {
    this.seg(s, { t1: until, poses, fps, from: this.x[s], to: this.x[s], ...more });
  }

  /** Moves to `to`, getting there at `until`. */
  move(s: Side, until: number, to: number, poses: PoseName[], more: Partial<Seg> = {}) {
    this.seg(s, { t1: until, poses, fps: 8, from: this.x[s], to, ...more });
    this.x[s] = to;
  }

  hide(s: Side, until: number) {
    this.seg(s, { t1: until, poses: ['idle'], from: this.x[s], to: this.x[s], hidden: true });
  }

  /** Puts a hidden fighter somewhere else; no time passes. */
  place(s: Side, x: number, facing: Facing) {
    this.x[s] = x;
    this.facing[s] = facing;
  }

  turn(s: Side, facing: Facing) {
    this.facing[s] = facing;
  }

  add(kind: FxKind, t0: number, t1: number, x: number, y: number, more: Partial<Fx> = {}) {
    this.fx.push({ kind, t0, t1, x, y, ...more });
  }

  shake(t0: number, dur: number, amp: number) {
    this.shakes.push({ t0, t1: t0 + dur, amp });
  }

  dust(t: number, x: number) {
    this.add('dust', t, t + 0.3, x, GROUND + 1);
  }
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

/** A wind-up crouch, then a leap that lands `reach` short of x. Returns when it lands. */
function leap(k: Choreo, s: Side, t: number, x: number, reach = REACH, arc = 12): number {
  k.hold(s, t);
  k.hold(s, t + 0.26, ['crouch']);
  const d = Math.sign(x - k.x[s]) || toward(s);
  k.dust(t + 0.22, k.x[s] - d * 6);
  k.move(s, t + 0.58, x - d * reach, ['pounce'], { arc, trail: true });
  return t + 0.58;
}

/** A quick lunge to `reach` short of x, holding the blow a beat. Returns when it lands. */
function lunge(k: Choreo, s: Side, t: number, x: number, reach = REACH): number {
  k.hold(s, t, ['trick']);
  const d = Math.sign(x - k.x[s]) || toward(s);
  k.move(s, t + 0.14, x - d * reach, ['pounce'], { arc: 2, trail: true });
  k.hold(s, t + 0.24, ['pounce']);
  return t + 0.14;
}

/** Raises a shield on the side it faces, from t until `until`. */
function guard(k: Choreo, s: Side, t: number, until: number) {
  k.hold(s, t);
  k.hold(s, until, ['guard'], 2);
  k.add('shield', t + 0.04, until, 0, SHIELD_Y, { follow: s, dx: ahead(k.facing[s]) * SHIELD_DX, dir: k.facing[s] });
}

/** The front of a guard's shield, where blows land. */
const shieldFront = (k: Choreo, s: Side) => k.x[s] + ahead(k.facing[s]) * (SHIELD_DX + 6);

/** A flourish, then gone in a puff of smoke. */
function vanish(k: Choreo, s: Side, t: number) {
  k.hold(s, t);
  k.hold(s, t + 0.3, ['trick']);
  poofOut(k, s, t + 0.3);
}

function poofOut(k: Choreo, s: Side, t: number) {
  k.hold(s, t, ['trick']);
  k.add('poof', t - 0.06, t + 0.4, k.x[s], 62, { size: 1.5, trick: true });
}

/** Back out of a puff of smoke at x, facing `facing`. */
function appear(k: Choreo, s: Side, t: number, x: number, facing: Facing) {
  k.hide(s, t);
  k.place(s, x, facing);
  k.add('poof', t - 0.1, t + 0.32, x, 62, { size: 1.2, trick: true });
}

/** A blow lands at x: the burst, and the screen shakes. */
function impact(k: Choreo, t: number, x: number, big = false) {
  k.add('impact', t, t + 0.34, x, 58, { big });
  k.shake(t, big ? 0.28 : 0.16, big ? 2 : 1);
}

/** Takes a blow at t: frozen white for a beat, knocked `by` pixels, then down and dazed for good. */
function knockedDown(k: Choreo, s: Side, t: number, by: number) {
  k.hold(s, t);
  k.hold(s, t + 0.08, ['hit'], 1, { flashUntil: t + 0.08 });
  k.move(s, t + 0.42, k.x[s] + by, ['hit'], { flashUntil: t + 0.14, ease: true, arc: 5 });
  k.dust(t + 0.38, k.x[s]);
  k.hold(s, Infinity, ['down'], 1);
  k.add('dizzy', t + 0.56, Infinity, 0, 46, { follow: s });
}

/** Lands on its feet after a leap. */
function land(k: Choreo, s: Side, t: number) {
  k.hold(s, t + 0.16, ['crouch']);
  k.dust(t, k.x[s]);
}

/** The winner turns to the loser, hops and holds its pose, with glints. */
function celebrate(k: Choreo, s: Side, t: number) {
  k.hold(s, t);
  k.turn(s, facingOf(k.x[rival(s)] - k.x[s]));
  const x = k.x[s];
  k.move(s, t + 0.36, x, ['win'], { arc: 7 });
  k.hold(s, t + 1.0, ['win'], 2);
  k.move(s, t + 1.3, x, ['win'], { arc: 4 });
  k.hold(s, Infinity, ['win', 'win', 'win', 'idle'], 2);
  [
    [0.2, -13, 47],
    [0.5, 12, 43],
    [0.85, -6, 39],
    [1.2, 10, 50],
  ].forEach(([dt, dx, y]) => k.add('glint', t + dt, t + dt + 0.45, x + dx, y));
}

// ---------------------------------------------------------------------------
// Clashes: a is the side named first
// ---------------------------------------------------------------------------

/** Pounce (a) into Guard (b): the shield holds, unless instinct carries the pounce through. */
function pounceGuard(k: Choreo, c: number, a: Side, b: Side, aWins: boolean): Beat {
  const hit = c + 0.15 + 0.58;
  guard(k, b, c, aWins ? hit : hit + 0.4);
  leap(k, a, c + 0.15, k.x[b], SHIELD_REACH);
  impact(k, hit, shieldFront(k, b), aWins);
  if (aWins) {
    k.add('shieldBroken', hit, hit + 0.6, k.x[b] + ahead(k.facing[b]) * SHIELD_DX, SHIELD_Y, { dir: k.facing[b] });
    knockedDown(k, b, hit, toward(a) * 18);
    land(k, a, hit);
    celebrate(k, a, hit + 0.7);
    return { impact: hit, result: hit + 0.7 };
  }
  knockedDown(k, a, hit, -toward(a) * 24);
  celebrate(k, b, hit + 0.75);
  return { impact: hit, result: hit + 0.75 };
}

/** Pounce (a) at Trick (b): the pounce catches the trick as it comes back, unless it slips behind. */
function pounceTrick(k: Choreo, c: number, a: Side, b: Side, aWins: boolean): Beat {
  const bx = k.x[b];
  vanish(k, b, c + 0.05);
  if (aWins) {
    k.hold(a, c + 0.3);
    k.hold(a, c + 0.78, ['crouch']); // it reads the trick
    const x = k.x[a] + toward(a) * 50;
    appear(k, b, c + 0.78, x, facingOf(-toward(a)));
    k.hold(b, c + 0.98, ['trick']);
    const hit = c + 0.98;
    k.move(a, hit, x - toward(a) * REACH, ['pounce'], { arc: 6, trail: true });
    impact(k, hit, x - toward(a) * 8);
    knockedDown(k, b, hit, toward(a) * 18);
    land(k, a, hit);
    celebrate(k, a, hit + 0.7);
    return { impact: hit, result: hit + 0.7 };
  }
  const landed = leap(k, a, c + 0.3, bx, 4); // where the trick stood: nobody there
  land(k, a, landed);
  appear(k, b, landed + 0.06, k.x[a] - toward(a) * 40, facingOf(toward(a)));
  k.hold(b, landed + 0.24, ['trick']);
  const hit = lunge(k, b, landed + 0.24, k.x[a]);
  impact(k, hit, k.x[a] - toward(a) * 8);
  knockedDown(k, a, hit, toward(a) * 16);
  celebrate(k, b, hit + 0.7);
  return { impact: hit, result: hit + 0.7 };
}

/** Trick (a) around Guard (b): the trick strikes from behind, unless the guard turns in time. */
function trickGuard(k: Choreo, c: number, a: Side, b: Side, aWins: boolean): Beat {
  // The guard steps up and raises its shield toward the trick.
  k.hold(b, c);
  k.move(b, c + 0.24, k.x[b] - toward(a) * 16, RUN, { fps: 10 });
  const bx = k.x[b];
  vanish(k, a, c + 0.1);
  appear(k, a, c + 0.9, bx + toward(a) * 40, facingOf(-toward(a)));
  k.hold(a, c + 1.04, ['trick']);
  if (aWins) {
    guard(k, b, c + 0.24, c + 1.18); // still facing the wrong way
    const hit = lunge(k, a, c + 1.04, bx);
    impact(k, hit, bx + toward(a) * 8);
    knockedDown(k, b, hit, -toward(a) * 16);
    celebrate(k, a, hit + 0.7);
    return { impact: hit, result: hit + 0.7 };
  }
  guard(k, b, c + 0.24, c + 0.98);
  k.turn(b, facingOf(toward(a)));
  guard(k, b, c + 0.98, c + 1.6);
  const hit = lunge(k, a, c + 1.04, bx, SHIELD_REACH);
  impact(k, hit, shieldFront(k, b));
  knockedDown(k, a, hit, toward(a) * 12);
  celebrate(k, b, hit + 0.75);
  return { impact: hit, result: hit + 0.75 };
}

/** Pounce against Pounce: they meet in the air, and only one lands on its feet. */
function pouncePounce(k: Choreo, c: number, w: Side): Beat {
  const l = rival(w);
  let hit = 0;
  for (const s of SIDES) hit = leap(k, s, c, MID, REACH / 2, 10);
  impact(k, hit, MID, true);
  knockedDown(k, l, hit, -toward(l) * 30);
  k.move(w, hit + 0.3, k.x[w] - toward(w) * 10, ['crouch'], { arc: 6, ease: true });
  land(k, w, hit + 0.3);
  celebrate(k, w, hit + 0.75);
  return { impact: hit, result: hit + 0.75 };
}

/** Trick against Trick: smoke, a feint face to face, more smoke, and one of them gets behind. */
function trickTrick(k: Choreo, c: number, w: Side): Beat {
  const l = rival(w);
  for (const s of SIDES) {
    vanish(k, s, c + 0.05);
    appear(k, s, c + 0.72, MID - toward(s) * 16, facingOf(toward(s)));
    poofOut(k, s, c + 0.96);
  }
  appear(k, l, c + 1.32, MID, facingOf(toward(l)));
  appear(k, w, c + 1.32, MID - toward(l) * 40, facingOf(toward(l)));
  k.hold(l, c + 1.46, ['trick']);
  k.hold(w, c + 1.46, ['trick']);
  const hit = lunge(k, w, c + 1.46, MID);
  impact(k, hit, MID - toward(l) * 8);
  knockedDown(k, l, hit, toward(l) * 16);
  celebrate(k, w, hit + 0.7);
  return { impact: hit, result: hit + 0.7 };
}

/** Guard against Guard: shields up, a shoving match in the middle, and one shield gives. */
function guardGuard(k: Choreo, c: number, w: Side): Beat {
  const l = rival(w);
  const give = c + 1.3;
  for (const s of SIDES) {
    k.hold(s, c);
    k.add('shield', c + 0.04, s === l ? give : give + 0.3, 0, SHIELD_Y, { follow: s, dx: toward(s) * SHIELD_DX, dir: k.facing[s] });
    k.move(s, c + 0.6, MID - toward(s) * (SHIELD_DX + 6), ['guard'], { fps: 2, ease: true });
  }
  for (const dt of [0.6, 0.88, 1.12]) {
    k.add('impact', c + dt, c + dt + 0.2, MID, SHIELD_Y - 4 + (dt > 0.8 ? 6 : 0));
    k.shake(c + dt, 0.1, 1);
  }
  k.hold(l, give, ['guard'], 2);
  k.hold(w, give, ['guard'], 2);
  k.add('shieldBroken', give, give + 0.6, k.x[l] + toward(l) * SHIELD_DX, SHIELD_Y, { dir: k.facing[l] });
  impact(k, give, MID, true);
  knockedDown(k, l, give, -toward(l) * 22);
  k.move(w, give + 0.3, k.x[w] + toward(w) * 6, ['guard'], { ease: true });
  celebrate(k, w, give + 0.75);
  return { impact: give, result: give + 0.75 };
}

const BRAWL: PoseName[] = ['pounce', 'hit', 'trick', 'guard', 'crouch', 'pounce', 'hit'];

/**
 * What a spectator sees: both dive into a fight cloud, paws and tails flying out of it, and the
 * winner is the one left standing. Nothing in it says which tactics were played.
 */
function blindFight(k: Choreo, c: number, w: Side): Beat {
  const l = rival(w);
  const out = c + 2.0;
  for (const s of SIDES) {
    k.hold(s, c);
    k.hold(s, c + 0.25, ['crouch']);
    k.move(s, c + 0.5, MID - toward(s) * 10, RUN, { fps: 10, trail: true });
    // inside the cloud: a scuffle, every pose and both ways
    for (let i = 0, t = c + 0.5; t < out - 1e-6; i++, t += 0.12) {
      const j = i + s * 3;
      k.turn(s, j % 3 === 2 ? facingOf(-toward(s)) : facingOf(toward(s)));
      k.move(s, Math.min(out, t + 0.12), MID - toward(s) * (6 + ((i * 7 + s * 3) % 6)), [BRAWL[j % BRAWL.length]], { arc: j % 2 ? 4 : 0 });
    }
  }
  k.add('cloud', c + 0.45, out, MID, 60);
  for (const dt of [0.6, 0.95, 1.3, 1.6]) k.shake(c + dt, 0.12, 1);
  k.add('poof', out, out + 0.45, MID, 60, { size: 2.2 });
  k.place(l, MID - toward(l) * 4, facingOf(toward(l)));
  knockedDown(k, l, out, -toward(l) * 30);
  k.place(w, MID - toward(w) * 10, facingOf(toward(w)));
  k.hold(w, out + 0.2, ['crouch']);
  celebrate(k, w, out + 0.55);
  return { impact: c + 0.6, result: out + 0.55 };
}

/** The clash for two known tactics. */
function clash(k: Choreo, c: number, tactics: readonly [Tactic, Tactic], w: Side): Beat {
  const [ta, tb] = tactics;
  if (ta === tb) return [pouncePounce, trickTrick, guardGuard][ta](k, c, w);
  // x plays the tactic that beats y's.
  const [x, y]: [Side, Side] = beats(ta, tb) ? [0, 1] : [1, 0];
  const xWins = w === x;
  switch (tactics[x]) {
    case 0:
      return pounceTrick(k, c, x, y, xWins);
    case 1:
      return trickGuard(k, c, x, y, xWins);
    default:
      return pounceGuard(k, c, y, x, !xWins);
  }
}

// ---------------------------------------------------------------------------

/**
 * The whole fight: both run in, face off (VS), lock their tactics (padlocks, and bits rising while
 * the arena computes under FHE), clash, and the winner celebrates over a dazed loser. With no
 * winner yet, the face-off holds until a new script is built with the result; everything before
 * `clashAt` is the same in both, so the switch is seamless.
 */
export function buildScript(plan: FightPlan): Script {
  const k = new Choreo();
  for (const s of SIDES) {
    k.move(s, BEATS.arrive, HOME[s], RUN, { fps: 9 });
    for (let t = 0.12; t < BEATS.arrive - 0.1; t += 0.24) {
      const x = ENTER[s] + ((HOME[s] - ENTER[s]) * t) / BEATS.arrive;
      k.dust(t, x - toward(s) * 8);
    }
    k.dust(BEATS.arrive - 0.04, HOME[s] + toward(s) * 4);
    k.hold(s, BEATS.arrive + 0.16, ['crouch']);
    k.hold(s, BEATS.lock, IDLE, 3);
  }

  const c = plan.winner === null ? Infinity : Math.max(BEATS.clash, plan.clashAt ?? BEATS.clash);
  for (const s of SIDES) {
    k.hold(s, c, IDLE, 3);
    k.add('lock', BEATS.lock, c, 0, 38, { follow: s });
    if (c < Infinity) k.add('glint', c, c + 0.4, k.x[s], 38);
  }
  k.add('bits', BEATS.lock, c, MID, 72);

  const marks: Script['marks'] = { vs: BEATS.vs, lock: BEATS.lock, clash: c, end: Infinity };
  if (plan.winner !== null) {
    const beat = plan.tactics ? clash(k, c, plan.tactics, plan.winner) : blindFight(k, c, plan.winner);
    k.cheers.push({ t0: beat.impact, t1: beat.result + 2.4 });
    marks.impact = beat.impact;
    marks.result = beat.result;
    marks.end = beat.result + 2.2;
  }
  return { tracks: k.tracks, fx: k.fx, shakes: k.shakes, cheers: k.cheers, marks, rest: [k.x[0], k.x[1]] };
}

const EXPECTED: Record<Tactic, string> = {
  0: 'Pounce catches the Trick.',
  1: 'Trick gets around the Guard.',
  2: 'Guard stops the Pounce.',
};
const UPSET: Record<Tactic, string> = {
  0: 'Upset! Instinct carries the Pounce through the Guard.',
  1: 'Upset! Instinct slips the Trick past the Pounce.',
  2: 'Upset! Instinct turns the Guard in time.',
};

/** One line under the stage that says what happened. */
export function captionOf(plan: FightPlan): string {
  if (plan.winner === null) return 'Both tactics are locked. The arena is fighting under FHE…';
  if (!plan.tactics) return 'Nobody saw the tactics. Only the winner comes out of the box.';
  const tw = plan.tactics[plan.winner];
  const tl = plan.tactics[rival(plan.winner)];
  if (tw === tl) return `${TACTICS[tw]} against ${TACTICS[tl]}: instinct and luck decide.`;
  return beats(tw, tl) ? EXPECTED[tw] : UPSET[tw];
}
