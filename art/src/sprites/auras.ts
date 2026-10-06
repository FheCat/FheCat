import { ColorTable, rasterize, SIZE } from '../compile';
import type { Sprite } from '../types';
import { BODY, HEAD } from './base';

// Auras are painted right after the background, behind the cat.

const SPARK = ['.c.', 'cwc', '.c.'];

export const SPARKLES: Sprite = {
  colors: { w: { hex: '#ffffff' }, c: { hex: '#9cfbff' } },
  parts: [
    { x: 0, y: 3, rows: SPARK },
    { x: 29, y: 10, rows: SPARK },
    { x: 1, y: 21, rows: SPARK },
    { x: 28, y: 29, rows: SPARK },
    { x: 17, y: 0, rows: ['..c..', '..c..', 'ccwcc', '..c..', '..c..'] },
    ...[[12, 1], [31, 17], [0, 15], [24, 0], [4, 30]].map(([x, y]) => ({ x, y, rows: ['w'] })),
  ],
};

const HEART = ['h.h', 'hhh', '.h.'];

export const HEARTS: Sprite = {
  colors: { h: { hex: '#ff5d9e' }, H: { hex: '#ffa3c8' } },
  parts: [
    { x: 0, y: 6, rows: HEART },
    { x: 29, y: 2, rows: HEART.map((r) => r.replace(/h/g, 'H')) },
    { x: 1, y: 24, rows: HEART.map((r) => r.replace(/h/g, 'H')) },
    { x: 28, y: 29, rows: HEART },
    { x: 13, y: 1, rows: HEART },
    ...[[30, 15], [0, 18], [21, 0]].map(([x, y]) => ({ x, y, rows: ['H'] })),
  ],
};

export const CIPHER_RAIN: Sprite = {
  colors: { g: { hex: '#1f9e5c' }, G: { hex: '#9cffb8' } },
  parts: [
    { x: 0, y: 0, rows: columnRain('1101001101011101100101101101001', 'G', 'g') },
    { x: 1, y: 3, rows: columnRain('0110101101001011010110100110', 'G', 'g') },
    { x: 30, y: 1, rows: columnRain('101101001011011001011101001011', 'G', 'g') },
    { x: 31, y: 4, rows: columnRain('0101101011010010110101101011', 'G', 'g') },
  ],
};

/** A vertical strip: '1' → bright bit, '0' → dim bit, alternating with gaps. */
function columnRain(bits: string, on: string, off: string): string[] {
  return bits.split('').map((b, i) => (i % 3 === 2 ? '.' : b === '1' ? on : off));
}

/** Soft circular backlight behind the head. */
export const BACKLIGHT: Sprite = disc(15.5, 12, [
  [15.5, 'o'],
  [13.5, 'i'],
], { o: '#0a4d63', i: '#0c6a85' });

function disc(cx: number, cy: number, radii: [number, string][], palette: Record<string, string>): Sprite {
  const grid: string[] = [];
  for (let y = 0; y < SIZE; y++) {
    let row = '';
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x + 0.5 - (cx + 0.5), y + 0.5 - (cy + 0.5));
      let ch = '.';
      for (const [r, c] of radii) if (d <= r) ch = c;
      row += ch;
    }
    grid.push(row);
  }
  return {
    colors: Object.fromEntries(Object.entries(palette).map(([k, hex]) => [k, { hex }])),
    parts: [{ x: 0, y: 0, rows: grid }],
  };
}

const BOLT = ['..Y', '.Y.', 'YYY', '.Yw', 'Y..', 'Y..'];

export const LIGHTNING: Sprite = {
  colors: { Y: { hex: '#ffe27a' }, w: { hex: '#ffffff' } },
  parts: [
    { x: 0, y: 2, rows: BOLT },
    { x: 29, y: 5, rows: BOLT },
    { x: 1, y: 22, rows: BOLT },
    { x: 13, y: 0, rows: ['Y'] },
  ],
};

/** A two-pixel glowing outline hugging the cat's silhouette. */
export const ENCRYPTED_AURA: Sprite = (() => {
  const scratch = new ColorTable();
  const head = rasterize(HEAD, scratch);
  const body = rasterize(BODY, scratch);
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < SIZE && y < SIZE && (head[y][x] >= 0 || body[y][x] >= 0);
  const near = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r && inside(x + dx, y + dy)) return true;
    return false;
  };
  const grid: string[] = [];
  for (let y = 0; y < SIZE; y++) {
    let row = '';
    for (let x = 0; x < SIZE; x++) {
      if (inside(x, y)) row += '.';
      else if (near(x, y, 1)) row += 'c';
      else if (near(x, y, 2)) row += 'd';
      else row += '.';
    }
    grid.push(row);
  }
  return { colors: { c: { hex: '#0df3ff' }, d: { hex: '#0a7f93' } }, parts: [{ x: 0, y: 0, rows: grid }] };
})();
