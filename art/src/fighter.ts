import { HEAD } from './sprites/base';
import { BOX, LID_OPENED, LID_PEEKED, LID_UNOPENED } from './sprites/box';
import { HOODIE } from './sprites/accessories';
import { ACCESSORIES, AURAS, EYES, FURS, HEADWEAR, MOUTHS, PATTERNS } from './traits';
import { BARCODE_OFF, BARCODE_ON, decodeDna } from './render';
import { POSES } from './fighterPoses';
import type { FurRole, Sprite } from './types';

/**
 * Full-body fighters for the Blind Arena.
 *
 * A revealed cat fights with its own head, exactly as in its portrait (fur, pattern, eyes, mouth,
 * headwear), on a chibi fighter's body in its fur, with its coat pattern, accessory and aura carried
 * over. A sealed cat fights as its box, on shadow paws: nothing about it leaks. This is site art;
 * the on-chain portrait is unchanged.
 *
 * Poses are drawn facing right (fighterPoses.ts). A fighter on the right mirrors its body, never
 * its head, so a wink stays on its side.
 */

export const FIGHTER_W = 48;
export const FIGHTER_H = 48;
export { POSES };
export type PoseName = keyof typeof POSES;
export const POSE_NAMES = Object.keys(POSES) as PoseName[];

export type Region = 'torso' | 'belly' | 'arm' | 'paw' | 'leg' | 'foot' | 'tail' | 'line';
type PoseLayer = 'back' | 'body' | 'front';

/**
 * Region codes in pose rows; the case of a code says which layer it is on.
 * Body (torso, legs): o outline, f fur, s shade, l light (chest and belly), g leg, j leg shade, e foot.
 * Front (arms, drawn over the accessory): O outline, A arm, B arm shade, H paw, Q pad.
 * Back (behind the body): k outline, t tail, u tail shade, v tail light, y far arm, w far paw.
 */
const CODES: Record<string, { role: FurRole | 'pad'; region: Region; layer: PoseLayer }> = {
  o: { role: 'outline', region: 'line', layer: 'body' },
  f: { role: 'main', region: 'torso', layer: 'body' },
  s: { role: 'shade', region: 'torso', layer: 'body' },
  l: { role: 'light', region: 'belly', layer: 'body' },
  g: { role: 'main', region: 'leg', layer: 'body' },
  j: { role: 'shade', region: 'leg', layer: 'body' },
  e: { role: 'light', region: 'foot', layer: 'body' },
  O: { role: 'outline', region: 'line', layer: 'front' },
  A: { role: 'main', region: 'arm', layer: 'front' },
  B: { role: 'shade', region: 'arm', layer: 'front' },
  H: { role: 'light', region: 'paw', layer: 'front' },
  Q: { role: 'pad', region: 'paw', layer: 'front' },
  k: { role: 'outline', region: 'line', layer: 'back' },
  t: { role: 'main', region: 'tail', layer: 'back' },
  u: { role: 'shade', region: 'tail', layer: 'back' },
  v: { role: 'light', region: 'tail', layer: 'back' },
  y: { role: 'main', region: 'arm', layer: 'back' },
  w: { role: 'light', region: 'paw', layer: 'back' },
};

export interface Pose {
  /** Where the head's 32×32 frame sits in the 48×48 fighter frame. */
  head: [number, number];
  /** Top-left of `rows`, in the head's frame. */
  x: number;
  y: number;
  rows: string[];
}

export type FighterLook =
  | { kind: 'cat'; dna: bigint }
  /** A sealed box: 0 Unopened, 1 Peeked, 2 Opened. `handle` prints the token's own barcode. */
  | { kind: 'box'; state: 0 | 1 | 2; handle?: bigint | string };

export interface FighterOptions {
  /** Animation tick for auras (sparkles twinkle, bits fall). */
  tick?: number;
  /** 'left' mirrors the body (never the head) to face a fighter on the left. */
  facing?: 'right' | 'left';
}

/** Rows of '#rrggbb' or null (transparent), FIGHTER_H × FIGHTER_W. */
export type FighterGrid = (string | null)[][];

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

