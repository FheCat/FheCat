import type { FighterLook, PoseName } from '@art';
import {
  BITS,
  FX_PALETTE,
  GLINT,
  LOCK,
  POPS,
  SMOKE,
  STAR,
  TRICK_SMOKE,
  drawBrawl,
  drawDust,
  drawImpact,
  drawPoof,
  drawRows,
  drawShards,
  drawShield,
  fighterFrame,
  type Facing,
} from './pixels';

/**
 * The arena stage: a 160×90 pixel night arena drawn on a canvas, scaled up by whole numbers.
 * A Script (script.ts) says where each fighter is, in which pose, at every moment; render(t)
 * draws that moment. Nothing here knows about the chain.
 */

export const STAGE_W = 160;
const STAGE_H = 90;
/** The fighters' feet stand on this row. */
export const GROUND = 78;
/** Fighter frames are 48×48 with the feet on their row 45. */
const SPRITE_TOP = GROUND - 45;

export interface Seg {
  t0: number;
  t1: number;
  poses: PoseName[];
  fps?: number;
  /** Centre x at the start and end of the segment. */
  from: number;
  to: number;
  /** Height of a jump arc over the segment (pixels). */
  arc?: number;
  /** Ease the move out (fast then slow). */
  ease?: boolean;
  facing: Facing;
  hidden?: boolean;
  /** White hit flash until this time. */
  flashUntil?: number;
  /** Afterimages behind a fast move. */
  trail?: boolean;
}

export type FxKind = 'dust' | 'impact' | 'shield' | 'shieldBroken' | 'poof' | 'dizzy' | 'glint' | 'cloud' | 'bits' | 'lock';

/** 0 the challenger, on the left; 1 the opponent, on the right. */
export type Side = 0 | 1;

export interface Fx {
  kind: FxKind;
  t0: number;
  t1: number;
  x: number;
  y: number;
  /** Facing of a shield. */
  dir?: Facing;
  /** A bigger impact, for a clash. */
  big?: boolean;
  /** Scale of a puff of smoke, and whether it is a trick's (violet). */
  size?: number;
  trick?: boolean;
  /** Moves with a fighter: x is then `dx` from its centre, and y rises with its jumps. */
  follow?: Side;
  dx?: number;
}

