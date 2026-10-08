/*
 * The waitlist, one step at a time:
 *   1 follow @FheCat · 2 make your card · 3 post it · 4 like, repost and reply
 *   to the launch post with it · 5 add a wallet and submit.
 * Progress is kept in localStorage, so people can hop over to X and come back.
 * X can't be checked from a web page, so the links are stored and every
 * entry is reviewed by hand before the mint.
 */
(function () {
  'use strict';

  // The launch post everyone likes, reposts and replies to. Step 4 opens once this is set.
  var LAUNCH_POST = 'https://x.com/FheCat/status/2105240697620271388';

  var NS = window.FheCat;
  var P = NS.pixel;
  var KEY = 'fhecat.wl';
  var HANDLE = /^[A-Za-z0-9_]{1,15}$/;
  var WALLET = /^0x[0-9a-fA-F]{40}$/;
  var STATUS = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,25})(?:[/?#].*)?$/i;
  var POST_TEXT = 'My cat is still encrypted. 🔒🐾\n\nJust joined the @FheCat waitlist, powered by @fhenix FHE. Mainnet mint in October.\n\nfhecat.com/waitlist';
  var REPLY_TEXT = 'Card attached. My cat stays encrypted until the reveal. 🐾';

  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var launch = STATUS.exec(LAUNCH_POST);

  // ---------------------------------------------------------------------------
  // state
  // ---------------------------------------------------------------------------
  var state = { done: {}, handle: '', saved: false, post: '', reply: '', wallet: '', entry: null };
  try {
    var kept = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (kept && typeof kept === 'object') state = Object.assign(state, kept);
  } catch (e) {
    /* private mode */
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* private mode */
    }
  }

  function cleanHandle(v) {
    v = String(v || '').trim();
    var m = /(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})/i.exec(v);
    if (m) v = m[1];
    return v.replace(/^@/, '');
  }
  function postBy(handle, raw) {
    var m = STATUS.exec(String(raw || '').trim());
    if (!m || m[1].toLowerCase() !== handle.toLowerCase()) return null;
    return 'https://x.com/' + m[1] + '/status/' + m[2];
  }
  function intent(path, params) {
    var q = Object.keys(params)
      .map(function (k) {
        return k + '=' + encodeURIComponent(params[k]);
      })
      .join('&');
    return 'https://x.com/intent/' + path + '?' + q;
  }

  // ---------------------------------------------------------------------------
  // the card
  // ---------------------------------------------------------------------------
  var canvas = $('#wlCanvas');
  var note = $('#wlCardNote');
  var blob = null; // PNG of the card on screen; null while it's being drawn
  var drawn = 0;
  var drawTimer = null;
  function drawCard() {
    var handle = HANDLE.test(state.handle) ? state.handle : '';
    var seq = ++drawn;
    blob = null;
    return NS.wlcard.render(canvas, handle).then(function () {
      if (seq !== drawn) return;
      note.textContent = handle
        ? 'Card ' + NS.wlcard.cardId(handle) + ' · @' + handle
        : 'Card #0x???????? · waiting for your handle';
      if (!handle) return render();
      return NS.wlcard.toBlob(canvas).then(function (b) {
        if (seq !== drawn) return;
        blob = b;
        render();
      });
    });
  }
  function fileName() {
    return 'fhecat-waitlist-' + state.handle.toLowerCase() + '.png';
  }
  function download() {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }
  /** Phones: hand the PNG (and optionally text) to the share sheet. */
  function share(text) {
    if (!touch || !blob || !navigator.canShare) return null;
    var file = new File([blob], fileName(), { type: 'image/png' });
    var data = text ? { files: [file], text: text } : { files: [file] };
    if (!navigator.canShare(data)) return null;
    return navigator.share(data);
  }

  // ---------------------------------------------------------------------------
  // steps
  // ---------------------------------------------------------------------------
  var steps = $$('.wl-step');
  function stepEl(n) {
    return steps[n - 1];
  }
  function current() {
    for (var n = 1; n <= 5; n++) if (!state.done[n]) return n;
    return 5;
  }
  function setError(n, msg) {
    var el = $('.wl-error', stepEl(n));
    if (el) el.textContent = msg || '';
  }
  var openStep = null;
  function render() {
    var cur = current();
    if (openStep === null || openStep > cur) openStep = cur;
    steps.forEach(function (li, i) {
      var n = i + 1;
      var head = $('.wl-step-head', li);
      var done = !!state.done[n];
      li.classList.toggle('done', done);
      li.classList.toggle('open', n === openStep);
      li.classList.toggle('locked', n > cur);
      head.disabled = n > cur;
      head.setAttribute('aria-expanded', n === openStep ? 'true' : 'false');
      $('.wl-state', li).textContent = done ? 'Done' : n === cur ? (n === 4 && !launch ? 'Soon' : 'Now') : '';
    });
    $('[data-done="2"]').disabled = !(HANDLE.test(state.handle) && state.saved);
    $('#wlSave').disabled = !(HANDLE.test(state.handle) && blob);
    $('#wlSaveAgain').disabled = !blob;
    var finished = state.entry !== null && state.entry !== undefined;
    $('#wlSteps').hidden = finished;
    $('#wlDone').hidden = !finished;
    if (finished) {
      $('#wlDoneMeta').textContent = 'Entry #' + state.entry + ' · @' + state.handle + ' · ' + NS.wlcard.cardId(state.handle);
    }
  }
  function complete(n) {
    state.done[n] = true;
    save();
    openStep = null;
    render();
    var next = stepEl(current());
    if (next && !state.entry) {
      var r = next.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight) next.scrollIntoView({ block: 'center', behavior: 'smooth' });
      var focusable = $('input, .btn', $('.wl-body', next));
      if (focusable && !touch) focusable.focus({ preventScroll: true });
    }
  }
  /** Changing the handle invalidates everything that was tied to it. */
  function resetFrom(n) {
    for (var k = n; k <= 5; k++) delete state.done[k];
  }

  steps.forEach(function (li, i) {
    $('.wl-step-head', li).addEventListener('click', function () {
      openStep = openStep === i + 1 ? current() : i + 1;
      render();
    });
  });

  // 1 · follow
  $('[data-done="1"]').addEventListener('click', function () {
    complete(1);
  });

  // 2 · card
  var handleIn = $('#wlHandle');
  handleIn.value = state.handle ? '@' + state.handle : '';
  handleIn.addEventListener('input', function () {
    var h = cleanHandle(handleIn.value);
    if (h !== state.handle) {
      state.handle = h;
      state.saved = false;
      resetFrom(2);
      save();
    }
    handleIn.classList.toggle('bad', !!h && !HANDLE.test(h));
    setError(2, h && !HANDLE.test(h) ? 'Handles are 1–15 letters, numbers or underscores.' : '');
    blob = null; // the card on screen is for the old handle until it redraws
    render();
    clearTimeout(drawTimer);
    drawTimer = setTimeout(drawCard, 180);
  });
  $('#wlSave').addEventListener('click', function () {
    if (!blob) return;
    var shared = share();
    var after = function () {
      state.saved = true;
      save();
      render();
      toast('Card saved. Keep it for steps 3 and 4.');
    };
    if (shared) shared.then(after, function () {});
    else {
      download();
      after();
    }
  });
  $('[data-done="2"]').addEventListener('click', function () {
    complete(2);
  });

  // 3 · post
  var postIntent = $('#wlPostIntent');
  postIntent.href = intent('tweet', { text: POST_TEXT });
  postIntent.addEventListener('click', function (e) {
    // On phones the share sheet can open X with the card already attached.
    var shared = share(POST_TEXT);
    if (shared) {
      e.preventDefault();
      shared.catch(function () {});
    }
  });
  var postIn = $('#wlPost');
  postIn.value = state.post || '';
  $('[data-done="3"]').addEventListener('click', function () {
    var url = postBy(state.handle, postIn.value);
    if (!url) {
      postIn.classList.add('bad');
      return setError(3, 'Paste the link to your post. It has to be from @' + state.handle + '.');
    }
    postIn.classList.remove('bad');
    setError(3, '');
    state.post = url;
    complete(3);
  });

  // 4 · like, repost, reply
  if (launch) {
    $('#wlLocked').hidden = true;
    $('#wlOpen').hidden = false;
    $('#wlLike').href = intent('like', { tweet_id: launch[2] });
    $('#wlRepost').href = intent('retweet', { tweet_id: launch[2] });
    $('#wlReplyIntent').href = intent('tweet', { in_reply_to: launch[2], text: REPLY_TEXT });
  }
  var replyIn = $('#wlReply');
  replyIn.value = state.reply || '';
  $('[data-done="4"]').addEventListener('click', function () {
    var url = postBy(state.handle, replyIn.value);
    var sameAsPost = url && STATUS.exec(url)[2] === (STATUS.exec(state.post) || [])[2];
    var bad = !url ? 'Paste the link to your reply. It has to be from @' + state.handle + '.' : sameAsPost ? "That's your card post. Paste the reply instead." : '';
    replyIn.classList.toggle('bad', !!bad);
    setError(4, bad);
    if (bad) return;
    state.reply = url;
    complete(4);
  });

  // 5 · wallet + submit
  var walletIn = $('#wlWallet');
  walletIn.value = state.wallet || '';
  var submit = $('#wlSubmit');
  submit.addEventListener('click', function () {
    var wallet = walletIn.value.trim();
    if (!WALLET.test(wallet)) {
      walletIn.classList.add('bad');
      return setError(5, 'That is not an EVM address (0x followed by 40 characters).');
    }
    walletIn.classList.remove('bad');
    setError(5, '');
    state.wallet = wallet;
    save();
    submit.disabled = true;
    $('span', submit).textContent = 'Encrypting…';
    fetch('api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: state.handle, wallet: wallet, post: state.post, reply: state.reply, website: $('#wlSite').value })
    })
      .then(function (res) {
        return res.json().then(
          function (j) {
            return { status: res.status, body: j };
          },
          function () {
            return { status: res.status, body: {} };
          }
        );
      })
      .then(function (r) {
        if (r.status === 200 && r.body.ok) {
          state.entry = r.body.entry || '?';
          state.done[5] = true;
          save();
          render();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        setError(5, r.body.error || 'Something went wrong. Try again in a minute.');
      })
      .catch(function () {
        setError(5, "Couldn't reach the server. Check your connection and try again.");
      })
      .then(function () {
        submit.disabled = false;
        $('span', submit).textContent = 'Join the waitlist';
      });
  });

  // done + reset
  $('#wlSaveAgain').addEventListener('click', function () {
    if (!blob) return;
    var shared = share();
    if (!shared) download();
  });
  $('#wlReset').addEventListener('click', function () {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {
      /* private mode */
    }
    location.reload();
  });

  // ---------------------------------------------------------------------------
  function toast(text) {
    var t = $('#toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      t.classList.remove('on');
    }, 2600);
  }

  function start() {
    P.mountAll(NS.sprites);
    var wm = NS.art.wordmarkCells();
    $$('[data-wordmark]').forEach(function (slot) {
      slot.appendChild(P.svg(wm.cells, { cls: 'wordmark' }));
    });
    $$('[data-stars]').forEach(function (el, i) {
      NS.scene.starfield(el, parseFloat(el.getAttribute('data-stars')) || 1, 70 + i);
    });
    $('#year').textContent = String(new Date().getFullYear());
    render();
    drawCard();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
