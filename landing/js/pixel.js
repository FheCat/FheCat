/*
 * Tiny pixel-art helper: turns ASCII pixel maps into crisp inline SVG.
 * Every sprite on the page is drawn with it, so the art stays editable as text.
 */
(function () {
  'use strict';

  var NS = (window.FheCat = window.FheCat || {});
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // Brand palette, sampled from the FheCat logo and banner.
  var PALETTE = {
    k: '#032842', // night sky (also fills outlined silhouettes)
    K: '#021a2e', // deep navy
    S: '#5e7b9d', // logo steel
    s: '#3e6d88', // banner cat outline
    d: '#2a4c66', // steel shadow
    C: '#0df3ff', // logo cyan
    b: '#10d5f7', // banner sparkle cyan
    c: '#1c88a7', // dim cyan
    N: '#0d3b55', // cloud
    n: '#113a53', // cloud, near
    H: '#1d4e6c', // cloud highlight
    h: '#26536e', // cloud highlight, bright
    M: '#275775', // moon
    T: '#1b698b', // star
    t: '#2c6989', // star, bright
    W: '#e6f2ff', // white
    w: '#9fb7cf', // pale steel
    P: '#e98baa', // pink
    Y: '#f5c542', // gold
    y: '#b8860b', // gold shadow
    R: '#ff5d73', // red
    V: '#8a74d6', // violet
    G: '#3ddc84', // green
    X: 'currentColor' // icons: inherit the text colour
  };

  /** '3.S2C' -> '...SCC' (a char without a count is one pixel). */
  function rle(spec) {
    var out = '';
    spec.replace(/(\d*)(\D)/g, function (_, n, ch) {
      out += ch.repeat(n ? Number(n) : 1);
      return '';
    });
    return out;
  }

  /** Mirrors left-half rows into full rows (even width). */
  function mirror(rows) {
    return rows.map(function (r) {
      return r + r.split('').reverse().join('');
    });
  }

  function width(rows) {
    return rows.reduce(function (m, r) {
      return Math.max(m, r.length);
    }, 0);
  }

  /**
   * Turns a filled silhouette into outline art: pixels touching the outside
   * (4-neighbourhood) take `edge`, the rest take `fill`. Other chars are kept.
   */
  function outline(rows, shape, edge, fill) {
    var h = rows.length;
    var w = width(rows);
    var at = function (x, y) {
      return y >= 0 && y < h && x >= 0 && x < w && rows[y][x] === shape;
    };
    return rows.map(function (r, y) {
      var out = '';
      for (var x = 0; x < w; x++) {
        var ch = r[x] || '.';
        if (ch !== shape) out += ch;
        else out += at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1) ? fill : edge;
      }
      return out;
    });
  }

  /** Greedy rectangle cover per colour -> [{ color, d }]. */
  function paths(rows, palette) {
    var pal = palette || PALETTE;
    var h = rows.length;
    var w = width(rows);
    var used = [];
    for (var i = 0; i < h; i++) used.push(new Array(w).fill(false));
    var groups = {};
    var order = [];
    var ch = function (x, y) {
      return (rows[y] && rows[y][x]) || '.';
    };
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var c = ch(x, y);
        if (c === '.' || c === ' ' || used[y][x]) continue;
        var rw = 1;
        while (x + rw < w && ch(x + rw, y) === c && !used[y][x + rw]) rw++;
        var rh = 1;
        grow: while (y + rh < h) {
          for (var k = 0; k < rw; k++) if (ch(x + k, y + rh) !== c || used[y + rh][x + k]) break grow;
          rh++;
        }
        for (var dy = 0; dy < rh; dy++) for (var dx = 0; dx < rw; dx++) used[y + dy][x + dx] = true;
        if (!groups[c]) {
          groups[c] = '';
          order.push(c);
        }
        groups[c] += 'M' + x + ' ' + y + 'h' + rw + 'v' + rh + 'h-' + rw + 'z';
      }
    }
    return order.map(function (c) {
      if (!pal[c]) throw new Error('pixel: no colour for "' + c + '"');
      return { color: pal[c], d: groups[c] };
    });
  }

  function el(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  /** Appends one layer (rows at x, y) to an SVG group. */
  function draw(parent, rows, opts) {
    var o = opts || {};
    var g = el('g', o.cls ? { class: o.cls } : {});
    if (o.x || o.y) g.setAttribute('transform', 'translate(' + (o.x || 0) + ' ' + (o.y || 0) + ')');
    paths(rows, o.palette).forEach(function (p) {
      g.appendChild(el('path', { fill: p.color, d: p.d }));
    });
    parent.appendChild(g);
    return g;
  }

  /**
   * Builds an <svg> from a sprite: { w, h, layers: [{ rows, cls?, x?, y? }] }
   * or just an array of rows.
   */
  function svg(sprite, opts) {
    var o = opts || {};
    var s = Array.isArray(sprite) ? { layers: [{ rows: sprite }] } : sprite;
    var w = s.w || width(s.layers[0].rows);
    var h = s.h || s.layers[0].rows.length;
    // Animation frames are layers classed f0, f1, ...; CSS cycles them.
    var frameCount = 0;
    s.layers.forEach(function (l) {
      var m = /\bf(\d+)\b/.exec(l.cls || '');
      if (m) frameCount = Math.max(frameCount, Number(m[1]) + 1);
    });
    var root = el('svg', {
      viewBox: '0 0 ' + w + ' ' + h,
      'shape-rendering': 'crispEdges',
      'aria-hidden': 'true',
      focusable: 'false',
      class: 'px ' + (frameCount ? 'frames-' + frameCount + ' ' : '') + (o.cls || ''),
      // Sized in CSS as --w x --h art pixels of var(--u) each.
      style: '--w:' + w + ';--h:' + h
    });
    s.layers.forEach(function (layer) {
      draw(root, layer.rows, { cls: layer.cls, x: layer.x, y: layer.y, palette: o.palette });
    });
    return root;
  }

  /** Replaces every <i data-sprite="name"> placeholder with its SVG. */
  function mountAll(sprites, root) {
    (root || document).querySelectorAll('[data-sprite]').forEach(function (slot) {
      var name = slot.getAttribute('data-sprite');
      var sprite = sprites[name];
      if (!sprite) return console.warn('unknown sprite', name);
      slot.replaceWith(svg(typeof sprite === 'function' ? sprite() : sprite, { cls: 'sprite-' + name + ' ' + slot.className }));
    });
  }

  NS.pixel = {
    PALETTE: PALETTE,
    rle: rle,
    mirror: mirror,
    outline: outline,
    paths: paths,
    draw: draw,
    svg: svg,
    el: el,
    mountAll: mountAll
  };
})();