export interface Script {
  tracks: [Seg[], Seg[]];
  fx: Fx[];
  shakes: { t0: number; t1: number; amp: number }[];
  cheers: { t0: number; t1: number }[];
  /** Named moments for the page's overlays. */
  marks: { vs: [number, number]; lock: number; clash: number; impact?: number; result?: number; end: number };
  /** Where each fighter ends up (centre x), for the overlays. */
  rest: [number, number];
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SKY = [
  [0, '#010f1c'],
  [10, '#021625'],
  [20, '#021c30'],
  [32, '#032842'],
  [48, '#043152'],
] as const;

interface Star {
  x: number;
  y: number;
  c: string;
  blink: number;
}

const STARS: Star[] = (() => {
  const r = rng(73);
  return Array.from({ length: 46 }, () => ({
    x: Math.floor(r() * STAGE_W),
    y: Math.floor(r() * 40),
    c: r() < 0.25 ? '#9fb7cf' : r() < 0.6 ? '#2c6989' : '#1b698b',
    blink: r() < 0.35 ? Math.floor(r() * 8) : -1,
  }));
})();

let background: HTMLCanvasElement | null = null;

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

function buildBackground(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = STAGE_W;
  c.height = STAGE_H;
  const ctx = c.getContext('2d')!;
  // sky bands
  SKY.forEach(([y, col], i) => px(ctx, 0, y, STAGE_W, (SKY[i + 1]?.[0] ?? 70) - y, col));
  for (const s of STARS) if (s.blink < 0) px(ctx, s.x, s.y, 1, 1, s.c);
  // the moon, with a halo
  const mx = 132;
  const my = 13;
  for (let y = -10; y <= 10; y++)
    for (let x = -10; x <= 10; x++) {
      const d = Math.hypot(x, y);
      if (d <= 6.6) px(ctx, mx + x, my + y, 1, 1, '#e6f2ff');
      else if (d <= 7.6) px(ctx, mx + x, my + y, 1, 1, '#9fb7cf');
      else if (d <= 9.6 && (x + y) % 2 === 0) px(ctx, mx + x, my + y, 1, 1, '#0d3b55');
    }
  for (const [x, y, w] of [[-3, -2, 2], [1, 2, 3], [2, -4, 1], [-2, 3, 1]]) px(ctx, mx + x, my + y, w, 1, '#c3d5e6');
  // the skyline
  const r = rng(11);
  let x = -2;
  while (x < STAGE_W) {
    const w = 8 + Math.floor(r() * 12);
    const h = 10 + Math.floor(r() * 18);
    const top = 64 - h;
    px(ctx, x, top, w, h, '#031c30');
    px(ctx, x, top, w, 1, '#06283f');
    for (let wy = top + 3; wy < 60; wy += 3)
      for (let wx = x + 2; wx < x + w - 2; wx += 3) {
        const v = r();
        if (v < 0.18) px(ctx, wx, wy, 1, 1, '#0a5f73');
        else if (v < 0.24) px(ctx, wx, wy, 1, 1, '#806a33');
      }
    if (r() < 0.3) px(ctx, x + Math.floor(w / 2), top - 3, 1, 3, '#06283f'); // antenna
    x += w + Math.floor(r() * 3);
  }
  // the stands: a railing in front of the crowd
  px(ctx, 0, 64, STAGE_W, 4, '#05243a');
  px(ctx, 0, 67, STAGE_W, 1, '#0b3550');
  for (let px0 = 2; px0 < STAGE_W; px0 += 12) px(ctx, px0, 64, 1, 4, '#0b3550');
  // the floor: back half with a grid, front edge lit
  px(ctx, 0, 68, STAGE_W, 11, '#062a43');
  for (let gx = 0; gx < STAGE_W; gx += 8) px(ctx, gx, 68, 1, 11, '#08334f');
  for (const gy of [71, 75]) px(ctx, 0, gy, STAGE_W, 1, '#08334f');
  px(ctx, 0, 79, STAGE_W, 1, '#0a8fa3');
  px(ctx, 0, 80, STAGE_W, 10, '#041f33');
  for (let gx = 4; gx < STAGE_W; gx += 16) px(ctx, gx, 83, 8, 1, '#06283f');
  // the paw on the floor, between the fighters
  const paw = ['.c.c.', 'c...c', '.ccc.', 'ccccc', '.ccc.'];
  drawRows(ctx, paw, 78, 71, { c: '#0a4d63' });
  return c;
}

// ---------------------------------------------------------------------------
// The crowd: sealed boxes watching, bobbing when something happens
// ---------------------------------------------------------------------------

const CROWD = (() => {
  const r = rng(5);
  const out: { x: number; y: number; phase: number; peek: boolean }[] = [];
  for (let x = 1; x < STAGE_W - 5; x += 7 + Math.floor(r() * 3)) out.push({ x, y: 58 + Math.floor(r() * 2), phase: r() * 6, peek: r() < 0.2 });
  return out;
})();

function drawCrowd(ctx: CanvasRenderingContext2D, t: number, cheering: boolean) {
  for (const b of CROWD) {
    const bob = cheering ? Math.round(Math.abs(Math.sin(t * 14 + b.phase)) * 2) : Math.round((Math.sin(t * 2 + b.phase) + 1) / 2);
    const y = b.y - bob;
    px(ctx, b.x, y, 6, 1, '#6f8db0'); // lid
    px(ctx, b.x, y + 1, 6, 5, '#3f5874');
    px(ctx, b.x + 5, y + 1, 1, 5, '#33496a');
    px(ctx, b.x + 2, y + 3, 2, 1, b.peek ? '#0df3ff' : '#0a8fa3');
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

interface Cast {
  looks: [FighterLook, FighterLook];
}

/** The segment a fighter is in at time t (or the last one, held). */
function segAt(segs: Seg[], t: number): Seg | null {
  if (!segs.length) return null;
  for (const s of segs) if (t >= s.t0 && t < s.t1) return s;
  return t < segs[0].t0 ? segs[0] : segs[segs.length - 1];
}

interface FighterAt {
  cx: number;
  lift: number;
  pose: PoseName;
  facing: Facing;
  hidden: boolean;
  flash: boolean;
  seg: Seg;
}

function fighterAt(segs: Seg[], t: number): FighterAt | null {
  const s = segAt(segs, t);
  if (!s) return null;
  const span = Math.max(1e-6, s.t1 - s.t0);
  const u = Math.min(1, Math.max(0, (t - s.t0) / span));
  const e = s.ease ? 1 - (1 - u) * (1 - u) : u;
  const cx = s.from + (s.to - s.from) * e;
  const lift = s.arc ? 4 * s.arc * u * (1 - u) : 0;
  const frame = s.poses.length > 1 ? Math.floor(Math.max(0, t - s.t0) * (s.fps ?? 4)) % s.poses.length : 0;
  return { cx, lift, pose: s.poses[frame], facing: s.facing, hidden: Boolean(s.hidden), flash: s.flashUntil !== undefined && t < s.flashUntil, seg: s };
}

function drawFighter(ctx: CanvasRenderingContext2D, look: FighterLook, f: FighterAt, t: number, alpha = 1) {
  const tick = Math.floor(t * 4);
  const frame = fighterFrame(look, f.pose, f.facing, tick, f.flash);
  ctx.globalAlpha = alpha;
  ctx.drawImage(frame, Math.round(f.cx - 24), Math.round(SPRITE_TOP - f.lift));
  ctx.globalAlpha = 1;
}

function drawShadow(ctx: CanvasRenderingContext2D, f: FighterAt) {
  const w = Math.max(8, 22 - Math.round(f.lift / 2));
  ctx.fillStyle = 'rgba(1, 12, 22, 0.55)';
  ctx.fillRect(Math.round(f.cx - w / 2), GROUND + 1, w, 1);
  ctx.fillRect(Math.round(f.cx - w / 2 + 2), GROUND + 2, w - 4, 1);
}

function drawFx(ctx: CanvasRenderingContext2D, fx: Fx, t: number, at: (FighterAt | null)[]) {
  const local = t - fx.t0;
  const u = Math.min(1, local / Math.max(1e-6, fx.t1 - fx.t0));
  if (fx.follow !== undefined) {
    const f = at[fx.follow];
    if (!f || f.hidden) return;
    fx = { ...fx, x: f.cx + (fx.dx ?? 0), y: fx.y - f.lift };
  }
  const dir = fx.dir === 'left' ? -1 : 1;
  switch (fx.kind) {
    case 'dust':
      drawDust(ctx, fx.x, fx.y, u);
      break;
    case 'impact':
      drawImpact(ctx, fx.x, fx.y, u, fx.big);
      break;
    case 'shield':
      drawShield(ctx, Math.round(fx.x), Math.round(fx.y), dir, local);
      break;
    case 'shieldBroken':
      drawShards(ctx, Math.round(fx.x), Math.round(fx.y), dir, u);
      break;
    case 'poof':
      drawPoof(ctx, fx.x, fx.y, u, fx.size, fx.trick ? TRICK_SMOKE : SMOKE);
      break;
    case 'dizzy': {
      for (let k = 0; k < 3; k++) {
        const a = local * 5 + (k * Math.PI * 2) / 3;
        drawRows(ctx, STAR, Math.round(fx.x + Math.cos(a) * 9 - 1), Math.round(fx.y + Math.sin(a) * 3 - 1), FX_PALETTE);
      }
      break;
    }
    case 'glint': {
      const rows = GLINT[Math.floor(local * 6) % 2];
      drawRows(ctx, rows, Math.round(fx.x - rows[0].length / 2), Math.round(fx.y - rows.length / 2 - local * 6), FX_PALETTE);
      break;
    }
    case 'cloud': {
      drawBrawl(ctx, fx.x, fx.y, local);
      // stars, sparks and a paw flying out of it
      const n = Math.floor(local * 9);
      for (let k = Math.max(0, n - 2); k <= n; k++) {
        const r = rng(k * 97 + 13);
        const pop = POPS[Math.floor(r() * POPS.length)];
        const ang = r() * Math.PI * 2;
        const dist = 18 + (local * 9 - k) * 12;
        drawRows(ctx, pop, Math.round(fx.x + Math.cos(ang) * dist * 1.3 - 1), Math.round(fx.y - 4 + Math.sin(ang) * dist * 0.6 - 1), FX_PALETTE);
      }
      break;
    }
    case 'bits': {
      for (let k = 0; k < 6; k++) {
        const r = rng(k * 31 + Math.floor(fx.x));
        const speed = 8 + r() * 6;
        const age = (local * speed + r() * 30) % 30;
        const glyph = BITS[Math.floor(r() * 2)];
        ctx.globalAlpha = 1 - age / 30;
        drawRows(ctx, glyph, Math.round(fx.x - 12 + r() * 24), Math.round(fx.y - age), FX_PALETTE);
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'lock': {
      const bob = Math.round(Math.sin(local * 4) * 1);
      const drop = Math.max(0, Math.round(8 * (1 - local / 0.2)));
      drawRows(ctx, LOCK, Math.round(fx.x - 3), Math.round(fx.y - 3 + bob - drop), FX_PALETTE);
      break;
    }
  }
}

/** Draws the moment t of a script. */
export function render(ctx: CanvasRenderingContext2D, script: Script, cast: Cast, t: number) {
  background ??= buildBackground();
  ctx.imageSmoothingEnabled = false;
  let sx = 0;
  let sy = 0;
  for (const s of script.shakes) {
    if (t >= s.t0 && t < s.t1) {
      const k = Math.floor(t * 30);
      sx = (k % 2 ? 1 : -1) * s.amp;
      sy = (k % 3 === 0 ? 1 : 0) * Math.ceil(s.amp / 2);
    }
  }
  ctx.save();
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  ctx.translate(sx, sy);
  ctx.drawImage(background, 0, 0);
  // twinkling stars
  const blink = Math.floor(t * 3);
  for (const s of STARS) if (s.blink >= 0 && (blink + s.blink) % 8 < 5) px(ctx, s.x, s.y, 1, 1, s.c);
  drawCrowd(ctx, t, script.cheers.some((c) => t >= c.t0 && t < c.t1));

  const at = [fighterAt(script.tracks[0], t), fighterAt(script.tracks[1], t)];
  for (const f of at) if (f && !f.hidden) drawShadow(ctx, f);
  // background effects (behind the fighters)
  for (const fx of script.fx) if (fx.kind === 'bits' && t >= fx.t0 && t < fx.t1) drawFx(ctx, fx, t, at);
  // afterimages, then the fighters; whoever is moving is drawn in front
  const order = at
    .map((f, i) => ({ f, i }))
    .filter((o): o is { f: FighterAt; i: number } => o.f !== null)
    .sort((a, b) => Number(Boolean(a.f.seg.trail || a.f.lift)) - Number(Boolean(b.f.seg.trail || b.f.lift)));
  for (const { f, i } of order) {
    if (f.hidden) continue;
    if (f.seg.trail) {
      for (const back of [0.09, 0.05]) {
        const g = fighterAt(script.tracks[i], t - back);
        if (g && !g.hidden && g.seg === f.seg) drawFighter(ctx, cast.looks[i], g, t, back > 0.06 ? 0.2 : 0.4);
      }
    }
    drawFighter(ctx, cast.looks[i], f, t);
  }
  for (const fx of script.fx) if (fx.kind !== 'bits' && t >= fx.t0 && t < fx.t1) drawFx(ctx, fx, t, at);
  ctx.restore();
}
