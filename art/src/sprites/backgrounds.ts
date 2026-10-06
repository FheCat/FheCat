import { SIZE } from '../compile';
import type { Sprite } from '../types';
import { rows } from '../util';

// Decorations live where the cat never reaches: the strip between the ears,
// the outer columns (x=0..2, x=29..31) and the bottom corners. The flat fill
// of each background is in traits.ts.

const PLUS = ['.c.', 'ccc', '.c.'];

export const STARS: Sprite = {
  colors: { c: { hex: '#0df3ff' }, d: { hex: '#2e6a8e' }, w: { hex: '#bff9ff' } },
  parts: [
    { x: 0, y: 8, rows: PLUS },
    { x: 29, y: 2, rows: PLUS },
    { x: 1, y: 24, rows: PLUS },
    { x: 1, y: 9, rows: ['w'] },
    { x: 30, y: 3, rows: ['w'] },
    ...[[13, 1], [19, 3], [8, 0], [24, 0], [30, 15], [0, 16], [29, 30], [3, 29], [31, 11], [1, 2]].map(([x, y]) => ({ x, y, rows: ['d'] })),
  ],
};

export const BUBBLES: Sprite = {
  colors: { b: { hex: '#1e6b8c' }, w: { hex: '#5fb3d4' }, g: { hex: '#0f5b4a' }, G: { hex: '#1b7a5c' } },
  parts: [
    { x: 0, y: 4, rows: ['.b.', 'b.b', '.b.'] },
    { x: 29, y: 9, rows: ['.b.', 'b.w', '.b.'] },
    { x: 29, y: 0, rows: ['.b.', 'b.b', '.b.'] },
    { x: 2, y: 1, rows: ['b'] },
    { x: 14, y: 2, rows: ['b'] },
    { x: 30, y: 16, rows: ['w'] },
    { x: 0, y: 14, rows: ['b'] },
    // seaweed in the bottom corners
    { x: 0, y: 23, rows: ['.g..', 'g.g.', 'g.G.', '.gG.', '.g.G', 'Gg.G', 'Gg.G', 'Gg.G', '.gGG'] },
    { x: 28, y: 28, rows: ['..g.', '.gg.', 'Gg..', 'Gg.g'] },
  ],
};

export const DUSK_STARS: Sprite = {
  colors: { v: { hex: '#8a74d6' }, w: { hex: '#e6ddff' } },
  parts: [
    { x: 0, y: 2, rows: ['.v.', 'vwv', '.v.'] },
    { x: 29, y: 8, rows: ['.v.', 'vwv', '.v.'] },
    { x: 2, y: 28, rows: ['.v.', 'vwv', '.v.'] },
    ...[[14, 2], [26, 0], [1, 15], [30, 24], [9, 0], [20, 1], [30, 14], [0, 21]].map(([x, y]) => ({ x, y, rows: ['v'] })),
  ],
};

/** A big pale moon rising behind the right ear. */
export const MOON: Sprite = (() => {
  const grid: string[] = [];
  for (let y = 0; y < 12; y++) {
    let row = '';
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x + 0.5 - 28, y + 0.5 - 3);
      row += d <= 7 ? (d > 6 ? 'r' : 'm') : '.';
    }
    grid.push(row);
  }
  return {
    colors: { m: { hex: '#e3edf7' }, r: { hex: '#a9c3db' }, c: { hex: '#c3d5e6' }, s: { hex: '#0df3ff' } },
    parts: [
      { x: 0, y: 0, rows: grid },
      { x: 29, y: 5, rows: ['cc', 'c.'] },
      { x: 30, y: 1, rows: ['c'] },
      { x: 0, y: 4, rows: ['.s.', 'sss', '.s.'] },
      { x: 1, y: 27, rows: ['.s.', 'sss', '.s.'] },
      { x: 13, y: 1, rows: ['s'] },
    ],
  };
})();

export const GRID: Sprite = {
  colors: { g: { hex: '#0a3553' }, c: { hex: '#0df3ff' } },
  parts: [
    ...[0, 8, 16, 24].map((y) => ({ x: 0, y, rows: rows('32g') })),
    ...[0, 8, 16, 24].map((x) => ({ x, y: 0, rows: Array.from({ length: 32 }, () => 'g') })),
    { x: 0, y: 8, rows: ['c'] },
    { x: 24, y: 0, rows: ['c'] },
    { x: 0, y: 24, rows: ['c'] },
    { x: 16, y: 0, rows: ['c'] },
  ],
};

/** Three soft ribbons waving across the top of the sky. */
export const AURORA: Sprite = (() => {
  const bands: [string, number][] = [
    ['v', 0],
    ['c', 2],
    ['g', 4],
  ];
  const grid = Array.from({ length: 9 }, () => new Array<string>(32).fill('.'));
  for (let x = 0; x < 32; x++) {
    const wave = Math.round(1.5 + 1.5 * Math.sin((x / 32) * 2 * Math.PI * 1.5));
    for (const [ch, offset] of bands) {
      grid[offset + wave][x] = ch;
      if (offset + wave + 1 < 9 && ch !== 'v') grid[offset + wave + 1][x] = ch === 'g' ? 'G' : 'C';
    }
  }
  return {
    colors: { g: { hex: '#1f9e74' }, G: { hex: '#145e52' }, c: { hex: '#0e7f99' }, C: { hex: '#0b4f66' }, v: { hex: '#5b4bb0' } },
    parts: [{ x: 0, y: 0, rows: grid.map((r) => r.join('')) }],
  };
})();

export const SAKURA: Sprite = {
  colors: { p: { hex: '#ff9ccb' }, P: { hex: '#e86aa6' } },
  parts: [
    ...[
      [0, 3],
      [29, 6],
      [1, 18],
      [30, 25],
      [12, 1],
      [21, 3],
      [2, 28],
      [29, 0],
    ].map(([x, y]) => ({ x, y, rows: ['pP'] })),
    ...[[1, 11], [30, 15], [4, 0], [28, 30], [17, 0]].map(([x, y]) => ({ x, y, rows: ['p'] })),
  ],
};

/** Pixel sunset: four bands, warm at the bottom. */
export const SUNSET: Sprite = {
  colors: { a: { hex: '#2b1850' }, b: { hex: '#4a1d5c' }, c: { hex: '#7a2858' }, s: { hex: '#ffcf6b' } },
  parts: [
    { x: 0, y: 0, rows: Array.from({ length: 10 }, () => rows('32a')[0]) },
    { x: 0, y: 10, rows: Array.from({ length: 8 }, () => rows('32b')[0]) },
    { x: 0, y: 18, rows: Array.from({ length: 7 }, () => rows('32c')[0]) },
    { x: 1, y: 3, rows: ['s'] },
    { x: 29, y: 6, rows: ['s'] },
  ],
};