type Layer = PoseLayer | 'head' | 'trait' | 'aura' | 'cape';

interface Pixel {
  hex: string;
  layer: Layer;
  region?: Region;
  role?: FurRole | 'pad';
  /** Head-frame coordinates, for coats and clipping. */
  hx: number;
  hy: number;
}

class Canvas {
  readonly px: (Pixel | null)[][] = Array.from({ length: FIGHTER_H }, () => new Array<Pixel | null>(FIGHTER_W).fill(null));

  constructor(
    readonly ox: number,
    readonly oy: number,
  ) {}

  /** Sets a pixel by head-frame coordinates. */
  set(hx: number, hy: number, p: Omit<Pixel, 'hx' | 'hy'>) {
    const x = this.ox + hx;
    const y = this.oy + hy;
    if (x < 0 || y < 0 || x >= FIGHTER_W || y >= FIGHTER_H) return;
    this.px[y][x] = { ...p, hx, hy };
  }

  at(hx: number, hy: number): Pixel | null {
    const x = this.ox + hx;
    const y = this.oy + hy;
    if (x < 0 || y < 0 || x >= FIGHTER_W || y >= FIGHTER_H) return null;
    return this.px[y][x];
  }

  each(fn: (p: Pixel) => void) {
    for (const row of this.px) for (const p of row) if (p) fn(p);
  }

  grid(): FighterGrid {
    return this.px.map((row) => row.map((p) => p?.hex ?? null));
  }
}

function spriteHex(sprite: Sprite, ch: string, fur: Record<FurRole, string>): string {
  const c = sprite.colors[ch];
  if (!c) throw new Error(`unknown sprite char '${ch}'`);
  return 'role' in c ? fur[c.role] : c.hex;
}

/** Calls fn for every pixel of a portrait sprite, in head coordinates. */
function eachSpritePixel(sprite: Sprite, fn: (hx: number, hy: number, ch: string) => void) {
  for (const part of sprite.parts) {
    const width = Math.max(...part.rows.map((r) => r.length));
    const stamp = (x0: number, flip: boolean) =>
      part.rows.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++) {
          const ch = row[dx];
          if (ch === '.' || ch === ' ') continue;
          fn(flip ? x0 + width - 1 - dx : x0 + dx, part.y + dy, ch);
        }
      });
    stamp(part.x, false);
    if (part.mirror) stamp(32 - part.x - width, true);
  }
}

/** Stamps a portrait sprite (moved down by `dy`); `keep` filters by head coordinates. */
function stampSprite(
  cv: Canvas,
  sprite: Sprite,
  fur: Record<FurRole, string>,
  layer: Layer,
  keep?: (hx: number, hy: number) => boolean,
  dy = 0,
) {
  eachSpritePixel(sprite, (hx, hy, ch) => {
    if (!keep || keep(hx, hy + dy)) cv.set(hx, hy + dy, { hex: spriteHex(sprite, ch, fur), layer });
  });
}

/** The portrait's head silhouette, in head coordinates. */
const HEAD_MASK: boolean[][] = (() => {
  const m = Array.from({ length: 32 }, () => new Array<boolean>(32).fill(false));
  eachSpritePixel(HEAD, (hx, hy) => (m[hy][hx] = true));
  return m;
})();
const onHead = (hx: number, hy: number) => HEAD_MASK[hy]?.[hx] === true;

function stampPose(cv: Canvas, pose: Pose, layer: PoseLayer, paint: (role: FurRole | 'pad') => string) {
  pose.rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const ch = row[dx];
      if (ch === '.') continue;
      const code = CODES[ch];
      if (!code) throw new Error(`unknown pose code '${ch}'`);
      if (code.layer !== layer) continue;
      cv.set(pose.x + dx, pose.y + dy, { hex: paint(code.role), layer, region: code.region, role: code.role });
    }
  });
}

// ---------------------------------------------------------------------------
// Coats: each pattern's head part comes from its portrait sprite; the body follows these rules.
// ---------------------------------------------------------------------------

