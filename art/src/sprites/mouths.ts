import type { Sprite } from '../types';

// Mouths live under the nose, centred on x=13..18, rows y=18..22.

export const CAT_MOUTH: Sprite = {
  colors: { o: { role: 'outline' } },
  parts: [{ x: 13, y: 18, mirror: true, rows: ['o.o', '.o.'] }],
};

export const SMILE: Sprite = {
  colors: { o: { role: 'outline' } },
  parts: [{ x: 13, y: 18, mirror: true, rows: ['o..', '.oo'] }],
};

export const BLEP: Sprite = {
  colors: { o: { role: 'outline' }, T: { hex: '#ff7fa8' } },
  parts: [{ x: 13, y: 18, mirror: true, rows: ['o.o', '.oT', '..T'] }],
};

export const FANGS: Sprite = {
  colors: { o: { role: 'outline' }, W: { hex: '#ffffff' } },
  parts: [{ x: 13, y: 18, mirror: true, rows: ['.oo', '.W.'] }],
};

export const FISH: Sprite = {
  colors: { F: { hex: '#8cb4d8' }, T: { hex: '#5c88b0' }, e: { hex: '#0b0e14' } },
  parts: [
    {
      x: 9,
      y: 18,
      rows: ['...FFFF...T.', '.FFFFFFF.TT.', 'FeFFFFFFTTT.', '.FFFFFFF.TT.', '...FFFF...T.'],
    },
  ],
};

export const MEOW: Sprite = {
  colors: { o: { role: 'outline' }, R: { hex: '#7a1f3d' } },
  parts: [{ x: 13, y: 18, mirror: true, rows: ['.oo', '.oR', '..o'] }],
};

export const BUBBLEGUM: Sprite = {
  colors: { P: { hex: '#ff7eb6' }, w: { hex: '#ffd1e6' } },
  parts: [{ x: 14, y: 18, rows: ['.PPP.', 'PPwPP', 'PPPPP', 'PPPPP', '.PPP.'] }],
};
