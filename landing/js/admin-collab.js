/*
 * fhecat.com/admin, the Collabs tab: communities that applied at /collab.
 * Approve one with a number of WL spots and the hours its manager gets to
 * add the winners; reject it or send it back to pending; reopen a submitted
 * list; see and copy the winners. The allowlist export joins the approved
 * waitlist wallets with every approved collab's winners. The switch at the top
 * opens or closes new applications (and the homepage's Collab button with them).
 * Uses js/admin.js for the session and helpers (window.FheCat.admin).
 */
(function () {
  'use strict';

  var NS = window.FheCat;
  var A = NS.admin;
  var SPOT = 'WL';
  // "community" is no longer offered; older applications may still carry it.
  var KIND = { dao: 'DAO', community: 'COMM', guild: 'GUILD', alpha: 'ALPHA', nft: 'NFT', other: 'OTHER' };
  var KIND_NAME = { dao: 'DAO', community: 'Community', guild: 'Guild', alpha: 'Alpha group', nft: 'NFT project', other: 'Other' };
  var ROLE = { founder: 'Founder', cm: 'Community manager', mod: 'Moderator', other: 'Other' };
  var STATUS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
  var HANDLE = /^[A-Za-z0-9_]{1,15}$/;

  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  var el = A.el;

  // applying: whether /collab takes new applications (null until loaded).
  var cv = { list: [], counts: null, status: '', q: '', offset: 0, loaded: false, open: {}, applying: null };

  // ---------------------------------------------------------------------------
  // tabs
  // ---------------------------------------------------------------------------
  function tab(name) {
    $$('.adm-tab').forEach(function (b) {
      var on = b.getAttribute('data-tab') === name;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      $('#' + b.getAttribute('aria-controls')).hidden = !on;
    });
    if (name === 'collabs') load();
    // The arena tab lives in js/admin-arena.js.
    if (name === 'arena' && NS.adminArena) NS.adminArena.show();
  }
  $$('.adm-tab').forEach(function (b) {
    b.addEventListener('click', function () {
      tab(b.getAttribute('data-tab'));
    });
  });

  // ---------------------------------------------------------------------------
  // loading
  // ---------------------------------------------------------------------------
  var loading = null;
  function load() {
    if (loading) return loading;
    if (!cv.loaded) setEmpty('Decrypting…');
    loading = A.call('GET', { view: 'collabs' })
      .then(function (r) {
        cv.list = r.collabs || [];
        cv.counts = r.counts;
        cv.offset = Date.parse(r.now) - Date.now();
        cv.applying = r.open !== false;
        cv.loaded = true;
        render();
      })
      .catch(function (err) {
        if (err.status === 401) return A.fail(err);
        setEmpty(err.message);
      })
      .then(function () {
        loading = null;
      });
    return loading;
  }

  function setEmpty(text) {
    var e = $('#admCollabEmpty');
    e.textContent = text;
    e.hidden = !text;
  }

  // ---------------------------------------------------------------------------
  // render
  // ---------------------------------------------------------------------------
  function now() {
    return Date.now() + cv.offset;
  }
  function isOpen(c) {
    return c.status === 'approved' && !c.submittedAt && c.deadline && Date.parse(c.deadline) > now();
  }
  function left(c) {
    var s = Math.max(0, Math.floor((Date.parse(c.deadline) - now()) / 1000));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
  }

  function render() {
    var c = cv.counts || { total: 0, pending: 0, approved: 0, rejected: 0, submitted: 0 };
    $$('[data-ccount]').forEach(function (n) {
      n.textContent = A.fmt(c[n.getAttribute('data-ccount')]);
    });
    $('[data-ccount-note="submitted"]').textContent = A.fmt(c.submitted) + ' submitted';
    $$('#admCollabs .adm-stat').forEach(function (b) {
      var on = b.getAttribute('data-cstatus') === cv.status;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var badge = $('#admCollabTab');
    badge.hidden = !c.pending;
    badge.textContent = A.fmt(c.pending);
    renderSwitch();

    var q = cv.q.toLowerCase().replace(/^@/, '');
    var rows = cv.list.filter(function (x) {
      if (cv.status && x.status !== cv.status) return false;
      if (!q) return true;
      return [x.name, x.x, x.contactX, x.manager, x.contactDiscord].some(function (v) {
        return String(v || '').toLowerCase().indexOf(q) !== -1;
      });
    });
    var list = $('#admCollabList');
    list.textContent = '';
    rows.forEach(function (x) {
      list.appendChild(card(x));
    });
    $('#admCollabShown').textContent = rows.length ? 'Showing ' + A.fmt(rows.length) + ' of ' + A.fmt(cv.list.length) : '';
    setEmpty(
      rows.length
        ? ''
        : q
          ? 'Nothing matches “' + cv.q + '”.'
          : cv.status
            ? 'No ' + STATUS[cv.status].toLowerCase() + ' collabs.'
            : 'No collab applications yet. Communities apply at fhecat.com/collab.'
    );
  }

  function link(text, href) {
    var a = el('a', 'adm-link', text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.appendChild(A.icon('i-ext'));
    return a;
  }
  function fact(k, v) {
    var d = el('div', 'adm-c-fact');
    d.appendChild(el('span', 'adm-c-k', k));
    if (typeof v === 'string') d.appendChild(el('span', 'adm-c-v', v));
    else d.appendChild(v);
    return d;
  }
  function group(nodes) {
    var span = el('span', 'adm-c-v');
    nodes.forEach(function (n, i) {
      if (i) span.appendChild(document.createTextNode(' · '));
      span.appendChild(typeof n === 'string' ? document.createTextNode(n) : n);
    });
    return span;
  }

  /** A post on X as a link, with a flag when none of `accounts` posted it. */
  function post(url, accounts, flag) {
    var by = (/^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/status\//.exec(url) || [])[1];
    var known = by && by !== 'i';
    var parts = [link(known ? 'Post by @' + by : 'Post on X', url)];
    var theirs = accounts.some(function (a) {
      return by && by.toLowerCase() === String(a || '').toLowerCase();
    });
    if (known && !theirs) parts.push(flag);
    return group(parts);
  }
  /** The application's post about FheCat (older applications have none). */
  function applyPost(x) {
    return x.post ? post(x.post, [x.x, x.contactX], 'not the community or the manager') : 'None, an older application';
  }
  /** The raffle post's link, and a flag when it isn't from the community's account. */
  function raffle(x) {
    return x.tweet ? post(x.tweet, [x.x], "not the community's account") : 'Not added yet';
  }

  function card(x) {
    var li = el('li', 'adm-collab is-' + x.status);
    li.setAttribute('data-id', x.id);

    var head = el('div', 'adm-c-head');
    head.appendChild(el('span', 'cb-kind', KIND[x.kind] || 'COMM'));
    head.appendChild(el('b', 'adm-c-name', x.name));
    var st = el('span', 'adm-status');
    st.appendChild(el('i', 'adm-dot is-' + x.status));
    st.appendChild(document.createTextNode(x.status === 'approved' && x.submittedAt ? 'Submitted' : STATUS[x.status] || x.status));
    head.appendChild(st);
    var at = el('time', 'adm-c-when', '#' + x.id + ' · ' + A.when(x.createdAt));
    at.dateTime = x.createdAt;
    head.appendChild(at);
    li.appendChild(head);

    var facts = el('div', 'adm-c-facts');
    var community = [HANDLE.test(x.x) ? link('@' + x.x, 'https://x.com/' + x.x) : '@' + x.x];
    if (x.discord) community.push(link('Discord', x.discord));
    if (x.website) community.push(link('Website', x.website));
    facts.appendChild(fact('Community', group(community)));
    facts.appendChild(fact('Type · size', (KIND_NAME[x.kind] || x.kind) + ' · ' + A.fmt(x.members) + ' members'));
    var manager = [HANDLE.test(x.contactX) ? link('@' + x.contactX, 'https://x.com/' + x.contactX) : '@' + x.contactX, ROLE[x.role] || x.role];
    if (x.contactDiscord) manager.push('Discord ' + x.contactDiscord);
    facts.appendChild(fact('Manager', group(manager)));
    var wallet = el('span', 'adm-c-v adm-c-mgr');
    var addr = el('span', 'adm-addr', x.manager.slice(0, 6) + '…' + x.manager.slice(-4));
    addr.title = x.manager;
    var copy = el('button', 'adm-icon');
    copy.type = 'button';
    copy.title = 'Copy wallet';
    copy.setAttribute('aria-label', "Copy the manager's wallet");
    copy.appendChild(A.icon('i-copy'));
    copy.addEventListener('click', function () {
      A.copyText(x.manager);
    });
    wallet.appendChild(addr);
    wallet.appendChild(copy);
    facts.appendChild(fact('Signed in as', wallet));
    facts.appendChild(fact('Post', applyPost(x)));
    // Older applications asked for a number of spots; the form no longer does.
    if (x.requested > 0) facts.appendChild(fact('Asked for', x.requested + ' ' + SPOT + ' spots'));
    if (x.status === 'approved') {
      var progress = x.winners.length + '/' + x.spots + ' ' + SPOT;
      progress += x.submittedAt ? ' · submitted ' + A.when(x.submittedAt) : isOpen(x) ? ' · ' + left(x) + ' left' : " · time's up, not submitted";
      facts.appendChild(fact('Winners', progress));
      facts.appendChild(fact('Raffle post', raffle(x)));
    }
    li.appendChild(facts);
    li.appendChild(el('p', 'adm-c-pitch', x.pitch));

    // review
    var act = el('div', 'adm-c-act');
    var spots = el('input', 'adm-c-in');
    spots.type = 'number';
    spots.min = '1';
    spots.max = '500';
    spots.value = x.status === 'approved' ? String(x.spots) : x.requested > 0 ? String(x.requested) : '';
    spots.placeholder = '10';
    spots.setAttribute('aria-label', 'WL spots for ' + x.name);
    var hours = el('input', 'adm-c-in');
    hours.type = 'number';
    hours.min = '1';
    hours.max = '720';
    hours.value = '48';
    hours.setAttribute('aria-label', 'Hours to submit for ' + x.name);
    var spotsLabel = el('label', 'adm-c-field');
    spotsLabel.appendChild(el('span', '', SPOT + ' spots'));
    spotsLabel.appendChild(spots);
    var hoursLabel = el('label', 'adm-c-field');
    hoursLabel.appendChild(el('span', '', x.status === 'approved' ? 'New deadline in (h)' : 'Hours to submit'));
    hoursLabel.appendChild(hours);
    act.appendChild(spotsLabel);
    act.appendChild(hoursLabel);
    var reopen = null;
    if (x.status === 'approved' && x.submittedAt) {
      var r = el('label', 'adm-c-check');
      reopen = el('input');
      reopen.type = 'checkbox';
      r.appendChild(reopen);
      r.appendChild(document.createTextNode('Reopen the list'));
      act.appendChild(r);
    }
    var approve = el('button', 'adm-btn is-approve');
    approve.type = 'button';
    approve.appendChild(A.icon('i-check'));
    approve.appendChild(document.createTextNode(x.status === 'approved' ? 'Update' : 'Approve'));
    approve.addEventListener('click', function () {
      review(x, 'approved', approve, { spots: Number(spots.value), hours: Number(hours.value), reopen: !!(reopen && reopen.checked) });
    });
    act.appendChild(approve);
    if (x.status !== 'rejected') {
      var reject = el('button', 'adm-btn is-reject');
      reject.type = 'button';
      reject.appendChild(A.icon('i-cross'));
      reject.appendChild(document.createTextNode('Reject'));
      reject.addEventListener('click', function () {
        review(x, 'rejected', reject);
      });
      act.appendChild(reject);
    }
    if (x.status !== 'pending') {
      var back = el('button', 'adm-btn');
      back.type = 'button';
      back.appendChild(A.icon('i-back'));
      back.appendChild(document.createTextNode('Pending'));
      back.addEventListener('click', function () {
        review(x, 'pending', back);
      });
      act.appendChild(back);
    }
    if (x.winners.length) {
      var show = el('button', 'adm-btn is-plain', (cv.open[x.id] ? 'Hide' : 'Show') + ' winners (' + x.winners.length + ')');
      show.type = 'button';
      show.addEventListener('click', function () {
        cv.open[x.id] = !cv.open[x.id];
        li.replaceWith(card(x));
      });
      act.appendChild(show);
    }
    li.appendChild(act);

    if (cv.open[x.id] && x.winners.length) {
      var ol = el('ol', 'adm-c-winners');
      x.winners.forEach(function (w) {
        var row = el('li');
        row.appendChild(el('span', 'adm-c-wname', w.name));
        var wa = el('span', 'adm-c-wallet', w.wallet);
        row.appendChild(wa);
        ol.appendChild(row);
      });
      li.appendChild(ol);
      var copyAll = el('button', 'adm-btn is-plain');
      copyAll.type = 'button';
      copyAll.appendChild(A.icon('i-copy'));
      copyAll.appendChild(document.createTextNode('Copy wallets'));
      copyAll.addEventListener('click', function () {
        A.copyText(
          x.winners
            .map(function (w) {
              return w.wallet;
            })
            .join('\n')
        );
      });
      li.appendChild(copyAll);
    }
    return li;
  }

  function review(x, status, btn, extra) {
    var body = { action: 'collab', id: x.id, status: status };
    if (extra) {
      body.spots = extra.spots;
      body.hours = extra.hours;
      body.reopen = extra.reopen;
    }
    btn.disabled = true;
    A.call('POST', null, body)
      .then(function (r) {
        for (var i = 0; i < cv.list.length; i++) if (cv.list[i].id === r.collab.id) cv.list[i] = r.collab;
        recount();
        render();
        A.toast(
          status === 'approved'
            ? r.collab.name + ': ' + r.collab.spots + ' ' + SPOT + ' · ' + (extra && extra.hours) + 'h to submit'
            : r.collab.name + ' ' + (status === 'rejected' ? 'rejected' : 'back to pending')
        );
      })
      .catch(function (err) {
        btn.disabled = false;
        A.fail(err);
      });
  }

  function recount() {
    var c = { total: cv.list.length, pending: 0, approved: 0, rejected: 0, submitted: 0 };
    cv.list.forEach(function (x) {
      c[x.status] += 1;
      if (x.status === 'approved' && x.submittedAt) c.submitted += 1;
    });
    cv.counts = c;
  }

  $$('#admCollabs .adm-stat').forEach(function (b) {
    b.addEventListener('click', function () {
      cv.status = b.getAttribute('data-cstatus');
      render();
    });
  });
  var searchTimer = null;
  $('#admCollabSearch').addEventListener('input', function () {
    var v = this.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      cv.q = v;
      render();
    }, 200);
  });

  // ---------------------------------------------------------------------------
  // applications open or closed
  // ---------------------------------------------------------------------------
  function renderSwitch() {
    var on = cv.applying;
    var state = $('#admCollabState');
    var b = $('#admCollabSwitch');
    $('.adm-dot', state).className = 'adm-dot' + (on === null ? '' : on ? ' is-approved' : ' is-rejected');
    state.lastChild.textContent = on === null ? 'Checking…' : on ? 'Open' : 'Closed';
    b.className = 'btn btn-sm btn-ghost' + (on ? ' is-close' : '');
    b.textContent = on ? 'Close' : 'Open';
    b.setAttribute('aria-label', on ? 'Close collab applications' : 'Open collab applications');
    b.hidden = on === null;
    b.disabled = switching;
  }

  var switching = false;
  $('#admCollabSwitch').addEventListener('click', function () {
    var next = !cv.applying;
    var ask = next
      ? 'Open collab applications? The Collab button comes back on the homepage and new communities can apply.'
      : 'Close collab applications? The homepage hides its Collab button and /collab stops taking new applications. Communities that already applied can still sign in and add their winners.';
    if (!window.confirm(ask)) return;
    switching = true;
    renderSwitch();
    A.call('POST', null, { action: 'collabOpen', open: next })
      .then(function (r) {
        cv.applying = r.open;
        A.toast(r.open ? 'Collab applications are open' : 'Collab applications are closed');
      })
      .catch(A.fail)
      .then(function () {
        switching = false;
        renderSwitch();
      });
  });

  // ---------------------------------------------------------------------------
  // exports
  // ---------------------------------------------------------------------------
  function approved() {
    return cv.list.filter(function (x) {
      return x.status === 'approved';
    });
  }
  function stamp() {
    return new Date().toISOString().slice(0, 10);
  }

  $('#admCollabCsv').addEventListener('click', function () {
    var b = this;
    b.disabled = true;
    load()
      .then(function () {
        var rows = [];
        approved().forEach(function (x) {
          x.winners.forEach(function (w) {
            rows.push([x.id, x.name, 'https://x.com/' + x.x, KIND_NAME[x.kind] || x.kind, x.tweet || '', w.name, w.wallet, x.submittedAt ? 'yes' : 'no', x.submittedAt || '']);
          });
        });
        if (!rows.length) return A.toast('No collab winners yet');
        var head = ['collab', 'community', 'community_x', 'type', 'raffle_post', 'winner', 'wallet', 'submitted', 'submitted_utc'];
        A.save('fhecat-collab-wallets-' + stamp() + '.csv', A.csv([head].concat(rows)), 'text/csv');
        A.toast(A.fmt(rows.length) + ' collab wallets exported');
      })
      .then(function () {
        b.disabled = false;
      });
  });

  $('#admAllowlist').addEventListener('click', function () {
    var b = this;
    b.disabled = true;
    A.toast('Building the allowlist…');
    load()
      .then(function () {
        var drafts = approved().filter(function (x) {
          return !x.submittedAt && x.winners.length;
        });
        var draftCount = drafts.reduce(function (n, x) {
          return n + x.winners.length;
        }, 0);
        var withDrafts =
          !draftCount ||
          window.confirm(
            drafts.length +
              ' approved collab' +
              (drafts.length === 1 ? ' has' : 's have') +
              ' saved ' +
              draftCount +
              ' wallets without submitting. Include them? (Cancel leaves them out.)'
          );
        return A.fetchAll('approved').then(function (waitlist) {
          var seen = {};
          var out = [];
          var add = function (w) {
            var k = String(w).toLowerCase();
            if (/^0x[0-9a-f]{40}$/.test(k) && !seen[k]) {
              seen[k] = true;
              out.push(k);
            }
          };
          waitlist.forEach(function (e) {
            add(e.wallet);
          });
          var fromWaitlist = out.length;
          approved().forEach(function (x) {
            if (!x.submittedAt && !withDrafts) return;
            x.winners.forEach(function (w) {
              add(w.wallet);
            });
          });
          if (!out.length) return A.toast('Nothing to export yet');
          A.save('fhecat-allowlist-' + stamp() + '.txt', out.join('\n') + '\n', 'text/plain');
          A.toast(A.fmt(out.length) + ' wallets · ' + A.fmt(fromWaitlist) + ' waitlist + ' + A.fmt(out.length - fromWaitlist) + ' collab');
        });
      })
      .catch(A.fail)
      .then(function () {
        b.disabled = false;
      });
  });

  // ---------------------------------------------------------------------------
  // hooks for js/admin.js
  // ---------------------------------------------------------------------------
  NS.adminCollab = {
    /** The panel is on screen: fetch the collabs once, for the pending count on the tab. */
    shown: function () {
      if (!cv.loaded) load();
    },
    reset: function () {
      cv = { list: [], counts: null, status: '', q: '', offset: 0, loaded: false, open: {}, applying: null };
      $('#admCollabSearch').value = '';
      $('#admCollabList').textContent = '';
      renderSwitch();
      tab('waitlist');
    }
  };
})();
