import type { Sprite } from '../types';

// Mouths sit under the nose (x=15..16, y=17), centred on x=13..18 from y=18.
// Lines use the fur's ink, so they stay visible on dark coats.

/** ω */
export const CAT_MOUTH: Sprite = {
  colors: { i: { role: 'ink' } },
  parts: [{ x: 13, y: 18, mirror: true, rows: ['i.i', '.i.'] }],
};

export const SMILE: Sprite = {
  colors: { i: { role: 'ink' } },
  parts: [{ x: 12, y: 18, mirror: true, rows: ['i...', '.iii'] }],
};

export const BLEP: Sprite = {
  colors: { i: { role: 'ink' }, T: { hex: '#ff7fa8' }, t: { hex: '#e0568a' } },
  parts: [
    { x: 13, y: 18, mirror: true, rows: ['i.i', '.i.'] },
    { x: 16, y: 19, rows: ['T', 't'] },
  ],
};

export const FANG: Sprite = {
  colors: { i: { role: 'ink' }, W: { hex: '#ffffff' } },
  parts: [
    { x: 13, y: 18, mirror: true, rows: ['i.i', '.i.'] },
    { x: 14, y: 20, rows: ['W'] },
  ],
};

export const MEOW: Sprite = {
  colors: { i: { role: 'ink' }, M: { hex: '#7a1f3d' }, T: { hex: '#ff7fa8' } },
  parts: [{ x: 14, y: 18, mirror: true, rows: ['.i', 'iM', 'iT', '.i'] }],
};

export const GRIN: Sprite = {
  colors: { i: { role: 'ink' }, W: { hex: '#ffffff' }, w: { hex: '#cfd8e3' } },
  parts: [{ x: 11, y: 18, mirror: true, rows: ['iiiii', '.iWWW', '..iww', '...ii'] }],
};

export const FISH: Sprite = {
  colors: { F: { hex: '#8cb4d8' }, f: { hex: '#5c88b0' }, e: { hex: '#0b0e14' }, w: { hex: '#e6f2ff' } },
  parts: [{ x: 9, y: 18, rows: ['..wFFFF...f', '.FFFFFFF.ff', 'FeFFFFFFfff', '.FFFFFFF.ff', '..fFFFf...f'] }],
};

export const BUBBLEGUM: Sprite = {
  colors: { P: { hex: '#ff7eb6' }, p: { hex: '#e0569a' }, w: { hex: '#ffd1e6' } },
  parts: [{ x: 14, y: 18, rows: ['.PPP.', 'PwPPP', 'PPPPp', 'PPPPp', '.ppp.'] }],
};

export const LOLLIPOP: Sprite = {
  colors: { i: { role: 'ink' }, s: { hex: '#f2f2f2' }, R: { hex: '#ff4f8b' }, Y: { hex: '#ffe27a' }, w: { hex: '#ffffff' } },
  parts: [
    { x: 13, y: 18, rows: ['i.ii.', '.i..i'] },
    { x: 18, y: 18, rows: ['.....RRR', '....RYYwR', 'ssssRYRYR', '....RYYYR', '.....RRR'].map((r) => r.padEnd(9, '.')) },
  ],
};

export const MUSTACHE: Sprite = {
  colors: { k: { hex: '#2a1a12' }, K: { hex: '#4a2e1f' } },
  parts: [{ x: 9, y: 17, mirror: true, rows: ['k.....', 'K.kkkk', '.KKKKk', '..KK..'] }],
};
