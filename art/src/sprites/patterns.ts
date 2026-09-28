import type { Sprite } from '../types';
import { rows } from '../util';

const WHITE = '#f4f7fb';

export const TABBY: Sprite = {
  colors: { s: { role: 'shade' } },
  parts: [
    { x: 12, y: 10, mirror: true, rows: ['s', 's'] },
    { x: 14, y: 9, mirror: true, rows: ['s', 's', 's'] },
    { x: 4, y: 15, mirror: true, rows: ['ss', '..', 'ss'] },
    { x: 6, y: 26, mirror: true, rows: ['ss', '..', '.ss'] },
  ],
};

export const TUXEDO: Sprite = {
  colors: { W: { hex: WHITE } },
  parts: [
    { x: 0, y: 16, mirror: true, rows: rows('13.3W', '12.4W', '11.5W', '11.5W', '11.5W', '12.4W') },
    { x: 0, y: 23, mirror: true, rows: rows('13.3W', '12.4W', '11.5W', '10.6W', '10.6W', '10.6W', '10.6W', '10.6W', '10.6W') },
  ],
};

export const SPOTS: Sprite = {
  colors: { s: { role: 'shade' } },
  parts: [
    { x: 7, y: 10, rows: ['ss', 'ss'] },
    { x: 23, y: 18, rows: ['ss', 'ss'] },
    { x: 20, y: 11, rows: ['s'] },
    { x: 6, y: 26, rows: ['ss', 'ss'] },
    { x: 22, y: 25, rows: ['ss', 'ss'] },
    { x: 18, y: 29, rows: ['s'] },
  ],
};

export const BANDIT: Sprite = {
  colors: { M: { role: 'outline' } },
  parts: [{ x: 5, y: 11, mirror: true, rows: rows('2.4M', '.10M', '11M', '10M', '.5M') }],
};

export const BLAZE: Sprite = {
  colors: { W: { hex: WHITE } },
  parts: [
    { x: 15, y: 9, mirror: true, rows: ['W', 'W', 'W', 'W', 'W', 'W', 'W'] },
    { x: 0, y: 16, mirror: true, rows: rows('13.3W', '12.4W', '11.5W', '11.5W', '12.4W', '13.3W') },
  ],
};

export const CALICO: Sprite = {
  colors: { O: { hex: '#e8833a' }, K: { hex: '#2b2b30' } },
  parts: [
    { x: 6, y: 9, rows: ['OOOOO', 'OOOOOO', 'OOOO', '.OO'] },
    { x: 21, y: 15, rows: ['..KKK', '.KKKKK', 'KKKKKK', '.KKKK'] },
    { x: 19, y: 25, rows: ['..OOO', '.OOOOO', 'OOOOOO', '.OOOO'] },
    { x: 5, y: 28, rows: ['KKK', 'KKKK', '.KK'] },
  ],
};
