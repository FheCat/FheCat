/*
 * Live numbers for the homepage's Launchpad chapter, read straight from Ethereum Sepolia:
 * how many tokens have launched, and the ETH waiting in the FheCat holders' vault.
 * Addresses: web/src/config/deployments.json.
 */
(function () {
  var RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
  var LAUNCHPAD = '0xFf55827d880ab9FEac379Cb0E2F1A7Ab58926670';
  var REWARDS = '0x4948cBd6E5D606D241F049eE43ede923CEF26BDB';
  var LAUNCH_COUNT = '0x27cca59f'; // launchCount()
  var count = document.getElementById('lpCount');
  var vault = document.getElementById('lpVault');
  if (!count || !vault) return;

  function rpc(method, params) {
    return fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (j.error || typeof j.result !== 'string') throw new Error('rpc');
        return j.result;
      });
  }
  /** Wei as ETH with 4 significant digits: 0.00002586 */
  function eth(hex) {
    var wei = BigInt(hex);
    if (wei === 0n) return '0 ETH';
    return Number(Number(wei) / 1e18).toPrecision(4).replace(/(\.\d*?)0+(e|$)/, '$1$2').replace(/\.(e|$)/, '$1') + ' ETH';
  }
  function load() {
    rpc('eth_call', [{ to: LAUNCHPAD, data: LAUNCH_COUNT }, 'latest'])
      .then(function (r) {
        count.textContent = String(BigInt(r));
      })
      .catch(function () {
        count.textContent = '–';
      });
    rpc('eth_getBalance', [REWARDS, 'latest'])
      .then(function (r) {
        vault.textContent = eth(r);
      })
      .catch(function () {
        vault.textContent = '–';
      });
  }
  // Only once the chapter is close, so the hero loads first.
  var section = document.getElementById('launchpad');
  if ('IntersectionObserver' in window && section) {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        io.disconnect();
        load();
      }
    }, { rootMargin: '400px' });
    io.observe(section);
  } else {
    load();
  }
})();
