/*
 * fhecat.com/collab: communities (DAOs, guilds, alpha groups) apply for
 * allowlist spots, and once approved add their raffle winners' wallets.
 *
 * The form opens right away: a short application with the link to a post
 * about FheCat on the community's X. Sending it signs in with a wallet (a
 * signature: free, no transaction): api/collab checks the form, hands out a
 * message, the wallet signs it, the server sets a session cookie, then the
 * application goes in. That wallet is the way back in. Then 2 Review (by the
 * team, in the admin) -> 3 Post the raffle on X, add the winners' wallets and
 * submit them with the post's link before the deadline. When the admin closes
 * applications the form gives way to a notice; those who applied can still
 * sign in. Everything goes through api/collab.
 */
(function () {
  'use strict';

  var NS = window.FheCat;
  var P = NS.pixel;
  var API = 'api/collab';
  var SPOT = 'WL'; // what a spot is called on this page
  // "community" is no longer offered; older applications may still carry it.
  var KIND_TAG = { dao: 'DAO', community: 'COMM', guild: 'GUILD', alpha: 'ALPHA', nft: 'NFT', other: 'OTHER' };
  var KIND_NAME = { dao: 'DAO', community: 'Community', guild: 'Guild', alpha: 'Alpha group', nft: 'NFT project', other: 'Other' };
  var MAX_COLLABS = 2; // applications per wallet (and per X account), as api/_collab.js
  var WALLET = /^0x[0-9a-fA-F]{40}$/;
  var POST = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/(?:[A-Za-z0-9_]{1,15}|i(?:\/web)?)\/status(?:es)?\/\d{1,20}(?:[/?#].*)?$/i;
  var APPLY_FIELDS = ['name', 'kind', 'members', 'x', 'contactX', 'contactDiscord', 'role', 'post', 'pitch', 'company'];

  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /** Everything the page knows. */
  var st = {
    open: true, // new applications are taken (the admin's switch)
    wallet: null, // signed-in wallet, lowercase
    collabs: [],
    selected: null, // collab id on screen
    applying: false, // the apply form is open (signed in)
    signin: false, // signed out, and asked to sign in rather than apply
    offset: 0, // server clock minus this clock, ms
    drafts: {}, // unsaved winner rows per collab id
    tweets: {} // unsaved raffle post links per collab id
  };

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
  function short(w) {
    return w ? w.slice(0, 6) + '…' + w.slice(-4) : '';
  }
  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function day(iso) {
    var d = new Date(iso);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function toast(text) {
    var t = $('#toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      t.classList.remove('on');
    }, 2800);
  }

  function call(method, params, body) {
    var url = API;
    if (params) url += '?' + new URLSearchParams(params).toString();
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
          err.field = j.field;
          err.row = j.row;
          err.closed = !!j.closed;
          throw err;
        });
    });
  }

  /** Takes a state answer from the API. */
  function take(s) {
    st.wallet = s.wallet;
    st.collabs = s.collabs || [];
    if (s.now) st.offset = Date.parse(s.now) - Date.now();
    if (!st.collabs.some(function (c) {
      return c.id === st.selected;
    }))
      st.selected = pickDefault();
  }
  function pickDefault() {
    var open = st.collabs.filter(isOpen)[0];
    if (open) return open.id;
    return st.collabs.length ? st.collabs[st.collabs.length - 1].id : null;
  }
  function current() {
    for (var i = 0; i < st.collabs.length; i++) if (st.collabs[i].id === st.selected) return st.collabs[i];
    return null;
  }
  function now() {
    return Date.now() + st.offset;
  }
  function isOpen(c) {
    return c.status === 'approved' && !c.submittedAt && c.deadline && Date.parse(c.deadline) > now();
  }

  // ---------------------------------------------------------------------------
  // wallets (EIP-6963, with window.ethereum as the fallback)
  // ---------------------------------------------------------------------------
  var providers = [];
  window.addEventListener('eip6963:announceProvider', function (ev) {
    var d = ev.detail;
    if (!d || !d.provider || !d.info) return;
    if (providers.some(function (p) {
      return p.info.uuid === d.info.uuid;
    }))
      return;
    providers.push(d);
    renderWallets();
  });

  function wallets() {
    var list = providers.slice();
    if (!list.length && window.ethereum) list.push({ info: { name: 'Wallet', icon: '' }, provider: window.ethereum });
    return list;
  }

  /** The wallet buttons: "Sign in with…" when coming back, "Apply with…" under the form. */
  function renderWallets() {
    fillWallets($('#cbWallets'), 'Sign in with ', 'Connect wallet', false);
    fillWallets($('#cbApplyWallets'), 'Apply with ', 'Connect wallet and apply', true);
    $('#cbNoWallet').hidden = !!st.wallet || wallets().length > 0;
  }
  function fillWallets(box, verb, plain, submits) {
    box.textContent = '';
    var list = wallets();
    if (!list.length) {
      var p = el('p', 'cb-nowallet');
      p.textContent = 'No wallet found in this browser. Open fhecat.com/collab in your wallet app (MetaMask, Rabby, OKX…) or install a wallet extension.';
      box.appendChild(p);
      return;
    }
    list.forEach(function (w, i) {
      var b = el('button', 'btn' + (i ? ' btn-ghost' : ''));
      // Under the form the buttons send it; the form's submit handler reads which one.
      b.type = submits ? 'submit' : 'button';
      b.setAttribute('data-wallet', String(i));
      if (w.info.icon && /^data:image\//.test(w.info.icon)) {
        var img = el('img');
        img.src = w.info.icon;
        img.alt = '';
        img.width = 24;
        img.height = 24;
        b.appendChild(img);
      }
      b.appendChild(el('span', '', list.length > 1 || w.info.name !== 'Wallet' ? verb + w.info.name : plain));
      if (!submits)
        b.addEventListener('click', function () {
          signIn(w.provider);
        });
      box.appendChild(b);
    });
  }

  function hex(text) {
    var bytes = new TextEncoder().encode(text);
    var out = '0x';
    for (var i = 0; i < bytes.length; i++) out += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return out;
  }

  /** The wallet shares an address and signs the server's message; resolves once signed in. */
  function connect(provider) {
    var address;
    return provider
      .request({ method: 'eth_requestAccounts' })
      .then(function (accounts) {
        address = accounts && accounts[0];
        if (!address) throw new Error('No account was shared.');
        return call('GET', { challenge: address });
      })
      .then(function (ch) {
        return provider.request({ method: 'personal_sign', params: [hex(ch.message), address] }).then(function (signature) {
          return call('POST', null, { action: 'signin', address: address, token: ch.token, signature: signature });
        });
      })
      .then(take);
  }
  function cancelled(err) {
    return !!err && (err.code === 4001 || err.code === 'ACTION_REJECTED');
  }

  function signIn(provider) {
    var error = $('#cbSigninError');
    error.textContent = '';
    $$('#cbWallets button').forEach(function (b) {
      b.disabled = true;
    });
    connect(provider)
      .then(function () {
        st.signin = false;
        st.applying = !st.collabs.length;
        render();
        toast('Signed in');
      })
      .catch(function (err) {
        error.textContent = cancelled(err) ? 'You cancelled in your wallet.' : (err && err.message) || 'Sign-in failed.';
      })
      .then(function () {
        $$('#cbWallets button').forEach(function (b) {
          b.disabled = false;
        });
      });
  }

  $('#cbSwitch').addEventListener('click', function () {
    if (dirty() && !window.confirm('You have unsaved changes. Sign out anyway?')) return;
    call('POST', null, { action: 'signout' })
      .catch(function () {})
      .then(function () {
        st.wallet = null;
        st.collabs = [];
        st.selected = null;
        st.applying = false;
        st.signin = true;
        st.drafts = {};
        st.tweets = {};
        render();
      });
  });
  function toSignin() {
    st.signin = true;
    render();
    var first = $('#cbWallets button');
    if (first) first.focus();
  }
  $('#cbSideSigninBtn').addEventListener('click', toSignin);
  $('#cbClosedSignin').addEventListener('click', toSignin);
  $('#cbSigninBack').addEventListener('click', function () {
    st.signin = false;
    $('#cbSigninError').textContent = '';
    render();
    var first = $('#cbApply input[name="name"]');
    if (first) first.focus();
  });

  // ---------------------------------------------------------------------------
  // a little pixel face for the signed-in wallet
  // ---------------------------------------------------------------------------
  function avatar(wallet) {
    var h = wallet.slice(2);
    var tones = ['C', 'b', 'P', 'Y', 'V', 'G', 'W'];
    var tone = tones[parseInt(h.slice(0, 2), 16) % tones.length];
    var half = [];
    for (var y = 0; y < 8; y++) {
      var row = '';
      for (var x = 0; x < 4; x++) {
        var nib = parseInt(h[(y * 4 + x) % h.length], 16);
        row += nib % 2 ? tone : 'K';
      }
      half.push(row);
    }
    return P.svg(P.mirror(half), { cls: 'cb-face' });
  }

  // ---------------------------------------------------------------------------
  // render
  // ---------------------------------------------------------------------------
  function render() {
    $('#cbBoot').hidden = true;
    renderSide();
    renderMain();
  }

  function renderSide() {
    $('#cbLive .blink-dot').hidden = !st.open;
    $('#cbLive span').textContent = st.open ? 'Collab live' : 'Applications closed';
    var list = $('#cbGroups');
    list.textContent = '';
    $('#cbNone').hidden = !st.wallet || st.collabs.length > 0;
    $('#cbNone').textContent = st.open ? 'No communities yet. Fill in the form to apply.' : 'No communities on this wallet.';
    $('#cbSideSignin').hidden = !!st.wallet;
    st.collabs.forEach(function (c) {
      var li = el('li');
      var b = el('button', 'cb-group is-' + c.status + (c.id === st.selected && !st.applying ? ' on' : ''));
      b.type = 'button';
      b.appendChild(el('span', 'cb-kind', KIND_TAG[c.kind] || 'COMM'));
      var text = el('span', 'cb-group-text');
      text.appendChild(el('b', '', c.name));
      text.appendChild(el('span', '', groupNote(c)));
      b.appendChild(text);
      b.appendChild(el('span', 'cb-group-count', c.status === 'approved' ? c.winners.length + '/' + c.spots : c.status === 'pending' ? '…' : '–'));
      b.addEventListener('click', function () {
        if (c.id === st.selected && !st.applying) return;
        st.selected = c.id;
        st.applying = false;
        render();
      });
      li.appendChild(b);
      list.appendChild(li);
    });
    $('#cbNew').hidden = !st.open || !st.wallet || st.applying || !st.collabs.length || st.collabs.length >= MAX_COLLABS;

    var me = $('#cbMe');
    me.hidden = !st.wallet;
    if (st.wallet) {
      var last = st.collabs[st.collabs.length - 1];
      $('#cbMeName').textContent = last ? '@' + last.contactX : 'Your wallet';
      $('#cbMeWallet').textContent = short(st.wallet);
      var av = $('#cbAvatar');
      av.textContent = '';
      av.appendChild(avatar(st.wallet));
    }
  }

  function groupNote(c) {
    if (c.status === 'pending') return 'In review';
    if (c.status === 'rejected') return 'Not this time';
    if (c.submittedAt) return 'Submitted · ' + c.spots + ' ' + SPOT;
    if (!isOpen(c)) return "Time's up · " + c.spots + ' ' + SPOT;
    return c.spots + ' ' + SPOT;
  }

  function show(id) {
    ['#cbSignin', '#cbClosed', '#cbApply', '#cbReview', '#cbRejected', '#cbWinners'].forEach(function (v) {
      $(v).hidden = v !== id;
    });
    $('#cbSteps').hidden = id === '#cbClosed';
  }

  function steps(at, opts) {
    var o = opts || {};
    $$('#cbSteps li').forEach(function (li) {
      var n = Number(li.getAttribute('data-step'));
      li.className = n < at || o.allDone ? 'done' : n === at ? (o.no ? 'no' : 'on') : '';
      var no = $('.cb-step-no', li);
      no.textContent = '';
      if (li.className === 'done') no.appendChild(icon('i-check'));
      else if (li.className === 'no') no.appendChild(icon('i-cross'));
      else no.textContent = String(n);
    });
  }

  function renderMain() {
    stopClock();
    renderWallets();
    var c = st.wallet ? current() : null;
    if (!st.wallet && st.signin) {
      steps(1);
      show('#cbSignin');
      $('#cbSigninBack').textContent = st.open ? 'New here? Apply' : 'Back';
      return;
    }
    if (!st.wallet || st.applying || !c) {
      if (!st.open) {
        show('#cbClosed');
        $('#cbClosedSignin').hidden = !!st.wallet;
        return;
      }
      steps(1);
      show('#cbApply');
      renderApply();
      return;
    }
    if (c.status === 'pending') {
      steps(2);
      show('#cbReview');
      $('#cbRevName').textContent = c.name;
      $('#cbRevContact').textContent = '@' + c.contactX;
      var dl = $('#cbRevFacts');
      dl.textContent = '';
      var facts = [
        ['Type', KIND_NAME[c.kind] || c.kind],
        ['Community X', '@' + c.x],
        ['Members', Number(c.members).toLocaleString('en-US')]
      ];
      if (c.post) {
        var a = el('a', 'link', c.post.replace(/^https:\/\//, ''));
        a.href = c.post;
        a.target = '_blank';
        a.rel = 'noopener';
        facts.push(['Your post', a]);
      }
      facts.push(['Applied', day(c.createdAt)]);
      facts.forEach(function (f) {
        dl.appendChild(el('dt', '', f[0]));
        var dd = el('dd');
        dd.appendChild(typeof f[1] === 'string' ? document.createTextNode(f[1]) : f[1]);
        dl.appendChild(dd);
      });
      return;
    }
    if (c.status === 'rejected') {
      steps(2, { no: true });
      show('#cbRejected');
      $('#cbRejName').textContent = c.name;
      return;
    }
    steps(3, { allDone: !!c.submittedAt });
    show('#cbWinners');
    renderWinners(c);
  }

  /** Signed out, the form ends in the wallet buttons that send it; signed in, in a plain Apply. */
  function renderApply() {
    var out = !st.wallet;
    var more = !out && st.collabs.length > 0;
    $('#cbApplyTitle').textContent = more ? 'Add another community.' : 'Bring your community.';
    $('#cbApplyIntro').hidden = more;
    $('#cbApplyAs').hidden = out;
    $('#cbApplyWallet').textContent = short(st.wallet);
    $('#cbApplyCancel').hidden = !more;
    $('#cbApplyBtn').hidden = out;
    $('#cbApplyActions').hidden = out;
    $('#cbApplySign').hidden = !out;
  }

  // ---------------------------------------------------------------------------
  // step 3: the winners
  // ---------------------------------------------------------------------------
  function rowsOf(c) {
    var saved = c.winners || [];
    var draft = st.drafts[c.id];
    var out = [];
    for (var i = 0; i < c.spots; i++) {
      var r = draft ? draft[i] : saved[i];
      out.push({ name: (r && r.name) || '', wallet: (r && r.wallet) || '' });
    }
    return out;
  }
  function tweetOf(c) {
    return st.tweets[c.id] !== undefined ? st.tweets[c.id] : c.tweet || '';
  }
  function dirty() {
    if (Object.keys(st.drafts).length) return true;
    return st.collabs.some(function (c) {
      return st.tweets[c.id] !== undefined && st.tweets[c.id].trim() !== (c.tweet || '');
    });
  }

  function renderWinners(c) {
    var open = isOpen(c);
    var done = !!c.submittedAt;
    $('#cbWinName').textContent = c.name;
    $('#cbWinWhat').textContent = done ? 'Your ' + SPOT + ' winners' : 'Add your ' + SPOT + ' winners';

    var timer = $('#cbTimer');
    timer.classList.toggle('is-done', done);
    timer.classList.toggle('is-over', !done && !open);
    $('#cbSubmit').hidden = !open;
    $('#cbWinActions').hidden = !open;
    $('#cbRowsNote').hidden = !open;
    $('#cbWinError').textContent = '';

    // the raffle post: a field while the list is open, a link once it is locked
    $('#cbRaffle').hidden = !open;
    var tweet = $('#cbTweet');
    tweet.value = tweetOf(c);
    tweet.classList.remove('bad');
    $('#cbTweetError').textContent = '';
    $('#cbRaffleDone').hidden = open || !c.tweet;
    var link = $('#cbTweetLink');
    link.href = c.tweet || '#';
    link.textContent = (c.tweet || '').replace(/^https:\/\//, '');

    var list = $('#cbRows');
    list.textContent = '';
    list.classList.toggle('is-locked', !open);
    rowsOf(c).forEach(function (r, i) {
      var li = el('li', 'cb-row');
      li.appendChild(el('span', 'cb-row-no', String(i + 1)));
      if (!open) {
        li.appendChild(el('span', 'cb-cell' + (r.name ? '' : ' is-empty'), r.name || '—'));
        li.appendChild(el('span', 'cb-cell mono' + (r.wallet ? '' : ' is-empty'), r.wallet || '—'));
        list.appendChild(li);
        return;
      }
      var name = el('input', 'cb-in');
      name.name = 'name';
      name.placeholder = 'discord or x name';
      name.value = r.name;
      name.maxLength = 40;
      name.autocomplete = 'off';
      name.spellcheck = false;
      name.setAttribute('aria-label', 'Winner ' + (i + 1) + ' name');
      var wallet = el('input', 'cb-in mono');
      wallet.name = 'wallet';
      wallet.placeholder = '0x…';
      wallet.value = r.wallet;
      wallet.maxLength = 42;
      wallet.autocomplete = 'off';
      wallet.spellcheck = false;
      wallet.setAttribute('aria-label', 'Winner ' + (i + 1) + ' wallet');
      [name, wallet].forEach(function (inp) {
        inp.readOnly = !open;
        inp.setAttribute('data-i', String(i));
        inp.addEventListener('input', function () {
          inp.classList.remove('bad');
          keepDraft(c);
          counts(c);
        });
        inp.addEventListener('paste', function (ev) {
          if (!open) return;
          var text = (ev.clipboardData || window.clipboardData).getData('text') || '';
          var lines = parseList(text);
          // A single plain value pastes as usual; a list (or "name wallet") fills rows.
          if (lines.length < 2 && !(lines.length === 1 && lines[0].name && lines[0].wallet)) return;
          ev.preventDefault();
          fillFrom(c, i, lines);
        });
      });
      li.appendChild(name);
      li.appendChild(wallet);
      list.appendChild(li);
    });
    counts(c);
    tick(c);
    if (open) startClock(c);
  }

  /** Lines like "name, 0x…", "0x… name", "1. name 0x…" -> [{name, wallet}]. */
  function parseList(text) {
    return String(text)
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean)
      .map(function (l) {
        var m = /0x[0-9a-fA-F]{40}/.exec(l);
        var wallet = m ? m[0] : '';
        var name = (m ? l.replace(m[0], ' ') : l)
          .replace(/^\s*\d+[.)]\s+/, '')
          .replace(/[,;\t|]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return { name: name.slice(0, 40), wallet: wallet };
      });
  }

  function fillFrom(c, start, lines) {
    var inputs = $$('#cbRows .cb-row');
    var room = inputs.length - start;
    lines.slice(0, room).forEach(function (r, k) {
      var li = inputs[start + k];
      $('input[name="name"]', li).value = r.name;
      $('input[name="wallet"]', li).value = r.wallet;
    });
    keepDraft(c);
    counts(c);
    var skipped = lines.length - Math.max(room, 0);
    toast(skipped > 0 ? plural(lines.length - skipped, 'row', 'rows') + ' filled · ' + skipped + " didn't fit" : plural(lines.length, 'row', 'rows') + ' filled');
  }

  function readRows() {
    return $$('#cbRows .cb-row').map(function (li) {
      return { name: $('input[name="name"]', li).value.trim(), wallet: $('input[name="wallet"]', li).value.trim() };
    });
  }
  function keepDraft(c) {
    st.drafts[c.id] = readRows();
  }

  function counts(c) {
    var rows = isOpen(c) ? readRows() : c.winners || [];
    var filled = rows.filter(function (r) {
      return r.name && WALLET.test(r.wallet);
    }).length;
    $('#cbBadge').textContent = SPOT + ' ' + filled + '/' + c.spots;
    $('#cbLeft').textContent = isOpen(c) ? plural(c.spots - filled, SPOT + ' spot', SPOT + ' spots') + ' left' : filled + ' of ' + c.spots + ' spots used';
  }

  /** Marks bad rows before sending; returns the first problem, or ''. */
  function check() {
    var seen = {};
    var problem = '';
    $$('#cbRows .cb-row').forEach(function (li, i) {
      var n = $('input[name="name"]', li);
      var w = $('input[name="wallet"]', li);
      var name = n.value.trim();
      var wallet = w.value.trim();
      n.classList.remove('bad');
      w.classList.remove('bad');
      if (!name && !wallet) return;
      if (!name) {
        n.classList.add('bad');
        problem = problem || 'Row ' + (i + 1) + ": add the winner's name.";
      }
      if (!WALLET.test(wallet)) {
        w.classList.add('bad');
        problem = problem || 'Row ' + (i + 1) + ": that wallet doesn't look right (0x and 40 characters).";
      } else if (seen[wallet.toLowerCase()]) {
        w.classList.add('bad');
        problem = problem || 'Row ' + (i + 1) + ': this wallet is already on your list.';
      }
      seen[wallet.toLowerCase()] = true;
    });
    return problem;
  }

  function badTweet(text) {
    var input = $('#cbTweet');
    input.classList.add('bad');
    input.focus();
    $('#cbTweetError').textContent = text;
  }

  function send(action) {
    var c = current();
    if (!c) return;
    var error = $('#cbWinError');
    $('#cbTweet').classList.remove('bad');
    $('#cbTweetError').textContent = '';
    error.textContent = check();
    if (error.textContent) return;
    var rows = readRows();
    var filled = rows.filter(function (r) {
      return r.name || r.wallet;
    }).length;
    var tweet = $('#cbTweet').value.trim();
    if (tweet && !POST.test(tweet)) return badTweet("That isn't a link to a post on X (x.com/name/status/...).");
    if (action === 'submit') {
      if (!filled) {
        error.textContent = 'Add at least one winner first.';
        return;
      }
      if (!tweet) return badTweet('Add the link to your raffle post on X first.');
      var note = filled < c.spots ? ' You are using ' + filled + ' of ' + c.spots + ' spots.' : '';
      if (!window.confirm('Submit ' + plural(filled, 'wallet', 'wallets') + ' for ' + c.name + '? The list is locked after this.' + note)) return;
    }
    var buttons = [$('#cbSave'), $('#cbSubmit')];
    buttons.forEach(function (b) {
      b.disabled = true;
    });
    call('POST', null, { action: action, id: c.id, winners: rows, tweet: tweet })
      .then(function (s) {
        delete st.drafts[c.id];
        delete st.tweets[c.id];
        take(s);
        render();
        toast(action === 'submit' ? 'Submitted · ' + plural(filled, 'wallet', 'wallets') : 'Saved · ' + plural(filled, 'wallet', 'wallets'));
      })
      .catch(function (err) {
        if (err.status === 401) return signedOut();
        if (err.field === 'tweet') return badTweet(err.message);
        error.textContent = err.message;
        if (typeof err.row === 'number') {
          var li = $$('#cbRows .cb-row')[err.row];
          if (li) $$('input', li).forEach(function (inp) {
            inp.classList.add('bad');
          });
        }
        if (err.status === 409) refresh();
      })
      .then(function () {
        buttons.forEach(function (b) {
          b.disabled = false;
        });
      });
  }
  $('#cbSave').addEventListener('click', function () {
    send('save');
  });
  $('#cbTweet').addEventListener('input', function () {
    var c = current();
    this.classList.remove('bad');
    $('#cbTweetError').textContent = '';
    if (c) st.tweets[c.id] = this.value;
  });
  $('#cbSubmit').addEventListener('click', function () {
    send('submit');
  });

  // ---------------------------------------------------------------------------
  // the clock
  // ---------------------------------------------------------------------------
  var clock = null;
  function startClock(c) {
    stopClock();
    clock = setInterval(function () {
      if (!tick(c)) {
        stopClock();
        render(); // time's up: lock the rows
      }
    }, 1000);
  }
  function stopClock() {
    if (clock) clearInterval(clock);
    clock = null;
  }
  /** Updates the clock; false once the time is up. */
  function tick(c) {
    var b = $('#cbClock');
    var note = $('#cbClockNote');
    if (c.submittedAt) {
      b.textContent = 'Submitted';
      note.textContent = day(c.submittedAt);
      return false;
    }
    var left = Math.max(0, Date.parse(c.deadline) - now());
    var s = Math.floor(left / 1000);
    var pad = function (n) {
      return (n < 10 ? '0' : '') + n;
    };
    b.textContent = pad(Math.floor(s / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60);
    note.textContent = left > 0 ? 'left to submit' : "Time's up · DM @FheCat for more time";
    return left > 0;
  }

  // ---------------------------------------------------------------------------
  // step 1: apply
  // ---------------------------------------------------------------------------
  $('#cbApply').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var form = ev.target;
    var error = $('#cbApplyError');
    error.textContent = '';
    $$('.bad', form).forEach(function (n) {
      n.classList.remove('bad');
    });
    var body = { action: 'apply' };
    APPLY_FIELDS.forEach(function (k) {
      body[k] = form.elements[k].value.trim();
    });
    // Signed out: check the form first, then the wallet that was picked signs in, then apply.
    var signedIn = !!st.wallet;
    var wallet = null;
    if (!signedIn) {
      var list = wallets();
      var picked = ev.submitter && ev.submitter.getAttribute('data-wallet');
      wallet = list[Number(picked)] || list[0];
      if (!wallet) {
        error.textContent = 'You need a wallet to send this. Open fhecat.com/collab in your wallet app (MetaMask, Rabby, OKX…).';
        return;
      }
    }
    var busy = function (on) {
      $$('button[type="submit"]', form).forEach(function (b) {
        b.disabled = on;
      });
    };
    busy(true);
    var ready = signedIn
      ? Promise.resolve()
      : call('POST', null, Object.assign({}, body, { action: 'check' })).then(function () {
          return connect(wallet.provider);
        });
    ready
      .then(function () {
        return call('POST', null, body);
      })
      .then(function (s) {
        take(s);
        st.selected = st.collabs.length ? st.collabs[st.collabs.length - 1].id : null;
        st.applying = false;
        form.reset();
        render();
        toast('Applied · we will DM you on X');
      })
      .catch(function (err) {
        if (err.status === 401) {
          // No session (it ran out, or the signature didn't check out): back to the wallet
          // buttons, with the answers still in the form.
          st.wallet = null;
          st.collabs = [];
          st.selected = null;
        }
        // Signed in on the way (the application itself failed): stay on the form.
        st.applying = !!st.wallet;
        st.signin = false;
        // Closed while it was being filled in: the notice replaces the form (or shows the
        // communities this wallet already has).
        if (err.closed) {
          st.open = false;
          st.applying = false;
        }
        render();
        error.textContent =
          err.status === 401 && signedIn
            ? 'Your session ended. Send the form again to sign in.'
            : cancelled(err)
              ? 'You cancelled in your wallet. Your answers are still here.'
              : (err && err.message) || 'Something went wrong.';
        var field = err.field && form.elements[err.field];
        if (field) {
          field.classList.add('bad');
          field.focus();
        }
      })
      .then(function () {
        busy(false);
      });
  });
  $('#cbApply').addEventListener('input', function (ev) {
    if (ev.target.classList) ev.target.classList.remove('bad');
  });
  $('#cbNew').addEventListener('click', function () {
    st.applying = true;
    render();
    var first = $('#cbApply input[name="name"]');
    if (first) first.focus();
  });
  $('#cbApplyCancel').addEventListener('click', function () {
    st.applying = false;
    render();
  });

  // ---------------------------------------------------------------------------
  // the guide
  // ---------------------------------------------------------------------------
  function post() {
    var c = current();
    var name = c ? c.name : 'your community';
    var spots = c && c.status === 'approved' ? String(c.spots) : '[number]';
    return [
      'FheCat x ' + name,
      '',
      'We have ' + spots + ' FheCat allowlist spots for our community.',
      '',
      "FheCat: pixel cats born encrypted on Fhenix. Each cat's DNA is FHE-encrypted at mint, so nobody can see it. Not even the team.",
      '',
      'To enter:',
      '1. Follow @FheCat',
      '2. Like and repost this post',
      '3. Reply with your EVM wallet',
      '',
      'Winners picked soon.'
    ].join('\n');
  }
  var lastFocus = null;
  function openGuide() {
    lastFocus = document.activeElement;
    $('#cbPost').textContent = post();
    $('#cbGuide').hidden = false;
    document.body.classList.add('cb-locked');
    $('#cbGuideClose').focus();
  }
  function closeGuide() {
    $('#cbGuide').hidden = true;
    document.body.classList.remove('cb-locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $('#cbGuideOpen').addEventListener('click', openGuide);
  $('#cbGuideClose').addEventListener('click', closeGuide);
  $('#cbGuide').addEventListener('click', function (ev) {
    if (ev.target === ev.currentTarget) closeGuide();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !$('#cbGuide').hidden) closeGuide();
  });
  $('#cbCopyPost').addEventListener('click', function () {
    var text = post();
    var done = function () {
      toast('Post copied');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        window.prompt('Copy the post:', text);
      });
    } else window.prompt('Copy the post:', text);
  });

  // ---------------------------------------------------------------------------
  // loading and staying fresh
  // ---------------------------------------------------------------------------
  function signedOut() {
    st.wallet = null;
    st.collabs = [];
    st.selected = null;
    st.signin = true;
    render();
    $('#cbSigninError').textContent = 'Your session ended. Sign in again.';
  }

  function refresh() {
    return call('GET')
      .then(function (s) {
        var before = current();
        take(s);
        var after = current();
        if (before && after && before.id === after.id && before.status === 'pending' && after.status !== 'pending') {
          toast(after.status === 'approved' ? 'Your spots are ready' : 'Your application was reviewed');
        }
        render();
      })
      .catch(function (err) {
        if (err.status === 401) {
          st.wallet = null;
          st.collabs = [];
          render();
        } else {
          $('#cbBoot').hidden = false;
          $('#cbBoot').textContent = err.message;
        }
      });
  }

  // While something is in review, check back every minute.
  setInterval(function () {
    var c = current();
    if (st.wallet && c && c.status === 'pending' && !document.hidden) refresh();
  }, 60000);

  window.addEventListener('beforeunload', function (ev) {
    if (!dirty()) return;
    ev.preventDefault();
    ev.returnValue = '';
  });

  function start() {
    P.mountAll(NS.sprites);
    var wm = NS.art.wordmarkCells();
    $$('[data-wordmark]').forEach(function (slot) {
      slot.appendChild(P.svg(wm.cells, { cls: 'wordmark' }));
    });
    $$('[data-stars]').forEach(function (s, i) {
      NS.scene.starfield(s, parseFloat(s.getAttribute('data-stars')) || 1, 70 + i);
    });
    steps(1);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    // Whether applications are open, then the signed-in wallet's communities. If the switch
    // can't be read the form shows; the server refuses applications while closed anyway.
    call('GET', { state: 1 })
      .then(function (s) {
        st.open = s.open !== false;
      })
      .catch(function () {})
      .then(refresh);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
