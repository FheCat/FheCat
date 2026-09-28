/*
 * The hero night sky, rebuilt from the banner as live pixel art:
 * moon, twinkling stars, cyan sparkles, drifting cloud banks, an antenna
 * and the sitting cat. It is generated for the element's size, so pixels stay
 * square and crisp on every screen.
 */
(function () {
  'use strict';

  var NS = window.FheCat;
  var P = NS.pixel;

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
  function svgBox(w, h, cls) {
    return P.el('svg', {
      viewBox: '0 0 ' + w + ' ' + h,
      width: w,
      height: h,
      'shape-rendering': 'crispEdges',
      'aria-hidden': 'true',
      class: cls
    });
  }
  function rect(parent, x, y, w, h, color, cls, style) {
    var r = P.el('rect', { x: x, y: y, width: w, height: h, fill: color });
    if (cls) r.setAttribute('class', cls);
    if (style) r.setAttribute('style', style);
    parent.appendChild(r);
    return r;
  }

  /** Pixel circle outline (midpoint algorithm). */
  function circle(g, cx, cy, r, ch) {
    var x = r;
    var y = 0;
    var err = 1 - r;
    var put = function (px, py) {
      if (g[py] && px >= 0 && px < g[py].length) g[py][px] = ch;
    };
    while (x >= y) {
      [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]].forEach(function (p) {
        put(cx + p[0], cy + p[1]);
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
      // Snap to steps of 2 so the edge reads as chunky pixel art.
      top = Math.max(0, Math.min(height - 1, Math.round(height - top)));
      for (var y = top; y < height; y++) g[y][x] = y === top && edge ? edge : fill;
    }
    return toRows(g);
  }

  function addSparkle(svg, x, y, big, delay) {
    var g = P.el('g', { class: 'spark' + (big ? ' spark-big' : ''), style: 'animation-delay:' + delay + 's' });
    var color = big ? '#10d5f7' : '#1c88a7';
    rect(g, x, y, 1, 1, color);
    var arms = P.el('g', { class: 'spark-arms' });
    rect(arms, x - 1, y, 1, 1, color);
    rect(arms, x + 1, y, 1, 1, color);
    rect(arms, x, y - 1, 1, 1, color);
    rect(arms, x, y + 1, 1, 1, color);
    g.appendChild(arms);
    svg.appendChild(g);
  }

  var current = null;

  function build(hero) {
    var box = hero.getBoundingClientRect();
    var px = Math.max(5, Math.min(10, Math.round(box.width / 175)));
    var W = Math.ceil(box.width / px);
    var H = Math.ceil(box.height / px);
    var r = rng(0xfec47);
    var layer = hero.querySelector('.scene');
    layer.innerHTML = '';
    hero.style.setProperty('--px', px + 'px');

    // --- sky: stars, sparkles, moon ------------------------------------------
    var sky = svgBox(W, H, 'sky');
    sky.style.width = W * px + 'px';
    sky.style.height = H * px + 'px';
    var starCount = Math.round((W * H) / 260);
    for (var i = 0; i < starCount; i++) {
      var sx = Math.floor(r() * W);
      var sy = Math.floor(r() * H * 0.72);
      var bright = r() < 0.25;
      rect(sky, sx, sy, 1, 1, bright ? '#2c6989' : '#1b698b', 'tw', 'animation-duration:' + (2.5 + r() * 4).toFixed(2) + 's;animation-delay:-' + (r() * 6).toFixed(2) + 's');
    }
    // Tall, narrow screens (phones) get a smaller moon and flatter clouds.
    var scale = Math.min(W, H);
    var moon = grid(W, H);
    var mr = Math.max(5, Math.round(scale * 0.07));
    var mx = Math.round(W * 0.1) + mr;
    // Sits just below the 68px top bar.
    var my = mr + 2 + Math.ceil(72 / px);
    circle(moon, mx, my, mr, 'M');
    // two faint craters, like the banner's moon
    moon[my - 1][mx - 2] = 'N';
    moon[my + 2][mx + 2] = 'N';
    moon[my + 2][mx + 3] = 'N';
    P.draw(sky, toRows(moon), { cls: 'moon' });
    [
      [0.045, 0.22, 1],
      [0.9, 0.2, 1],
      [0.93, 0.55, 0],
      [0.2, 0.7, 0],
      [0.66, 0.12, 0],
      [0.35, 0.08, 1]
    ].forEach(function (s, k) {
      addSparkle(sky, Math.round(W * s[0]), Math.round(H * s[1]), s[2], -k * 0.7);
    });
    var shooting = P.el('g', { class: 'shooting' });
    sky.appendChild(shooting);
    layer.appendChild(sky);

    // --- clouds: three banks drifting at different speeds --------------------
    var banks = [
      { h: Math.round(scale * 0.3), base: scale * 0.17, amp: scale * 0.06, seed: 11, fill: 'N', edge: null, cls: 'far' },
      { h: Math.round(scale * 0.24), base: scale * 0.12, amp: scale * 0.05, seed: 23, fill: 'n', edge: 'H', cls: 'mid' },
      { h: Math.round(scale * 0.16), base: scale * 0.07, amp: scale * 0.035, seed: 37, fill: 'K', edge: 'H', cls: 'near' }
    ];
    banks.forEach(function (b) {
      var rowsB = cloudRows(W, b.h, b.base, b.amp, b.seed, b.fill, b.edge);
      var strip = svgBox(W * 2, b.h, 'clouds clouds-' + b.cls);
      strip.style.width = W * 2 * px + 'px';
      strip.style.height = b.h * px + 'px';
      P.draw(strip, rowsB);
      layer.appendChild(strip);
    });

    // --- ground props: antenna with a blinking light, fireflies, the cat ----
    var ground = svgBox(W, H, 'ground');
    ground.style.width = W * px + 'px';
    ground.style.height = H * px + 'px';
    var ax = Math.round(W * 0.07);
    var aTop = Math.round(H * 0.62);
    rect(ground, ax, aTop, 1, Math.round(H * 0.2), '#3e6d88');
    rect(ground, ax - 1, aTop + 5, 3, 1, '#3e6d88');
    rect(ground, ax, aTop - 1, 1, 1, '#0df3ff', 'beacon');
    rect(ground, ax, aTop + 3, 1, 1, '#1c88a7', 'beacon beacon-2');
    for (var f = 0; f < 7; f++) {
      rect(ground, Math.round(W * (0.03 + r() * 0.18)), Math.round(H * (0.8 + r() * 0.15)), 1, 1, r() < 0.5 ? '#1bafca' : '#1796af', 'firefly', 'animation-delay:-' + (r() * 5).toFixed(2) + 's;animation-duration:' + (3 + r() * 3).toFixed(2) + 's');
    }
    var catX = Math.round(W * 0.86) - 9;
    var catY = H - Math.round(H * 0.07) - 19;
    var catG = P.el('g', { class: 'hero-cat', transform: 'translate(' + catX + ' ' + catY + ')' });
    NS.sprites.cat.layers.forEach(function (l) {
      P.draw(catG, l.rows, { cls: l.cls });
    });
    ground.appendChild(catG);
    rect(ground, catX - 3, catY + 19, 26, 1, '#3e6d88');
    layer.appendChild(ground);

    current = { hero: hero, W: W, H: H, px: px, shooting: shooting, width: box.width };
  }

  /** A shooting star every few seconds. */
  function shoot() {
    if (!current || document.hidden) return;
    var g = current.shooting;
    var r = Math.random;
    var x = Math.round(current.W * (0.35 + r() * 0.55));
    var y = Math.round(current.H * (0.05 + r() * 0.25));
    var star = P.el('g', { class: 'meteor' });
    rect(star, x, y, 1, 1, '#e6f2ff');
    rect(star, x + 1, y - 1, 1, 1, '#10d5f7');
    rect(star, x + 2, y - 2, 1, 1, '#1c88a7');
    rect(star, x + 3, y - 3, 1, 1, '#1b698b');
    g.appendChild(star);
    setTimeout(function () {
      star.remove();
    }, 1400);
  }

  function init(hero) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    build(hero);
    var timer = null;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        // Mobile browsers resize the height while scrolling; only rebuild on real changes.
        var w = hero.getBoundingClientRect().width;
        if (!current || Math.abs(w - current.width) > 40) build(hero);
      }, 200);
    });
    if (!reduce) {
      (function loop() {
        setTimeout(function () {
          shoot();
          loop();
        }, 4500 + Math.random() * 6000);
      })();
    }

    // Tap the sky: leave a cyan paw print.
    hero.addEventListener('pointerdown', function (e) {
      if (e.target.closest('a,button') || reduce) return;
      var b = hero.getBoundingClientRect();
      var paw = P.svg(NS.sprites.paw, { cls: 'tap-paw' });
      var size = current.px * 9;
      paw.style.left = e.clientX - b.left - size / 2 + 'px';
      paw.style.top = e.clientY - b.top - size / 2 + 'px';
      paw.style.width = size + 'px';
      hero.appendChild(paw);
      setTimeout(function () {
        paw.remove();
      }, 1200);
    });
  }

  NS.scene = { init: init };
})();
