/*
 * The FheCat waitlist card: a 320 x 180 pixel-art card drawn on a canvas and
 * exported at 4x (1280 x 720) so it stays crisp on X. It is a shipping crate
 * addressed to the holder, with their encrypted cat inside. Everything
 * personal on it (card id, barcode, stars, the glow between the planks, the
 * stamp wear) comes from the handle. Text uses the site's pixel fonts,
 * snapped to hard pixels; the handle is always drawn at 2x or 3x.
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
    starHi: '#2c6989',
    cloud: '#0d3b55',
    board: '#0d3b55',
    board2: '#113a53',
    boardHi: '#1d4e6c',
    boardLo: '#021f36',
    grain: '#0a3350',
    metal: '#9fb7cf',
    paper: '#e6f2ff',
    paperEdge: '#9fb7cf',
    tape: '#9fb7cf',
    red: '#ff5d73'
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
  /** The banner's moon: a one-pixel ring. */
  function ring(ctx, cx, cy, rad, color) {
    var x = rad;
    var y = 0;
    var err = 1 - rad;
    while (x >= y) {
      [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]].forEach(function (p) {
        rect(ctx, cx + p[0], cy + p[1], 1, 1, color);
      });
      y++;
      if (err < 0) err += 2 * y + 1;
      else {
        x--;
        err += 2 * (y - x) + 1;
      }
    }
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

  /** Ink that didn't take everywhere: drops `wear` of the pixels of whatever `paint` draws. */
  function stamped(ctx, x, y, w, h, rnd, wear, paint) {
    var tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    var t = tmp.getContext('2d');
    paint(t);
    var img = t.getImageData(0, 0, w, h);
    for (var i = 3; i < img.data.length; i += 4) if (img.data[i] && rnd() < wear) img.data[i] = 0;
    t.putImageData(img, 0, 0);
    ctx.drawImage(tmp, x, y);
  }

  function barcode(ctx, x, y, w, h, rnd, color) {
    var cx = x;
    var first = true;
    while (cx < x + w - 2) {
      var bw = rnd() < 0.5 ? 1 : 2;
      rect(ctx, cx, y, bw, h + (first ? 2 : 0), color);
      first = false;
      cx += bw + (rnd() < 0.6 ? 1 : 2);
    }
    rect(ctx, x + w - 2, y, 1, h + 2, color);
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

  /**
   * Draws the card for `handle` (without @; empty = sample card) at 1x:
   * a shipping crate under the banner's night sky, addressed to the holder.
   * Their cat is inside, encrypted: only its eyes and the glow between the
   * planks get out.
   */
  function draw(ctx, handle) {
    var sample = !handle;
    var name = sample ? 'yourname' : handle;
    var seed = hash(name.toLowerCase());
    var r = rng(seed);

    // --- the sky ------------------------------------------------------------
    rect(ctx, 0, 0, W, H, COL.night);
    for (var i = 0; i < 80; i++) {
      rect(ctx, (r() * W) | 0, (r() * H) | 0, 1, 1, r() < 0.3 ? COL.starHi : COL.star);
    }
    ring(ctx, 152, 17, 8, COL.moon);
    rect(ctx, 149, 15, 2, 2, COL.cloud);
    rect(ctx, 155, 20, 1, 1, COL.cloud);
    sparkle(ctx, 104, 30, COL.cyan);
    sparkle(ctx, 196, 27, COL.cyanDim);
    sparkle(ctx, 6, 98, COL.cyanDim);
    sparkle(ctx, 313, 64, COL.cyan);

    // hills behind the crate, and the ground it stands on
    for (var x = 0; x < W; x += 2) {
      var hy = 150 + Math.round(Math.sin(x / 23 + (seed % 7)) * 3 + Math.sin(x / 9) * 1.5);
      hy -= hy % 2;
      rect(ctx, x, hy, 2, H - hy, COL.cloud);
      rect(ctx, x, hy, 2, 1, COL.cloudHi);
    }
    rect(ctx, 0, 168, W, H - 168, COL.deep);

    // brand, top left; what this is, top right
    NS.sprites.logo.layers.forEach(function (l) {
      if (l.cls !== 'glow') sprite(ctx, l.rows, 10, 7);
    });
    sprite(ctx, NS.art.wordmarkCells().cells, 40, 12);
    text(ctx, 'WAITLIST CARD', 310, 16, FONT.label, COL.cyan, 'right');
    text(ctx, 'MAINNET · OCT 2026', 310, 28, FONT.label, COL.muted, 'right');

    // --- the crate ------------------------------------------------------------
    var X0 = 14;
    var Y0 = 38;
    var CW = 292;
    var CH = 124;
    rect(ctx, X0 + 4, Y0 + CH, CW - 2, 4, COL.ink); // shadow
    panel(ctx, X0, Y0, CW, CH, COL.ink, COL.steel, 2);
    var IX = X0 + 3;
    var IY = Y0 + 3;
    var IW = CW - 6;
    var glow = rng(seed ^ 0x9e3779b9);
    for (var b = 0; b < 6; b++) {
      var by = IY + b * 20;
      rect(ctx, IX, by, IW, 18, COL.board);
      rect(ctx, IX, by, IW, 1, COL.boardHi);
      rect(ctx, IX, by + 17, IW, 1, COL.boardLo);
      for (var k = 0; k < 7; k++) rect(ctx, IX + ((r() * (IW - 12)) | 0), by + 3 + ((r() * 12) | 0), 3 + ((r() * 9) | 0), 1, COL.grain);
      if (b === 5) break;
      // between the planks: the encrypted cat's glow
      for (var gx = IX; gx < IX + IW; gx++) {
        for (var gy = by + 18; gy < by + 20; gy++) {
          var v = glow();
          rect(ctx, gx, gy, 1, 1, v < 0.07 ? COL.cyan : v < 0.2 ? COL.cyanDim : v < 0.32 ? COL.star : COL.ink);
        }
      }
    }
    // side boards, nailed on
    [IX, IX + IW - 10].forEach(function (sx) {
      rect(ctx, sx, IY, 10, CH - 6, COL.board2);
      rect(ctx, sx, IY, 1, CH - 6, COL.boardHi);
      rect(ctx, sx + 9, IY, 1, CH - 6, COL.boardLo);
      for (var n = 0; n < 6; n++) rect(ctx, sx + 4, IY + n * 20 + 8, 2, 2, COL.metal);
    });
    // metal corners
    [[X0, Y0, 1, 1], [X0 + CW, Y0, -1, 1], [X0, Y0 + CH, 1, -1], [X0 + CW, Y0 + CH, -1, -1]].forEach(function (c) {
      var cx = c[2] > 0 ? c[0] : c[0] - 14;
      var cy = c[3] > 0 ? c[1] : c[1] - 4;
      rect(ctx, cx, cy, 14, 4, COL.metal);
      rect(ctx, c[2] > 0 ? c[0] : c[0] - 4, c[3] > 0 ? c[1] : c[1] - 14, 4, 14, COL.metal);
      rect(ctx, (c[2] > 0 ? c[0] + 1 : c[0] - 3), (c[3] > 0 ? c[1] + 1 : c[1] - 3), 2, 2, COL.white);
    });

    // the hand hole: the cat inside looks out
    var hx = 228;
    var hy2 = 42;
    panel(ctx, hx, hy2, 52, 15, COL.ink, COL.boardLo, 2);
    [[hx + 11, hy2 + 5], [hx + 34, hy2 + 5]].forEach(function (e) {
      rect(ctx, e[0] + 1, e[1], 5, 5, COL.cyan);
      rect(ctx, e[0], e[1] + 1, 7, 3, COL.cyan);
      rect(ctx, e[0] + 3, e[1] + 1, 1, 3, COL.ink); // slit pupil
      rect(ctx, e[0] + 1, e[1] + 1, 1, 1, COL.white);
    });

    // stamps
    var sr = rng(seed ^ 0x51a4b);
    function frame(t, w, h, color) {
      rect(t, 1, 0, w - 2, 1, color);
      rect(t, 1, h - 1, w - 2, 1, color);
      rect(t, 0, 1, 1, h - 2, color);
      rect(t, w - 1, 1, 1, h - 2, color);
    }
    stamped(ctx, 222, 62, 66, 15, sr, 0.2, function (t) {
      frame(t, 66, 15, COL.red);
    });
    stamped(ctx, 222, 62, 66, 15, sr, 0.02, function (t) {
      text(t, 'ENCRYPTED', 33, 11, FONT.label, COL.red, 'center');
    });
    stamped(ctx, 218, 84, 74, 26, sr, 0.2, function (t) {
      frame(t, 74, 26, COL.cyan);
    });
    stamped(ctx, 218, 84, 74, 26, sr, 0.02, function (t) {
      sprite(t, NS.sprites.paw, 6, 9, 1);
      text(t, 'HANDLE', 19, 11, FONT.label, COL.cyan);
      text(t, 'WITH FHE', 19, 22, FONT.label, COL.cyan);
    });
    text(ctx, 'DO NOT OPEN UNTIL THE REVEAL', 160, 154, FONT.label, COL.metal, 'center');

    // ...and a tail that didn't fit in the box: curled like a question mark
    var path = [[121, 39], [121, 31], [122, 24], [124, 18], [128, 14], [133, 13], [137, 15], [138, 19], [136, 22]];
    var inTail = function (px, py) {
      for (var k = 0; k < path.length - 1; k++) {
        var ax = path[k][0];
        var ay = path[k][1];
        var bx = path[k + 1][0] - ax;
        var bY = path[k + 1][1] - ay;
        var t = Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * bY) / (bx * bx + bY * bY)));
        var dx = px - (ax + bx * t);
        var dy = py - (ay + bY * t);
        var rad = 3.2 - ((k + t) / (path.length - 1)) * 1.2;
        if (dx * dx + dy * dy <= rad * rad) return true;
      }
      return false;
    };
    var tr = rng(seed ^ 0x7a11);
    for (var ty = 8; ty < Y0; ty++) {
      for (var tx = 112; tx < 146; tx++) {
        if (!inTail(tx + 0.5, ty + 0.5)) continue;
        var edge = !inTail(tx - 0.5, ty + 0.5) || !inTail(tx + 1.5, ty + 0.5) || !inTail(tx + 0.5, ty - 0.5) || !inTail(tx + 0.5, ty + 1.5);
        var v = tr();
        rect(ctx, tx, ty, 1, 1, edge ? COL.steel : v < 0.1 ? COL.cyan : v < 0.28 ? COL.cyanDim : COL.ink);
      }
    }

    // --- the shipping label -----------------------------------------------------
    var LX = 30;
    var LY = 48;
    var LW = 180;
    var LH = 88;
    rect(ctx, LX + 2, LY + 2, LW, LH, COL.boardLo);
    panel(ctx, LX, LY, LW, LH, COL.paper, COL.paperEdge, 1);
    rect(ctx, LX - 4, LY - 2, 14, 5, COL.tape);
    rect(ctx, LX + LW - 10, LY - 2, 14, 5, COL.tape);

    var ink = sample ? COL.muted : COL.ink;
    text(ctx, 'SHIP TO', LX + 8, LY + 14, FONT.label, COL.steel2);
    text(ctx, cardId(name), LX + LW - 8, LY + 14, FONT.mono, ink, 'right');

    // the name, as big as it fits
    var at = '@' + name;
    var room = LW - 16;
    var tw = width(at, FONT.small);
    if (tw * 3 <= room) text(ctx, at, LX + 8, LY + 44, FONT.small, ink, 'left', 3);
    else if (tw * 2 <= room) text(ctx, at, LX + 8, LY + 40, FONT.small, ink, 'left', 2);
    else text(ctx, at, LX + 8, LY + 36, FONT.mono, ink);

    dashed(ctx, LX + 8, LX + LW - 8, LY + 53, COL.paperEdge);
    var cw = text(ctx, 'CONTENTS ', LX + 8, LY + 65, FONT.label, COL.steel2);
    text(ctx, '1 CAT, ENCRYPTED', LX + 8 + cw, LY + 65, FONT.label, ink);
    barcode(ctx, LX + 8, LY + 70, LW - 16, 9, rng(seed ^ 0xba5c0de), ink);

    // on the ground
    text(ctx, 'FHECAT.COM', 310, 177, FONT.label, COL.cyan, 'right');
    text(ctx, 'PIXEL CATS ON FHENIX', 10, 177, FONT.label, COL.muted);
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
