/*
 * Wires the page: sprites, the hero sky, language switch and the small
 * animations (decrypting headings, scroll reveals, the cipher window,
 * decryptable cats, the roadmap walker).
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

  // ---------------------------------------------------------------------------
  // Language
  // ---------------------------------------------------------------------------
  var lang = 'tr';
  try {
    lang = localStorage.getItem('fhecat.lang') || (/^tr\b/i.test(navigator.language || '') ? 'tr' : 'en');
  } catch (e) {
    lang = /^tr\b/i.test(navigator.language || '') ? 'tr' : 'en';
  }
  function t(key) {
    return (NS.i18n[lang] && NS.i18n[lang][key]) || NS.i18n.tr[key] || key;
  }
  function applyLang(animate) {
    document.documentElement.lang = lang;
    document.title = t('meta.title');
    $$('[data-i18n]').forEach(function (el) {
      var text = t(el.getAttribute('data-i18n'));
      if (animate && el.hasAttribute('data-decrypt') && inView(el)) decrypt(el, text);
      else el.textContent = text;
    });
    $('#lang').textContent = lang === 'tr' ? 'EN' : 'TR';
    $('#lang').setAttribute('aria-label', lang === 'tr' ? 'Switch to English' : 'Türkçeye geç');
    $$('.cat-card').forEach(updateCatLabel);
  }
  function inView(el) {
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }

  // ---------------------------------------------------------------------------
  // "Decrypting" text: glyphs scramble, then settle left to right.
  // ---------------------------------------------------------------------------
  var GLYPHS = '01<>/#$%&*+=?ABCDEF';
  function decrypt(el, finalText) {
    var text = finalText || el.getAttribute('data-text') || el.textContent;
    el.setAttribute('data-text', text);
    if (reduce) {
      el.textContent = text;
      return;
    }
    clearInterval(el._scramble);
    var chars = Array.from(text);
    var steps = Math.min(26, 8 + chars.length);
    var i = 0;
    el.setAttribute('aria-label', text);
    el._scramble = setInterval(function () {
      i++;
      var settled = Math.floor((i / steps) * chars.length);
      el.textContent = chars
        .map(function (ch, k) {
          if (k < settled || ch === ' ') return ch;
          return GLYPHS[(Math.random() * GLYPHS.length) | 0];
        })
        .join('');
      if (i >= steps) {
        clearInterval(el._scramble);
        el.textContent = text;
        el.removeAttribute('aria-label');
      }
    }, 45);
  }

  // ---------------------------------------------------------------------------
  // Scroll reveals (+ decrypt headings the first time they appear)
  // ---------------------------------------------------------------------------
  function observeReveals() {
    var targets = $$('.reveal, [data-decrypt]');
    if (!('IntersectionObserver' in window) || reduce) {
      targets.forEach(function (el) {
        el.classList.add('in');
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          el.classList.add('in');
          if (el.hasAttribute('data-decrypt')) decrypt(el, el.hasAttribute('data-i18n') ? t(el.getAttribute('data-i18n')) : null);
          io.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    targets.forEach(function (el, k) {
      el.style.setProperty('--delay', (k % 4) * 90 + 'ms');
      io.observe(el);
    });
  }

  // ---------------------------------------------------------------------------
  // About window: a live stream of ciphertext under the logo.
  // ---------------------------------------------------------------------------
  function cipherStream() {
    var box = $('#cipher');
    if (!box) return;
    var hex = '0123456789abcdef';
    var line = function () {
      var s = '0x';
      for (var i = 0; i < 24; i++) s += hex[(Math.random() * 16) | 0];
      return s;
    };
    var lines = [line(), line(), line(), line()];
    box.textContent = lines.join('\n');
    if (reduce) return;
    setInterval(function () {
      if (!inView(box)) return;
      lines.shift();
      lines.push(line());
      box.textContent = lines.join('\n');
    }, 450);
  }

  // ---------------------------------------------------------------------------
  // Collection teaser: encrypted cats that decrypt on hover / tap.
  // ---------------------------------------------------------------------------
  var TOKEN_IDS = ['007', '042', '128', '256', '404', '512', '777', '999'];
  function updateCatLabel(card) {
    var open = card.classList.contains('is-open');
    $('.cat-state', card).textContent = open ? t('cat.' + card.getAttribute('data-cat')) : t('collection.encrypted');
    card.setAttribute('aria-pressed', open ? 'true' : 'false');
  }
  function buildCats() {
    var gridEl = $('#catGrid');
    if (!gridEl) return;
    NS.SAMPLE_CATS.forEach(function (name, i) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'cat-card reveal';
      card.setAttribute('data-cat', name);
      card.appendChild(P.svg(NS.sampleCat(name, 11 + i * 7), { cls: 'sample' }));
      var label = document.createElement('span');
      label.className = 'cat-label';
      label.innerHTML = '<b>#' + TOKEN_IDS[i] + '</b><span class="cat-state"></span>';
      card.appendChild(label);
      var set = function (open) {
        card.classList.toggle('is-open', open);
        updateCatLabel(card);
      };
      // Mouse: hover peeks, click pins. Touch and keyboard: each tap toggles.
      card.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse') return;
        card._hover = true;
        set(true);
      });
      card.addEventListener('pointerleave', function (e) {
        if (e.pointerType !== 'mouse') return;
        card._hover = false;
        if (!card._pinned) set(false);
      });
      card.addEventListener('click', function () {
        card._pinned = !card._pinned;
        set(card._pinned || card._hover);
      });
      gridEl.appendChild(card);
      updateCatLabel(card);
    });

    // Every few seconds one cat decrypts by itself, then hides again.
    if (reduce) return;
    setInterval(function () {
      if (!inView(gridEl) || document.hidden) return;
      var idle = $$('.cat-card', gridEl).filter(function (c) {
        return !c._hover && !c._pinned && !c.classList.contains('is-open');
      });
      if (!idle.length) return;
      var card = idle[(Math.random() * idle.length) | 0];
      card.classList.add('is-open');
      updateCatLabel(card);
      setTimeout(function () {
        if (card._hover || card._pinned) return;
        card.classList.remove('is-open');
        updateCatLabel(card);
      }, 1800);
    }, 2600);
  }

  // ---------------------------------------------------------------------------
  // Roadmap: a cat walks along the track as the page scrolls.
  // ---------------------------------------------------------------------------
  function roadmapWalker() {
    var track = $('#track');
    var walker = $('#walker');
    if (!track || !walker) return;
    var phases = $$('.phase');
    var last = null;
    var stopTimer = null;
    var update = function () {
      var r = track.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (vh * 0.7)));
      var max = track.clientWidth - walker.offsetWidth;
      var x = Math.round(p * max);
      if (last !== null && x !== last) {
        walker.classList.add('walking');
        walker.classList.toggle('backwards', x < last);
        clearTimeout(stopTimer);
        stopTimer = setTimeout(function () {
          walker.classList.remove('walking');
        }, 160);
      }
      last = x;
      walker.style.transform = 'translateX(' + x + 'px)';
      var reached = (x + walker.offsetWidth * 0.8) / track.clientWidth;
      phases.forEach(function (ph, i) {
        ph.classList.toggle('passed', reached >= (i + 0.5) / phases.length);
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // ---------------------------------------------------------------------------
  // Cloud dividers between sections: one seamless pixel tile, repeated.
  // ---------------------------------------------------------------------------
  function cloudTile() {
    var W = 64;
    var H = 14;
    var rows = [];
    var tops = [];
    for (var x = 0; x < W; x++) {
      var a = (x / W) * Math.PI * 2;
      var h = 7 + 3.5 * Math.sin(a + 0.6) + 2 * Math.sin(a * 2 + 2.1) + 0.8 * Math.sin(a * 3);
      tops.push(Math.round(H - h));
    }
    for (var y = 0; y < H; y++) {
      var r = '';
      for (var x2 = 0; x2 < W; x2++) r += y < tops[x2] ? '.' : y === tops[x2] ? 'H' : 'Z';
      rows.push(r);
    }
    var pal = Object.assign({}, P.PALETTE, { Z: '#021f36' });
    var svg = P.svg(rows, { palette: pal });
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg.outerHTML) + '")';
  }

  // ---------------------------------------------------------------------------
  // Mobile menu
  // ---------------------------------------------------------------------------
  function menu() {
    var btn = $('#menuBtn');
    var nav = $('#nav');
    btn.addEventListener('click', function () {
      var open = document.body.classList.toggle('menu-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('a', nav).forEach(function (a) {
      a.addEventListener('click', function () {
        document.body.classList.remove('menu-open');
        btn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function topbar() {
    var bar = $('.topbar');
    var onScroll = function () {
      bar.classList.toggle('scrolled', window.scrollY > 24);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---------------------------------------------------------------------------
  function start() {
    P.mountAll(NS.sprites);
    NS.scene.init($('.hero'));
    buildCats();
    applyLang(false);
    $('#lang').addEventListener('click', function () {
      lang = lang === 'tr' ? 'en' : 'tr';
      try {
        localStorage.setItem('fhecat.lang', lang);
      } catch (e) {
        /* private mode */
      }
      applyLang(true);
    });
    var tile = cloudTile();
    $$('[data-divider]').forEach(function (d) {
      d.style.backgroundImage = tile;
    });
    $('#year').textContent = String(new Date().getFullYear());
    cipherStream();
    menu();
    topbar();
    roadmapWalker();
    observeReveals();
    document.documentElement.classList.add('ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
