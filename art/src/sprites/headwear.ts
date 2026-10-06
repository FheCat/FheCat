import type { Sprite } from '../types';
import { rows } from '../util';

// Headwear is painted last, on top of everything. The head's top edge is y=6
// (x=10..21) and the ears rise from y=1 at x=3..10 and x=21..28.

/** Knit beanie between the ears, with a pom-pom. */
export const BEANIE: Sprite = {
  colors: {
    k: { hex: '#0b4f66' },
    K: { hex: '#19c6d9' },
    R: { hex: '#0e8fa3' },
    c: { hex: '#7fe9f5' },
    P: { hex: '#e6f7ff' },
    w: { hex: '#ffffff' },
  },
  parts: [
    {
      x: 6,
      y: 0,
      mirror: true,
      rows: rows('8.2k', '6.2k2P', '4.2kKkPw', '3.kc5K', '2.kKc5K', '.k8K', 'kRKRKRKRKR', 'kRKRKRKRKR', '10k'),
    },
  ],
};

/** Baseball cap with a cyan paw. */
export const CAP: Sprite = {
  colors: {
    k: { hex: '#0e1f33' },
    C: { hex: '#2b4f7a' },
    c: { hex: '#4a76a8' },
    V: { hex: '#1a3352' },
    L: { hex: '#0df3ff' },
  },
  parts: [{ x: 6, y: 2, mirror: true, rows: rows('5.5k', '3.kc5C', '2.k6CL', '.k6C2L', '.9k', '10k', '.9k') }],
};

/** Gaming headphones. */
export const HEADPHONES: Sprite = {
  colors: { k: { hex: '#0b0f17' }, H: { hex: '#3a4458' }, C: { hex: '#2b3445' }, c: { hex: '#0df3ff' } },
  parts: [
    {
      x: 0,
      y: 1,
      mirror: true,
      rows: rows(
        '11.5k',
        '9.2k5H',
        '9.2H5k',
        '9.2k5.',
        '.k14.',
        '.H14.',
        '.k14.',
        '.2k13.',
        'k2Ck12.',
        'kCck12.',
        'kCck12.',
        'k2Ck12.',
        '.2k13.',
      ),
    },
  ],
};

export const CROWN: Sprite = {
  colors: {
    k: { hex: '#7a5200' },
    Y: { hex: '#f5c542' },
    y: { hex: '#d4a017' },
    R: { hex: '#e53950' },
    B: { hex: '#2f80ed' },
  },
  parts: [{ x: 10, y: 1, mirror: true, rows: rows('.k3.k', 'kYk.kY', 'k2Yk2Y', 'k5Y', 'kYR2YB', 'k5y', '6k') }],
};

export const PARTY_HAT: Sprite = {
  colors: {
    k: { hex: '#7a1f4d' },
    S: { hex: '#ff5da2' },
    C: { hex: '#0df3ff' },
    Y: { hex: '#ffd23f' },
    w: { hex: '#ffffff' },
    P: { hex: '#ffd23f' },
  },
  parts: [
    {
      x: 11,
      y: 0,
      rows: rows('4.2P4.', '4.2k4.', '3.k2Sk3.', '3.k2CY3.', '2.k4Ck2.', '.k2Sw3Sk.', '.kY5Sk.', 'k8Ck', '10k'),
    },
  ],
};

export const HALO: Sprite = {
  colors: { Y: { hex: '#ffe27a' }, y: { hex: '#e0b84a' } },
  parts: [{ x: 11, y: 0, mirror: true, rows: rows('.4Y', 'Y4.', '.4y') }],
};

export const TOP_HAT: Sprite = {
  colors: { k: { hex: '#000000' }, K: { hex: '#1c2230' }, B: { hex: '#0df3ff' }, g: { hex: '#3a4458' } },
  parts: [{ x: 8, y: 0, mirror: true, rows: rows('3.5k', '3.kg3K', '3.k4K', '3.k4B', '3.k4B', '3.5k', '8k', '8k') }],
};

export const WIZARD_HAT: Sprite = {
  colors: {
    k: { hex: '#2a1660' },
    W: { hex: '#6c4cc7' },
    B: { hex: '#4b2f9a' },
    s: { hex: '#ffe27a' },
    y: { hex: '#fff3b0' },
  },
  parts: [
    {
      x: 6,
      y: 0,
      rows: rows('9.2k9.', '8.k2Wk8.', '8.kWyk8.', '7.s4Wk7.', '6.k6Wk6.', '5.k6WsWk5.', '5.10k5.', '20k', '.18k.'),
    },
  ],
};

export const COWBOY_HAT: Sprite = {
  colors: { k: { hex: '#3b2414' }, H: { hex: '#a0672e' }, h: { hex: '#8a5524' }, b: { hex: '#5a3519' } },
  parts: [
    { x: 2, y: 1, mirror: true, rows: rows('9.3k2.', '8.k3H2k', '8.k5H', '8.k5H', 'k7.6k', '.13k', '2k12h', '2.12k') },
  ],
};

export const DEVIL_HORNS: Sprite = {
  colors: { k: { hex: '#5c0a14' }, R: { hex: '#e53950' } },
  parts: [{ x: 10, y: 2, mirror: true, rows: rows('k5.', 'Rk4.', '2Rk3.', 'k2R3.', '.2k3.') }],
};

export const PROPELLER_CAP: Sprite = {
  colors: {
    k: { hex: '#1b2230' },
    R: { hex: '#e53950' },
    Y: { hex: '#ffd23f' },
    B: { hex: '#2f80ed' },
    G: { hex: '#3ddc84' },
    p: { hex: '#d7dee8' },
    q: { hex: '#9aa5b5' },
  },
  parts: [
    {
      x: 7,
      y: 0,
      rows: rows('2.6p2k6q2.', '8.2k8.', '8.2k8.', '4.10k4.', '2.2k2R3Y3G2B2k2.', '.k4R3Y3G4Bk.', 'k5R3Y3G5Bk', '18k'),
    },
  ],
};

export const CIPHER_CROWN: Sprite = {
  colors: {
    k: { hex: '#063a46' },
    c: { hex: '#0df3ff' },
    C: { hex: '#ffffff' },
    d: { hex: '#0a8fa3' },
    w: { hex: '#9cfbff' },
  },
  parts: [
    { x: 10, y: 0, mirror: true, rows: rows('2.w3.', '6.', 'k2.k2.', 'kck.kc', 'k2ck2c', 'k3cCc', 'kdcdcd', '6k') },
  ],
};

export const BOW: Sprite = {
  colors: { k: { hex: '#8c1046' }, P: { hex: '#ff5da2' }, p: { hex: '#ff9ccb' }, K: { hex: '#c2185b' } },
  parts: [{ x: 7, y: 4, rows: rows('.2k.2k.', 'k2Pk2Pk', 'kPpKpPk', 'k2Pk2Pk', '.2k.2k.') }],
};

export const FLOWER: Sprite = {
  colors: { P: { hex: '#ff8fc7' }, Y: { hex: '#ffe27a' }, g: { hex: '#3ddc84' } },
  parts: [{ x: 3, y: 4, rows: rows('.P.P.', '5P', '.PYP.', '5P', '.P.Pg', '4.g') }],
};

export const HEADBAND: Sprite = {
  colors: { R: { hex: '#e53950' }, r: { hex: '#a3162c' }, K: { hex: '#6b0f1d' } },
  parts: [{ x: 3, y: 8, rows: rows('26RK2.', '26rKR.', '26.R.R', '26.R.R') }],
};
