import type { Sprite } from '../types';
import { rows } from '../util';

// Coat markings, painted over the head and body but under the eyes and mouth.
// Anything covering the nose (x=15..16, y=17) paints it back.

const WHITE = '#f4f7fb';
const NOSE = '#e86a92';

/** White muzzle around the mouth, shared by Tuxedo and Blaze. Left half. */
const MUZZLE = { x: 0, y: 17, mirror: true, rows: rows('13.2W1n', '12.4W', '12.4W', '13.3W', '14.2W') };

export const TABBY: Sprite = {
  colors: { s: { role: 'shade' } },
  parts: [
    { x: 12, y: 7, mirror: true, rows: ['s.s', 's.s', '..s'] }, // forehead M
    { x: 3, y: 14, mirror: true, rows: ['sss', '...', 'ss.'] }, // cheeks
    { x: 7, y: 24, mirror: true, rows: ['.ss', '...', 'ss.', '...', 's..'] }, // flanks
    { x: 29, y: 23, rows: ['ss'] }, // tail rings
    { x: 28, y: 26, rows: ['ss'] },
  ],
};

export const TIGER: Sprite = {
  colors: { k: { role: 'outline' } },
  parts: [
    { x: 11, y: 7, mirror: true, rows: ['k.k.k', 'k.k.k', '..k..'] },
    { x: 3, y: 13, mirror: true, rows: ['kkk.', '....', 'kkkk', '....', 'kk..'] },
    { x: 6, y: 23, mirror: true, rows: ['..kk', '....', '.kk.', '....', 'kk..', '....', 'k...'] },
    { x: 29, y: 22, rows: ['kk'] },
    { x: 29, y: 24, rows: ['kk'] },
    { x: 28, y: 26, rows: ['kk'] },
  ],
};

export const TUXEDO: Sprite = {
  colors: { W: { hex: WHITE }, n: { hex: NOSE } },
  parts: [
    MUZZLE,
    { x: 0, y: 23, mirror: true, rows: rows('13.3W', '12.4W', '11.5W', '11.5W', '12.4W') },
    { x: 10, y: 28, mirror: true, rows: ['WWWWW', 'WWWWW', 'W.WWW'] }, // white paws
  ],
};

export const SPOTS: Sprite = {
  colors: { s: { role: 'shade' } },
  parts: [
    { x: 7, y: 8, rows: ['.ss', 'sss', '.s.'] },
    { x: 22, y: 9, rows: ['ss', 'ss'] },
    { x: 25, y: 19, rows: ['ss'] },
    { x: 6, y: 25, rows: ['.ss', 'sss'] },
    { x: 22, y: 26, rows: ['ss', 'ss'] },
    { x: 19, y: 7, rows: ['s'] },
  ],
};

/** A domino mask; the eye boxes stay open so closed eyes still show. */
export const BANDIT: Sprite = {
  colors: { M: { role: 'outline' } },
  parts: [
    { x: 0, y: 11, mirror: true, rows: rows('5.11M', '4.3M5.4M', '3.4M5.4M', '3.4M5.4M', '3.4M5.4M', '4.3M5.3M1.', '7.5M4.') },
  ],
};

/** A white stripe running down the forehead into a white muzzle. */
export const BLAZE: Sprite = {
  colors: { W: { hex: WHITE }, n: { hex: NOSE } },
  parts: [MUZZLE, { x: 0, y: 7, mirror: true, rows: rows('15.W', '15.W', '15.W', '15.W', '15.W', '15.W', '14.2W', '14.2W', '14.2W', '13.3W') }],
};

export const CALICO: Sprite = {
  colors: { O: { hex: '#e8833a' }, K: { hex: '#2b2b30' } },
  parts: [
    // orange over the left ear and brow
    { x: 4, y: 2, rows: ['.O', '.O', 'O..O', 'O...O', 'O....OO', 'OOOOOOOO', 'OOOOOOO', 'OOOOO', 'OOO'] },
    // black over the right brow
    { x: 19, y: 7, rows: ['..KKKKKKK', '.KKKKKKKK', '...KKKKKK', '.....KKK'] },
    // body patches
    { x: 6, y: 24, rows: ['.KK', 'KKKK', 'KKKK', '.KK'] },
    { x: 21, y: 25, rows: ['..OO', '.OOOO', 'OOOOO', '.OOO'] },
    { x: 29, y: 21, rows: ['OO', 'OO', 'OO'] },
  ],
};

/** Colourpoint: dark ears and tail tip, a shaded face mask. */
export const SIAMESE: Sprite = {
  colors: { d: { role: 'outline' }, m: { role: 'shade' }, n: { hex: NOSE } },
  parts: [
    { x: 4, y: 2, mirror: true, rows: ['.d', '.d', 'd..d', 'd...d', 'd....d', 'dd'] },
    { x: 0, y: 12, mirror: true, rows: rows('14.2m', '13.3m', '12.4m', '11.5m', '11.5m', '11.4mn', '11.5m', '12.4m', '13.3m', '14.2m') },
    { x: 28, y: 20, rows: ['.dd.', '.dd.', '.dd.'] },
  ],
};

export const HEART_MARK: Sprite = {
  colors: { W: { hex: WHITE } },
  parts: [{ x: 13, y: 7, mirror: true, rows: ['.W.', 'WWW', 'WWW', '.WW', '..W'] }],
};
