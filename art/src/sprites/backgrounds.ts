import type { Sprite } from '../types';
import { rows } from '../util';

// Decorations stay in the margins the cat does not cover: the top corners,
// the strip between the ears and the far left/right columns.

export const STARS: Sprite = {
  colors: { c: { hex: '#0df3ff' }, d: { hex: '#2e6a8e' } },
  parts: [
    { x: 1, y: 1, rows: ['.c.', 'ccc', '.c.'] },
    { x: 27, y: 3, rows: ['.c.', 'ccc', '.c.'] },
    { x: 29, y: 20, rows: ['.c.', 'ccc', '.c.'] },
    { x: 13, y: 1, rows: ['d'] },
    { x: 19, y: 3, rows: ['d'] },
    { x: 1, y: 12, rows: ['d'] },
    { x: 30, y: 13, rows: ['d'] },
    { x: 0, y: 26, rows: ['d'] },
    { x: 2, y: 20, rows: ['d'] },
  ],
};

export const BUBBLES: Sprite = {
  colors: { b: { hex: '#1e6b8c' } },
  parts: [
    { x: 0, y: 17, rows: ['.b.', 'b.b', '.b.'] },
    { x: 28, y: 7, rows: ['.bb.', 'b..b', 'b..b', '.bb.'] },
    { x: 29, y: 24, rows: ['.b.', 'b.b', '.b.'] },
    { x: 2, y: 5, rows: ['b'] },
    { x: 30, y: 16, rows: ['b'] },
    { x: 15, y: 1, rows: ['b'] },
  ],
};

export const GRID: Sprite = {
  colors: { g: { hex: '#0a3553' } },
  parts: [
    ...[0, 8, 16, 24].map((y) => ({ x: 0, y, rows: rows('32g') })),
    ...[0, 8, 16, 24].map((x) => ({ x, y: 0, rows: Array.from({ length: 32 }, () => 'g') })),
  ],
};

export const DUSK_STARS: Sprite = {
  colors: { v: { hex: '#8a74d6' }, w: { hex: '#d9ceff' } },
  parts: [
    { x: 2, y: 2, rows: ['.v.', 'vwv', '.v.'] },
    { x: 26, y: 1, rows: ['v'] },
    { x: 29, y: 9, rows: ['.v.', 'vwv', '.v.'] },
    { x: 14, y: 2, rows: ['v'] },
    { x: 1, y: 15, rows: ['v'] },
    { x: 30, y: 25, rows: ['v'] },
  ],
};

export const MOON: Sprite = {
  colors: { m: { hex: '#5e7b9d' }, c: { hex: '#0df3ff' } },
  parts: [
    { x: 0, y: 0, rows: ['.mmm.', 'm...m', 'm...m', 'm...m', '.mmm.'] },
    { x: 27, y: 2, rows: ['.c.', 'ccc', '.c.'] },
    { x: 30, y: 18, rows: ['c'] },
    { x: 1, y: 22, rows: ['c'] },
  ],
};

/** Three soft ribbons waving across the top of the sky. */
export const AURORA: Sprite = (() => {
  const bands: [string, number][] = [
    ['v', 0],
    ['c', 2],
    ['g', 4],
  ];
  const grid = Array.from({ length: 8 }, () => new Array<string>(32).fill('.'));
  for (let x = 0; x < 32; x++) {
    const wave = Math.round(1.5 + 1.5 * Math.sin((x / 32) * 2 * Math.PI * 1.5));
    for (const [ch, offset] of bands) grid[offset + wave][x] = ch;
  }
  return {
    colors: { g: { hex: '#1b7a5c' }, c: { hex: '#0e6f86' }, v: { hex: '#4b3f8f' } },
    parts: [{ x: 0, y: 0, rows: grid.map((r) => r.join('')) }],
  };
})();
