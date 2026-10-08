/*
 * fhecat.com/admin, the Arena tab: the Blind Arena on the testnet, live from the
 * chain (GET /api/admin?view=arena). Open challenges, duels waiting for a result,
 * the latest results, this week's table and tier proofs; refreshed every 30
 * seconds while the tab is open. Playing happens in the test mint copy
 * (admin/mint/#arena), with a wallet.
 * Uses js/admin.js for the session and helpers (window.FheCat.admin).
 */
(function () {
  'use strict';

  var NS = window.FheCat;
  var A = NS.admin;
  var el = A.el;
  var REFRESH = 30000;

  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var av = { data: null, offset: 0, timer: 0, loading: null };

  // ---------------------------------------------------------------------------
  // time
  // ---------------------------------------------------------------------------
  /** Chain time now, from the last answer (unix seconds). */
  function now() {
    return Date.now() / 1000 + av.offset;
  }
  /** "2d 4h", "3h 20m", "12m". */
  function span(s) {
    s = Math.max(0, Math.floor(s));
    var d = Math.floor(s / 86400);
    var h = Math.floor((s % 86400) / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    return Math.max(m, 1) + 'm';
  }
  function ago(t) {
    return span(now() - t) + ' ago';
  }

  // ---------------------------------------------------------------------------
  // loading
  // ---------------------------------------------------------------------------
  function load() {
    if (av.loading) return av.loading;
    if (!av.data) setEmpty('Reading the chain…');
    $('#admArenaRefresh').disabled = true;
    av.loading = A.call('GET', { view: 'arena' })
      .then(function (r) {
        av.data = r;
        av.offset = r.now ? r.now - Date.now() / 1000 : 0;
        render();
      })
      .catch(function (err) {
        if (err.status === 401) return A.fail(err);
        if (av.data) A.toast(err.message);
        else setEmpty(err.message);
      })
      .then(function () {
        av.loading = null;
        $('#admArenaRefresh').disabled = false;
      });
    return av.loading;
  }

  function setEmpty(text) {
    var e = $('#admArenaEmpty');
    e.textContent = text;
    e.hidden = !text;
    $('#admArenaBody').hidden = Boolean(text);
  }

  /** Refresh every 30 s while the tab is on screen and the page is visible. */
  function tick() {
    clearTimeout(av.timer);
    av.timer = setTimeout(function () {
      if (!$('#admArena').hidden && !document.hidden) load().then(tick);
      else tick();
    }, REFRESH);
  }

  // ---------------------------------------------------------------------------
  // render
  // ---------------------------------------------------------------------------
  function cat(id) {
    return el('b', 'adm-a-cat', '#' + id);
  }
  function chip(box) {
    return box ? el('span', 'adm-a-chip is-' + box.toLowerCase(), box) : null;
  }
  function row(cls, parts, meta) {
    var li = el('li', 'adm-a-row' + (cls ? ' ' + cls : ''));
    var main = el('span', 'adm-a-main');
    parts.forEach(function (p) {
      if (p === null || p === undefined) return;
      main.appendChild(typeof p === 'string' ? document.createTextNode(p) : p);
    });
    li.appendChild(main);
    if (meta) li.appendChild(el('span', 'adm-a-meta', meta));
    return li;
  }
  function list(id, items, empty) {
    var ol = $(id);
    ol.textContent = '';
    if (!items.length) ol.appendChild(el('li', 'adm-a-none', empty));
    items.forEach(function (li) {
      ol.appendChild(li);
    });
  }

  function render() {
    var r = av.data;
    if (!r.arena) return setEmpty('No arena is set on the testnet collection.');
    setEmpty('');
    var t = r.totals;

    $$('[data-acount]').forEach(function (n) {
      n.textContent = A.fmt(t[n.getAttribute('data-acount')]);
    });
    $('[data-anote="sealed"]').textContent = A.fmt(t.sealedWins) + ' won with a sealed box';
    $('[data-anote="badges"]').textContent = A.fmt(t.badges) + ' badges earned';
    var badge = $('#admArenaTab');
    badge.textContent = String(t.open);
    badge.hidden = !t.open;
    $('#admArenaWeek').textContent = 'Week ends in ' + span(r.weekEnd - now());

    // This week's table.
    var board = $('#admArenaBoard');
    board.textContent = '';
    if (!r.board.length) board.appendChild(el('li', 'adm-a-none', 'No points this week yet. The table resets every Monday, 00:00 UTC.'));
    r.board.forEach(function (b, i) {
      var li = el('li', 'adm-a-brow');
      li.appendChild(el('span', 'adm-a-rank', String(i + 1)));
      var who = el('span', 'adm-a-who');
      who.appendChild(cat(b.cat));
      var c = chip(b.box);
      if (c) who.appendChild(c);
      li.appendChild(who);
      li.appendChild(el('span', 'adm-a-wl', b.wins + 'W · ' + b.losses + 'L' + (b.sealedWins ? ' · ' + b.sealedWins + ' sealed' : '')));
      var badges = el('span', 'adm-a-badges');
      b.badges.forEach(function (name) {
        var s = el('span', 'adm-a-badge');
        s.appendChild(A.icon('i-star'));
        s.appendChild(document.createTextNode(name));
        badges.appendChild(s);
      });
      li.appendChild(badges);
      li.appendChild(el('span', 'adm-a-pts', b.points + (b.points === 1 ? ' pt' : ' pts')));
      board.appendChild(li);
    });
    var lw = r.lastWeek;
    $('#admArenaCrown').textContent = lw.champion
      ? 'Last week’s crown: #' + lw.champion + ' (' + lw.points + ' pts)'
      : lw.leader
        ? 'Last week’s leader: #' + lw.leader + ' (' + lw.points + ' pts). The crown goes on with the next result.'
        : 'No duels last week.';

    list(
      '#admArenaOpen',
      r.open.map(function (d) {
        return row('', [cat(d.challenger), el('i', 'adm-a-vs', 'vs'), d.opponent ? cat(d.opponent) : el('span', 'adm-a-any', 'anyone'), chip(d.box)], span(d.endsAt - now()) + ' left');
      }),
      'No open challenges.'
    );

    var waitBox = $('#admArenaWaitBox');
    waitBox.hidden = !r.waiting.length;
    list(
      '#admArenaWait',
      r.waiting.map(function (d) {
        return row('', [cat(d.challenger), el('i', 'adm-a-vs', 'vs'), cat(d.opponent)], 'fought ' + ago(d.foughtAt));
      }),
      ''
    );

    list(
      '#admArenaResults',
      r.results.map(function (d) {
        return row('is-win', [cat(d.winner), ' beat ', cat(d.loser), d.sealed ? el('em', 'adm-a-sealed', 'sealed') : null], ago(d.foughtAt));
      }),
      'No results yet.'
    );

    list(
      '#admArenaClaims',
      r.claims.map(function (c) {
        if (!c.settled) return row('', [cat(c.cat), ' ' + c.tier + '?'], 'waiting');
        return row(c.result ? 'is-win' : '', [cat(c.cat), (c.result ? ' is ' : ' is not ') + c.tier], '');
      }),
      'No tier proofs yet.'
    );

    $('#admArenaAddr').textContent = r.network + ' · arena ' + r.arena.slice(0, 6) + '…' + r.arena.slice(-4);
  }

  $('#admArenaRefresh').addEventListener('click', function () {
    load();
  });

  // ---------------------------------------------------------------------------
  // hooks for js/admin.js and js/admin-collab.js
  // ---------------------------------------------------------------------------
  NS.adminArena = {
    /** The tab is open: read the chain now, then keep it fresh. */
    show: function () {
      load();
      tick();
    },
    /** The panel is on screen: read once, for the open-challenge count on the tab. */
    shown: function () {
      if (!av.data && !av.loading) load();
    },
    reset: function () {
      clearTimeout(av.timer);
      av = { data: null, offset: 0, timer: 0, loading: null };
      $('#admArenaTab').hidden = true;
    }
  };
})();
