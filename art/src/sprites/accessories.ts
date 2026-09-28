import type { Sprite } from '../types';
import { rows } from '../util';

const GOLD = '#f5c542';
const CYAN = '#0df3ff';

export const BELL_COLLAR: Sprite = {
  colors: { R: { hex: '#d7263d' }, G: { hex: GOLD }, k: { hex: '#6b4a00' } },
  parts: [
    { x: 8, y: 23, rows: [rows('16R')[0]] },
    { x: 14, y: 24, mirror: true, rows: ['.G', 'GG', '.k'] },
  ],
};

export const BOW_TIE: Sprite = {
  colors: { B: { hex: '#d7263d' }, K: { hex: '#8c1022' } },
  parts: [{ x: 12, y: 23, mirror: true, rows: ['BB..', 'BBBK', 'BB..'] }],
};

export const SCARF: Sprite = {
  colors: { S: { hex: '#19c6d9' }, s: { hex: '#0e7c8f' } },
  parts: [
    { x: 7, y: 22, rows: ['SSsSSSsSSSsSSSsSSS', 'SSsSSSsSSSsSSSsSSS', '.SsSSSsSSSsSSSsSS.'] },
    { x: 9, y: 25, rows: ['SS', 'ss', 'SS', 'ss', 'SS'] },
  ],
};

export const GOLD_CHAIN: Sprite = {
  colors: { G: { hex: GOLD }, P: { hex: '#ffe27a' } },
  parts: [{ x: 9, y: 23, mirror: true, rows: ['G......', '.G.....', '..GG...', '....GGG', '......P', '......P'] }],
};

export const FHE_KEY: Sprite = {
  colors: { S: { hex: '#c9d4e0' }, c: { hex: CYAN } },
  parts: [
    { x: 9, y: 23, mirror: true, rows: ['S......', '.S.....', '..SS...', '....SS.'] },
    { x: 14, y: 26, rows: ['.cc.', 'c..c', '.cc.', '..c.', '..cc', '..c.'] },
  ],
};

export const HOODIE: Sprite = {
  colors: { o: { role: 'outline' }, H: { hex: '#22486e' }, h: { hex: '#16304d' }, w: { hex: '#e6eef5' }, c: { hex: CYAN } },
  parts: [
    {
      x: 0,
      y: 23,
      mirror: true,
      rows: rows('8.o7h', '7.o8H', '6.o9H', '5.o10H', '5.o10H', '4.o11H', '4.o11H', '3.o12H', '3.o12H'),
    },
    { x: 13, y: 24, mirror: true, rows: ['w', 'w', 'w', 'c'] },
    { x: 14, y: 28, rows: ['c..c', '.cc.', '.cc.'] },
  ],
};

export const CAPE: Sprite = {
  colors: { C: { hex: '#c1121f' }, c: { hex: '#780000' }, G: { hex: GOLD } },
  parts: [
    { x: 3, y: 23, mirror: true, rows: rows('5.CC', '4.CCc', '3.CCc', '2.CCc', '2.CCc', '1.CCc', '1.CCc', 'CCc', 'CCc') },
    { x: 15, y: 23, mirror: true, rows: ['G'] },
  ],
};
