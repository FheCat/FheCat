/*
 * The Blind Arena on the testnet, for the admin's Arena tab (GET /api/admin?view=arena).
 * Everything here is public on-chain: who challenged whom, who won, the week's table.
 * The tactics, scores and DNA stay sealed. The admin page reads it through its own API
 * because its content security policy keeps it on this site.
 */
import { createPublicClient, http, parseAbi } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

/** The testnet collection (web/src/config/deployments.json); FheCat.arena() names the arena. */
const FHECAT = '0xd4F8521c8F4dBd22fe8E0877beF1Fd91A0691b24';
const RPC = process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';

const catAbi = parseAbi([
  'function arena() view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function stateOf(uint256 tokenId) view returns (uint8)',
]);
const arenaAbi = parseAbi([
  'struct Duel { uint256 challenger; uint256 opponent; address challengerHolder; address opponentHolder; bytes32 challengerTactic; bytes32 opponentTactic; bytes32 outcome; uint64 openedAt; uint64 foughtAt; uint8 status; bool challengerSealed; bool opponentSealed; uint256 winner; }',
  'struct Record { uint32 wins; uint32 losses; uint32 sealedWins; uint16 streak; uint16 bestStreak; uint8 tier; uint32 badges; }',
  'function duelCount() view returns (uint256)',
  'function claimCount() view returns (uint256)',
  'function currentWeek() view returns (uint256)',
  'function weekStart(uint256 week) view returns (uint256)',
  'function weeklyChampion(uint256 week) view returns (uint256)',
  'function weeklyLeader(uint256 week) view returns (uint256)',
  'function weeklyPoints(uint256 week, uint256 tokenId) view returns (uint32)',
  'function OPEN_FOR() view returns (uint256)',
  'function duelsInRange(uint256 fromId, uint256 toId) view returns (Duel[] list)',
  'function standings(uint256 week, uint256 fromId, uint256 toId) view returns (Record[] recs, uint32[] points)',
  'function claims(uint256 claimId) view returns (uint256 tokenId, uint8 tier, bytes32 reached, bool settled, bool result)',
]);

