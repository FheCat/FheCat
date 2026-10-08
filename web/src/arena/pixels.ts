import { FIGHTER_H, FIGHTER_W, fighterGrid, type FighterLook, type PoseName } from '@art';

/**
 * Pixel helpers for the arena stage: fighter frames rendered once into small canvases, and the
 * effect sprites (dust, impacts, shields, smoke, stars) as character rows with a palette.
 */

export type Facing = 'right' | 'left';

export function lookKey(look: FighterLook): string {
  return look.kind === 'cat' ? `cat:${look.dna}` : `box:${look.state}:${String(look.handle ?? 0)}`;
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const frames = new Map<string, HTMLCanvasElement>();
const MAX_FRAMES = 600;

/** A fighter frame as a 48×48 canvas; `flash` paints its silhouette white (a hit). */
export function fighterFrame(look: FighterLook, pose: PoseName, facing: Facing, tick: number, flash = false): HTMLCanvasElement {
  const animated = look.kind === 'cat'; // auras animate on two ticks
  const key = `${lookKey(look)}|${pose}|${facing}|${animated ? tick % 2 : 0}|${flash ? 1 : 0}`;
  let c = frames.get(key);
  if (c) return c;
  const grid = fighterGrid(look, pose, { facing, tick: animated ? tick % 2 : 0 });
  c = canvas(FIGHTER_W, FIGHTER_H);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(FIGHTER_W, FIGHTER_H);
  for (let y = 0; y < FIGHTER_H; y++) {
    for (let x = 0; x < FIGHTER_W; x++) {
      const hex = grid[y][x];
      if (!hex) continue;
      const i = (y * FIGHTER_W + x) * 4;
      const v = flash ? 0xffffff : parseInt(hex.slice(1), 16);
      img.data[i] = (v >> 16) & 255;
      img.data[i + 1] = (v >> 8) & 255;
      img.data[i + 2] = v & 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (frames.size > MAX_FRAMES) frames.delete(frames.keys().next().value!);
  frames.set(key, c);
  return c;
}

/** Draws rows of palette characters at (x, y); '.' is transparent. */
export function drawRows(ctx: CanvasRenderingContext2D, rows: readonly string[], x: number, y: number, palette: Record<string, string>, flip = false) {
  const w = Math.max(...rows.map((r) => r.length));
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const ch = row[dx];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + (flip ? w - 1 - dx : dx), y + dy, 1, 1);
    }
  });
}

export const FX_PALETTE: Record<string, string> = {
  W: '#ffffff',
  w: '#e6f2ff',
  p: '#9fb7cf', // pale steel (dust)
  s: '#5e7b9d', // steel
  d: '#2a4c66', // dark steel
  C: '#0df3ff', // cyan
  c: '#0a8fa3', // dim cyan
  b: '#9cfbff', // glow
  Y: '#ffe27a', // star yellow
  y: '#f5c542', // gold
  R: '#ff5d73', // red
  P: '#ff9ccb', // pink
  K: '#021a2e', // ink
};

// ---------------------------------------------------------------------------
// Drawn effects: smoke, dust, impacts and shields are drawn from circles and lines, so they can
// grow and wobble frame by frame and stay on the pixel grid.
// ---------------------------------------------------------------------------

/** A pixel disc; radius 0 is one pixel. */
function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  const x = Math.round(cx);
  const y = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(x - w, y + dy, 2 * w + 1, 1);
  }
}

/** A pixel line from (x0, y0) to (x1, y1). */
function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) {
  ctx.fillStyle = color;
  let x = Math.round(x0);
  let y = Math.round(y0);
  const xe = Math.round(x1);
  const ye = Math.round(y1);
  const dx = Math.abs(xe - x);
  const dy = -Math.abs(ye - y);
  const sx = x < xe ? 1 : -1;
  const sy = y < ye ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x, y, 1, 1);
    if (x === xe && y === ye) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

export type Puff = readonly [x: number, y: number, r: number];

export interface Smoke {
  outline: string;
  shade: string;
  body: string;
}