const WHITE = '#f4f7fb';
const CALICO_ORANGE = '#e8833a';
const CALICO_BLACK = '#2b2b30';

type CoatRule = (p: Pixel, fur: Record<FurRole, string>) => string | undefined;

const isFur = (p: Pixel) => p.role === 'main' || p.role === 'shade';
const limb = (p: Pixel) => p.region === 'leg' || p.region === 'arm' || p.region === 'tail';
/** The torso's flanks: the fur either side of the belly. */
const flank = (p: Pixel) => p.region === 'torso' && p.role === 'main' && (p.hx <= 9 || p.hx >= 22);
const SPOTS = new Set(['8,25', '9,25', '8,26', '9,26', '22,27', '23,27', '22,28', '23,28', '10,30', '11,30']);

const COATS: Record<string, CoatRule> = {
  Tabby: (p, fur) => {
    if (flank(p) && (p.hy === 25 || p.hy === 28)) return fur.shade;
    if (limb(p) && p.role === 'main' && (p.hx + p.hy) % 4 === 0) return fur.shade;
    return undefined;
  },
  Tiger: (p, fur) => {
    if (flank(p) && p.hy % 2 === 1 && p.hy <= 30) return fur.outline;
    if (limb(p) && isFur(p) && (p.hx + p.hy) % 3 === 0) return fur.outline;
    return undefined;
  },
  Tuxedo: (p) => (p.region === 'belly' || p.region === 'paw' || p.region === 'foot' ? WHITE : undefined),
  Spots: (p, fur) => {
    if (p.role !== 'main') return undefined;
    if (p.region === 'torso' && SPOTS.has(`${p.hx},${p.hy}`)) return fur.shade;
    if (limb(p) && (p.hx * 7 + p.hy * 13) % 11 === 0) return fur.shade;
    return undefined;
  },
  Siamese: (p, fur) => (p.region === 'paw' || p.region === 'foot' || p.region === 'tail' ? fur.shade : undefined),
  Calico: (p) => {
    if (p.region === 'tail' && isFur(p)) return CALICO_ORANGE;
    if (p.region === 'torso' && isFur(p)) {
      if (p.hx <= 10 && p.hy >= 24 && p.hy <= 27) return CALICO_BLACK;
      if (p.hx >= 21 && p.hy >= 26 && p.hy <= 30) return CALICO_ORANGE;
    }
    if (p.region === 'leg' && isFur(p) && p.hx <= 15) return CALICO_BLACK;
    return undefined;
  },
};

function coat(cv: Canvas, pattern: string, fur: Record<FurRole, string>, layers: Layer[]) {
  const rule = COATS[pattern];
  if (!rule) return;
  cv.each((p) => {
    if (!layers.includes(p.layer)) return;
    const hex = rule(p, fur);
    if (hex) p.hex = hex;
  });
}

// ---------------------------------------------------------------------------
// Accessories: the portrait's, on the torso (which sits at the same place in every pose)
// ---------------------------------------------------------------------------

const HOODIE_COLORS = { outline: '#0c1b2b', main: '#22486e', shade: '#16304d' };
const CAPE_COLORS = { main: '#c1121f', shade: '#780000', outline: '#3a0610', clasp: '#f5c542' };

const isTorso = (p: Pixel | null) =>
  Boolean(p && p.layer === 'body' && p.hy <= 31 && (p.region === 'torso' || p.region === 'belly' || p.region === 'line'));

/** Where an accessory may draw: the torso, and the collar line under the chin. */
function onTorso(cv: Canvas): (hx: number, hy: number) => boolean {
  return (hx, hy) => (hy >= 21 && hy <= 24 && hx >= 6 && hx <= 25) || isTorso(cv.at(hx, hy));
}

function nearPaw(cv: Canvas, p: Pixel): boolean {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => cv.at(p.hx + dx, p.hy + dy)?.region === 'paw');
}

