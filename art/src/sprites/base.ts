import type { Sprite } from '../types';
import { rows } from '../util';

const EAR_PINK = '#f29bb5';
const NOSE = '#e86a92';
const BLUSH = '#ff8fae';

/**
 * Sitting body with a light bib, front paws and a curled tail. Drawn before the
 * head. Left half mirrored; the tail is the one asymmetric part.
 */
export const BODY: Sprite = {
  colors: { o: { role: 'outline' }, f: { role: 'main' }, s: { role: 'shade' }, l: { role: 'light' } },
  parts: [
    // tail, curling up behind the right haunch
    { x: 26, y: 20, rows: ['...oo.', '..ollo', '..ollo', '..offo', '..offo', '.offo.', '.offo.', 'offo..', 'ffo...'] },
    {
      x: 0,
      y: 21,
      mirror: true,
      rows: rows(
        '8.o7f',
        '8.o7f',
        '7.o6s2l', // shadow under the chin
        '7.o4f4l',
        '6.o4f5l',
        '6.o4f5l',
        '5.o5f5l',
        '5.o3fs5lo', // front legs, split down the middle
        '5.o3fo5lo',
        '5.o3folo3lo', // toes
        '6.10o',
      ),
    },
  ],
};

/** Big head with pink ears, nose and blush. Eyes and mouth are traits. Left half, mirrored. */
export const HEAD: Sprite = {
  colors: {
    o: { role: 'outline' },
    f: { role: 'main' },
    p: { hex: EAR_PINK },
    n: { hex: NOSE },
    b: { hex: BLUSH },
  },
  parts: [
    {
      x: 0,
      y: 1,
      mirror: true,
      rows: rows(
        '4.2o10.',
        '4.ofo9.',
        '4.ofpo8.',
        '3.of2pfo7.',
        '3.of3pfo6.',
        '3.of4pf6o',
        '3.o2f3p7f',
        '3.o12f',
        '3.o12f',
        '3.o12f',
        '3.o12f',
        '3.o12f',
        '2.o13f',
        '2.o13f',
        '2.o13f',
        '2.o13f',
        '2.o2f2b8fn', // blush and nose
        '2.o13f',
        '3.o12f',
        '4.2o10f',
        '6.3o7f',
        '9.7o',
      ),
    },
  ],
};

const STEEL = '#5e7b9d';
const STEEL_DARK = '#3f5874';
const CYAN = '#0df3ff';

/**
 * The FheCat logo mark: a paw between two "encryption brackets" that grow cat
 * ears. Used for every still-encrypted token and for the collection image.
 */
export const MOTIF: Sprite = {
  colors: { b: { hex: STEEL }, d: { hex: STEEL_DARK }, c: { hex: CYAN } },
  parts: [
    {
      x: 0,
      y: 4,
      mirror: true,
      rows: rows(
        '9.b',
        '8.2b',
        '8.bdb',
        '7.b2db',
        '7.b3db',
        '6.6b',
        '6.2b',
        '5.2b',
        '5.2b',
        '5.2b',
        '5.2b',
        '5.2b',
        '5.2b',
        '5.2b',
        '5.2b',
        '5.2b',
        '6.2b',
        '6.2b',
        '7.2b',
        '8.2b',
      ).map((r) => r.padEnd(16, '.')),
    },
    // toes: inner pair higher, outer pair lower
    { x: 13, y: 11, mirror: true, rows: ['cc', 'cc', 'cc'] },
    { x: 10, y: 14, mirror: true, rows: ['cc', 'cc', 'cc'] },
    // main pad
    { x: 12, y: 18, mirror: true, rows: rows('2.2c', '.3c', '4c', '4c', '.3c') },
  ],
};
