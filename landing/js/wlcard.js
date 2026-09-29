/*
 * The FheCat waitlist card: a 320 x 180 pixel-art card drawn on a canvas and
 * exported at 4x (1280 x 720) so it stays crisp on X.
 *
 * Every star is a cat. On the card, the holder's cat is a constellation:
 * the chain can see where the stars are, not what the cat looks like. Down
 * on the hill the FheCat sits with its telescope and looks up at it.
 * Everything personal comes from the handle: the pose (sitting, walking or
 * a face), where each star sits, which ones shine, the sky, the catalogue
 * numbers and the card number. The handle is always drawn at 2x or 3x.
 */
(function () {
  'use strict';

  var NS = window.FheCat;
  var P = NS.pixel;
  var PAL = P.PALETTE;
  var W = 320;
  var H = 180;
  var SCALE = 4;
  var COL = {
    night: '#032842',
    deep: '#021f36',
    ink: '#021a2e',
    cloud: '#0d3b55',
    cloudNear: '#113a53',
    cloudHi: '#1d4e6c',
    cloudTop: '#26536e',
    steel: '#5e7b9d',
    steel2: '#3e6d88',
    steel3: '#2a4c66',
    moon: '#275775',
    cyan: '#0df3ff',
    cyanDim: '#1c88a7',
    white: '#e6f2ff',
    muted: '#7d9cba',
    star: '#1b698b',
    starHi: '#2c6989'
  };

  /** FNV-1a of the lowercase handle; must match cardId() in api/waitlist.js. */
  function hash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }
  function cardId(handle) {
    return '0x' + hash(handle.toLowerCase()).toString(16).toUpperCase().padStart(8, '0');
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  /** Draws sprite rows at (x, y), each pixel `s` x `s`; `map` swaps colours. */
  function sprite(ctx, rows, x, y, s, map) {
    s = s || 1;
    rows.forEach(function (r, j) {
      for (var i = 0; i < r.length; i++) {
        var ch = r[i];
        if (ch === '.' || ch === ' ') continue;
        rect(ctx, x + i * s, y + j * s, s, s, (map && map[ch]) || PAL[ch]);
      }
    });
  }
  /** A panel with a `t`-pixel border and notched corners. */
  function panel(ctx, x, y, w, h, fill, border, t) {
    rect(ctx, x + t, y, w - 2 * t, h, border);
    rect(ctx, x, y + t, w, h - 2 * t, border);
    rect(ctx, x + t, y + t, w - 2 * t, h - 2 * t, fill);
  }
  /** The banner's moon: a one-pixel ring with two craters. */
  function moon(ctx, cx, cy, rad) {
    var x = rad;
    var y = 0;
    var err = 1 - rad;
    while (x >= y) {
      [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]].forEach(function (p) {
        rect(ctx, cx + p[0], cy + p[1], 1, 1, COL.moon);
      });
      y++;
      if (err < 0) err += 2 * y + 1;
      else {
        x--;
        err += 2 * (y - x) + 1;
      }
    }
    rect(ctx, cx - 3, cy - 2, 2, 2, COL.cloud);
    rect(ctx, cx + 2, cy + 3, 1, 1, COL.cloud);
  }

  // Text goes through a scratch canvas and every pixel is snapped to on/off,
  // then it is scaled by a whole number, so the pixel fonts stay exact.
  var scratch = null;
  function scratchCtx() {
    if (!scratch) {
      scratch = document.createElement('canvas');
      scratch.width = W;
      scratch.height = H;
    }
    return scratch.getContext('2d', { willReadFrequently: true });
  }
  function width(str, font) {
    var t = scratchCtx();
    t.font = font;
    return Math.ceil(t.measureText(str).width);
  }
  /** Draws `str` with its baseline at y, `n` times its native 8px; returns the width drawn. */
  function text(ctx, str, x, y, font, color, align, n) {
    n = n || 1;
    var w = width(str, font) + 2;
    var t = scratchCtx();
    t.clearRect(0, 0, W, H);
    t.font = font;
    t.textBaseline = 'alphabetic';
    t.textAlign = 'left';
    t.fillStyle = '#ffffff';
    t.fillText(str, 0, 12);
    var img = t.getImageData(0, 0, w, 16);
    var d = img.data;
    var r = parseInt(color.slice(1, 3), 16);
    var g = parseInt(color.slice(3, 5), 16);
    var b = parseInt(color.slice(5, 7), 16);
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] >= 110) {
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = 255;
      } else d[i + 3] = 0;
    }
    var strip = document.createElement('canvas');
    strip.width = w;
    strip.height = 16;
    strip.getContext('2d').putImageData(img, 0, 0);
    var drawn = (w - 2) * n;
    var left = align === 'right' ? x - drawn : align === 'center' ? x - Math.round(drawn / 2) : x;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(strip, 0, 0, w, 16, left, y - 12 * n, w * n, 16 * n);
    return drawn;
  }

  var FONT = {
    label: '8px Silkscreen',
    mono: '8px "Press Start 2P"',
    small: '8px Tiny5'
  };
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load(FONT.label),
      document.fonts.load(FONT.mono),
      document.fonts.load(FONT.small)
    ]).catch(function () {});
  }

  // ---------------------------------------------------------------------------
  // The constellations, traced over the site's own cats (grid units).
  // `stars` are [x, y]; `lines` join star indexes; `eyes` shine brightest.
  // ---------------------------------------------------------------------------
  var POSES = [
    {
      name: 'FELIS SEDENS', // the sitting cat of the banner
      w: 19,
      h: 19,
      stars: [[3, 0], [4.6, 2.4], [6.6, 2.4], [8, 0], [9.6, 4.2], [8.2, 6.8], [12.2, 10], [14, 13.6], [14.6, 18], [1.8, 18], [2, 9.4], [3, 6.8], [1.8, 4.2], [16.4, 14.6], [17.2, 11.2]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 0], [8, 13], [13, 14]],
      eyes: []
    },
    {
      name: 'FELIS AMBULANS', // the night-walk cat
      w: 25,
      h: 14,
      stars: [[1, 0], [2.4, 3], [5, 5.6], [11, 4.8], [18, 5.4], [19, 3.2], [19.6, 0], [21, 1.8], [22.6, 0], [24.8, 3.6], [22.6, 6], [20.6, 8.4], [20.2, 13.4], [13, 9], [7, 9], [5.6, 13.4]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [11, 13], [13, 14], [14, 2], [14, 15]],
      eyes: []
    },
    {
      name: 'CAPUT FELIS', // the face from the logo
      w: 16,
      h: 13,
      stars: [[1, 0], [4.2, 2.6], [7.5, 3.2], [10.8, 2.6], [14, 0], [15.6, 4.4], [15.4, 9.2], [12.6, 11.8], [7.5, 12.8], [2.4, 11.8], [-0.4, 9.2], [-0.6, 4.4], [4.8, 6.8], [10.2, 6.8], [7.5, 9.2]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 0]],
      eyes: [12, 13]
    }
  ];

  var STAR_BIG = ['..C..', '..C..', 'CCWCC', '..C..', '..C..'];
  var STAR_MID = ['.C.', 'CWC', '.C.'];
  var STAR_DIM = ['.c.', 'cWc', '.c.'];

  /** Dotted line between two stars, leaving a little dark around each. */
  function starLine(ctx, a, b, color) {
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var len = Math.max(Math.abs(dx), Math.abs(dy));
    for (var s = 4; s <= len - 4; s++) {
      if (s % 3 === 2) continue;
      rect(ctx, Math.round(a[0] + (dx * s) / len), Math.round(a[1] + (dy * s) / len), 1, 1, color);
    }
  }

  /** A small telescope on three legs, pointing up and left, at (x, y) = its feet. */
  function telescope(ctx, x, y) {
    var tube = ['......SS', '....SSSw', '..SSSSw.', 'CSSSSw..', 'SSSw....'];
    sprite(ctx, tube, x - 6, y - 17, 1, { S: COL.steel, w: COL.muted, C: COL.cyan });
    rect(ctx, x, y - 12, 1, 3, COL.steel2);
    // tripod
    for (var i = 0; i < 9; i++) {
      rect(ctx, x - ((i / 2) | 0), y - 9 + i, 1, 1, COL.steel2);
      rect(ctx, x, y - 9 + i, 1, 1, COL.steel2);
      rect(ctx, x + ((i / 2) | 0), y - 9 + i, 1, 1, COL.steel2);
    }
  }

  /** Draws the card for `handle` (without @; empty = sample card) at 1x. */
  function draw(ctx, handle) {
    var sample = !handle;
    var name = sample ? 'yourname' : handle;
    var seed = hash(name.toLowerCase());
    var r = rng(seed);

    // --- outside the card, and the card itself -------------------------------
    rect(ctx, 0, 0, W, H, COL.ink);
    for (var i = 0; i < 24; i++) rect(ctx, (r() * W) | 0, (r() * H) | 0, 1, 1, COL.star);
    var X0 = 8;
    var Y0 = 8;
    var CW = W - 16;
    var CH = H - 16;
    panel(ctx, X0 + 3, Y0 + 3, CW, CH, COL.deep, COL.deep, 2); // hard shadow
    panel(ctx, X0, Y0, CW, CH, COL.night, COL.steel2, 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(X0 + 2, Y0 + 2, CW - 4, CH - 4);
    ctx.clip();

    // --- the sky: this handle's stars ----------------------------------------
    for (var s = 0; s < 90; s++) {
      rect(ctx, X0 + 2 + ((r() * (CW - 4)) | 0), Y0 + 2 + ((r() * 128) | 0), 1, 1, r() < 0.3 ? COL.starHi : COL.star);
    }
    moon(ctx, 150, 30, 8);
    // a shooting star
    for (var m = 0; m < 14; m++) rect(ctx, 106 + m, 12 + (m >> 1), 1, 1, m > 10 ? COL.white : m > 6 ? COL.cyan : COL.cyanDim);

    // --- the constellation --------------------------------------------------------
    var pose = POSES[seed % POSES.length];
    var box = { x: 196, y: 18, w: 104, h: 74 };
    var k = Math.min(box.w / (pose.w + 1), box.h / (pose.h + 1));
    var ox = box.x + (box.w - pose.w * k) / 2;
    var oy = box.y + (box.h - pose.h * k) / 2;
    var pr = rng(seed ^ 0x5ca1ab1e);
    var pts = pose.stars.map(function (p) {
      return [Math.round(ox + p[0] * k + (pr() - 0.5) * 2), Math.round(oy + p[1] * k + (pr() - 0.5) * 2)];
    });
    // viewfinder corners: the telescope has found it
    var vf = [box.x - 6, box.y - 5, box.x + box.w + 4, box.y + box.h + 5];
    [[vf[0], vf[1], 1, 1], [vf[2], vf[1], -1, 1], [vf[0], vf[3], 1, -1], [vf[2], vf[3], -1, -1]].forEach(function (c) {
      rect(ctx, c[2] > 0 ? c[0] : c[0] - 7, c[1], 8, 1, COL.cyanDim);
      rect(ctx, c[0], c[3] > 0 ? c[1] : c[1] - 7, 1, 8, COL.cyanDim);
    });
    pose.lines.forEach(function (l) {
      starLine(ctx, pts[l[0]], pts[l[1]], COL.cyanDim);
    });
    pts.forEach(function (p, n) {
      var eye = pose.eyes.indexOf(n) >= 0;
      var shine = eye || pr() < 0.35 ? STAR_BIG : pr() < 0.6 ? STAR_MID : STAR_DIM;
      var half = (shine[0].length / 2) | 0;
      sprite(ctx, shine, p[0] - half, p[1] - half, 1, { C: COL.cyan, c: COL.cyanDim, W: COL.white });
    });
    text(ctx, pose.name, vf[0], vf[3] + 11, FONT.label, COL.cyanDim);

    // --- the hills, and the FheCat on top with its telescope --------------------
    var ground = function (gx) {
      var gy = Math.round(148 - Math.max(0, gx - 170) * 0.04 + Math.sin(gx / 17 + (seed % 5)) * 2);
      return gy - (gy % 2);
    };
    for (var x = X0; x < X0 + CW; x += 2) {
      var hy = ground(x);
      rect(ctx, x, hy, 2, H - hy, COL.cloud);
      rect(ctx, x, hy, 2, 1, COL.cloudHi);
    }
    for (var x2 = X0; x2 < X0 + CW; x2 += 2) {
      var ny = Math.round(158 + Math.sin(x2 / 11 + 2) * 2);
      ny -= ny % 2;
      rect(ctx, x2, ny, 2, H - ny, COL.cloudNear);
      rect(ctx, x2, ny, 2, 1, COL.cloudTop);
    }
    var catX = 272;
    var catY = Math.max(ground(catX + 19) - 36, 110);
    NS.sprites.catBack.layers
      .filter(function (l) {
        return l.cls !== 'cat-b';
      })
      .forEach(function (l) {
        sprite(ctx, l.rows, catX, catY, 2, { s: COL.steel, k: COL.ink });
      });
    telescope(ctx, 258, ground(258) + 1);
    // the banner's radio mast, still listening
    var mx = 172;
    var my = ground(mx);
    rect(ctx, mx, my - 32, 1, 32, COL.steel2);
    rect(ctx, mx - 3, my - 22, 7, 1, COL.steel2);
    rect(ctx, mx - 2, my - 12, 5, 1, COL.steel2);
    rect(ctx, mx, my - 34, 1, 2, COL.cyan);
    rect(ctx, mx - 1, my - 33, 3, 1, COL.cyanDim);
    rect(ctx, mx - 3, my - 21, 1, 1, COL.cyan);
    rect(ctx, mx + 3, my - 21, 1, 1, COL.cyan);

    // --- the words -------------------------------------------------------------------
    NS.sprites.logo.layers.forEach(function (l) {
      if (l.cls !== 'glow') sprite(ctx, l.rows, 20, 18);
    });
    sprite(ctx, NS.art.wordmarkCells().cells, 50, 23);

    var LX = 22;
    var id = cardId(name);
    var lw = text(ctx, 'WAITLIST CARD', LX, 64, FONT.label, COL.cyan);
    text(ctx, id, LX + lw + 8, 64, FONT.mono, sample ? COL.steel2 : COL.muted);

    var at = '@' + name;
    var ink = sample ? COL.muted : COL.white;
    var tw = width(at, FONT.small);
    // as big as it goes without reaching the constellation
    if (tw * 3 <= 164) text(ctx, at, LX, 96, FONT.small, ink, 'left', 3);
    else if (tw * 2 <= 164) text(ctx, at, LX, 92, FONT.small, ink, 'left', 2);
    else text(ctx, at, LX, 90, FONT.mono, ink);

    text(ctx, 'YOUR CAT IS UP THERE.', LX, 114, FONT.label, COL.muted);
    text(ctx, 'STILL ENCRYPTED.', LX, 125, FONT.label, COL.cyan);

    text(ctx, 'MAINNET MINT · OCT 2026', LX, 165, FONT.label, COL.white);
    text(ctx, 'FHECAT.COM', X0 + CW - 12, 165, FONT.label, COL.cyan, 'right');
    ctx.restore();
  }

  /**
   * Renders the card for `handle` into `canvas` (sized 1280 x 720).
   * Resolves once fonts are in, so the text is right on the first draw.
   */
  function render(canvas, handle) {
    return fontsReady().then(function () {
      var art = document.createElement('canvas');
      art.width = W;
      art.height = H;
      draw(art.getContext('2d'), handle);
      canvas.width = W * SCALE;
      canvas.height = H * SCALE;
      var ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(art, 0, 0, W * SCALE, H * SCALE);
      return canvas;
    });
  }

  function toBlob(canvas) {
    return new Promise(function (resolve) {
      canvas.toBlob(resolve, 'image/png');
    });
  }

  NS.wlcard = { render: render, toBlob: toBlob, cardId: cardId, W: W, H: H, SCALE: SCALE };
})();