/** A hoodie: torso and arms in hoodie blue, with the portrait's hood and drawstrings. */
function hoodie(cv: Canvas, fur: Record<FurRole, string>) {
  cv.each((p) => {
    const arm = p.layer === 'front' && (p.region === 'arm' || (p.region === 'line' && !nearPaw(cv, p)));
    if (!isTorso(p) && !arm) return;
    p.hex = p.region === 'line' ? HOODIE_COLORS.outline : p.role === 'shade' ? HOODIE_COLORS.shade : HOODIE_COLORS.main;
  });
  const torso = onTorso(cv);
  stampSprite(cv, HOODIE, fur, 'trait', (hx, hy) => hy <= 26 && torso(hx, hy) && cv.at(hx, hy)?.layer !== 'front');
}

/** How far the cape streams back in each pose (it flows away from where the fighter is going). */
const CAPE_FLOW: Partial<Record<PoseName, number>> = { pounce: 6, run: 3, run2: 3, hit: -3, win: 1 };

/** A cape behind the body: from the shoulders down past the knees, flaring, streaming when moving. */
function cape(cv: Canvas, pose: PoseName, dir: 1 | -1) {
  const flow = (CAPE_FLOW[pose] ?? 0) * dir;
  // down to the knees, never to the ground
  const bottom = Math.min(pose === 'pounce' ? 31 : 34, FIGHTER_H - 6 - cv.oy);
  const span = (hy: number): [number, number] | null => {
    if (hy < 22 || hy > bottom) return null;
    const t = (hy - 22) / (bottom - 22);
    const shift = Math.round(flow * t);
    const half = 9 + Math.round(4 * t);
    return [Math.round(16 - half - shift), Math.round(15 + half - shift)];
  };
  const inside = (hx: number, hy: number) => {
    const s = span(hy);
    return Boolean(s && hx >= s[0] && hx <= s[1]);
  };
  for (let hy = 21; hy <= bottom + 1; hy++) {
    for (let hx = -8; hx <= 39; hx++) {
      if (cv.at(hx, hy)) continue;
      if (inside(hx, hy)) {
        const s = span(hy)!;
        const lining = hy === bottom || hx === s[0] || hx === s[1];
        cv.set(hx, hy, { hex: lining ? CAPE_COLORS.shade : CAPE_COLORS.main, layer: 'cape' });
      } else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(hx + dx, hy + dy)) && hy > 22) {
        cv.set(hx, hy, { hex: CAPE_COLORS.outline, layer: 'cape' });
      }
    }
  }
}

/** The cape's gold clasp at the neck. */
function capeClasp(cv: Canvas) {
  for (const [hx, hy] of [[8, 23], [23, 23]]) if (cv.at(hx, hy)?.layer !== 'front') cv.set(hx, hy, { hex: CAPE_COLORS.clasp, layer: 'trait' });
}

// ---------------------------------------------------------------------------
// Auras, around the whole fighter
// ---------------------------------------------------------------------------

const SPARK = ['.c.', 'cwc', '.c.'];
const SPARK_BIG = ['..c..', '..c..', 'ccwcc', '..c..', '..c..'];
const HEART = ['h.h', 'hhh', '.h.'];
const BOLT = ['..Y', '.Y.', 'YYY', '.Yw', 'Y..', 'Y..'];
const RAIN_BITS = '1101001101011101100101101101001011010010110';

/** Fighter-frame pixels the fighter covers. */
function silhouette(cv: Canvas): boolean[][] {
  return cv.px.map((row) => row.map((p) => Boolean(p && p.layer !== 'aura')));
}

/** Stamps rows at fighter-frame (x, y), only where the fighter is not. */
function stampFree(cv: Canvas, x: number, y: number, rows: string[], colors: Record<string, string>, body: boolean[][]) {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const ch = row[dx];
      if (ch === '.') continue;
      const fx = x + dx;
      const fy = y + dy;
      if (fx < 0 || fy < 0 || fx >= FIGHTER_W || fy >= FIGHTER_H || body[fy][fx]) continue;
      cv.px[fy][fx] = { hex: colors[ch], layer: 'aura', hx: fx - cv.ox, hy: fy - cv.oy };
    }
  });
}