const OPEN = 1;
const FOUGHT = 2;
const SETTLED = 3;
const CANCELLED = 4;
const BOX = ['Sealed', 'Peeked', 'Opened', 'Revealed'];
const TIERS = ['', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const BADGES = ['First Blood', 'Won Blind', 'Hat-trick', 'Sealed Legend', 'Weekly Crown'];
/** The latest duels and tier claims looked at; the totals count them. */
const RECENT_DUELS = 500n;
const RECENT_CLAIMS = 100n;
const PAGE = 250n;

const badgesOf = (bits) => BADGES.filter((_, i) => (bits >> i) & 1);
const num = (v) => Number(v);

let client;
function chain() {
  client ??= createPublicClient({ chain: arbitrumSepolia, transport: http(RPC, { timeout: 8000, retryCount: 1 }) });
  return client;
}

/** Ranges [from, to] of at most PAGE ids, newest last. */
function pages(from, to) {
  const out = [];
  for (let a = from; a <= to; a += PAGE) out.push([a, a + PAGE - 1n > to ? to : a + PAGE - 1n]);
  return out;
}

export async function arenaView() {
  const c = chain();
  const read = (address, abi) => (functionName, args) => ({ address, abi, functionName, args });
  const cat = read(FHECAT, catAbi);
  const [arena, supply] = await c.multicall({ contracts: [cat('arena'), cat('totalSupply')], allowFailure: false });
  if (/^0x0{40}$/i.test(arena)) return { network: arbitrumSepolia.name, fheCat: FHECAT, arena: null };

  const at = read(arena, arenaAbi);
  const [duelCount, claimCount, week, openFor, block] = await Promise.all([
    c.readContract(at('duelCount')),
    c.readContract(at('claimCount')),
    c.readContract(at('currentWeek')),
    c.readContract(at('OPEN_FOR')),
    c.getBlock(),
  ]);
  const now = num(block.timestamp);
  const last = week > 0n ? week - 1n : 0n;
  const fromDuel = duelCount > RECENT_DUELS ? duelCount - RECENT_DUELS + 1n : 1n;
  const fromClaim = claimCount > RECENT_CLAIMS ? claimCount - RECENT_CLAIMS + 1n : 1n;
  const claimIds = [];
  for (let id = fromClaim; id <= claimCount; id++) claimIds.push(id);

  const [duelPages, standingPages, heads, claimRows] = await Promise.all([
    duelCount ? c.multicall({ contracts: pages(fromDuel, duelCount).map(([a, b]) => at('duelsInRange', [a, b])), allowFailure: false }) : [],
    supply ? c.multicall({ contracts: pages(1n, supply).map(([a, b]) => at('standings', [week, a, b])), allowFailure: false }) : [],
    c.multicall({
      contracts: [at('weekStart', [week]), at('weekStart', [week + 1n]), at('weeklyChampion', [last]), at('weeklyLeader', [last])],
      allowFailure: false,
    }),
    claimIds.length ? c.multicall({ contracts: claimIds.map((id) => at('claims', [id])), allowFailure: false }) : [],
  ]);
  const [weekStart, weekEnd, champion, leader] = heads;

  const duels = duelPages.flat().map((d, i) => ({ ...d, id: fromDuel + BigInt(i) }));
  const live = (d) => d.status === OPEN && now <= num(d.openedAt) + num(openFor);
  const open = duels.filter(live);
  const waiting = duels.filter((d) => d.status === FOUGHT);
  const settled = duels.filter((d) => d.status === SETTLED);

  // Every cat's record and points this week; the table is the cats with points.
  const records = new Map();
  standingPages.forEach(([recs, points], p) => {
    const from = 1n + BigInt(p) * PAGE;
    recs.forEach((r, i) => records.set(from + BigInt(i), { ...r, points: num(points[i]) }));
  });
  const board = [...records.entries()]
    .filter(([, r]) => r.points > 0)
    .sort(([a, x], [b, y]) => y.points - x.points || y.wins - x.wins || Number(a - b))
    .slice(0, 10);

  // Box states for the cats on show.
  const shown = new Set();
  for (const d of open) shown.add(d.challenger);
  for (const [id] of board) shown.add(id);
  const ids = [...shown];
  const states = ids.length ? await c.multicall({ contracts: ids.map((id) => cat('stateOf', [id])), allowFailure: false }) : [];
  const box = new Map(ids.map((id, i) => [id, BOX[num(states[i])] ?? '']));

  const lastLeaderPoints = leader ? num(await c.readContract(at('weeklyPoints', [last, leader]))) : 0;
  const claims = claimRows.map(([tokenId, tier, , isSettled, result], i) => ({ id: num(claimIds[i]), cat: num(tokenId), tier: TIERS[tier], settled: isSettled, result }));
  let players = 0;
  let badges = 0;
  for (const r of records.values()) {
    if (r.wins + r.losses > 0) players++;
    badges += badgesOf(r.badges).length;
  }

  return {
    network: arbitrumSepolia.name,
    chainId: arbitrumSepolia.id,
    fheCat: FHECAT,
    arena,
    now,
    week: num(week),
    weekStart: num(weekStart),
    weekEnd: num(weekEnd),
    totals: {
      duels: num(duelCount),
      settled: settled.length,
      open: open.length,
      waiting: waiting.length,
      cancelled: duels.filter((d) => d.status === CANCELLED).length,
      sealedWins: settled.filter((d) => (d.winner === d.challenger ? d.challengerSealed : d.opponentSealed)).length,
      players,
      badges,
      claims: num(claimCount),
      proven: claims.filter((x) => x.settled && x.result).length,
    },
    open: open.reverse().map((d) => ({
      id: num(d.id),
      challenger: num(d.challenger),
      opponent: num(d.opponent),
      box: box.get(d.challenger) ?? '',
      openedAt: num(d.openedAt),
      endsAt: num(d.openedAt) + num(openFor),
    })),
    waiting: waiting.reverse().map((d) => ({ id: num(d.id), challenger: num(d.challenger), opponent: num(d.opponent), foughtAt: num(d.foughtAt) })),
    results: settled
      .reverse()
      .slice(0, 12)
      .map((d) => {
        const challengerWon = d.winner === d.challenger;
        return {
          id: num(d.id),
          winner: num(d.winner),
          loser: num(challengerWon ? d.opponent : d.challenger),
          sealed: challengerWon ? d.challengerSealed : d.opponentSealed,
          foughtAt: num(d.foughtAt),
        };
      }),
    board: board.map(([id, r]) => ({
      cat: num(id),
      points: r.points,
      wins: r.wins,
      losses: r.losses,
      sealedWins: r.sealedWins,
      streak: r.streak,
      badges: badgesOf(r.badges),
      box: box.get(id) ?? '',
    })),
    lastWeek: { week: num(last), champion: num(champion), leader: num(leader), points: lastLeaderPoints },
    claims: claims.reverse().slice(0, 8),
  };
}
