/*
 * FheCat pixel designs, in the style of the logo and banner:
 * steel outlines, cyan accents, night-sky navy.
 */
(function () {
  'use strict';

  var NS = window.FheCat;
  var P = NS.pixel;
  var R = P.rle;

  function rows() {
    return Array.prototype.map.call(arguments, R);
  }

  // ---------------------------------------------------------------------------
  // Logo mark: two "encryption brackets" growing cat ears, a paw in between.
  // 26 x 22, redrawn pixel by pixel from the logo.
  // ---------------------------------------------------------------------------
  var BRACKETS = P.mirror(
    rows(
      '2.2S9.',
      '2.3S8.',
      '2.4S7.',
      '2.S2.2S6.',
      '2.S.3S6.',
      '3.3S7.',
      '2.3S8.',
      '2.3S8.',
      '2.3S8.',
      '.3S9.',
      '.3S9.',
      '.3S9.',
      '.3S9.',
      '.3S9.',
      '.3S9.',
      '.3S9.',
      '2.3S8.',
      '2.3S8.',
      '2.3S8.',
      '3.3S7.',
      '4.3S6.',
      '4.3S6.'
    )
  );

  var blank = function (n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push('.'.repeat(26));
    return out;
  };

  // Rounded toes: corners are cut so neighbouring toes never touch.
  var TOES_TOP = blank(7).concat(rows('10.2C2.2C10.', '9.3C2.3C9.', '9.3C2.3C9.', '9.3C2.3C9.', '10.2C2.2C10.'));
  var TOES_SIDE = blank(11).concat(rows('7.2C8.2C7.', '6.3C8.3C6.', '6.3C8.3C6.', '7.2C8.2C7.'));
  var PAD = blank(13).concat(rows('11.4C11.', '10.6C10.', '10.6C10.', '10.6C10.', '11.4C11.'));

  var LOGO = {
    w: 26,
    h: 22,
    layers: [
      { rows: BRACKETS.map(function (r) { return r.slice(0, 13) + '.'.repeat(13); }), cls: 'br-l' },
      { rows: BRACKETS.map(function (r) { return '.'.repeat(13) + r.slice(13); }), cls: 'br-r' },
      { rows: TOES_TOP, cls: 'toe toe-top' },
      { rows: TOES_SIDE, cls: 'toe toe-side' },
      { rows: PAD, cls: 'pad' }
    ]
  };

  // ---------------------------------------------------------------------------
  // Sitting cat from the banner, bigger: outline on a sky-filled silhouette,
  // with blinking eyes and two tail poses.
  // ---------------------------------------------------------------------------
  var CAT_BODY = rows(
    '3.X4.X10.',
    '3.2X2.2X10.',
    '3.6X10.',
    '2.8X9.',
    '2.8X9.',
    '2.8X9.',
    '3.6X10.',
    '3.7X9.',
    '2.9X8.',
    '2.10X7.',
    '2.11X6.',
    '2.11X6.',
    '2.12X5.',
    '2.12X5.',
    '2.12X5.',
    '2.12X5.',
    '2.X.10X5.',
    '2.X.10X5.',
    '.14X4.'
  );
  var TAIL_A = rows(
    '19.', '19.', '19.', '19.', '19.', '19.', '19.', '19.', '19.', '19.', '19.', '19.',
    '16.X2.',
    '15.2X2.',
    '15.X3.',
    '14.2X3.',
    '14.X4.',
    '14.X4.',
    '14.3X2.'
  );
  var TAIL_B = rows(
    '19.', '19.', '19.', '19.', '19.', '19.', '19.', '19.', '19.', '19.',
    '17.X.',
    '16.X2.',
    '15.2X2.',
    '15.X3.',
    '14.2X3.',
    '14.X4.',
    '14.X4.',
    '14.X4.',
    '14.4X.'
  );

  function union(a, b) {
    return a.map(function (r, y) {
      var o = '';
      for (var x = 0; x < Math.max(r.length, b[y].length); x++) o += r[x] === 'X' || b[y][x] === 'X' ? 'X' : '.';
      return o;
    });
  }

  var CAT = {
    w: 19,
    h: 19,
    layers: [
      { rows: P.outline(union(CAT_BODY, TAIL_A), 'X', 's', 'k'), cls: 'cat-a' },
      { rows: P.outline(union(CAT_BODY, TAIL_B), 'X', 's', 'k'), cls: 'cat-b' },
      { rows: rows('19.', '19.', '19.', '19.', '4.C2.C11.'), cls: 'cat-eyes' }
    ]
  };

  // ---------------------------------------------------------------------------
  // Small helpers for icons
  // ---------------------------------------------------------------------------
  function sprite(w, h, layers) {
    return { w: w, h: h, layers: layers };
  }
  function frames(list, prefix) {
    return list.map(function (rs, i) {
      return { rows: rs, cls: 'f f' + i + (prefix ? ' ' + prefix : '') };
    });
  }
  function grid(w, h, ch) {
    var out = [];
    for (var y = 0; y < h; y++) out.push((ch || '.').repeat(w));
    return out;
  }
  function plot(g, x, y, ch) {
    if (y < 0 || y >= g.length || x < 0 || x >= g[y].length) return;
    g[y] = g[y].slice(0, x) + ch + g[y].slice(x + 1);
  }

  // DNA helix: two strands (steel in front, cyan behind) with dim rungs; 4 frames spin it.
  function helixFrame(phase) {
    var g = grid(9, 18);
    for (var y = 0; y < 18; y++) {
      var t = ((y + phase * 3) / 12) * Math.PI * 2;
      var a = Math.round(4 + 3.6 * Math.sin(t));
      var b = Math.round(4 - 3.6 * Math.sin(t));
      if (y % 3 === 1) for (var x = Math.min(a, b) + 1; x < Math.max(a, b); x++) plot(g, x, y, 'c');
      var aFront = Math.cos(t) > 0;
      plot(g, aFront ? b : a, y, 'C');
      plot(g, aFront ? a : b, y, 'S');
    }
    return g;
  }
  var HELIX = sprite(9, 18, frames([helixFrame(0), helixFrame(1), helixFrame(2), helixFrame(3)]));

  // Die: a pixel die rolling through faces.
  function dieFace(pips) {
    var g = rows('.12S.', 'S12kS', 'S12kS', 'S12kS', 'S12kS', 'S12kS', 'S12kS', 'S12kS', 'S12kS', 'S12kS', 'S12kS', 'S12kS', 'S12kS', '.12S.');
    var spots = { tl: [3, 3], tr: [9, 3], ml: [3, 6], c: [6, 6], mr: [9, 6], bl: [3, 9], br: [9, 9] };
    pips.forEach(function (k) {
      var p = spots[k];
      plot(g, p[0], p[1], 'C'); plot(g, p[0] + 1, p[1], 'C'); plot(g, p[0], p[1] + 1, 'C'); plot(g, p[0] + 1, p[1] + 1, 'C');
    });
    return g;
  }
  var DIE = sprite(14, 14, frames([
    dieFace(['c']),
    dieFace(['tl', 'br']),
    dieFace(['tl', 'tr', 'bl', 'br']),
    dieFace(['tl', 'tr', 'ml', 'mr', 'bl', 'br'])
  ]));

  // Key with a paw-print bow.
  var KEY = sprite(19, 9, [
    {
      rows: rows(
        '2.3S14.',
        '.S3kS13.',
        'SkCkCkS12.',
        'S5k13S',
        'SkCCCk12kS',
        '.SkCkS13S',
        '2.3S6.S.S2.S2.',
        '11.S.S2.S2.',
        '11.3S2.2S.'
      ),
      cls: 'key'
    },
    { rows: rows('19.', '19.', '19.', '19.', '8.2W9.'), cls: 'glint' }
  ]);

  // Cat head (outline), used on its own and inside other icons.
  var HEAD_SIL = rows(
    '.X12.X.',
    '.2X10.2X.',
    '.3X8.3X.',
    '.14X.',
    '16X',
    '16X',
    '16X',
    '16X',
    '16X',
    '16X',
    '.14X.',
    '2.12X2.',
    '4.8X4.'
  );
  var HEAD = P.outline(HEAD_SIL, 'X', 'S', 'k');
  var HEAD_FACE = rows('16.', '16.', '16.', '16.', '16.', '4.C6.C4.', '4.C6.C4.', '16.', '7.2P7.', '6.S2.S6.', '7.2S7.', '16.', '16.');
  var CAT_HEAD = sprite(16, 13, [{ rows: HEAD }, { rows: HEAD_FACE, cls: 'face' }]);

  // Cipher cat: the head filled with shimmering bits, between brackets.
  function bits(seed) {
    var n = seed;
    return HEAD_SIL.map(function (r, y) {
      var out = '';
      for (var x = 0; x < r.length; x++) {
        n = (n * 1103515245 + 12345) & 0x7fffffff;
        var inside = r[x] === 'X' && HEAD[y][x] === 'k';
        out += inside && n % 3 === 0 ? (n % 2 ? 'C' : 'c') : '.';
      }
      return out;
    });
  }
  function shift(rs, dx, w) {
    return rs.map(function (r) {
      return ('.'.repeat(dx) + r).padEnd(w, '.').slice(0, w);
    });
  }
  var BR_L = rows('2S', 'S.', 'S.', 'S.', 'S.', 'S.', 'S.', 'S.', 'S.', 'S.', 'S.', 'S.', '2S');
  var BR_R = rows('2S', '.S', '.S', '.S', '.S', '.S', '.S', '.S', '.S', '.S', '.S', '.S', '2S');
  var CIPHER_CAT = sprite(22, 13, [
    { rows: shift(BR_L, 0, 22), cls: 'br-l' },
    { rows: shift(BR_R, 20, 22), cls: 'br-r' },
    { rows: shift(HEAD, 3, 22) },
    { rows: shift(bits(7), 3, 22), cls: 'f f0 bits' },
    { rows: shift(bits(99), 3, 22), cls: 'f f1 bits' }
  ]);

  // Coprocessor chip with pins that light up in turn.
  function chipPins(lit) {
    var g = grid(18, 18);
    [4, 7, 10, 13].forEach(function (p, i) {
      var ch = i === lit ? 'C' : 'S';
      plot(g, p, 0, ch); plot(g, p, 1, ch); plot(g, p, 16, ch); plot(g, p, 17, ch);
      plot(g, 0, p, ch); plot(g, 1, p, ch); plot(g, 16, p, ch); plot(g, 17, p, ch);
    });
    return g;
  }
  var CHIP_BODY = shift(rows('.12S.', 'S12kS', 'S12kS', 'S3k6dS3kS', 'S2kS6kS2kS', 'S2kSk2CkkSk2kS', 'S2kSkC2CkSk2kS', 'S2kSkC2CkSk2kS', 'S2kSk2CkkSk2kS', 'S2kS6kS2kS', 'S3k6dS3kS', 'S12kS', 'S12kS', '.12S.'), 2, 18);
  var CHIP = sprite(18, 18, [
    { rows: grid(18, 2).concat(CHIP_BODY).concat(grid(18, 2)) },
    { rows: chipPins(0), cls: 'f f0' },
    { rows: chipPins(1), cls: 'f f1' },
    { rows: chipPins(2), cls: 'f f2' },
    { rows: chipPins(3), cls: 'f f3' }
  ]);

  // Padlock with a paw-shaped keyhole; frames: locked / shackle lifted.
  var LOCK_BODY = P.outline(rows('14X', '14X', '14X', '14X', '14X', '14X', '14X', '14X', '.12X.'), 'X', 'S', 'k');
  var LOCK_PAW = rows('14.', '14.', '4.C2.C5.', '14.', '3.C4.C4.', '5.3C6.', '4.5C5.', '4.5C5.', '14.');
  var SHACKLE = rows('3.8S3.', '2.S8.S2.', '2.S8.S2.', '2.S8.S2.', '2.S8.S2.', '2.S8.S2.');
  var SHACKLE_UP = rows('3.8S3.', '2.S8.S2.', '2.S8.S2.', '2.S8.S2.', '2.S11.', '2.S11.', '2.S11.', '2.S11.');
  var LOCK = sprite(14, 17, [
    { rows: grid(14, 2).concat(SHACKLE).concat(grid(14, 9)), cls: 'f f0' },
    { rows: SHACKLE_UP.concat(grid(14, 9)), cls: 'f f1' },
    { rows: grid(14, 8).concat(LOCK_BODY) },
    { rows: grid(14, 8).concat(LOCK_PAW), cls: 'hole' }
  ]);

  // Mint box with a question mark.
  var BOX = sprite(16, 16, [
    {
      rows: P.outline(rows('16.', '16.', '16.', '16.', '.14X.', '.14X.', '.14X.', '2.12X2.', '2.12X2.', '2.12X2.', '2.12X2.', '2.12X2.', '2.12X2.', '2.12X2.', '2.12X2.', '2.12X2.'), 'X', 'S', 'k')
    },
    { rows: rows('4.3C2.3C4.', '3.C3.2C3.C3.', '4.3C2.3C4.', '7.2C7.', '16.', '16.', '16.', '16.', '16.', '16.', '16.', '16.', '16.', '16.', '16.', '16.'), cls: 'ribbon' },
    { rows: rows('16.', '16.', '16.', '16.', '7.2c7.', '7.2c7.', '7.2c7.', '16.', '6.4C6.', '5.C4.C5.', '9.C6.', '8.C7.', '7.C8.', '16.', '7.C8.', '16.'), cls: 'q' }
  ]);

  // Eye that blinks.
  var EYE_OPEN = rows(
    '5.6S5.',
    '3.2S6k2S3.',
    '2.S2k6C2kS2.',
    '.S3kCW2K2C3kS.',
    'S4k2C2K2C4kS',
    '.S3k2C2K2C3kS.',
    '2.S2k6C2kS2.',
    '3.2S6k2S3.',
    '5.6S5.'
  );
  var EYE_SHUT = rows('16.', '16.', '16.', '16.', '16S', '.S.S2.S2.S2.S.S.', '16.', '16.', '16.');
  var EYE = sprite(16, 9, [
    { rows: EYE_OPEN, cls: 'eye-open' },
    { rows: EYE_SHUT, cls: 'eye-shut' }
  ]);

  // Reveal: brackets part and the cat appears.
  var REVEAL = sprite(26, 13, [
    { rows: shift(BR_L, 2, 26), cls: 'br-l' },
    { rows: shift(BR_R, 22, 26), cls: 'br-r' },
    { rows: shift(HEAD, 5, 26), cls: 'rv-head' },
    { rows: shift(HEAD_FACE, 5, 26), cls: 'rv-face' }
  ]);

  // Walking cat (side view, facing right), two frames.
  var WALK_BODY = rows(
    '18.X2.X3.',
    '18.4X3.',
    '.X15.6X2.',
    '.X15.7X.',
    '2.X14.6X2.',
    '3.X18X3.',
    '3.19X3.',
    '3.19X3.',
    '4.17X4.',
    '5.15X5.'
  );
  var LEGS_A = rows('5.X3.X4.X3.X6.', '4.X5.X2.X5.X5.', '3.2X4.2X.2X4.2X5.');
  var LEGS_B = rows('6.X.X6.X.X7.', '6.X.X6.X.X7.', '6.3X6.3X7.');
  var WALK = sprite(25, 13, [
    { rows: P.outline(WALK_BODY.concat(LEGS_A), 'X', 's', 'k'), cls: 'f f0' },
    { rows: P.outline(WALK_BODY.concat(LEGS_B), 'X', 's', 'k'), cls: 'f f1' },
    { rows: rows('25.', '25.', '25.', '21.C3.'), cls: 'walk-eye' }
  ]);

  // Small paw print and sparkle.
  var PAW = rows('2.2C.2C2.', '2.2C.2C2.', '9.', '2C5.2C', '2C.3C.2C', '2.5C2.', '2.5C2.', '3.3C3.');
  var SPARK = rows('2.C2.', '2.C2.', '5C', '2.C2.', '2.C2.');

  // ---------------------------------------------------------------------------
  // Sample cats for the collection teaser: a head in the logo's outline style,
  // wearing one accessory. Each has an encrypted look (bits + "?") and a
  // decrypted look; the page flips between them.
  // ---------------------------------------------------------------------------
  var CW = 20;
  var CH = 18;
  function at(rs, x, y) {
    var g = grid(CW, CH);
    rs.forEach(function (r, i) {
      for (var j = 0; j < r.length; j++) if (r[j] !== '.') plot(g, x + j, y + i, r[j]);
    });
    return g;
  }
  var EYES = rows('16.', '16.', '16.', '16.', '16.', '4.C6.C4.', '4.C6.C4.');
  var NOSE_MOUTH = rows('16.', '16.', '16.', '16.', '16.', '16.', '16.', '16.', '7.2P7.', '6.S2.S6.', '7.2S7.');
  var ACCESSORIES = {
    beanie: { hideEars: true, rows: rows('20.', '9.2W9.', '6.8C6.', '4.12C4.', '3.14C3.', '2.16C2.', '2.cCcCcCcCcCcCcCcC2.', '2.CcCcCcCcCcCcCcCc2.') },
    crown: { rows: rows('20.', '20.', '20.', '6.Y2.2Y2.Y6.', '6.2Y.2Y.2Y6.', '6.8Y6.', '6.YC4YCY6.', '6.8y6.') },
    headphones: { rows: rows('20.', '5.10S5.', '3.2S10.2S3.', '2.S14.S2.', '.S16.S.', '.S16.S.', '.S16.S.', '.S16.S.', '3C14.3C', 'CcC14.CcC', 'CcC14.CcC', 'CcC14.CcC', '3C14.3C') },
    visor: { eyes: false, rows: rows('20.', '20.', '20.', '20.', '20.', '20.', '20.', '20.', '20.', '3.14C3.', '3.W13c3.') },
    halo: { rows: rows('6.8Y6.', '5.Y8.Y5.', '6.8Y6.') },
    party: { rows: rows('9.2W9.', '9.2C9.', '8.4C8.', '8.4P8.', '7.6C7.', '7.6P7.', '6.8C6.', '6.8P6.') },
    bow: { rows: rows('20.', '20.', '20.', '20.', '20.', '20.', '20.', '20.', '20.', '20.', '20.', '20.', '20.', '20.', '20.', '6.2P4.2P6.', '6.3P2R3P6.', '6.2P4.2P6.') },
    cipher: {
      eyes: false,
      rows: rows('20.', '20.', '20.', '20.', '20.', '20.', '20.', '20.', '5.3C4.C7.', '5.C.C3.2C7.', '5.C.C4.C7.', '5.C.C4.C7.', '5.3C3.3C6.')
    }
  };

  function sampleCat(name, seed) {
    var acc = ACCESSORIES[name];
    // Hats that cover the ears only hide them once the cat is decrypted.
    var ears = HEAD.map(function (r, y) { return y < 3 ? r : '.'.repeat(16); });
    var head = acc.hideEars ? HEAD.map(function (r, y) { return y < 3 ? '.'.repeat(16) : r; }) : HEAD;
    var layers = [{ rows: at(head, 2, 4), cls: 'head' }];
    if (acc.hideEars) layers.push({ rows: at(ears, 2, 4), cls: 'enc head' });
    layers.push({ rows: at(bits(seed), 2, 4), cls: 'enc bits f f0' });
    layers.push({ rows: at(bits(seed + 17), 2, 4), cls: 'enc bits f f1' });
    layers.push({ rows: at(rows('.4C.', '6C', '2C2.2C', '4.2C', '3.2C.', '2.2C2.', '6.', '2.2C2.'), 7, 6), cls: 'enc q' });
    var face = at(NOSE_MOUTH, 2, 4);
    if (acc.eyes !== false) {
      var eyes = at(EYES, 2, 4);
      face = face.map(function (r, y) {
        var o = '';
        for (var x = 0; x < CW; x++) o += eyes[y][x] !== '.' ? eyes[y][x] : r[x];
        return o;
      });
    }
    layers.push({ rows: face, cls: 'dec face' });
    layers.push({ rows: acc.rows.map(function (r) { return r.padEnd(CW, '.'); }).concat(grid(CW, CH - acc.rows.length)), cls: 'dec acc' });
    return sprite(CW, CH, layers);
  }

  NS.sampleCat = sampleCat;
  NS.SAMPLE_CATS = Object.keys(ACCESSORIES);

  NS.sprites = {
    logo: LOGO,
    cat: CAT,
    helix: HELIX,
    die: DIE,
    key: KEY,
    head: CAT_HEAD,
    cipher: CIPHER_CAT,
    chip: CHIP,
    lock: LOCK,
    box: BOX,
    eye: EYE,
    reveal: REVEAL,
    walk: WALK,
    paw: PAW,
    spark: SPARK
  };
  NS.art = { HEAD_SIL: HEAD_SIL, HEAD: HEAD, HEAD_FACE: HEAD_FACE, bits: bits, shift: shift, rows: rows, outline: P.outline };
})();