function aura(cv: Canvas, name: string, tick: number) {
  const body = silhouette(cv);
  const t = tick % 2;
  switch (name) {
    case 'Sparkles': {
      const c = { c: '#9cfbff', w: '#ffffff' };
      const spots: [number, number, boolean][] = [
        [3, 9, t === 0], [41, 6, t === 1], [1, 27, t === 1], [43, 23, t === 0], [4, 40, t === 0], [41, 39, t === 1],
      ];
      for (const [x, y, big] of spots) stampFree(cv, big ? x - 1 : x, big ? y - 1 : y, big ? SPARK_BIG : SPARK, c, body);
      for (const [x, y] of [[20, 3], [46, 15], [0, 19], [30, 2], [9, 45]]) if ((x + y + t) % 2 === 0) stampFree(cv, x, y, ['w'], c, body);
      break;
    }
    case 'Hearts': {
      const c = { h: '#ff5d9e', H: '#ffa3c8' };
      const at: [number, number, string][] = [[2, 12, 'h'], [42, 8, 'H'], [1, 30, 'H'], [43, 27, 'h'], [20, 2, 'h'], [6, 42, 'h'], [40, 41, 'H']];
      for (const [x, y, k] of at) stampFree(cv, x, y - t, HEART.map((r) => r.replace(/h/g, k)), c, body);
      break;
    }
    case 'Cipher Rain': {
      const c = { G: '#9cffb8', g: '#1f9e5c' };
      for (const [col, seed] of [[1, 0], [3, 7], [44, 3], [46, 11]] as const) {
        const rows: string[] = [];
        for (let y = 0; y < FIGHTER_H; y++) {
          const i = (((y - tick * 2 + seed) % 46) + 46) % 46;
          rows.push(i % 3 === 2 ? '.' : RAIN_BITS[i % RAIN_BITS.length] === '1' ? 'G' : 'g');
        }
        stampFree(cv, col, 0, rows, c, body);
      }
      break;
    }
    case 'Backlight': {
      // a soft disc behind the head, as in the portrait
      const rows: string[] = [];
      for (let y = 0; y < FIGHTER_H; y++) {
        let row = '';
        for (let x = 0; x < FIGHTER_W; x++) {
          const d = Math.hypot(x - (cv.ox + 15.5), y - (cv.oy + 12));
          row += d <= 13.5 ? 'i' : d <= 15.5 ? 'o' : '.';
        }
        rows.push(row);
      }
      stampFree(cv, 0, 0, rows, { o: '#0a4d63', i: '#0c6a85' }, body);
      break;
    }
    case 'Lightning': {
      const c = { Y: '#ffe27a', w: '#ffffff' };
      const at: [number, number][] = t === 0 ? [[2, 7], [42, 15], [3, 31]] : [[41, 5], [1, 19], [42, 33]];
      for (const [x, y] of at) stampFree(cv, x, y, BOLT, c, body);
      break;
    }
    case 'Encrypted Aura': {
      const near = (x: number, y: number, r: number) => {
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > r) continue;
            const fx = x + dx;
            const fy = y + dy;
            if (fx >= 0 && fy >= 0 && fx < FIGHTER_W && fy < FIGHTER_H && body[fy][fx]) return true;
          }
        return false;
      };
      const rows: string[] = [];
      for (let y = 0; y < FIGHTER_H; y++) {
        let row = '';
        for (let x = 0; x < FIGHTER_W; x++) row += body[y][x] ? '.' : near(x, y, 1) ? 'c' : near(x, y, 2) && (x + y + tick) % 3 !== 0 ? 'd' : '.';
        rows.push(row);
      }
      stampFree(cv, 0, 0, rows, { c: '#0df3ff', d: '#0a7f93' }, body);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// The sealed box on shadow paws
// ---------------------------------------------------------------------------

/** Nobody knows the cat's colours: its paws, legs and tail are a shadow. */
const SHADOW: Record<FurRole, string> = { outline: '#020c16', main: '#2a3f5c', shade: '#1f3048', light: '#3d5a80', ink: '#020c16' };
const LIDS = [LID_UNOPENED, LID_PEEKED, LID_OPENED];

/** The box's label barcode, as renderSealedSvg draws it (box frame x=6..25, y=27..28). */
function barcodeBits(handle: bigint): boolean[][] {
  return [0, 1].map((row) => Array.from({ length: 20 }, (_, i) => ((handle >> BigInt(255 - (row * 20 + i))) & 1n) === 1n));
}

function boxFighter(cv: Canvas, pose: Pose, state: 0 | 1 | 2, handle: bigint) {
  const paint = (role: FurRole | 'pad') => (role === 'pad' ? SHADOW.light : SHADOW[role]);
  stampPose(cv, pose, 'back', paint);
  // the box is the torso: keep only the legs
  const legs: Pose = { ...pose, rows: pose.rows.map((row, dy) => (pose.y + dy <= 31 ? row.replace(/[ofsl]/g, '.') : row)) };
  stampPose(cv, legs, 'body', paint);
  // the box sits on the hips: its bottom edge (box frame y=30) on the head frame's y=31
  const dy = 1;
  for (const sprite of [BOX, LIDS[state]]) stampSprite(cv, sprite, SHADOW, 'head', undefined, dy);
  barcodeBits(handle).forEach((bits, row) =>
    bits.forEach((on, i) => cv.set(6 + i, 27 + row + dy, { hex: on ? BARCODE_ON : BARCODE_OFF, layer: 'head' })),
  );
  stampPose(cv, pose, 'front', paint);
}

// ---------------------------------------------------------------------------

/** A pose turned to face left: the body mirrored around the head's centre line. */
function mirrored(p: Pose): Pose {
  const width = Math.max(...p.rows.map((r) => r.length));
  return {
    head: [FIGHTER_W - 32 - p.head[0], p.head[1]],
    x: 31 - (p.x + width - 1),
    y: p.y,
    rows: p.rows.map((r) => r.padEnd(width, '.').split('').reverse().join('')),
  };
}

/** The fighter's pixels in one pose. */
export function fighterGrid(look: FighterLook, pose: PoseName, options: FighterOptions = {}): FighterGrid {
  const left = options.facing === 'left';
  const p: Pose = left ? mirrored(POSES[pose]) : POSES[pose];
  const cv = new Canvas(p.head[0], p.head[1]);
  if (look.kind === 'box') {
    boxFighter(cv, p, look.state, BigInt(look.handle ?? 0));
    return cv.grid();
  }

  const [, furI, patternI, eyesI, mouthI, hatI, accI, auraI] = decodeDna(look.dna);
  const fur = FURS[furI].palette;
  const paint = (role: FurRole | 'pad') => (role === 'pad' ? '#f29bb5' : fur[role]);
  const pattern = PATTERNS[patternI];
  const accessory = ACCESSORIES[accI];

  stampPose(cv, p, 'back', paint);
  stampPose(cv, p, 'body', paint);
  if (accessory.name === 'Cape') cape(cv, pose, left ? -1 : 1);
  coat(cv, pattern.name, fur, ['back', 'body']);
  stampSprite(cv, HEAD, fur, 'head');
  if (pattern.sprite) stampSprite(cv, pattern.sprite, fur, 'trait', onHead);
  for (const sprite of [EYES[eyesI].sprite, MOUTHS[mouthI].sprite]) if (sprite) stampSprite(cv, sprite, fur, 'trait');
  stampPose(cv, p, 'front', paint);
  coat(cv, pattern.name, fur, ['front']);
  if (accessory.name === 'Hoodie') hoodie(cv, fur);
  else if (accessory.name === 'Cape') capeClasp(cv);
  else if (accessory.sprite) {
    const torso = onTorso(cv);
    stampSprite(cv, accessory.sprite, fur, 'trait', (hx, hy) => torso(hx, hy) && cv.at(hx, hy)?.layer !== 'front');
  }
  const hat = HEADWEAR[hatI].sprite;
  if (hat) stampSprite(cv, hat, fur, 'trait');
  if (AURAS[auraI].sprite) aura(cv, AURAS[auraI].name, options.tick ?? 0);
  return cv.grid();
}
