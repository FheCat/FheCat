import type { Sprite } from '../types';
import { rows } from '../util';

const EAR_PINK = '#e98baa';
const NOSE = '#e0628a';
const WHISKER = '#c9d6e5';

/** Shoulders and chest, drawn before the head. Left half, mirrored. */
export const BODY: Sprite = {
  colors: { o: { role: 'outline' }, f: { role: 'main' }, s: { role: 'shade' }, l: { role: 'light' } },
  parts: [
    {
      x: 0,
      y: 22,
      mirror: true,
      rows: rows('9.o6f', '8.o7f', '7.o8f', '6.o9f', '5.o10f', '5.o10f', '4.o11f', '4.o11f', '3.o12f', '3.o12f'),
    },
    { x: 0, y: 24, mirror: true, rows: rows('14.2l', '13.3l', '12.4l', '12.4l', '12.4l', '12.4l', '12.4l', '12.4l') },
    { x: 9, y: 28, mirror: true, rows: ['s', 's', 's', 's'] },
  ],
};

/** Head with ears, muzzle, nose and whiskers. Left half, mirrored. */
export const HEAD: Sprite = {
  colors: {
    o: { role: 'outline' },
    f: { role: 'main' },
    l: { role: 'light' },
    p: { hex: EAR_PINK },
    n: { hex: NOSE },
    w: { hex: WHISKER },
  },
  parts: [
    {
      x: 0,
      y: 3,
      mirror: true,
      rows: rows(
        '6.o9.',
        '6.2o8.',
        '5.ofpo7.',
        '5.of2po6.',
        '5.o2f2po5.',
        '5.o3f2po4.',
        '5.o6f4o',
        '4.o11f',
        '4.o11f',
        '4.o11f',
        '3.o12f',
        '3.o12f',
        '3.o12f',
        '3.o12f',
        '3.o12f',
        '4.o11f',
        '4.o11f',
        '5.o10f',
        '6.o9f',
        '7.9o',
      ),
    },
    { x: 0, y: 16, mirror: true, rows: rows('13.3l', '12.4l', '11.5l', '11.5l', '12.4l', '13.3l') },
    { x: 14, y: 16, mirror: true, rows: ['nn', '.n'] },
    { x: 0, y: 17, mirror: true, rows: rows('.6w', '', '2.5w') },
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