/** Dust and the fight cloud: pale steel. */
export const SMOKE: Smoke = { outline: '#5e7b9d', shade: '#9fb7cf', body: '#e6f2ff' };
/** A trick's smoke, in the Trick's violet (the tactic colours on the page). */
export const TRICK_SMOKE: Smoke = { outline: '#3c2f73', shade: '#8a74d6', body: '#d4cbf5' };

/** Smoke and dust: overlapping puffs, outlined as one shape, shaded underneath. */
export function drawPuffs(ctx: CanvasRenderingContext2D, puffs: readonly Puff[], smoke: Smoke = SMOKE) {
  for (const [x, y, r] of puffs) if (r >= 0) disc(ctx, x, y, r + 1, smoke.outline);
  for (const [x, y, r] of puffs) if (r >= 0) disc(ctx, x, y, r, smoke.shade);
  for (const [x, y, r] of puffs) if (r >= 1) disc(ctx, x - 1, y - 1, r - 1, smoke.body);
}

/** Dust kicked up at the feet, u from 0 to 1 over its life. */
export function drawDust(ctx: CanvasRenderingContext2D, x: number, y: number, u: number) {
  const r = Math.round(2.6 * (1 - u));
  const spread = 2 + u * 5;
  const rise = 2 + u * 3;
  drawPuffs(ctx, [
    [x - spread, y - rise + 1, r],
    [x, y - rise - 1, r],
    [x + spread, y - rise + 1, r],
  ]);
}

/** A puff of smoke, a ball bursting into a ring: a trick vanishing or coming back, a cloud ending. */
export function drawPoof(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, size = 1, smoke: Smoke = SMOKE) {
  const out = (3 + u * 11) * size;
  const r = Math.round(6 * size * (1 - u));
  const puffs: Puff[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    puffs.push([x + Math.cos(a) * out, y + Math.sin(a) * out * 0.75, r]);
  }
  if (u < 0.5) puffs.push([x, y, Math.round(9 * size * (1 - 2 * u))]);
  drawPuffs(ctx, puffs, smoke);
}

const BRAWL: readonly Puff[] = [
  [-18, 2, 8],
  [-9, -7, 10],
  [4, -10, 10],
  [15, -4, 9],
  [21, 5, 7],
  [9, 6, 10],
  [-5, 6, 10],
  [-17, 9, 6],
];

/** The fight cloud spectators see, boiling: every puff swells and shifts on its own beat. */
export function drawBrawl(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const k = Math.floor(t * 12);
  drawPuffs(
    ctx,
    BRAWL.map(([dx, dy, r], i) => [x + dx + ((k + i) % 3 === 0 ? 1 : 0), y + dy - ((k + i) % 4 === 1 ? 1 : 0), r + ((k + i * 2) % 4 === 0 ? 1 : 0)] as const),
  );
}

/** A four-pointed star (an astroid) of radius r; `diagonal` turns it 45°. */
function star4(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, diagonal = false) {
  const p = 0.62;
  const lim = Math.pow(r, p);
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const a = diagonal ? (dx + dy) * Math.SQRT1_2 : dx;
      const b = diagonal ? (dy - dx) * Math.SQRT1_2 : dy;
      if (Math.pow(Math.abs(a), p) + Math.pow(Math.abs(b), p) <= lim) ctx.fillRect(x0 + dx, y0 + dy, 1, 1);
    }
}

/** Where a blow lands: a burst of light, then a smaller one throwing sparks. `big` for a clash. */
export function drawImpact(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, big = false) {
  const s = big ? 1.3 : 1;
  const R = (n: number) => Math.round(n * s);
  if (u < 0.24) {
    star4(ctx, x, y, R(9), FX_PALETTE.y, true);
    star4(ctx, x, y, R(15), FX_PALETTE.y);
    star4(ctx, x, y, R(13), FX_PALETTE.Y);
    star4(ctx, x, y, R(7), FX_PALETTE.Y, true);
    star4(ctx, x, y, R(9), FX_PALETTE.W);
    star4(ctx, x, y, R(4), FX_PALETTE.W, true);
    return;
  }
  const v = (u - 0.24) / 0.76;
  if (u < 0.55) {
    star4(ctx, x, y, R(10), FX_PALETTE.Y);
    star4(ctx, x, y, R(6), FX_PALETTE.W);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const r0 = (9 + v * 12) * s;
    const c = Math.cos(a);
    const n = Math.sin(a);
    line(ctx, x + c * r0, y + n * r0, x + c * (r0 + 3 - v * 2), y + n * (r0 + 3 - v * 2), i % 2 ? FX_PALETTE.W : FX_PALETTE.Y);
  }
}

