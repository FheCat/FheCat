/*
 * The FheCat waitlist card: a 320 x 180 pixel-art card drawn on a canvas and
 * exported at 4x (1280 x 720) so it stays crisp on X. Everything personal on
 * it (card id, DNA, the noise in the cat, the stars) comes from the handle.
 * Text is drawn with the site's pixel fonts and snapped to hard pixels.
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
    steel: '#5e7b9d',
    steel2: '#3e6d88',
    steel3: '#2a4c66',
    cloudHi: '#1d4e6c',
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
  /** Draws sprite rows at (x, y), each pixel `s` x `s`. */
  function sprite(ctx, rows, x, y, s) {
    s = s || 1;
    rows.forEach(function (r, j) {
      for (var i = 0; i < r.length; i++) {
        var ch = r[i];
        if (ch === '.' || ch === ' ') continue;
        rect(ctx, x + i * s, y + j * s, s, s, PAL[ch]);
      }
    });
  }
  /** A panel with a `t`-pixel border and notched corners. */
  function panel(ctx, x, y, w, h, fill, border, t) {
    rect(ctx, x + t, y, w - 2 * t, h, border);
    rect(ctx, x, y + t, w, h - 2 * t, border);
    rect(ctx, x + t, y + t, w - 2 * t, h - 2 * t, fill);
  }
  function dashed(ctx, x0, x1, y, color) {
    for (var x = x0; x < x1; x += 4) rect(ctx, x, y, 2, 1, color);
  }
  function sparkle(ctx, x, y, color) {
    rect(ctx, x, y - 2, 1, 5, color);
    rect(ctx, x - 2, y, 5, 1, color);
  }

  // Text goes through a scratch canvas and every pixel is snapped to on/off,
  // so the pixel fonts come out as hard pixels at any size.
  var scratch = null;
  function scratchCtx() {
    if (!scratch) {
      scratch = document.createElement('canvas');
      scratch.width = W;
      scratch.height = H;
    }
    return scratch.getContext('2d', { willReadFrequently: true });
  }
  function text(ctx, str, x, y, font, color, align) {
    var t = scratchCtx();
    t.clearRect(0, 0, W, H);
    t.font = font;
    t.textBaseline = 'alphabetic';
    t.textAlign = align || 'left';
    t.fillStyle = '#ffffff';
    t.fillText(str, x, y);
    var img = t.getImageData(0, 0, W, H);
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
    t.putImageData(img, 0, 0);
    ctx.drawImage(scratch, 0, 0);
    return t.measureText(str).width;
  }
  /**
   * Tiny5 twice as big: drawn at its native 8px (one font pixel = one canvas
   * pixel) and then scaled up 2x without smoothing, so every glyph is exact.
   */
  function textBig(ctx, str, x, y, color) {
    var w = Math.ceil(width(str, FONT.small)) + 2;
    var tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = 16;
    var sub = tmp.getContext('2d');
    // draw at 1x into the shared scratch, snap the pixels, copy the strip
    var t = scratchCtx();
    t.clearRect(0, 0, W, H);
    t.font = FONT.small;
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
    sub.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, w, 16, x, y - 24, w * 2, 32);
    return w * 2;
  }
  function width(str, font) {
    var t = scratchCtx();
    t.font = font;
    return t.measureText(str).width;
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

  /** Draws the card for `handle` (without @; empty = sample card) at 1x. */
  function draw(ctx, handle) {
    var sample = !handle;
    var name = sample ? 'yourname' : handle;
    var seed = hash(name.toLowerCase());
    var r = rng(seed);

    // --- the sky around the card ---------------------------------------------
    rect(ctx, 0, 0, W, H, COL.night);
    for (var i = 0; i < 70; i++) {
      rect(ctx, (r() * W) | 0, (r() * H) | 0, 1, 1, r() < 0.3 ? COL.starHi : COL.star);
    }
    // the banner's moon, top left
    var moon = [];
    for (var y = 0; y < 17; y++) moon.push(new Array(17).fill('.'));
    (function ring(cx, cy, rad) {
      var x = rad;
      var yy = 0;
      var err = 1 - rad;
      while (x >= yy) {
        [[x, yy], [yy, x], [-yy, x], [-x, yy], [-x, -yy], [-yy, -x], [yy, -x], [x, -yy]].forEach(function (p) {
          moon[cy + p[1]][cx + p[0]] = 'M';
        });
        yy++;
        if (err < 0) err += 2 * yy + 1;
        else {
          x--;
          err += 2 * (yy - x) + 1;
        }
      }
    })(8, 8, 7);
    moon[7][6] = 'N';
    moon[10][10] = 'N';
    sprite(
      ctx,
      moon.map(function (row) {
        return row.join('');
      }),
      18,
      4
    );
    sparkle(ctx, 120, 12, COL.cyan);
    sparkle(ctx, 212, 16, COL.cyanDim);
    sparkle(ctx, 314, 60, COL.cyanDim);
    sparkle(ctx, 5, 120, COL.cyan);

    // --- the card ---------------------------------------------------------------
    var X = 12;
    var Y = 26;
    var CW = 296;
    var CH = 146;
    panel(ctx, X + 3, Y + 3, CW, CH, COL.ink, COL.ink, 2);
    panel(ctx, X, Y, CW, CH, COL.deep, COL.steel2, 2);

    // a cat sits on the card, like cats do
    var cat = NS.sprites.cat.layers.filter(function (l) {
      return l.cls !== 'cat-b';
    });
    cat.forEach(function (l) {
      sprite(ctx, l.rows, 262, Y - 18);
    });

    // header: logo, wordmark, card id
    NS.sprites.logo.layers.forEach(function (l) {
      if (l.cls !== 'glow') sprite(ctx, l.rows, X + 10, Y + 8);
    });
    sprite(ctx, NS.art.wordmarkCells().cells, X + 42, Y + 13);
    text(ctx, 'WAITLIST CARD', X + CW - 12, Y + 16, FONT.label, COL.cyan, 'right');
    text(ctx, cardId(name), X + CW - 12, Y + 28, FONT.mono, sample ? COL.muted : COL.white, 'right');
    dashed(ctx, X + 10, X + CW - 10, Y + 36, COL.cloudHi);

    // portrait: this handle's cat, still encrypted
    var PX = X + 10;
    var PY = Y + 44;
    panel(ctx, PX, PY, 72, 72, COL.ink, COL.steel3, 2);
    var nc = NS.art.noiseCat(seed, 1);
    nc.layers.forEach(function (l) {
      if (!/\bf[1-9]/.test(l.cls || '')) sprite(ctx, l.rows, PX + 4, PY + 10, 4);
    });

    // details
    var TX = X + 94;
    text(ctx, 'HOLDER', TX, Y + 51, FONT.label, COL.muted);
    var at = '@' + name;
    if (width(at, FONT.small) * 2 <= CW - 104) textBig(ctx, at, TX, Y + 67, sample ? COL.muted : COL.white);
    else text(ctx, at, TX, Y + 67, FONT.small, sample ? COL.muted : COL.white);

    var dna = rng(seed ^ 0x5eed);
    var dnaHex = '0x';
    for (var k = 0; k < 10; k++) dnaHex += '0123456789ABCDEF'[(dna() * 16) | 0];
    text(ctx, 'DNA', TX, Y + 85, FONT.label, COL.muted);
    text(ctx, dnaHex, TX, Y + 97, FONT.mono, COL.cyan);
    text(ctx, 'STATUS', TX + 104, Y + 85, FONT.label, COL.muted);
    rect(ctx, TX + 104, Y + 91, 4, 4, COL.cyan);
    text(ctx, 'ENCRYPTED', TX + 111, Y + 96, FONT.label, COL.cyan);

    text(ctx, 'TRAITS', TX, Y + 112, FONT.label, COL.muted);
    for (var s = 0; s < 3; s++) {
      var bw = [34, 22, 28][s];
      var bx = TX + 38 + [0, 38, 64][s];
      for (var q = 0; q < bw; q += 4) rect(ctx, bx + q, Y + 106, 3, 6, (q / 4 + s) % 3 ? COL.cyanDim : COL.steel3);
    }

    // footer
    dashed(ctx, X + 10, X + CW - 10, Y + 122, COL.cloudHi);
    text(ctx, 'MAINNET MINT · OCTOBER 2026', X + 10, Y + 136, FONT.label, COL.cyan);
    text(ctx, 'FHECAT.COM', X + CW - 12, Y + 136, FONT.label, COL.white, 'right');
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
