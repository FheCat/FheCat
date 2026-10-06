import type { Sprite } from '../types';
import { rows } from '../util';

// The sealed box every FheCat is born in. One box, three lids: Unopened (taped
// shut), Peeked (lid lifted, two eyes in the dark) and Opened (flaps out, the
// cat's outline glowing). The renderer adds a barcode of the token's own
// ciphertext handle on the label (x=6..25, y=27..28).

const COLORS = {
  O: { hex: '#0b1a2b' }, // outline
  T: { hex: '#6f8db0' }, // lid
  F: { hex: '#3f5874' }, // front
  S: { hex: '#33496a' }, // shade
  Q: { hex: '#4a6688' }, // lit edge
  D: { hex: '#062033' }, // label
  K: { hex: '#020c16' }, // inside the box
  V: { hex: '#0df3ff' }, // cyan
  Y: { hex: '#9cfbff' }, // glow
  H: { hex: '#e6f7ff' }, // spark
};

/** Front of the box with the paw stamp and the label. */
export const BOX: Sprite = {
  colors: COLORS,
  parts: [
    {
      x: 0,
      y: 12,
      mirror: true,
      rows: rows(
        '3.13O',
        '3.O12S',
        '3.O12F',
        '3.O12F',
        '3.O12F',
        '3.O9F2VF', // paw: inner toes
        '3.O9F2VF',
        '3.O6F2V4F', // outer toes
        '3.O6F2V4F',
        '3.O10F2V', // pad
        '3.O9F3V',
        '3.O8F4V',
        '3.O9F3V',
        '3.O12F',
        '3.OF11D', // label
        '3.OF11D',
        '3.OF11D',
        '3.OF11D',
        '3.13O',
      ),
    },
    { x: 4, y: 13, rows: Array.from({ length: 17 }, () => 'Q') },
    { x: 27, y: 14, rows: Array.from({ length: 16 }, () => 'S') },
  ],
};

/** Unopened: lid on, taped shut, two air holes. */
export const LID_UNOPENED: Sprite = {
  colors: COLORS,
  parts: [
    {
      x: 0,
      y: 7,
      mirror: true,
      rows: rows('7.9O', '6.O8TV', '5.OTK7TV', '4.O10TV', '3.O11TV', '15.V', '15.V', '15.V', '15.V', '15.V'),
    },
  ],
};

/** Peeked: the tape is cut and the lid lifted; something looks back. */
export const LID_PEEKED: Sprite = {
  colors: COLORS,
  parts: [
    {
      x: 0,
      y: 4,
      mirror: true,
      rows: rows('7.9O', '6.O9T', '5.OTK8T', '4.O11T', '3.O12T', '3.13O', '3.O6K2V4K', '3.O6KVH4K'),
    },
  ],
};

/** Opened: flaps out and the outline of a cat glowing inside. */
export const LID_OPENED: Sprite = {
  colors: COLORS,
  parts: [
    // flaps
    { x: 0, y: 7, mirror: true, rows: rows('1.2O13.', 'O2TO12.', '.O2TO11.', '2.O2TO10.', '3.O2TO9.') },
    // the glow
    {
      x: 0,
      y: 3,
      mirror: true,
      rows: rows('9.V6.', '8.VYV5.', '8.V2YV4.', '7.V4Y4V', '7.V8Y', '7.V8Y', '7.V8Y', '7.V8Y', '7.V8Y'),
    },
    // a question mark, and sparks
    { x: 15, y: 7, rows: ['KK.', '..K', '.K.', '...', '.K.'] },
    { x: 13, y: 1, rows: ['H'] },
    { x: 25, y: 2, rows: ['H'] },
    { x: 2, y: 3, rows: ['.Y.', 'YHY', '.Y.'] },
    { x: 28, y: 9, rows: ['Y'] },
  ],
};