const SHIELD_RY = 16;
const SHIELD_RX = 6;

/** How far the shield's arc bulges at row dy. */
function shieldArc(dy: number) {
  return Math.round(SHIELD_RX * Math.sqrt(Math.max(0, 1 - (dy / SHIELD_RY) ** 2)));
}

/** A guard's shield of light: x is its back, it bulges `dir`-ward, a shimmer runs down it. */
export function drawShield(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1, t: number) {
  const band = Math.floor((t * 44) % (2 * SHIELD_RY + 12)) - SHIELD_RY - 6;
  for (let dy = -SHIELD_RY; dy <= SHIELD_RY; dy++) {
    const e = shieldArc(dy);
    // the field behind the arc, with faint scan lines
    if (e >= 3) {
      ctx.globalAlpha = dy % 4 === 0 ? 0.42 : 0.24;
      ctx.fillStyle = FX_PALETTE.C;
      ctx.fillRect(Math.min(x, x + dir * (e - 2)), y + dy, e - 1, 1);
    }
    ctx.globalAlpha = 1;
    const shine = Math.abs(dy - band) <= 1;
    ctx.fillStyle = shine ? FX_PALETTE.W : FX_PALETTE.C;
    ctx.fillRect(x + dir * e, y + dy, 1, 1);
    ctx.fillStyle = shine ? FX_PALETTE.W : FX_PALETTE.b;
    ctx.fillRect(x + dir * (e - 1), y + dy, 1, 1);
    if (e >= 2) {
      ctx.fillStyle = FX_PALETTE.c;
      ctx.fillRect(x + dir * (e - 2), y + dy, 1, 1);
    }
  }
}

/** A shield breaking: a white flash along its arc, then shards flying `dir`-ward and falling. */
export function drawShards(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1, u: number) {
  const parts = 6;
  const span = (2 * SHIELD_RY + 1) / parts;
  ctx.globalAlpha = Math.max(0, 1 - u * 1.1);
  for (let p = 0; p < parts; p++) {
    const mid = -SHIELD_RY + span * (p + 0.5);
    const ox = dir * u * (8 + (p % 3) * 6);
    const oy = u * mid * 0.5 + 28 * u * u;
    for (let dy = Math.ceil(-SHIELD_RY + span * p); dy < -SHIELD_RY + span * (p + 1) - 1; dy++) {
      const e = shieldArc(dy);
      ctx.fillStyle = u < 0.12 ? FX_PALETTE.W : FX_PALETTE.C;
      ctx.fillRect(Math.round(x + dir * e + ox), Math.round(y + dy + oy), 1, 1);
      ctx.fillStyle = u < 0.12 ? FX_PALETTE.W : FX_PALETTE.b;
      ctx.fillRect(Math.round(x + dir * (e - 1) + ox), Math.round(y + dy + oy), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

/** Little stars spinning over a dazed head. */
export const STAR = ['.Y.', 'YWY', '.Y.'];

/** A glint of victory. */
export const GLINT = [['.b.', 'bWb', '.b.'], ['..b..', '..b..', 'bbWbb', '..b..', '..b..']];

/** Things flying out of the cloud. */
export const POPS = [
  ['.Y.', 'YWY', '.Y.'],
  ['W.W', '.W.', 'W.W'],
  ['.R.', '.R.', '.R.', '...', '.R.'],
  ['.ss.', 'swws', 'swws', '.ss.'],
];

/** 0 and 1, 3×5, for the bits rising while the fight runs under FHE. */
export const BITS = [
  ['.C.', 'C.C', 'C.C', 'C.C', '.C.'],
  ['.C.', 'CC.', '.C.', '.C.', 'CCC'],
];

/** A padlock over a sealed tactic. */
export const LOCK = ['..ccc..', '.c...c.', '.c...c.', 'CCCCCCC', 'CCCKCCC', 'CCCKCCC', 'CCCCCCC'];
