import type { Sprite } from '../types';
import { rows } from '../util';

const GOLD = '#f5c542';
const CYAN = '#0df3ff';

export const BEANIE: Sprite = {
  colors: { P: { hex: '#e6f7ff' }, K: { hex: '#19c6d9' }, R: { hex: '#0e8fa3' } },
  parts: [
    {
      x: 4,
      y: 1,
      mirror: true,
      rows: rows('11.P', '10.2P', '7.5K', '5.7K', '3.9K', '2.10K', '1.11K', '1.11K', 'RKRKRKRKRKRK', 'RKRKRKRKRKRK'),
    },
  ],
};

export const HEADPHONES: Sprite = {
  colors: { H: { hex: '#2b3445' }, h: { hex: '#1b2230' }, c: { hex: CYAN } },
  parts: [
    { x: 3, y: 2, mirror: true, rows: rows('7.6H', '4.3H', '2.2H', '1.H', '1.H', '1.H', '1.H', '1.H', '1.H') },
    { x: 1, y: 11, mirror: true, rows: ['.hh.', 'hHHh', 'hcHh', 'hcHh', 'hHHh', '.hh.'] },
  ],
};

export const CROWN: Sprite = {
  colors: { Y: { hex: GOLD }, y: { hex: '#c9971c' }, R: { hex: '#e53950' }, C: { hex: CYAN } },
  parts: [{ x: 11, y: 4, mirror: true, rows: ['Y...Y', 'YY..Y', 'YYYYY', 'YRYYC', 'yyyyy'] }],
};

export const PARTY_HAT: Sprite = {
  colors: { P: { hex: '#ffffff' }, C: { hex: '#ff5da2' }, S: { hex: '#ffd23f' } },
  parts: [{ x: 12, y: 0, mirror: true, rows: rows('3.P', '3.C', '2.2C', '2.2S', '.3C', '.3S', '4C', '4S', '4C') }],
};

export const HALO: Sprite = {
  colors: { Y: { hex: '#ffe27a' } },
  parts: [{ x: 10, y: 0, mirror: true, rows: rows('.5Y', 'Y', '.5Y') }],
};

export const HEADBAND: Sprite = {
  colors: { R: { hex: '#e53950' }, D: { hex: '#ff8a9a' }, k: { hex: '#a3162c' } },
  parts: [
    { x: 4, y: 10, rows: rows('2RD4RD4RD4RD6R', '24R') },
    { x: 27, y: 9, rows: ['.kR', 'kRR', 'RR.', 'R.R', '..R'] },
  ],
};

export const WIZARD_HAT: Sprite = {
  colors: { W: { hex: '#6c4cc7' }, B: { hex: '#4b2f9a' }, s: { hex: '#ffe27a' } },
  parts: [
    { x: 6, y: 0, mirror: true, rows: rows('9.W', '8.2W', '7.3W', '6.4W', '6.4W', '5.5W', '4.6W', '4.6W', '10B', '.9B') },
    { x: 13, y: 3, rows: ['s'] },
    { x: 17, y: 5, rows: ['.s.', 'sss', '.s.'] },
    { x: 12, y: 7, rows: ['s'] },
  ],
};

export const CAP: Sprite = {
  colors: { C: { hex: '#2b4f7a' }, V: { hex: '#1a3352' }, c: { hex: CYAN } },
  parts: [
    { x: 4, y: 4, mirror: true, rows: rows('6.6C', '4.8C', '3.9C', '2.10C', '2.10C', '12V') },
    { x: 14, y: 6, rows: ['c..c', '.cc.'] },
  ],
};

export const CIPHER_CROWN: Sprite = {
  colors: { C: { hex: CYAN }, d: { hex: '#0a8fa3' }, w: { hex: '#ffffff' } },
  parts: [
    { x: 10, y: 1, mirror: true, rows: ['.w....', '......', 'C..C..', 'CC.CC.', 'CCCCCC', 'CdCdCw', 'dddddd'] },
  ],
};

export const FLOWER: Sprite = {
  colors: { P: { hex: '#ff8fc7' }, Y: { hex: '#ffe27a' }, g: { hex: '#3ddc84' } },
  parts: [{ x: 3, y: 3, rows: ['.PP..', 'PPYP.', '.PPP.', '..g..', '.gg..'] }],
};
