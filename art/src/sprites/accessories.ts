import type { Sprite } from '../types';
import { rows } from '../util';

// Accessories are painted after the head. The chin's bottom edge is y=22; the
// neck shows at y=23 (x=7..24) and the body widens to x=5..26 by y=27.

/** Red collar with a gold bell. */
export const BELL_COLLAR: Sprite = {
  colors: {
    R: { hex: '#d7263d' },
    G: { hex: '#f5c542' },
    g: { hex: '#c9971c' },
    k: { hex: '#5c3d00' },
    w: { hex: '#fff6c8' },
  },
  parts: [{ x: 8, y: 23, rows: rows('16R', '7.2G7.', '6.Gw2G6.', '6.g2kg6.') }],
};

export const BOW_TIE: Sprite = {
  colors: { B: { hex: '#d7263d' }, b: { hex: '#ff5a6e' }, K: { hex: '#8c1022' } },
  parts: [{ x: 12, y: 23, mirror: true, rows: rows('2B2.', 'B2bK', '2B2.') }],
};

/** Cyan scarf with a loose end. */
export const SCARF: Sprite = {
  colors: { S: { hex: '#19c6d9' }, s: { hex: '#0e8fa3' }, t: { hex: '#7fe9f5' } },
  parts: [
    {
      x: 6,
      y: 22,
      rows: rows(
        '2s3Ss8Ss3S2s',
        '3Ss3Ss4Ss3Ss3S',
        '.8s2.8s.',
        '3.2S15.',
        '3.2s15.',
        '3.2S15.',
        '3.2s15.',
        '3.2S15.',
        '3.2t15.',
      ),
    },
  ],
};

export const BANDANA: Sprite = {
  colors: { R: { hex: '#d7263d' }, w: { hex: '#ffffff' } },
  parts: [{ x: 8, y: 23, mirror: true, rows: rows('8R', '.7R', '2.Rw4R', '4.3Rw', '6.2R') }],
};

/** Office cat: shirt collar and tie. */
export const NECKTIE: Sprite = {
  colors: { W: { hex: '#f4f7fb' }, K: { hex: '#14335c' }, T: { hex: '#2f80ed' }, t: { hex: '#8fc2ff' } },
  parts: [{ x: 12, y: 23, rows: rows('3W2K3W', '.2W2T2W.', '3.2T3.', '2.4T2.', '2.Tt2T2.', '2.2TtT2.', '3.2T3.') }],
};

export const PEARLS: Sprite = {
  colors: { w: { hex: '#f4f1ea' }, W: { hex: '#cfc8bb' }, P: { hex: '#ffb3c7' } },
  parts: [{ x: 8, y: 23, mirror: true, rows: rows('w7.', '.Ww5.', '3.wW3.', '5.wWw', '7.P') }],
};

/** Thick gold chain with a padlock. */
export const GOLD_CHAIN: Sprite = {
  colors: { G: { hex: '#f5c542' }, g: { hex: '#c9971c' }, k: { hex: '#7a5200' } },
  parts: [
    { x: 8, y: 23, mirror: true, rows: rows('G7.', '.g6.', '2.G5.', '3.gGgGg', '6.2k', '5.k2G', '5.3G', '5.G2k') },
  ],
};

/** The FHE key, glowing. */
export const FHE_KEY: Sprite = {
  colors: { s: { hex: '#c9d4e0' }, c: { hex: '#0df3ff' } },
  parts: [
    {
      x: 8,
      y: 23,
      rows: rows('s14.s', '.2s10.2s.', '3.10s3.', '7.2c7.', '6.c2.c6.', '7.2c7.', '8.c7.', '8.2c6.', '8.c7.'),
    },
  ],
};

export const SPIKED_COLLAR: Sprite = {
  colors: { k: { hex: '#14161c' }, g: { hex: '#5c6b80' }, w: { hex: '#d7dee8' } },
  parts: [{ x: 8, y: 23, mirror: true, rows: rows('2kg2kg2k', '.w2.w2.w') }],
};

export const HOODIE: Sprite = {
  colors: {
    k: { hex: '#0c1b2b' },
    H: { hex: '#22486e' },
    h: { hex: '#16304d' },
    w: { hex: '#e6eef5' },
    c: { hex: '#0df3ff' },
    L: { hex: '#0df3ff' },
    l: { role: 'light' },
    o: { role: 'outline' },
  },
  parts: [
    {
      x: 4,
      y: 21,
      mirror: true,
      rows: rows(
        '2k10.',
        'kH3h7.',
        '.k3H4kw2k',
        '.k7Hw2H',
        'k8HcHL',
        'k9H2L',
        'k11H',
        'k4Hk5hk',
        'k4Ho5lo',
        'k4Holo3lo',
        '.11k',
      ),
    },
  ],
};

export const CAPE: Sprite = {
  colors: { C: { hex: '#c1121f' }, c: { hex: '#780000' }, G: { hex: '#f5c542' } },
  parts: [
    {
      x: 1,
      y: 21,
      mirror: true,
      rows: rows(
        '5.2C8.',
        '4.2Cc8.',
        '3.2Cc2.G6.',
        '2.2Cc10.',
        '2.2Cc10.',
        '.2Cc11.',
        '.2Cc11.',
        '2Cc12.',
        '2Cc12.',
        '2Cc12.',
        '2Cc12.',
      ),
    },
  ],
};
