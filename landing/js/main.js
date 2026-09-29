/*
 * Wires the page together: sprites, the two night scenes, and every small
 * interaction. The theme is simple: everything starts encrypted, some things
 * decrypt, and the cats never do.
 */
(function () {
  'use strict';

  var NS = window.FheCat;
  var P = NS.pixel;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  var HEX = '0123456789abcdef';
  function hex(n, rand) {
    var r = rand || Math.random;
    var s = '';
    for (var i = 0; i < n; i++) s += HEX[(r() * 16) | 0];
    return s;
  }
  function inView(el) {
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }
  /** Calls fn(true/false) as el enters/leaves the viewport. */
  function watch(el, fn, margin) {
    if (!('IntersectionObserver' in window)) return fn(true);
    new IntersectionObserver(
      function (entries) {
        fn(entries[0].isIntersecting);
      },
      { rootMargin: margin || '0px' }
    ).observe(el);
  }

  // ---------------------------------------------------------------------------
  // Wordmark: "FheCat" drawn in pixels; the hero one decodes out of noise.
  // ---------------------------------------------------------------------------
  function wordmarks() {
    var wm = NS.art.wordmarkCells();
    $$('[data-wordmark]').forEach(function (slot) {
      var svg = P.svg(wm.cells, { cls: 'wordmark' });
      slot.appendChild(svg);
      if (slot.hasAttribute('data-decode') && !reduce) decode(slot, svg, wm);
    });
  }

  function decode(slot, finalSvg, wm) {
    var W = wm.w;
    var H = wm.h;
    var noise = ['#1c88a7', '#3e6d88', '#10d5f7', '#2a4c66'];
    var colours = P.PALETTE;
    var svg = P.el('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      'shape-rendering': 'crispEdges',
      class: 'px wordmark',
      style: '--w:' + W + ';--h:' + H,
      'aria-hidden': 'true'
    });
    var cells = [];
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var r = P.el('rect', { x: x, y: y, width: 1, height: 1, fill: 'none' });
        svg.appendChild(r);
        cells.push({ r: r, x: x, final: wm.cells[y][x] });
      }
    }
    slot.replaceChild(svg, finalSvg);
    var frame = 0;
    var total = 26;
    var paint = function (settledCols, busyFrom, busyTo) {
      cells.forEach(function (c) {
        var settled = c.x < settledCols && !(c.x >= busyFrom && c.x < busyTo);
        if (settled) c.r.setAttribute('fill', c.final === '.' ? 'none' : colours[c.final]);
        else c.r.setAttribute('fill', Math.random() < 0.45 ? noise[(Math.random() * noise.length) | 0] : 'none');
      });
    };
    var timer = setInterval(function () {
      frame++;
      var cols = frame < 6 ? 0 : Math.round(((frame - 6) / (total - 6)) * W);
      paint(cols, -1, -1);
      if (frame >= total) {
        clearInterval(timer);
        slot.replaceChild(finalSvg, svg);
        // Every so often, a few columns glitch back to noise and settle again.
        setInterval(function () {
          if (document.hidden || !inView(slot)) return;
          var from = (Math.random() * (W - 8)) | 0;
          var to = from + 4 + ((Math.random() * 6) | 0);
          var n = 0;
          slot.replaceChild(svg, finalSvg);
          var g = setInterval(function () {
            paint(W, from, n < 4 ? to : -1);
            if (++n > 4) {
              clearInterval(g);
              slot.replaceChild(finalSvg, svg);
            }
          }, 60);
        }, 7000);
      }
    }, 50);
    paint(0, -1, -1);
  }

  // ---------------------------------------------------------------------------
  // "Decrypting" text: characters sit behind flickering cipher blocks, then
  // resolve left to right. Widths never change, so nothing jumps around.
  // ---------------------------------------------------------------------------
  function decryptText(el, text, done) {
    text = text || el.getAttribute('data-text') || el.textContent;
    el.setAttribute('data-text', text);
    if (reduce) {
      el.textContent = text;
      if (done) done();
      return;
    }
    clearInterval(el._decrypt);
    el.setAttribute('aria-label', text);
    el.textContent = '';
    var spans = Array.from(text).map(function (ch) {
      var s = document.createElement('span');
      s.textContent = ch;
      s.setAttribute('aria-hidden', 'true');
      if (ch !== ' ') s.className = 'x';
      el.appendChild(s);
      return s;
    });
    var steps = Math.min(28, 10 + spans.length);
    var i = 0;
    el._decrypt = setInterval(function () {
      i++;
      var settled = Math.floor((i / steps) * spans.length);
      spans.forEach(function (s, k) {
        if (s.textContent === ' ') return;
        s.className = k < settled ? '' : Math.random() < 0.5 ? 'x' : 'x x2';
      });
      if (i >= steps) {
        clearInterval(el._decrypt);
        el.textContent = text;
        el.removeAttribute('aria-label');
        if (done) done();
      }
    }, 55);
  }

  /** The reverse: plain text dissolves into cipher blocks. */
  function encryptText(el, done) {
    var text = el.textContent;
    if (reduce) return done && done();
    el.textContent = '';
    var spans = Array.from(text).map(function (ch) {
      var s = document.createElement('span');
      s.textContent = ch;
      el.appendChild(s);
      return s;
    });
    var i = 0;
    var steps = 10;
    var t = setInterval(function () {
      i++;
      var from = spans.length - Math.floor((i / steps) * spans.length);
      spans.forEach(function (s, k) {
        if (s.textContent !== ' ' && k >= from) s.className = Math.random() < 0.5 ? 'x' : 'x x2';
      });
      if (i >= steps) {
        clearInterval(t);
        if (done) done();
      }
    }, 40);
  }

  function headings() {
    $$('[data-decrypt]').forEach(function (h) {
      var text = h.textContent;
      h.setAttribute('data-text', text);
      if (reduce) return;
      var seen = false;
      watch(
        h,
        function (on) {
          if (on && !seen) {
            seen = true;
            decryptText(h, text);
          }
        },
        '0px 0px -12% 0px'
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Top bar: turns solid after the hero; shows how much of the page is "decrypted".
  // ---------------------------------------------------------------------------
  function topbar() {
    var bar = $('#topbar');
    var meter = $('.meter');
    var cells = [];
    var track = $('#meterBar');
    for (var i = 0; i < 10; i++) cells.push(track.appendChild(document.createElement('i')));
    var pct = $('#meterPct');
    var label = $('.meter-label');
    var line = $('#meterLine');
    var last = -1;
    var update = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 0;
      bar.classList.toggle('solid', window.scrollY > 24);
      if (p === last) return;
      last = p;
      cells.forEach(function (c, k) {
        c.classList.toggle('on', k < Math.round(p / 10));
      });
      pct.textContent = p + '%';
      meter.classList.toggle('done', p >= 100);
      label.textContent = p >= 100 ? 'Page decrypted' : 'Decrypting page';
      // the mobile line grows in 4px steps
      line.style.width = Math.round((p / 100) * window.innerWidth / 4) * 4 + 'px';
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // ---------------------------------------------------------------------------
  // Ticker: a slow LED marquee under the hero.
  // ---------------------------------------------------------------------------
  function ticker() {
    var track = $('#ticker');
    var items = [
      ['FheCat', true],
      ['Pixel cats', false],
      ['Born encrypted', true],
      ['Powered by Fhenix FHE', false],
      ['Mainnet mint: October 2026', true],
      ['Supply: encrypted', false],
      ['Traits: ' + '0x' + hex(8), false],
      ['Reveal: soon', true],
      ['Rarity: encrypted', false],
      ['Follow the signal @FheCat', false]
    ];
    var make = function () {
      var row = document.createElement('div');
      row.className = 'ticker-item';
      items.forEach(function (it) {
        var span = document.createElement(it[1] ? 'b' : 'span');
        span.textContent = it[0];
        row.appendChild(span);
        row.appendChild(P.svg(NS.sprites['i-diamond']));
      });
      return row;
    };
    track.appendChild(make());
    track.appendChild(make());
    var measure = function () {
      var w = track.firstChild.getBoundingClientRect().width;
      // pad the loop to a multiple of 4px so every step is a whole pixel
      var padded = Math.ceil(w / 4) * 4;
      track.childNodes.forEach(function (n) {
        n.style.width = padded + 'px';
      });
      track.style.setProperty('--dist', padded + 'px');
      track.style.setProperty('--steps', padded / 4);
      track.style.setProperty('--dur', (padded / 48).toFixed(1) + 's');
    };
    measure();
    document.addEventListener('fhecat:rebuild', measure);
  }

  // ---------------------------------------------------------------------------
  // Hero cat: say hi and it answers, in cipher first.
  // ---------------------------------------------------------------------------
  function heroCat(scene) {
    var hit = $('#catHit');
    var bubble = $('#bubble');
    var lines = ['Meow', 'Mrrp?', 'Still encrypted', 'Prrr'];
    var n = 0;
    var hide = null;
    var place = function (s) {
      hit.style.left = s.cat.x + 'px';
      hit.style.top = s.cat.y + 'px';
      hit.style.width = s.cat.w + 'px';
      hit.style.height = s.cat.h + 'px';
      bubble.style.right = Math.max(8, s.width - s.cat.x - s.cat.w + 8) + 'px';
      bubble.style.bottom = s.H * s.px - s.cat.y + 24 + 'px';
    };
    place(scene);
    scene.opts.onBuild = place;
    hit.addEventListener('click', function () {
      clearTimeout(hide);
      bubble.classList.add('on');
      decryptText(bubble, lines[n++ % lines.length]);
      hide = setTimeout(function () {
        bubble.classList.remove('on');
      }, 2600);
    });
  }

  // ---------------------------------------------------------------------------
  // 01 · The specimen card: an encrypted cat you can try (and fail) to peek at.
  // ---------------------------------------------------------------------------
  function specimen() {
    var card = $('#specimen');
    var btn = $('#peek');
    var label = $('span', btn);
    var msg = $('#specMsg');
    var dna = $('[data-hex]', card);
    var visible = false;
    watch(card, function (on) {
      visible = on;
    });
    if (!reduce) {
      setInterval(function () {
        if (visible && !document.hidden) dna.textContent = '0x' + hex(+dna.getAttribute('data-hex'));
      }, 140);
    }
    var busy = false;
    btn.addEventListener('click', function () {
      if (busy) return;
      busy = true;
      btn.disabled = true;
      label.textContent = 'Decrypting…';
      card.classList.remove('denied');
      card.classList.add('scanning');
      var p = 0;
      var stop = 72 + ((Math.random() * 20) | 0);
      var tick = setInterval(function () {
        p = Math.min(stop, p + 4 + ((Math.random() * 6) | 0));
        var blocks = Math.round(p / 10);
        msg.textContent = '[' + '#'.repeat(blocks) + '.'.repeat(10 - blocks) + '] ' + p + '%';
        if (p >= stop) {
          clearInterval(tick);
          card.classList.remove('scanning');
          void card.offsetWidth; // restart the shake
          card.classList.add('denied');
          msg.textContent = 'Access denied. Only the owner can decrypt this cat.';
          label.textContent = 'Try again';
          setTimeout(function () {
            card.classList.remove('denied');
            btn.disabled = false;
            busy = false;
            msg.textContent = '';
          }, 2800);
        }
      }, reduce ? 20 : 90);
    });
  }

  // ---------------------------------------------------------------------------
  // 02 · The FHE machine: enc(3) + enc(4) goes in, enc(7) comes out, and only
  // the owner's key opens it. Positions are whole art pixels, 10 frames a second.
  // ---------------------------------------------------------------------------
  function machine() {
    var stage = $('#stage');
    var inner = $('#stageInner');
    var status = $('#stageStatus');
    var A = $('[data-actor="a"]', inner);
    var B = $('[data-actor="b"]', inner);
    var C = $('[data-actor="c"]', inner);
    var K = $('[data-actor="key"]', inner);
    var M = $('[data-actor="m"]', inner);
    var u = 6;
    var readU = function () {
      u = parseInt(getComputedStyle(stage).getPropertyValue('--u'), 10) || 6;
    };
    var put = function (el, x, y) {
      el.style.transform = 'translate(' + Math.round(x) * u + 'px,' + Math.round(y) * u + 'px)';
    };
    // step-wise interpolation in 2-pixel hops
    var hop = function (a, b, t) {
      var v = a + (b - a) * Math.max(0, Math.min(1, t));
      return Math.round(v / 2) * 2;
    };
    var say = function (text) {
      if (status.textContent !== text) status.textContent = text;
    };
    var T = 11;
    var render = function (t) {
      put(M, 36, 2);
      var crateY = 14;
      var inT = (t - 1) / 2; // 1s..3s
      var outT = (t - 5) / 1.4; // 5s..6.4s
      var keyT = (t - 6.4) / 1.2; // 6.4s..7.6s
      put(A, hop(0, 44, inT), crateY);
      put(B, hop(18, 52, inT), crateY);
      var cx = hop(52, 92, outT);
      put(C, cx, crateY);
      C.style.visibility = t >= 5 && t < 10.4 ? 'visible' : 'hidden';
      A.style.visibility = B.style.visibility = t < 3 || t >= 10.4 ? 'visible' : 'hidden';
      K.classList.toggle('on', t >= 6.4 && t < 7.9);
      put(K, hop(92 - 30, 92 - 12, keyT), crateY + 7);
      C.classList.toggle('open', t >= 7.6 && t < 10.4);
      stage.classList.toggle('moving', (t >= 1 && t < 3) || (t >= 5 && t < 6.4));
      stage.classList.toggle('busy', t >= 3 && t < 5);
      if (t < 1) say('Two encrypted numbers are waiting…');
      else if (t < 3) say('Sending enc(3) and enc(4) to CoFHE…');
      else if (t < 5) say('Computing FHE.add(enc(3), enc(4)). Nothing is decrypted.');
      else if (t < 6.4) say('Out comes enc(7). Still encrypted.');
      else if (t < 7.6) say('Only an address with access can decrypt it…');
      else if (t < 10.4) say('Decrypted for its owner: 7');
      else say('Two encrypted numbers are waiting…');
    };
    readU();
    document.addEventListener('fhecat:rebuild', readU);
    window.addEventListener('resize', readU);
    if (reduce) {
      render(8.5);
      return;
    }
    var t = 0;
    var running = false;
    watch(stage, function (on) {
      running = on;
    });
    setInterval(function () {
      if (!running || document.hidden) return;
      t = (t + 0.1) % T;
      render(t);
    }, 100);
    render(0);
  }

  // ---------------------------------------------------------------------------
  // 03 · The star sky: every star is a cat; hovering shows what the chain sees.
  // ---------------------------------------------------------------------------
  // A cat-head constellation (ears, cheeks, chin) plus two eyes, in 8px units.
  var CONST = [
    [6, 14], [9, 3], [15, 10], [23, 10], [29, 3], [32, 14], [30, 24], [19, 29], [8, 24]
  ];
  var CONST_EYES = [[14, 17], [24, 17]];

  function skybox() {
    var box = $('#skybox');
    var field = $('#skyStars');
    var card = $('#peekcard');
    var dnaEl = $('#peekDna');
    var reticle = $('#reticle');
    var count = $('#skyCount');
    var stars = [];
    var hovering = false;

    var build = function () {
      field.innerHTML = '';
      stars = [];
      var bw = box.clientWidth;
      var bh = box.clientHeight;
      var r = NS.scene.rng(20);
      // constellation first: lines in 4px pixels, stars on top
      var unit = bw < 600 ? 5 : 8;
      var cw = 38 * unit;
      var ch = 32 * unit;
      var ox = Math.round((bw < 600 ? (bw - cw) / 2 : bw * 0.62) / 4) * 4;
      var oy = Math.round((bh - ch) / 2 / 4) * 4;
      var W = Math.ceil(bw / 4);
      var H = Math.ceil(bh / 4);
      var lines = P.el('svg', {
        viewBox: '0 0 ' + W + ' ' + H,
        width: W * 4,
        height: H * 4,
        'shape-rendering': 'crispEdges',
        class: 'const'
      });
      var pts = CONST.map(function (p) {
        return [Math.round((ox + p[0] * unit) / 4), Math.round((oy + p[1] * unit) / 4)];
      });
      var segs = [];
      pts.forEach(function (a, i) {
        var b = pts[(i + 1) % pts.length];
        var g = P.el('g', { class: 'seg', style: 'visibility:hidden' });
        // Bresenham, skipping the pixels right next to the stars
        var x0 = a[0], y0 = a[1], x1 = b[0], y1 = b[1];
        var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
        var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        var err = dx + dy;
        var k = 0;
        var len = Math.max(dx, -dy);
        for (;;) {
          if (k > 1 && k < len - 1 && k % 2 === 0) g.appendChild(P.el('rect', { x: x0, y: y0, width: 1, height: 1, fill: '#2a4c66' }));
          if (x0 === x1 && y0 === y1) break;
          var e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
          k++;
        }
        lines.appendChild(g);
        segs.push(g);
      });
      field.appendChild(lines);
      var addStar = function (x, y, opts) {
        var s = document.createElement('span');
        s.className = 'star' + (opts.big ? ' big' : '') + (opts.tw ? ' twinkle' : '');
        s.style.left = x + 'px';
        s.style.top = y + 'px';
        s.style.setProperty('--c', opts.c);
        if (opts.tw) {
          s.style.setProperty('--tw', opts.tw + 's');
          s.style.setProperty('--td', -opts.td + 's');
        }
        s.dataset.dna = '0x' + hex(6, r) + '…' + hex(4, r);
        field.appendChild(s);
        stars.push(s);
        return s;
      };
      pts.forEach(function (p) {
        addStar(p[0] * 4, p[1] * 4, { big: true, c: '#5e7b9d' });
      });
      CONST_EYES.forEach(function (p) {
        addStar(Math.round((ox + p[0] * unit) / 4) * 4, Math.round((oy + p[1] * unit) / 4) * 4, { c: '#0df3ff', tw: 2.2, td: 0 });
      });
      var n = Math.round((bw * bh) / 3000);
      for (var i = 0; i < n; i++) {
        var x = 8 + Math.floor(r() * (bw - 16) / 4) * 4;
        var y = 8 + Math.floor(r() * (bh - 16) / 4) * 4;
        // keep the constellation readable
        if (x > ox - 12 && x < ox + cw + 12 && y > oy - 12 && y < oy + ch + 12) continue;
        var big = r() < 0.1;
        addStar(x, y, { big: big, c: r() < 0.3 ? '#2c6989' : '#1b698b', tw: r() < 0.5 ? 2 + r() * 4 : 0, td: r() * 5 });
      }
      count.textContent = stars.length + ' stars · ' + stars.length + ' encrypted · 0 revealed';
      // draw the constellation one line at a time once it's on screen
      var drawn = false;
      watch(box, function (on) {
        if (!on || drawn) return;
        drawn = true;
        segs.forEach(function (g, i) {
          setTimeout(function () {
            g.style.visibility = 'visible';
          }, reduce ? 0 : 400 + i * 180);
        });
      });
    };

    var show = function (star) {
      stars.forEach(function (s) {
        s.classList.toggle('hot', s === star);
      });
      if (!star) {
        card.classList.remove('on');
        reticle.classList.remove('on');
        return;
      }
      var x = parseInt(star.style.left, 10);
      var y = parseInt(star.style.top, 10);
      reticle.style.transform = 'translate(' + (x - 18) + 'px,' + (y - 18) + 'px)';
      reticle.classList.add('on');
      dnaEl.textContent = star.dataset.dna;
      card.classList.add('on');
      var cw = card.offsetWidth;
      var chh = card.offsetHeight;
      var bw = box.clientWidth;
      var bh = box.clientHeight;
      var left = x + 32 + cw > bw - 8 ? x - 32 - cw : x + 32;
      var top = Math.max(12, Math.min(bh - chh - 12, y - chh / 2));
      card.style.transform = 'translate(' + Math.round(Math.max(12, left) / 4) * 4 + 'px,' + Math.round(top / 4) * 4 + 'px)';
    };

    build();
    document.addEventListener('fhecat:rebuild', build);
    field.addEventListener('pointerover', function (e) {
      if (e.target.classList.contains('star')) {
        hovering = true;
        show(e.target);
      }
    });
    field.addEventListener('pointerleave', function () {
      hovering = false;
      show(null);
    });
    field.addEventListener('click', function (e) {
      if (e.target.classList.contains('star')) {
        hovering = true;
        show(e.target);
        clearTimeout(skybox._t);
        skybox._t = setTimeout(function () {
          hovering = false;
        }, 4000);
      }
    });

    // When nobody is looking, a scanner checks random stars on its own.
    if (reduce) return;
    var visible = false;
    watch(box, function (on) {
      visible = on;
    });
    setInterval(function () {
      if (!visible || hovering || document.hidden || !stars.length) return;
      var star = stars[(Math.random() * stars.length) | 0];
      show(star);
      setTimeout(function () {
        if (!hovering) show(null);
      }, 1700);
    }, 2600);
  }

  // ---------------------------------------------------------------------------
  // 04 · The night walk: a cat walks the path as you scroll; lanterns light up.
  // ---------------------------------------------------------------------------
  function nightWalk() {
    var path = $('#path');
    var walker = $('#walker');
    var stops = $$('.stop', path);
    var mobile = window.matchMedia('(max-width: 860px)');
    stops[0].classList.add('lit');
    var last = null;
    var stopTimer = null;
    var update = function () {
      if (mobile.matches) {
        stops.forEach(function (s, i) {
          if (i === 0) return;
          var r = s.getBoundingClientRect();
          s.classList.toggle('lit', r.top < window.innerHeight * 0.7);
        });
        return;
      }
      var r = path.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = Math.max(0, Math.min(1, (vh * 0.8 - r.top) / (vh * 0.6)));
      var max = path.clientWidth - walker.offsetWidth;
      var x = Math.round((p * max) / 8) * 8;
      if (last !== null && x !== last && !reduce) {
        walker.classList.add('walking');
        walker.classList.toggle('back', x < last);
        clearTimeout(stopTimer);
        stopTimer = setTimeout(function () {
          walker.classList.remove('walking');
        }, 200);
      }
      last = x;
      walker.style.transform = 'translateX(' + x + 'px)';
      var head = x + walker.offsetWidth - 20;
      stops.forEach(function (s, i) {
        if (i === 0) return;
        s.classList.toggle('lit', head >= s.offsetLeft + 28);
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // ---------------------------------------------------------------------------
  // 05 · Encrypted inbox: every answer is ciphertext until you decrypt it.
  // ---------------------------------------------------------------------------
  function inbox() {
    var msgs = $$('.msg');
    var countEl = $('#inboxCount');
    var cipherFor = function (text, seed) {
      var r = NS.scene.rng(seed);
      var out = [];
      var n = Math.max(24, Math.round(text.length / 2));
      for (var i = 0; i < n; i++) out.push(hex(4, r));
      return out.join(' ');
    };
    var refresh = function () {
      var closed = msgs.filter(function (m) {
        return !m.classList.contains('open');
      }).length;
      countEl.textContent = closed ? closed + ' encrypted' : 'all decrypted';
    };
    msgs.forEach(function (m, i) {
      var btn = $('.msg-q', m);
      var act = $('.msg-act', m);
      var a = $('.msg-a', m);
      var text = a.getAttribute('data-answer');
      var cipher = cipherFor(text, 31 + i * 17);
      a.innerHTML = '';
      var sr = document.createElement('span');
      sr.className = 'sr';
      sr.textContent = text;
      var vis = document.createElement('span');
      vis.setAttribute('aria-hidden', 'true');
      vis.textContent = cipher;
      a.appendChild(sr);
      a.appendChild(vis);
      btn.addEventListener('click', function () {
        var open = !m.classList.contains('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        act.textContent = open ? 'Decrypted' : 'Decrypt';
        if (open) {
          m.classList.add('open');
          decryptText(vis, text);
        } else {
          encryptText(vis, function () {
            m.classList.remove('open');
            vis.textContent = cipher;
          });
        }
        refresh();
      });
    });
    refresh();
  }

  // ---------------------------------------------------------------------------
  // Scroll reveals, starfields, cloud ribbons, little extras
  // ---------------------------------------------------------------------------
  function reveals() {
    var els = $$('.copy, .specimen, .stage, .captions li, .aside, .skybox, .facts, .stop, .inbox, .finale-inner');
    if (reduce || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('in');
          io.unobserve(e.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    els.forEach(function (el, k) {
      if (inView(el)) return;
      el.classList.add('rv');
      el.style.transitionDelay = (k % 3) * 80 + 'ms';
      io.observe(el);
    });
  }

  function skies() {
    var paint = function () {
      $$('[data-stars]').forEach(function (el, i) {
        NS.scene.starfield(el, parseFloat(el.getAttribute('data-stars')) || 1, 50 + i * 11);
      });
      $$('[data-clouds]').forEach(function (el) {
        NS.scene.ribbon(el, +el.getAttribute('data-clouds'));
      });
    };
    paint();
    document.addEventListener('fhecat:rebuild', paint);
  }

  function toast(text) {
    var t = $('#toast');
    clearTimeout(toast._t);
    t.classList.add('on');
    decryptText(t, text);
    toast._t = setTimeout(function () {
      t.classList.remove('on');
    }, 2600);
  }

  // Type "reveal" anywhere. The cats will not cooperate.
  function easterEggs() {
    var typed = '';
    document.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('input,textarea')) return;
      if (!e.key || e.key.length !== 1) return;
      typed = (typed + e.key.toLowerCase()).slice(-12);
      if (/reveal$/.test(typed)) toast('Nice try. Still encrypted.');
      else if (/meow$/.test(typed)) toast('Mrrp. (That was encrypted too.)');
    });
  }

  // ---------------------------------------------------------------------------
  function start() {
    P.mountAll(NS.sprites);
    wordmarks();
    var hero = NS.scene.init($('.hero'), { moon: 'left', tapPaws: true });
    NS.scene.init($('.finale'), { moon: 'right', back: true, catAt: 0.8, seed: 0x5eed });
    heroCat(hero);
    topbar();
    ticker();
    skies();
    headings();
    specimen();
    machine();
    skybox();
    nightWalk();
    inbox();
    reveals();
    easterEggs();
    $('#year').textContent = String(new Date().getFullYear());
    document.documentElement.classList.add('ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
