/*
 * FheCat pixel designs, drawn in the style of the logo and banner:
 * steel outlines, cyan accents, night-sky navy. Every sprite is plain text,
 * one character per pixel (colours in pixel.js).
 */
(function () {
  'use strict';

  var NS = window.FheCat;
  var P = NS.pixel;
  var R = P.rle;

  function rows() {
    return Array.prototype.map.call(arguments, R);
  }
  function sprite(w, h, layers) {
    return { w: w, h: h, layers: layers };
  }
  function frames(list, extra) {
    return list.map(function (rs, i) {
      return { rows: rs, cls: 'f f' + i + (extra ? ' ' + extra : '') };
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
  function fill(g, x, y, w, h, ch) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) plot(g, x + i, y + j, ch);
  }
  /** Copies non-empty pixels of `src` onto `g` at (x, y). */
  function stamp(g, src, x, y) {
    src.forEach(function (r, j) {
      for (var i = 0; i < r.length; i++) if (r[i] !== '.') plot(g, x + i, y + j, r[i]);
    });
    return g;
  }
  function shift(rs, dx, w) {
    return rs.map(function (r) {
      return ('.'.repeat(dx) + r).padEnd(w, '.').slice(0, w);
    });
  }
  function union(a, b) {
    return a.map(function (r, y) {
      var o = '';
      for (var x = 0; x < Math.max(r.length, b[y].length); x++) o += r[x] === 'X' || b[y][x] === 'X' ? 'X' : '.';
      return o;
    });
  }
  function recolor(rs, from, to) {
    return rs.map(function (r) {
      return r.split(from).join(to);
    });
  }
  /** Tiny deterministic RNG. */
  function rng(seed) {
    var n = seed >>> 0 || 1;
    return function () {
      n = (Math.imul(n, 1103515245) + 12345) >>> 0;
      return ((n >>> 8) & 0xffff) / 0x10000;
    };
  }

  // ---------------------------------------------------------------------------
  // Logo mark: two "encryption brackets" growing cat ears, a paw in between.
  // 26 x 22, redrawn pixel by pixel from the logo.
  // ---------------------------------------------------------------------------
  var BRACKETS = P.mirror(
    rows(
      '2.2S9.', '2.3S8.', '2.4S7.', '2.S2.2S6.', '2.S.3S6.', '3.3S7.', '2.3S8.', '2.3S8.', '2.3S8.', '.3S9.', '.3S9.',
      '.3S9.', '.3S9.', '.3S9.', '.3S9.', '.3S9.', '2.3S8.', '2.3S8.', '2.3S8.', '3.3S7.', '4.3S6.', '4.3S6.'
    )
  );
  var blank = function (n, w) {
    return grid(w || 26, n);
  };
  // Rounded toes: corners are cut so neighbouring toes never touch.
  var TOES_TOP = blank(7).concat(rows('10.2C2.2C10.', '9.3C2.3C9.', '9.3C2.3C9.', '9.3C2.3C9.', '10.2C2.2C10.'));
  var TOES_SIDE = blank(11).concat(rows('7.2C8.2C7.', '6.3C8.3C6.', '6.3C8.3C6.', '7.2C8.2C7.'));
  var PAD = blank(13).concat(rows('11.4C11.', '10.6C10.', '10.6C10.', '10.6C10.', '11.4C11.'));
  // A crisp pixel "glow": the ring of pixels around the paw, blinked in CSS.
  var PAW_ALL = TOES_TOP.map(function (r, y) {
    var o = '';
    for (var x = 0; x < 26; x++) o += r[x] === 'C' || TOES_SIDE[y][x] === 'C' || PAD[y][x] === 'C' ? 'C' : '.';
    return o;
  });
  var GLOW = PAW_ALL.map(function (r, y) {
    var o = '';
    for (var x = 0; x < 26; x++) {
      var near = false;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if (PAW_ALL[y + dy] && PAW_ALL[y + dy][x + dx] === 'C') near = true;
      o += r[x] !== 'C' && near ? 'c' : '.';
    }
    return o;
  });
  var LOGO = sprite(26, 22, [
    { rows: GLOW, cls: 'glow' },
    { rows: BRACKETS.map(function (r) { return r.slice(0, 13) + '.'.repeat(13); }), cls: 'br-l' },
    { rows: BRACKETS.map(function (r) { return '.'.repeat(13) + r.slice(13); }), cls: 'br-r' },
    { rows: TOES_TOP, cls: 'toe toe-top' },
    { rows: TOES_SIDE, cls: 'toe toe-side' },
    { rows: PAD, cls: 'pad' }
  ]);

  // ---------------------------------------------------------------------------
  // Sitting cat from the banner: outline on a sky-filled silhouette,
  // two tail poses and blinking cyan eyes. Without the eyes it reads as the
  // same cat seen from behind, looking at the sky.
  // ---------------------------------------------------------------------------
  var CAT_BODY = rows(
    '3.X4.X10.', '3.2X2.2X10.', '3.6X10.', '2.8X9.', '2.8X9.', '2.8X9.', '3.6X10.', '3.7X9.', '2.9X8.', '2.10X7.',
    '2.11X6.', '2.11X6.', '2.12X5.', '2.12X5.', '2.12X5.', '2.12X5.', '2.X.10X5.', '2.X.10X5.', '.14X4.'
  );
  var TAIL_A = grid(19, 12).concat(rows('16.X2.', '15.2X2.', '15.X3.', '14.2X3.', '14.X4.', '14.X4.', '14.3X2.'));
  var TAIL_B = grid(19, 10).concat(rows('17.X.', '16.X2.', '15.2X2.', '15.X3.', '14.2X3.', '14.X4.', '14.X4.', '14.X4.', '14.4X.'));
  var CAT_A = P.outline(union(CAT_BODY, TAIL_A), 'X', 's', 'k');
  var CAT_B = P.outline(union(CAT_BODY, TAIL_B), 'X', 's', 'k');
  var CAT = sprite(19, 19, [
    { rows: CAT_A, cls: 'cat-a' },
    { rows: CAT_B, cls: 'cat-b' },
    { rows: rows('19.', '19.', '19.', '19.', '4.C2.C11.'), cls: 'cat-eyes' }
  ]);
  var CAT_BACK = sprite(19, 19, [
    { rows: CAT_A, cls: 'cat-a' },
    { rows: CAT_B, cls: 'cat-b' }
  ]);

  // Walking cat (side view, facing right), two frames.
  var WALK_BODY = rows('18.X2.X3.', '18.4X3.', '.X15.6X2.', '.X15.7X.', '2.X14.6X2.', '3.X18X3.', '3.19X3.', '3.19X3.', '4.17X4.', '5.15X5.');
  var LEGS_A = rows('5.X3.X4.X3.X6.', '4.X5.X2.X5.X5.', '3.2X4.2X.2X4.2X5.');
  var LEGS_B = rows('6.X.X6.X.X7.', '6.X.X6.X.X7.', '6.3X6.3X7.');
  var WALK = sprite(25, 13, [
    { rows: P.outline(WALK_BODY.concat(LEGS_A), 'X', 's', 'k'), cls: 'f f0' },
    { rows: P.outline(WALK_BODY.concat(LEGS_B), 'X', 's', 'k'), cls: 'f f1' },
    { rows: rows('25.', '25.', '25.', '21.C3.'), cls: 'walk-eye' }
  ]);

  // ---------------------------------------------------------------------------
  // Wordmark: "FheCat" in hand-drawn 10-pixel letters. "Fhe" is white,
  // "Cat" is the logo's cyan; each letter has a one-pixel extrusion and a shadow.
  // ---------------------------------------------------------------------------
  var GLYPHS = {
    F: ['#######', '#######', '##.....', '##.....', '######.', '######.', '##.....', '##.....', '##.....', '##.....'],
    h: ['##.....', '##.....', '##.....', '##.###.', '###..##', '##...##', '##...##', '##...##', '##...##', '##...##'],
    e: ['.......', '.......', '.......', '.#####.', '##...##', '##...##', '#######', '##.....', '##...##', '.#####.'],
    C: ['..#####', '.######', '###....', '##.....', '##.....', '##.....', '##.....', '###....', '.######', '..#####'],
    a: ['.......', '.......', '.......', '.#####.', '.....##', '.######', '##...##', '##...##', '##..###', '.###.##'],
    t: ['......', '.##...', '.##...', '#####.', '.##...', '.##...', '.##...', '.##...', '.##.##', '..###.']
  };
  /**
   * Lays out "FheCat" and returns { w, h, cells } where cells[y][x] is one of
   * '.', 'W' (Fhe face), 'C' (Cat face), 'S'/'c' extrusion, 'K' shadow.
   */
  function wordmarkCells() {
    var word = 'FheCat';
    var x = 0;
    var placed = [];
    for (var i = 0; i < word.length; i++) {
      var g = GLYPHS[word[i]];
      placed.push({ g: g, x: x, cat: i >= 3 });
      x += g[0].length + 1;
    }
    var w = x - 1 + 1;
    var h = 10 + 2;
    var cells = grid(w, h);
    var paint = function (dx, dy, pick) {
      placed.forEach(function (p) {
        p.g.forEach(function (r, y) {
          for (var i = 0; i < r.length; i++) if (r[i] === '#') plot(cells, p.x + i + dx, y + dy, pick(p));
        });
      });
    };
    paint(1, 2, function () { return 'K'; });
    paint(0, 1, function (p) { return p.cat ? 'c' : 'S'; });
    paint(0, 0, function (p) { return p.cat ? 'C' : 'W'; });
    return { w: w, h: h, cells: cells };
  }

  // ---------------------------------------------------------------------------
  // Encrypted cat: the logo-style head, filled with shimmering cipher noise
  // and a question mark. It never decrypts on this page.
  // ---------------------------------------------------------------------------
  var HEAD_SIL = rows('.X12.X.', '.2X10.2X.', '.3X8.3X.', '.14X.', '16X', '16X', '16X', '16X', '16X', '16X', '.14X.', '2.12X2.', '4.8X4.');
  var HEAD = P.outline(HEAD_SIL, 'X', 'S', 'k');
  var QMARK = rows('.4C.', '6C', '2C2.2C', '4.2C', '3.2C.', '2.2C2.', '6.', '2.2C2.');
  function noise(seed, density) {
    var r = rng(seed);
    return HEAD.map(function (row) {
      var out = '';
      for (var x = 0; x < row.length; x++) {
        var v = r();
        out += row[x] === 'k' && v < density ? (v < density * 0.2 ? 'C' : v < density * 0.6 ? 'c' : 'd') : '.';
      }
      return out;
    });
  }
  /** 16 x 13 encrypted head with `n` noise frames. */
  function noiseCat(seed, n) {
    var layers = [{ rows: HEAD, cls: 'nc-head' }];
    for (var i = 0; i < (n || 3); i++) layers.push({ rows: noise(seed + i * 101, 0.55), cls: 'f f' + i + ' nc-noise' });
    // the question mark gets a dark halo so it reads through the noise
    layers.push({ rows: P.outline(stamp(grid(16, 13), recolor(QMARK, 'C', 'X'), 5, 3).map(function (r) { return r; }), 'X', 'X', 'X').map(function (r, y, all) {
      var out = '';
      for (var x = 0; x < r.length; x++) {
        var near = false;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if (all[y + dy] && all[y + dy][x + dx] === 'X') near = true;
        out += r[x] === 'X' ? 'C' : near && HEAD[y][x] === 'k' ? 'K' : '.';
      }
      return out;
    }), cls: 'nc-q' });
    return sprite(16, 13, layers);
  }

  // ---------------------------------------------------------------------------
  // Night-walk lantern: off (steel, dark glass) or lit (cyan glass, flickering rays).
  // ---------------------------------------------------------------------------
  var LAMP = rows(
    '6.3S6.', '5.5S5.', '4.2S3.2S4.', '4.S5.S4.', '4.S5.S4.', '4.S5.S4.', '4.2S3.2S4.', '5.5S5.', '7.S7.', '7.S7.',
    '7.S7.', '7.S7.', '7.S7.', '7.S7.', '7.S7.', '7.S7.', '7.S7.', '7.S7.', '7.S7.', '7.S7.', '7.S7.', '7.S7.', '5.5S5.', '4.7S4.'
  );
  function glass(ch, core) {
    var g = grid(15, 24);
    fill(g, 6, 2, 3, 1, ch);
    fill(g, 5, 3, 5, 3, ch);
    fill(g, 6, 6, 3, 1, ch);
    if (core) fill(g, 7, 4, 1, 1, core);
    return g;
  }
  function rays(pts) {
    var g = grid(15, 24);
    pts.forEach(function (p) { plot(g, p[0], p[1], 'c'); });
    return g;
  }
  var LANTERN = sprite(15, 24, [
    { rows: LAMP, cls: 'lamp' },
    { rows: glass('K'), cls: 'glass-off' },
    { rows: glass('C', 'W'), cls: 'glass-on' },
    { rows: rays([[2, 4], [12, 4], [3, 1], [11, 1], [3, 7], [11, 7]]), cls: 'rays f f0' },
    { rows: rays([[1, 4], [13, 4], [2, 0], [12, 0], [2, 8], [12, 8], [2, 4], [12, 4]]), cls: 'rays f f1' }
  ]);

  // ---------------------------------------------------------------------------
  // FHE demo props: a locked crate, the numbers that go inside, the machine.
  // ---------------------------------------------------------------------------
  var CRATE_BODY = P.outline(grid(16, 8, 'X'), 'X', 'S', 'k');
  var CRATE_LID = P.outline(grid(16, 4, 'X'), 'X', 'S', 'k');
  // planks
  [2, 5].forEach(function (y) { CRATE_BODY[y] = 'S' + 'd'.repeat(14) + 'S'; });
  var PADLOCK = rows('.4S.', 'S4.S', '6C', '2CKK2C', '2CKK2C', '6C');
  var CRATE = sprite(16, 16, [
    { rows: grid(16, 4).concat(grid(16, 4)).concat(CRATE_BODY), cls: 'crate-body' },
    { rows: grid(16, 5).concat(CRATE_LID).concat(grid(16, 7)), cls: 'crate-lid' },
    { rows: stamp(grid(16, 16), PADLOCK, 5, 7), cls: 'crate-lock' }
  ]);
  // Pixel digits, 5 x 7.
  var DIGITS = {
    3: rows('5W', '4.W', '3.W.', '2.2W.', '4.W', 'W3.W', '.3W.'),
    4: rows('3.W.', '2.2W.', '.W.W.', 'W2.W.', '5W', '3.W.', '3.W.'),
    7: rows('5W', '4.W', '3.W.', '2.W2.', '2.W2.', '2.W2.', '2.W2.')
  };
  function digit(d) {
    return sprite(5, 7, [{ rows: DIGITS[d] }]);
  }

  // The CoFHE coprocessor: a boxy machine with a screen, blinking LEDs,
  // an intake on the left, a chute on the right and a steaming vent.
  function machine() {
    var W = 40;
    var H = 30;
    var base = grid(W, H);
    // body
    var body = P.outline(grid(30, 22, 'X'), 'X', 'S', 'k');
    stamp(base, body, 5, 6);
    // intake + chute openings (dark), framed
    fill(base, 5, 19, 1, 7, 'K');
    fill(base, 34, 19, 1, 7, 'K');
    fill(base, 1, 18, 5, 1, 'S');
    fill(base, 34, 18, 5, 1, 'S');
    // screen
    fill(base, 9, 9, 22, 8, 'd');
    fill(base, 10, 10, 20, 6, 'K');
    // vent + light on top
    fill(base, 26, 2, 4, 4, 'S');
    fill(base, 27, 3, 2, 3, 'k');
    // panel plate below the screen
    fill(base, 9, 19, 22, 1, 'd');
    // feet
    fill(base, 8, 28, 3, 2, 'S');
    fill(base, 29, 28, 3, 2, 'S');
    var screen = function (f) {
      var g = grid(W, H);
      // "enc + enc": two lock glyphs and a plus, pulsing
      var lockG = rows('.2c.', 'c2.c', '4c', '4c');
      stamp(g, lockG, 12, 11);
      stamp(g, lockG, 24, 11);
      var plus = rows('.C.', '3C', '.C.');
      if (f % 2 === 0) stamp(g, plus, 19, 11);
      // progress bar under the operands
      fill(g, 12, 15 - 0, 1 + (f * 4) % 16, 1, 'C');
      return g;
    };
    var leds = function (lit) {
      var g = grid(W, H);
      [12, 16, 20, 24, 28].forEach(function (x, i) {
        fill(g, x, 22, 2, 2, i === lit ? 'C' : 'c');
      });
      return g;
    };
    var puff = function (f) {
      var g = grid(W, H);
      if (f === 0) { plot(g, 27, 0, 'w'); plot(g, 28, 1, 'w'); }
      if (f === 1) { plot(g, 29, 0, 'w'); plot(g, 28, 0, 'w'); }
      return g;
    };
    return sprite(W, H, [
      { rows: base, cls: 'mc-body' },
      { rows: screen(0), cls: 'f f0' },
      { rows: screen(1), cls: 'f f1' },
      { rows: screen(2), cls: 'f f2' },
      { rows: screen(3), cls: 'f f3' },
      { rows: leds(0), cls: 'mc-led l0' },
      { rows: leds(2), cls: 'mc-led l1' },
      { rows: leds(4), cls: 'mc-led l2' },
      { rows: puff(0), cls: 'mc-puff p0' },
      { rows: puff(1), cls: 'mc-puff p1' }
    ]);
  }

  // Key with a paw-print bow (the owner's key).
  var KEY = sprite(19, 9, [
    {
      rows: rows('2.3S14.', '.S3kS13.', 'SkCkCkS12.', 'S5k13S', 'SkCCCk12kS', '.SkCkS13S', '2.3S6.S.S2.S2.', '11.S.S2.S2.', '11.3S2.2S.'),
      cls: 'key'
    },
    { rows: rows('19.', '19.', '19.', '19.', '8.2W9.'), cls: 'glint' }
  ]);

  // ---------------------------------------------------------------------------
  // Encrypted message: sealed envelope (paw wax seal) and opened letter.
  // ---------------------------------------------------------------------------
  var ENV_CLOSED = [
    '..............', '..............', '..............', '..............',
    'SSSSSSSSSSSSSS',
    'SSkkkkkkkkkkSS',
    'SkSkkkkkkkkSkS',
    'SkkSkkkkkkSkkS',
    'SkkkSkkkkSkkkS',
    'SkkkkSkkSkkkkS',
    'SkkkkkSSkkkkkS',
    'SkkkkkkkkkkkkS',
    'SSSSSSSSSSSSSS'
  ];
  var ENV_SEAL = grid(14, 9).concat(['......CC......', '.....CCCC.....', '......CC......', '..............']);
  var ENV_OPEN = [
    '......SS......',
    '....SSkkSS....',
    '..SSkkkkkkSS..',
    'SSkkkkkkkkkkSS',
    'SSSSSSSSSSSSSS',
    'SkWWWWWWWWWWkS',
    'SkWccccccccWkS',
    'SkWWWWWWWWWWkS',
    'SSkkkkkkkkkkSS',
    'SkSSkkkkkkSSkS',
    'SkkkSSkkSSkkkS',
    'SkkkkkSSkkkkkS',
    'SSSSSSSSSSSSSS'
  ];
  var ENVELOPE = sprite(14, 13, [
    { rows: ENV_CLOSED, cls: 'env-closed' },
    { rows: ENV_SEAL, cls: 'env-closed env-seal' },
    { rows: ENV_OPEN, cls: 'env-open' }
  ]);

  // ---------------------------------------------------------------------------
  // Small icons (inherit the text colour through the 'X' palette entry).
  // ---------------------------------------------------------------------------
  var ICON = {
    x: rows('2X3.2X', '.2X.2X.', '2.3X2.', '3.X3.', '2.3X2.', '.2X.2X.', '2X3.2X'),
    arrow: rows('4.X2.', '5.X.', '7X', '5.X.', '4.X2.'),
    down: rows('2.X2.', '2.X2.', '2.X2.', '2.X2.', 'X.X.X', '.3X.', '2.X2.'),
    diamond: rows('2.X2.', '.3X.', '5X', '.3X.', '2.X2.'),
    lock: rows('.3X.', 'X3.X', '5X', '2X.2X', '5X'),
    star: rows('.X.', '3X', '.X.')
  };

  // Small paw print and sparkle.
  var PAW = rows('2.2C.2C2.', '2.2C.2C2.', '9.', '2C5.2C', '2C.3C.2C', '2.5C2.', '2.5C2.', '3.3C3.');
  var SPARK = rows('2.C2.', '2.C2.', '5C', '2.C2.', '2.C2.');

  // Eye that blinks (the "try to peek" button).
  var EYE_OPEN = rows('5.6S5.', '3.2S6k2S3.', '2.S2k6C2kS2.', '.S3kCW2K2C3kS.', 'S4k2C2K2C4kS', '.S3k2C2K2C3kS.', '2.S2k6C2kS2.', '3.2S6k2S3.', '5.6S5.');
  var EYE_SHUT = rows('16.', '16.', '16.', '16.', '16S', '.S.S2.S2.S2.S.S.', '16.', '16.', '16.');
  var EYE = sprite(16, 9, [
    { rows: EYE_OPEN, cls: 'eye-open' },
    { rows: EYE_SHUT, cls: 'eye-shut' }
  ]);

  NS.sprites = {
    logo: LOGO,
    cat: CAT,
    catBack: CAT_BACK,
    walk: WALK,
    lantern: LANTERN,
    crate: CRATE,
    machine: machine(),
    key: KEY,
    envelope: ENVELOPE,
    eye: EYE,
    paw: PAW,
    spark: SPARK,
    noiseCat: noiseCat(7, 3),
    d3: digit(3),
    d4: digit(4),
    d7: digit(7),
    'i-x': ICON.x,
    'i-arrow': ICON.arrow,
    'i-down': ICON.down,
    'i-diamond': ICON.diamond,
    'i-lock': ICON.lock,
    'i-star': ICON.star
  };
  NS.art = {
    rows: rows,
    grid: grid,
    plot: plot,
    stamp: stamp,
    shift: shift,
    recolor: recolor,
    rng: rng,
    noiseCat: noiseCat,
    wordmarkCells: wordmarkCells,
    HEAD: HEAD,
    frames: frames
  };
})();
