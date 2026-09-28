/*
 * The night sky from the banner, rebuilt as live pixel art: moon, twinkling
 * stars, cyan sparkles, drifting cloud banks, the antenna and the cat.
 * Everything is generated for the element's size so pixels stay square and
 * crisp, and every movement is a whole number of pixels.
 */
(function () {
  'use strict';

  var NS = window.FheCat;
  var P = NS.pixel;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Small deterministic RNG, so the sky does not reshuffle on every resize. */
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
  function grid(w, h) {
    var g = [];
    for (var y = 0; y < h; y++) g.push(new Array(w).fill('.'));
    return g;
  }
  function toRows(g) {
    return g.map(function (r) {
      return r.join('');
    });
  }
  function svgBox(w, h, px, cls) {
    var s = P.el('svg', {
      viewBox: '0 0 ' + w + ' ' + h,
      width: w * px,
      height: h * px,
      'shape-rendering': 'crispEdges',
      'aria-hidden': 'true',
      focusable: 'false'
    });
    if (cls) s.setAttribute('class', cls);
    return s;
  }
  function rect(parent, x, y, w, h, color, cls, style) {
    var r = P.el('rect', { x: x, y: y, width: w, height: h, fill: color });
    if (cls) r.setAttribute('class', cls);
    if (style) r.setAttribute('style', style);
    parent.appendChild(r);
    return r;
  }

  /** Pixel circle outline (midpoint algorithm); `keep(dx, dy)` can drop parts. */
  function circle(g, cx, cy, r, ch, keep) {
    var x = r;
    var y = 0;
    var err = 1 - r;
    var put = function (dx, dy) {
      if (keep && !keep(dx, dy)) return;
      var px = cx + dx;
      var py = cy + dy;
      if (g[py] && px >= 0 && px < g[py].length) g[py][px] = ch;
    };
    while (x >= y) {
      [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]].forEach(function (p) {
        put(p[0], p[1]);
      });
      y++;
      if (err < 0) err += 2 * y + 1;
      else {
        x--;
        err += 2 * (y - x) + 1;
      }
    }
  }

  /**
   * One cloud bank: a stepped silhouette whose height is a sum of sines that
   * repeat every `period` columns, so a strip of 2 x period tiles seamlessly.
   */
  function cloudRows(period, height, base, amp, seed, fill, edge) {
    var r = rng(seed);
    var waves = [1, 2, 3, 5].map(function (k) {
      return { k: k + Math.floor(r() * 2), a: (amp / k) * (0.6 + r() * 0.8), p: r() * Math.PI * 2 };
    });
    var w = period * 2;
    var g = grid(w, height);
    for (var x = 0; x < w; x++) {
      var t = (x / period) * Math.PI * 2;
      var top = base;
      waves.forEach(function (wv) {
        top += wv.a * Math.sin(wv.k * t + wv.p);
      });
      top = Math.max(0, Math.min(height - 1, Math.round(height - top)));
      for (var y = top; y < height; y++) g[y][x] = y === top && edge ? edge : fill;
    }
    return toRows(g);
  }

  function addSparkle(svg, x, y, big, delay) {
    var g = P.el('g', { class: 'spark' });
    var color = big ? '#10d5f7' : '#1c88a7';
    rect(g, x, y, 1, 1, color);
    var arms = P.el('g', { class: 'spark-arms', style: 'animation-delay:' + delay.toFixed(2) + 's' });
    rect(arms, x - 1, y, 1, 1, color);
    rect(arms, x + 1, y, 1, 1, color);
    rect(arms, x, y - 1, 1, 1, color);
    rect(arms, x, y + 1, 1, 1, color);
    g.appendChild(arms);
    svg.appendChild(g);
  }

  function addStars(svg, W, H, count, r, top) {
    for (var i = 0; i < count; i++) {
      var sx = Math.floor(r() * W);
      var sy = Math.floor(r() * H * (top || 1));
      var bright = r() < 0.25;
      var twinkle = r() < 0.5;
      rect(
        svg,
        sx,
        sy,
        1,
        1,
        bright ? '#2c6989' : '#1b698b',
        twinkle ? 'tw' : null,
        twinkle ? 'animation-duration:' + (2.5 + r() * 4).toFixed(2) + 's;animation-delay:-' + (r() * 6).toFixed(2) + 's' : null
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Full scenes (hero and finale)
  // ---------------------------------------------------------------------------
  var scenes = [];

  function build(s) {
    var el = s.el;
    var box = el.getBoundingClientRect();
    var px = Math.max(4, Math.min(10, Math.round(box.width / 175)));
    var W = Math.ceil(box.width / px);
    var H = Math.ceil(box.height / px);
    var o = s.opts;
    var r = rng(o.seed || 0xfec47);
    var layer = el.querySelector('.scene');
    layer.innerHTML = '';
    el.style.setProperty('--px', px + 'px');
    // Tall, narrow screens (phones) get a smaller moon and flatter clouds.
    var scale = Math.min(W, H);

    // --- sky: stars, moon, sparkles -------------------------------------------
    var sky = svgBox(W, H, px, 'sky');
    addStars(sky, W, H, Math.round((W * H) / 260), r, 0.75);
    if (o.moon) {
      var moon = grid(W, H);
      var mr = Math.max(5, Math.round(scale * 0.07));
      var mx = o.moon === 'right' ? W - Math.round(W * 0.12) - mr : Math.round(W * 0.1) + mr;
      var my = mr + 2 + Math.ceil(72 / px);
      circle(moon, mx, my, mr, 'M');
      moon[my - 1][mx - 2] = 'N';
      moon[my + 2][mx + 2] = 'N';
      moon[my + 2][mx + 3] = 'N';
      P.draw(sky, toRows(moon), { cls: 'moon' });
    }
    [
      [0.045, 0.22, 1],
      [0.9, 0.2, 1],
      [0.93, 0.55, 0],
      [0.2, 0.7, 0],
      [0.66, 0.12, 0],
      [0.35, 0.08, 1]
    ].forEach(function (sp, k) {
      addSparkle(sky, Math.round(W * sp[0]), Math.round(H * sp[1]), sp[2], -k * 0.7);
    });
    var shooting = P.el('g', { class: 'shooting' });
    sky.appendChild(shooting);
    layer.appendChild(sky);

    // --- clouds: three banks drifting one pixel at a time ----------------------
    [
      { h: Math.round(scale * 0.3), base: scale * 0.17, amp: scale * 0.06, seed: 11, fill: 'N', edge: null, cls: 'far', t: 1.6 },
      { h: Math.round(scale * 0.24), base: scale * 0.12, amp: scale * 0.05, seed: 23, fill: 'n', edge: 'H', cls: 'mid', t: 1.05 },
      { h: Math.round(scale * 0.16), base: scale * 0.07, amp: scale * 0.035, seed: 37, fill: 'K', edge: 'H', cls: 'near', t: 0.7 }
    ].forEach(function (b) {
      var strip = svgBox(W * 2, b.h, px, 'clouds-strip ' + b.cls);
      strip.style.setProperty('--drift', (W * b.t).toFixed(1) + 's');
      strip.style.setProperty('--steps', W);
      P.draw(strip, cloudRows(W, b.h, b.base, b.amp, b.seed + (o.seed || 0), b.fill, b.edge));
      layer.appendChild(strip);
    });

    // --- ground props: antenna, fireflies, the cat -----------------------------
    var ground = svgBox(W, H, px, 'ground');
    var ax = Math.round(W * 0.07);
    var aTop = Math.round(H * 0.62);
    rect(ground, ax, aTop, 1, Math.round(H * 0.2), '#3e6d88');
    rect(ground, ax - 1, aTop + 5, 3, 1, '#3e6d88');
    rect(ground, ax, aTop - 1, 1, 1, '#0df3ff', 'beacon');
    rect(ground, ax, aTop + 3, 1, 1, '#1c88a7', 'beacon beacon-2');
    // broadcast rings: three arcs above the tip, one after another
    [3, 6, 9].forEach(function (rad, i) {
      var arc = grid(W, H);
      circle(arc, ax, aTop - 1, rad, i === 0 ? 'b' : 'c', function (dx, dy) {
        return dy < -Math.abs(dx) * 0.35 - 0.5;
      });
      P.draw(ground, toRows(arc), { cls: 'ring ring-' + i });
    });
    for (var f = 0; f < 7; f++) {
      rect(
        ground,
        Math.round(W * (0.03 + r() * 0.18)),
        Math.round(H * (0.8 + r() * 0.15)),
        1,
        1,
        r() < 0.5 ? '#1bafca' : '#1796af',
        'firefly',
        'animation-delay:-' + (r() * 5).toFixed(2) + 's;animation-duration:' + (3 + r() * 3).toFixed(2) + 's'
      );
    }
    var catX = Math.round(W * (o.catAt || 0.86)) - 9;
    var catY = H - Math.round(H * 0.07) - 19;
    var catG = P.el('g', { class: 'scene-cat', transform: 'translate(' + catX + ' ' + catY + ')' });
    NS.sprites[o.back ? 'catBack' : 'cat'].layers.forEach(function (l) {
      P.draw(catG, l.rows, { cls: l.cls });
    });
    ground.appendChild(catG);
    rect(ground, catX - 3, catY + 19, 26, 1, '#3e6d88');
    layer.appendChild(ground);

    s.W = W;
    s.H = H;
    s.px = px;
    s.width = box.width;
    s.shooting = shooting;
    s.cat = { x: catX * px, y: catY * px, w: 19 * px, h: 19 * px };
    if (o.onBuild) o.onBuild(s);
  }

  /** A shooting star somewhere in the upper sky. */
  function shoot(s) {
    if (!s.shooting || document.hidden || !s.visible) return;
    var r = Math.random;
    var x = Math.round(s.W * (0.35 + r() * 0.55));
    var y = Math.round(s.H * (0.05 + r() * 0.25));
    var star = P.el('g', { class: 'meteor' });
    rect(star, x, y, 1, 1, '#e6f2ff');
    rect(star, x + 1, y - 1, 1, 1, '#10d5f7');
    rect(star, x + 2, y - 2, 1, 1, '#1c88a7');
    rect(star, x + 3, y - 3, 1, 1, '#1b698b');
    s.shooting.appendChild(star);
    setTimeout(function () {
      star.remove();
    }, 1300);
  }

  function init(el, opts) {
    var s = { el: el, opts: opts || {}, visible: true };
    scenes.push(s);
    build(s);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        s.visible = entries[0].isIntersecting;
      }).observe(el);
    }
    if (!reduce) {
      (function loop() {
        setTimeout(function () {
          shoot(s);
          loop();
        }, 4500 + Math.random() * 6000);
      })();
    }
    if (s.opts.tapPaws && !reduce) {
      el.addEventListener('pointerdown', function (e) {
        if (e.target.closest('a,button')) return;
        var b = el.getBoundingClientRect();
        var paw = P.svg(NS.sprites.paw, { cls: 'tap-paw' });
        var u = Math.max(3, s.px - 2);
        paw.style.setProperty('--u', u + 'px');
        paw.style.left = Math.round((e.clientX - b.left) / u) * u - u * 4 + 'px';
        paw.style.top = Math.round((e.clientY - b.top) / u) * u - u * 4 + 'px';
        el.appendChild(paw);
        setTimeout(function () {
          paw.remove();
        }, 1200);
      });
    }
    return s;
  }

  // ---------------------------------------------------------------------------
  // Light-weight pieces for the chapters
  // ---------------------------------------------------------------------------

  /** Scatters stars (a few twinkling) over an element, 4px per pixel. */
  function starfield(el, density, seed) {
    var px = 4;
    var box = el.getBoundingClientRect();
    var W = Math.ceil(box.width / px);
    var H = Math.ceil(box.height / px);
    var r = rng(seed || 7);
    var svg = svgBox(W, H, px);
    addStars(svg, W, H, Math.round(((W * H) / 900) * (density || 1)), r);
    for (var i = 0; i < 3 * (density || 1); i++) {
      addSparkle(svg, 2 + Math.floor(r() * (W - 4)), 2 + Math.floor(r() * (H - 4)), r() < 0.4, -r() * 4);
    }
    el.innerHTML = '';
    el.appendChild(svg);
  }

  /**
   * Puffy clouds: round bumps (circles) over a flat base, repeating every
   * `period` columns so a 2 x period strip tiles. The underside gets a dark line.
   */
  function puffRows(period, H, seed, o) {
    var r = rng(seed);
    var bumps = [];
    for (var x = 0; x < period; ) {
      var rad = o.rmin + Math.floor(r() * (o.rmax - o.rmin + 1));
      bumps.push({ x: x + rad, r: rad });
      x += Math.max(3, Math.round(rad * (1.1 + r() * 0.9)));
    }
    var w = period * 2;
    var g = grid(w, H);
    for (var col = 0; col < w; col++) {
      var top = o.base;
      bumps.forEach(function (b) {
        for (var k = -1; k <= 2; k++) {
          var dx = col - (b.x + k * period);
          if (Math.abs(dx) <= b.r) top = Math.min(top, o.base - Math.round(Math.sqrt(b.r * b.r - dx * dx) * 0.9));
        }
      });
      var t = (col / period) * Math.PI * 2;
      var bottom = Math.round(o.bottom + Math.sin(t * 3 + seed) * 0.8 + Math.sin(t * 7 + seed * 2) * 0.6);
      for (var y = Math.max(0, top); y <= Math.min(H - 1, bottom); y++) g[y][col] = y === top ? o.edge : y === bottom ? o.under : o.fill;
    }
    return toRows(g);
  }

  /**
   * A cloud ribbon between chapters: two banks of puffy pixel clouds with
   * bright top edges, drifting in opposite directions one pixel at a time.
   */
  function ribbon(el, seed) {
    var px = 4;
    var box = el.getBoundingClientRect();
    var W = Math.ceil(box.width / px) + 2;
    var H = Math.ceil(box.height / px);
    el.innerHTML = '';
    [
      { fill: 'N', edge: 'H', under: 'K', base: Math.round(H * 0.62), bottom: Math.round(H * 0.84), rmin: 4, rmax: 10, t: 2.4, seed: seed * 7 + 3 },
      { fill: 'n', edge: 'h', under: 'K', base: Math.round(H * 0.8), bottom: Math.round(H * 0.95), rmin: 3, rmax: 7, t: 1.5, seed: seed * 13 + 5 }
    ].forEach(function (b, i) {
      var strip = svgBox(W * 2, H, px, 'clouds-strip');
      strip.style.setProperty('--drift', (W * b.t).toFixed(1) + 's');
      strip.style.setProperty('--steps', W);
      if (i === 1) strip.style.animationDirection = 'reverse';
      P.draw(strip, puffRows(W, H, b.seed, b));
      el.appendChild(strip);
    });
  }

  var lastWidth = window.innerWidth;
  window.addEventListener('resize', function () {
    clearTimeout(init._t);
    init._t = setTimeout(function () {
      // Mobile browsers resize the height while scrolling; only rebuild on real changes.
      if (Math.abs(window.innerWidth - lastWidth) < 40) return;
      lastWidth = window.innerWidth;
      scenes.forEach(build);
      document.dispatchEvent(new Event('fhecat:rebuild'));
    }, 200);
  });

  NS.scene = { init: init, starfield: starfield, ribbon: ribbon, rng: rng };
})();
