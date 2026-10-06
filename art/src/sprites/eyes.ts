import type { Sprite } from '../types';

const PUPIL = '#141821';
const SHINE = '#ffffff';
const CYAN = '#0df3ff';

// Eyes fill 5×5 boxes: the left one at x=7..11, the right one at x=20..24,
// both on rows y=12..16. Most eyes are drawn on the left and mirrored.

/** Round eye: iris ring, big pupil, one large and one small sparkle. */
const ROUND = ['.EEE.', 'EBBWE', 'EBBBE', 'EWBBE', '.LLL.'];

function round(iris: string, lower: string): Sprite {
  return {
    colors: { E: { hex: iris }, L: { hex: lower }, B: { hex: PUPIL }, W: { hex: SHINE } },
    parts: [{ x: 7, y: 12, mirror: true, rows: ROUND }],
  };
}

export const AMBER_EYES = round('#f5a623', '#ffd166');
export const EMERALD_EYES = round('#2fbf71', '#7ae6a6');
export const SKY_EYES = round('#3d9df5', '#8fd0ff');
export const VIOLET_EYES = round('#9b6bff', '#c9adff');

export const ODD_EYES: Sprite = {
  colors: {
    S: { hex: '#3d9df5' },
    s: { hex: '#8fd0ff' },
    A: { hex: '#f5a623' },
    a: { hex: '#ffd166' },
    B: { hex: PUPIL },
    W: { hex: SHINE },
  },
  parts: [
    { x: 7, y: 12, rows: ROUND.map((r) => r.replace(/E/g, 'S').replace(/L/g, 's')) },
    { x: 20, y: 12, rows: ['.AAA.', 'AWBBA', 'ABBBA', 'ABBWA', '.aaa.'] },
  ],
};

/** Heavy lids over a half-moon of iris. */
export const SLEEPY_EYES: Sprite = {
  colors: { i: { role: 'ink' }, E: { hex: '#f5a623' }, B: { hex: PUPIL } },
  parts: [{ x: 7, y: 14, mirror: true, rows: ['iiiii', 'EBBBE', '.EEE.'] }],
};

/** ^ ^ */
export const HAPPY_EYES: Sprite = {
  colors: { i: { role: 'ink' } },
  parts: [{ x: 7, y: 13, mirror: true, rows: ['.iii.', 'i...i'] }],
};

export const WINK_EYES: Sprite = {
  colors: { E: { hex: '#f5a623' }, L: { hex: '#ffd166' }, B: { hex: PUPIL }, W: { hex: SHINE }, i: { role: 'ink' } },
  parts: [
    { x: 7, y: 12, rows: ROUND },
    { x: 20, y: 13, rows: ['.iii.', 'i...i'] },
  ],
};

/** A four-point star shining in each eye. */
export const STARRY_EYES: Sprite = {
  colors: { E: { hex: '#3d9df5' }, B: { hex: '#1b2a6b' }, W: { hex: SHINE }, Y: { hex: '#ffe27a' } },
  parts: [{ x: 7, y: 12, mirror: true, rows: ['.EEE.', 'EBWBE', 'EWYWE', 'EBWBE', '.EEE.'] }],
};

export const HEART_EYES: Sprite = {
  colors: { H: { hex: '#ff4f8b' }, h: { hex: '#c2185b' }, W: { hex: '#ffd1e3' } },
  parts: [{ x: 7, y: 12, mirror: true, rows: ['HH.HH', 'HWHHH', 'HHHHh', '.HHh.', '..h..'] }],
};

/** A glowing 0 and 1 in dark sockets. */
export const CIPHER_EYES: Sprite = {
  colors: { c: { hex: CYAN }, d: { hex: '#05202b' } },
  parts: [
    { x: 7, y: 12, rows: ['dcccd', 'cdddc', 'cdddc', 'cdddc', 'dcccd'] },
    { x: 20, y: 12, rows: ['ddcdd', 'dccdd', 'ddcdd', 'ddcdd', 'dcccd'] },
  ],
};

export const PIXEL_SHADES: Sprite = {
  colors: { k: { hex: '#0b0d12' }, g: { hex: '#5c6b80' }, w: { hex: '#e6eef5' } },
  parts: [{ x: 5, y: 12, mirror: true, rows: ['kkkkkkkkkkk', '.kwkkkkkk..', '.kgwkkkkk..', '..kkkkkk...'] }],
};

export const GLOW_EYES: Sprite = {
  colors: { c: { hex: CYAN }, C: { hex: '#0a8fa3' }, w: { hex: SHINE } },
  parts: [{ x: 7, y: 12, mirror: true, rows: ['.CCC.', 'CcccC', 'CcwcC', 'CcccC', '.CCC.'] }],
};

export const GLASSES_3D: Sprite = {
  colors: { F: { hex: '#f2f2f2' }, R: { hex: '#e53950' }, B: { hex: '#2f80ed' } },
  parts: [
    { x: 5, y: 12, rows: ['FFFFFFFFFFF', '.FRRRRRF...', '.FRRRRRF...', '.FFFFFFF...'] },
    { x: 16, y: 12, rows: ['FFFFFFFFFFF', '...FBBBBBF.', '...FBBBBBF.', '...FFFFFFF.'] },
  ],
};

/** Red eyes firing beams out to the edges. */
export const LASER_EYES: Sprite = {
  colors: { R: { hex: '#ff2d3d' }, r: { hex: '#ff8a8a' }, w: { hex: SHINE }, d: { hex: '#b3001b' } },
  parts: [
    { x: 7, y: 12, mirror: true, rows: ['.ddd.', 'dRRRd', 'RRwRR', 'dRRRd', '.ddd.'] },
    { x: 0, y: 13, mirror: true, rows: ['ddddddd', 'rrrrrrr', 'ddddddd'] },
  ],
};

/** A cyan cyber visor across both eyes. */
export const VISOR: Sprite = {
  colors: { k: { hex: '#0b1a24' }, c: { hex: CYAN }, C: { hex: '#0a8fa3' }, w: { hex: SHINE } },
  parts: [{ x: 4, y: 12, mirror: true, rows: ['.kkkkkkkkkkk', 'kwcccccccccc', 'kcCCCCCCCCCC', '.kkkkkkkkkkk'] }],
};
