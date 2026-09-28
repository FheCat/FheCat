import { FUR_ROLES, type ColorRef, type Layer, type Rect, type Sprite } from './types';

export const SIZE = 32;

/**
 * Registry of fixed colours. Indices are assigned in first-use order while the
 * art is compiled, so the Solidity tables and the TypeScript renderer always
 * agree on them.
 */
export class ColorTable {
  readonly hexes: string[] = [];
  private readonly index = new Map<string, number>();

  ref(color: ColorRef): number {
    if ('role' in color) return FUR_ROLES.indexOf(color.role);
    return FUR_ROLES.length + this.fixed(color.hex);
  }

  fixed(hex: string): number {
    const key = normalizeHex(hex);
    let i = this.index.get(key);
    if (i === undefined) {
      i = this.hexes.length;
      this.hexes.push(key);
      this.index.set(key, i);
    }
    return i;
  }
}

export function normalizeHex(hex: string): string {
  const h = hex.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(h)) throw new Error(`bad colour ${hex}`);
  return h;
}

/** Rasterise a sprite into a 32×32 grid of colour indices (-1 = transparent). */
export function rasterize(sprite: Sprite, colors: ColorTable): number[][] {
  const grid = Array.from({ length: SIZE }, () => new Array<number>(SIZE).fill(-1));
  const stamp = (x0: number, y0: number, rows: string[], flip: boolean) => {
    const width = Math.max(...rows.map((r) => r.length));
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const ch = row[dx];
        if (ch === '.' || ch === ' ') continue;
        const color = sprite.colors[ch];
        if (!color) throw new Error(`unknown sprite char '${ch}'`);
        const x = flip ? x0 + width - 1 - dx : x0 + dx;
        const y = y0 + dy;
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) throw new Error(`pixel (${x},${y}) off canvas`);
        grid[y][x] = colors.ref(color);
      }
    });
  };
  for (const part of sprite.parts) {
    stamp(part.x, part.y, part.rows, false);
    if (part.mirror) {
      const width = Math.max(...part.rows.map((r) => r.length));
      stamp(SIZE - part.x - width, part.y, part.rows, true);
    }
  }
  return grid;
}

/**
 * Greedy rectangle cover: scan row-major, grow each rectangle right, then down.
 * Groups are ordered by first appearance of their colour in the same scan.
 */
export function gridToLayer(grid: number[][]): Layer {
  const used = grid.map((row) => row.map(() => false));
  const groups = new Map<number, Rect[]>();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = grid[y][x];
      if (c < 0 || used[y][x]) continue;
      let w = 1;
      while (x + w < SIZE && grid[y][x + w] === c && !used[y][x + w]) w++;
      let h = 1;
      grow: while (y + h < SIZE) {
        for (let i = 0; i < w; i++) {
          if (grid[y + h][x + i] !== c || used[y + h][x + i]) break grow;
        }
        h++;
      }
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) used[y + dy][x + dx] = true;
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c)!.push([x, y, w, h]);
    }
  }
  return [...groups.entries()].map(([color, rects]) => ({ color, rects }));
}

export function compileSprite(sprite: Sprite | undefined, colors: ColorTable): Layer {
  return sprite ? gridToLayer(rasterize(sprite, colors)) : [];
}
