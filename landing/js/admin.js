/*
 * fhecat.com/admin: review waitlist applications and export them.
 * Everything goes through api/admin, which holds the session cookie. Without
 * the password the API only answers 401, so this page shows the sign-in box.
 * Exports are built here from the API pages: applications as CSV, wallets
 * as CSV or plain text (one address per line), for the current status tab.
 */
(function () {
  'use strict';

  var NS = window.FheCat;
  var P = NS.pixel;
  var API = 'api/admin';
  var PAGE = 100;
  var STATUS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
  // What each row offers, given its status now.
  var ACTIONS = { pending: ['approved', 'rejected'], approved: ['rejected', 'pending'], rejected: ['approved', 'pending'] };
  var VERB = {
    approved: { icon: 'i-check', text: 'Approve', cls: 'is-approve', done: 'approved' },
    rejected: { icon: 'i-cross', text: 'Reject', cls: 'is-reject', done: 'rejected' },
    pending: { icon: 'i-back', text: 'Pending', cls: '', done: 'back to pending' }
  };
  var HANDLE = /^[A-Za-z0-9_]{1,15}$/;
  var POST_URL = /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{1,25}$/;

  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var view = { status: '', q: '', rows: [], next: null, counts: null, sel: {} };
  var seq = 0; // answers to superseded list requests are dropped

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function icon(name) {
    return P.svg(NS.sprites[name], { cls: 'sprite-' + name });
  }
  function fmt(n) {
    return Number(n || 0).toLocaleString('en-US');
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var pad = function (n) {
    return (n < 10 ? '0' : '') + n;
  };
  /** "29 Sep 22:05" in the viewer's time zone. */
  function when(iso) {
    var d = new Date(iso);
    return pad(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function toast(text) {
    var t = $('#toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      t.classList.remove('on');
    }, 2600);
  }

  function call(method, params, body) {
    var url = API;
    if (params) {
      var sp = new URLSearchParams();
      Object.keys(params).forEach(function (k) {
        if (params[k] !== '' && params[k] !== null && params[k] !== undefined) sp.set(k, params[k]);
      });
      url += '?' + sp.toString();
    }
    var opts = { method: method, credentials: 'same-origin', cache: 'no-store' };
    if (body) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (j) {
          if (res.ok) return j;
          var err = new Error(j.error || 'Something went wrong (' + res.status + ').');
          err.status = res.status;
          throw err;
        });
    });
  }
  /** Handles an API error: back to sign-in on 401, a toast otherwise. */
  function fail(err) {
    if (err.status === 401) return showLogin('Your session ended. Sign in again.');
    toast(err.message);
  }

  // ---------------------------------------------------------------------------
  // screens
  // ---------------------------------------------------------------------------
  function show(which) {
    $('#admBoot').hidden = true;
    $('#admLogin').hidden = which !== 'login';
    $('#admPanel').hidden = which !== 'panel';
    $('#admSignOut').hidden = which !== 'panel';
  }
  function showLogin(msg) {
    show('login');
    $('#admLoginError').textContent = msg || '';
    $('#admPass').focus();
  }

  $('#admLoginForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var btn = $('#admSignIn');
    btn.disabled = true;
    $('#admLoginError').textContent = '';
    call('POST', null, { action: 'login', password: $('#admPass').value })
      .then(function () {
        $('#admPass').value = '';
        // Sent here from the testnet mint copy (middleware.js): go back to it.
        if (new URLSearchParams(location.search).get('next') === 'mint') return location.assign('admin/mint/');
        return load(true);
      })
      .catch(function (err) {
        $('#admLoginError').textContent = err.message;
        $('#admPass').select();
      })
      .then(function () {
        btn.disabled = false;
      });
  });

  $('#admSignOut').addEventListener('click', function () {
    call('POST', null, { action: 'logout' })
      .catch(function () {})
      .then(function () {
        view = { status: '', q: '', rows: [], next: null, counts: null, sel: {} };
        $('#admSearch').value = '';
        showLogin('');
      });
  });

  // ---------------------------------------------------------------------------
  // the list
  // ---------------------------------------------------------------------------
  function load(reset) {
    var my = ++seq;
    if (reset) {
      view.rows = [];
      view.next = null;
      view.sel = {};
      renderRows();
      setEmpty('Decrypting…');
    }
    $('#admMore').disabled = true;
    return call('GET', { status: view.status, q: view.q, limit: PAGE, after: reset ? '' : view.next })
      .then(function (r) {
        if (my !== seq) return;
        show('panel');
        view.rows = view.rows.concat(r.entries);
        view.next = r.next;
        if (r.counts) view.counts = r.counts;
        renderCounts();
        renderRows();
      })
      .catch(function (err) {
        if (my !== seq) return;
        if (err.status === 401) return showLogin(view.counts ? 'Your session ended. Sign in again.' : '');
        if ($('#admPanel').hidden) $('#admBoot').textContent = err.message;
        else setEmpty(err.message);
      })
      .then(function () {
        $('#admMore').disabled = false;
      });
  }

  function setEmpty(text) {
    var e = $('#admEmpty');
    e.textContent = text;
    e.hidden = !text;
  }

  function renderCounts() {
    var c = view.counts || { total: 0, pending: 0, approved: 0, rejected: 0, today: 0 };
    $$('[data-count]').forEach(function (n) {
      n.textContent = fmt(c[n.getAttribute('data-count')]);
    });
    $('#admToday').textContent = '+' + fmt(c.today) + ' in 24h';
    $$('.adm-stat').forEach(function (b) {
      var on = b.getAttribute('data-status') === view.status;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var n = view.status ? c[view.status] : c.total;
    $('#admExportWhat').textContent = 'Export ' + (view.status ? STATUS[view.status].toLowerCase() : 'all') + ' · ' + fmt(n);
  }

  function renderRows() {
    var list = $('#admRows');
    var frag = document.createDocumentFragment();
    view.rows.forEach(function (e) {
      frag.appendChild(rowEl(e));
    });
    list.textContent = '';
    list.appendChild(frag);
    $('#admMore').hidden = !view.next;

    var c = view.counts;
    var total = c ? (view.status ? c[view.status] : c.total) : 0;
    $('#admShown').textContent = !view.rows.length
      ? ''
      : view.q
        ? fmt(view.rows.length) + (view.next ? '+' : '') + ' matching “' + view.q + '”'
        : 'Showing ' + fmt(view.rows.length) + ' of ' + fmt(total);
    setEmpty(
      view.rows.length
        ? ''
        : view.q
          ? 'Nothing matches “' + view.q + '”.'
          : view.status
            ? 'No ' + STATUS[view.status].toLowerCase() + ' applications.'
            : 'No applications yet.'
    );
    renderBulk();
  }

  function rowEl(e) {
    var li = el('li', 'adm-row is-' + e.status);
    li.setAttribute('data-id', e.id);

    var sel = el('label', 'adm-sel');
    var box = el('input');
    box.type = 'checkbox';
    box.checked = !!view.sel[e.id];
    box.setAttribute('aria-label', 'Select @' + e.handle);
    box.addEventListener('change', function () {
      if (box.checked) view.sel[e.id] = true;
      else delete view.sel[e.id];
      renderBulk();
    });
    sel.appendChild(box);

    var who = el('div', 'adm-who');
    var handle = el('a', 'adm-handle', '@' + e.handle);
    if (HANDLE.test(e.handle)) {
      handle.href = 'https://x.com/' + e.handle;
      handle.target = '_blank';
      handle.rel = 'noopener noreferrer';
    }
    who.appendChild(handle);
    who.appendChild(el('span', 'adm-card', 'Card ' + e.card));

    var wallet = el('div', 'adm-wallet');
    var addr = el('span', 'adm-addr', e.wallet.slice(0, 6) + '…' + e.wallet.slice(-4));
    addr.title = e.wallet;
    var copy = el('button', 'adm-icon');
    copy.type = 'button';
    copy.title = 'Copy wallet';
    copy.setAttribute('aria-label', 'Copy the wallet of @' + e.handle);
    copy.appendChild(icon('i-copy'));
    copy.addEventListener('click', function () {
      copyText(e.wallet);
    });
    wallet.appendChild(addr);
    wallet.appendChild(copy);

    var posts = el('div', 'adm-posts');
    [
      ['Post', e.post],
      ['Reply', e.reply]
    ].forEach(function (p) {
      if (!POST_URL.test(p[1] || '')) return posts.appendChild(el('span', 'adm-link is-missing', p[0] + ' ?'));
      var a = el('a', 'adm-link', p[0]);
      a.href = p[1];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.appendChild(icon('i-ext'));
      posts.appendChild(a);
    });

    var at = el('time', 'adm-at');
    at.dateTime = e.at;
    at.title = e.at.slice(0, 19).replace('T', ' ') + ' UTC';
    at.appendChild(el('span', 'adm-at-num', '#' + e.id + ' · '));
    at.appendChild(document.createTextNode(when(e.at)));

    var status = el('span', 'adm-status');
    status.appendChild(el('i', 'adm-dot is-' + e.status));
    status.appendChild(document.createTextNode(STATUS[e.status] || e.status));

    var act = el('div', 'adm-act');
    (ACTIONS[e.status] || []).forEach(function (s) {
      act.appendChild(actionBtn(s, function () {
        return [e.id];
      }));
    });

    [sel, el('span', 'adm-num', '#' + e.id), who, wallet, posts, at, status, act].forEach(function (n) {
      li.appendChild(n);
    });
    return li;
  }

  function actionBtn(status, ids) {
    var v = VERB[status];
    var b = el('button', 'adm-btn ' + v.cls);
    b.type = 'button';
    b.appendChild(icon(v.icon));
    b.appendChild(document.createTextNode(v.text));
    b.addEventListener('click', function () {
      b.disabled = true;
      setStatus(ids(), status).then(
        function () {
          b.disabled = false;
        },
        function () {
          b.disabled = false;
        }
      );
    });
    return b;
  }

  function copyText(text) {
    var done = function () {
      toast('Wallet copied');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        window.prompt('Copy the wallet:', text);
      });
    } else window.prompt('Copy the wallet:', text);
  }

  // ---------------------------------------------------------------------------
  // review: one row or the selection
  // ---------------------------------------------------------------------------
  function setStatus(ids, status) {
    var chunks = [];
    for (var i = 0; i < ids.length; i += 500) chunks.push(ids.slice(i, i + 500));
    var changed = 0;
    return chunks
      .reduce(function (p, chunk) {
        return p.then(function () {
          return call('POST', null, { action: 'status', ids: chunk, status: status }).then(function (r) {
            changed += r.ids.length;
            view.counts = r.counts;
            r.ids.forEach(function (id) {
              refresh(id, status);
            });
          });
        });
      }, Promise.resolve())
      .then(function () {
        renderCounts();
        toast(fmt(changed) + ' ' + VERB[status].done);
      })
      .catch(function (err) {
        renderCounts();
        fail(err);
        throw err;
      });
  }

  function refresh(id, status) {
    for (var i = 0; i < view.rows.length; i++) {
      if (view.rows[i].id !== id) continue;
      view.rows[i].status = status;
      var li = $('.adm-row[data-id="' + id + '"]');
      if (li) li.replaceWith(rowEl(view.rows[i]));
    }
  }

  function selected() {
    return Object.keys(view.sel).map(Number);
  }
  function renderBulk() {
    var ids = selected();
    $('#admBulk').hidden = !ids.length;
    $('#admBulkCount').textContent = fmt(ids.length) + ' selected';
    var all = $('#admSelAll');
    all.checked = ids.length > 0 && ids.length === view.rows.length;
    all.indeterminate = ids.length > 0 && ids.length < view.rows.length;
  }
  function syncChecks() {
    $$('#admRows .adm-row').forEach(function (li) {
      $('input', li).checked = !!view.sel[li.getAttribute('data-id')];
    });
    renderBulk();
  }

  $('#admSelAll').addEventListener('change', function () {
    var on = this.checked;
    view.sel = {};
    if (on)
      view.rows.forEach(function (e) {
        view.sel[e.id] = true;
      });
    syncChecks();
  });

  $$('[data-bulk]').forEach(function (b) {
    b.addEventListener('click', function () {
      var status = b.getAttribute('data-bulk');
      var ids = selected();
      if (status && ids.length > 25 && !window.confirm('Mark ' + fmt(ids.length) + ' applications as ' + status + '?')) return;
      var clear = function () {
        view.sel = {};
        syncChecks();
      };
      if (!status) return clear();
      b.disabled = true;
      setStatus(ids, status)
        .then(clear, function () {})
        .then(function () {
          b.disabled = false;
        });
    });
  });

  // ---------------------------------------------------------------------------
  // filters
  // ---------------------------------------------------------------------------
  $$('.adm-stat').forEach(function (b) {
    b.addEventListener('click', function () {
      view.status = b.getAttribute('data-status');
      renderCounts();
      load(true);
    });
  });

  var searchTimer = null;
  $('#admSearch').addEventListener('input', function () {
    var v = this.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      if (v === view.q) return;
      view.q = v;
      load(true);
    }, 300);
  });

  $('#admMore').addEventListener('click', function () {
    load(false);
  });

  // ---------------------------------------------------------------------------
  // exports (the current status tab, all pages)
  // ---------------------------------------------------------------------------
  function fetchAll(status) {
    var out = [];
    function page(after) {
      return call('GET', { status: status, order: 'asc', limit: 1000, after: after }).then(function (r) {
        out = out.concat(r.entries);
        return r.next ? page(r.next) : out;
      });
    }
    return page('');
  }
  function cell(v) {
    v = String(v === null || v === undefined ? '' : v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; // spreadsheets would read these as formulas
    return '"' + v.replace(/"/g, '""') + '"';
  }
  function csv(rows) {
    return (
      '﻿' +
      rows
        .map(function (r) {
          return r.map(cell).join(',');
        })
        .join('\r\n') +
      '\r\n'
    );
  }
  function save(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
    var a = el('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
  }

  $$('[data-export]').forEach(function (b) {
    b.addEventListener('click', function () {
      var kind = b.getAttribute('data-export');
      var status = view.status;
      var what = kind === 'applications' ? 'applications' : 'wallets';
      var name = 'fhecat-waitlist-' + what + '-' + (status || 'all') + '-' + new Date().toISOString().slice(0, 10);
      b.disabled = true;
      toast('Exporting…');
      fetchAll(status)
        .then(function (rows) {
          if (!rows.length) return toast('Nothing to export');
          if (kind === 'applications') {
            var head = ['entry', 'handle', 'x_profile', 'wallet', 'card', 'status', 'post', 'reply', 'joined_utc'];
            save(
              name + '.csv',
              csv(
                [head].concat(
                  rows.map(function (e) {
                    return [e.id, e.handle, 'https://x.com/' + e.handle, e.wallet, e.card, e.status, e.post, e.reply, e.at];
                  })
                )
              ),
              'text/csv'
            );
          } else if (kind === 'wallets-csv') {
            save(
              name + '.csv',
              csv(
                [['wallet']].concat(
                  rows.map(function (e) {
                    return [e.wallet];
                  })
                )
              ),
              'text/csv'
            );
          } else {
            save(
              name + '.txt',
              rows
                .map(function (e) {
                  return e.wallet;
                })
                .join('\n') + '\n',
              'text/plain'
            );
          }
          toast(fmt(rows.length) + ' ' + what + ' exported');
        })
        .catch(fail)
        .then(function () {
          b.disabled = false;
        });
    });
  });

  // ---------------------------------------------------------------------------
  function start() {
    P.mountAll(NS.sprites);
    var wm = NS.art.wordmarkCells();
    $$('[data-wordmark]').forEach(function (slot) {
      slot.appendChild(P.svg(wm.cells, { cls: 'wordmark' }));
    });
    $$('[data-stars]').forEach(function (s, i) {
      NS.scene.starfield(s, parseFloat(s.getAttribute('data-stars')) || 1, 90 + i);
    });
    $('#year').textContent = String(new Date().getFullYear());
    load(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
