import type { Sprite } from '../types';

const PUPIL = '#101418';
const SHINE = '#ffffff';
export const AMBER = '#f5b63c';
export const EMERALD = '#3ddc84';
export const SKY = '#5ab8ff';
const CYAN = '#0df3ff';

// Left eye sits at x=9..12, right eye at x=19..22, both on rows y=12..15.
const LEFT_EYE = ['.EE.', 'EWBE', 'EEBE', '.EE.'];
const RIGHT_EYE = ['.EE.', 'EBWE', 'EBEE', '.EE.'];

function round(iris: string): Sprite {
  return {
    colors: { E: { hex: iris }, W: { hex: SHINE }, B: { hex: PUPIL } },
    parts: [{ x: 9, y: 12, mirror: true, rows: LEFT_EYE }],
  };
}

export const AMBER_EYES = round(AMBER);
export const EMERALD_EYES = round(EMERALD);
export const SKY_EYES = round(SKY);

export const SLEEPY_EYES: Sprite = {
  colors: { s: { role: 'shade' }, i: { role: 'ink' } },
  parts: [{ x: 9, y: 13, mirror: true, rows: ['ssss', 'iiii', 'i...'] }],
};

export const ODD_EYES: Sprite = {
  colors: { S: { hex: SKY }, A: { hex: AMBER }, W: { hex: SHINE }, B: { hex: PUPIL } },
  parts: [
    { x: 9, y: 12, rows: LEFT_EYE.map((r) => r.replace(/E/g, 'S')) },
    { x: 19, y: 12, rows: RIGHT_EYE.map((r) => r.replace(/E/g, 'A')) },
  ],
};

export const HAPPY_EYES: Sprite = {
  colors: { i: { role: 'ink' } },
  parts: [{ x: 9, y: 13, mirror: true, rows: ['.ii.', 'i..i'] }],
};

export const WINK_EYES: Sprite = {
  colors: { E: { hex: AMBER }, W: { hex: SHINE }, B: { hex: PUPIL }, i: { role: 'ink' } },
  parts: [
    { x: 9, y: 12, rows: LEFT_EYE },
    { x: 19, y: 13, rows: ['.ii.', 'i..i'] },
  ],
};

/** A glowing 0 and 1 on dark sockets. */
export const CIPHER_EYES: Sprite = {
  colors: { c: { hex: CYAN }, d: { hex: '#062a33' } },
  parts: [
    { x: 9, y: 11, rows: ['dccd', 'cddc', 'cddc', 'cddc', 'dccd'] },
    { x: 19, y: 11, rows: ['ddcd', 'dccd', 'ddcd', 'ddcd', 'dccc'] },
  ],
};

export const PIXEL_SHADES: Sprite = {
  colors: { k: { hex: '#0a0d12' }, L: { hex: '#1f2a3d' }, g: { hex: '#8fd8ff' } },
  parts: [{ x: 7, y: 12, mirror: true, rows: ['kkkkkkkkk', '.kgLLLk..', '.kLLLLk..', '..kkkk...'] }],
};

export const GLOW_EYES: Sprite = {
  colors: { c: { hex: CYAN }, w: { hex: SHINE }, h: { hex: '#0a8fa3' } },
  parts: [{ x: 8, y: 12, mirror: true, rows: ['.hcch.', 'hcwwch', 'hcwwch', '.hcch.'] }],
};

export const GLASSES_3D: Sprite = {
  colors: { F: { hex: '#f2f2f2' }, R: { hex: '#e53950' }, B: { hex: '#2f80ed' } },
  parts: [
    { x: 7, y: 12, rows: ['FFFFFFFFF', '.FRRRRF..', '.FRRRRF..', '.FFFFFF..'] },
    { x: 16, y: 12, rows: ['FFFFFFFFF', '..FBBBBF.', '..FBBBBF.', '..FFFFFF.'] },
  ],
};
