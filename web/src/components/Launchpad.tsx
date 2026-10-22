import { useEffect, useState, type ReactNode } from 'react';
import { decodeEventLog, parseEther, parseUnits, type Hash } from 'viem';
import { useBalance, useConnection, usePublicClient, useReadContract, useReadContracts, useWriteContract } from 'wagmi';
import { Encryptable, FheTypes } from '@cofhe/sdk';
import { fheCatRewardsAbi, fheLaunchTokenAbi, fheLaunchpadAbi } from '../config/abi';
import { explorerUrl, type Deployment } from '../config/chains';
import { ensurePermit, useCofhe } from '../lib/cofhe';
import { useMyCats } from '../lib/hooks';
import { failure, formatEth, retry, shortAddress } from '../lib/format';
import { DECIMALS, PHASE_LABEL, eth, phaseOf, timeLeft, tokens, useLaunchpad, type Launch, type Phase } from '../lib/launchpad';
import { Sprite } from '../pixel/Sprite';
import { Stars } from '../pixel/Sky';
import { useToast } from '../pixel/Toast';
import { ChapterHead } from './Chapter';
import { ConnectButton } from './ConnectButton';

const POLL = { refetchInterval: 12_000 };
const CELLS = 20;
const DURATIONS: [string, number][] = [
  ['10 minutes', 600],
  ['1 hour', 3600],
  ['6 hours', 6 * 3600],
  ['1 day', 86400],
  ['3 days', 3 * 86400],
  ['7 days', 7 * 86400],
];
export const SEPOLIA_FAUCET = 'https://www.alchemy.com/faucets/ethereum-sepolia';

type Note = { ok: boolean; text: string } | null;

/** How many tokens one ETH buys: `units` (base units) for `wei`. Easier to read than a price like 1e-9 ETH. */
function perEth(units: bigint, wei: bigint): string {
  return tokens((units * 10n ** 18n) / wei);
}

/** Re-renders every second, for countdowns. */
function useClock() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
}

function Panel({ title, value, id, children }: { title: string; value?: ReactNode; id?: string; children: ReactNode }) {
  return (
    <div className="box owner-box" id={id}>
      <p className="panel-head">
        <span>{title}</span>
        {value !== undefined && <span className="mono">{value}</span>}
      </p>
      {children}
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: 'decimal' | 'numeric'; bad?: boolean; hint?: string }) {
  return (
    <label className="owner-field">
      <span>{props.label}</span>
      <input
        className={`field ${props.bad ? 'bad' : ''}`}
        value={props.value}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        spellCheck={false}
        aria-invalid={props.bad || undefined}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.hint && <small className="lp-hint">{props.hint}</small>}
    </label>
  );
}

type Receipt = { status: 'success' | 'reverted'; logs: { data: `0x${string}`; topics: [`0x${string}`, ...`0x${string}`[]] | [] }[] };

/** Sends a transaction and waits for it; `busy` names the one running. */
function useRunner(chainId: number) {
  const toast = useToast();
  const write = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);

  async function run(label: string, done: string, send: () => Promise<Hash>, after?: (r: Receipt) => Promise<void>) {
    if (!publicClient) return;
    setBusy(label);
    setNote(null);
    try {
      const hash = await send();
      const receipt = (await publicClient.waitForTransactionReceipt({ hash })) as unknown as Receipt;
      if (receipt.status !== 'success') throw new Error('Transaction reverted');
      if (after) await after(receipt);
      setNote({ ok: true, text: done });
      toast(done);
    } catch (e) {
      setNote({ ok: false, text: failure(e) });
    } finally {
      setBusy(null);
    }
  }
  return { run, busy, note, setNote, write };
}

// ---------------------------------------------------------------------------
// launch a token
// ---------------------------------------------------------------------------

export function CreatePanel({ chainId, pad, fee, feeBps, holderBps, onDone }: { chainId: number; pad: `0x${string}`; fee?: bigint; feeBps: bigint; holderBps: bigint; onDone: () => void }) {
  const { isConnected, address } = useConnection();
  const balance = useBalance({ address, chainId, query: { enabled: Boolean(address), ...POLL } });
  const { run, busy, note, write } = useRunner(chainId);
  const [f, setF] = useState({ name: '', symbol: '', supply: '1000000', sale: '60', soft: '0.01', hard: '0.1', max: '', duration: 86400, info: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  // Parsed values, or the field that is wrong.
  const num = (v: string) => (/^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN);
  const ethOf = (v: string) => {
    try {
      return parseEther(v.trim() || '0');
    } catch {
      return -1n;
    }
  };
  const supply = /^\d{1,13}$/.test(f.supply.replace(/[,_\s]/g, '')) ? BigInt(f.supply.replace(/[,_\s]/g, '')) : 0n;
  const salePct = num(f.sale);
  const soft = ethOf(f.soft);
  const hard = ethOf(f.hard);
  const max = f.max.trim() ? ethOf(f.max) : 0n;
  const bad = {
    name: f.name.trim().length > 32,
    symbol: !/^[A-Za-z0-9]{0,11}$/.test(f.symbol.trim()),
    supply: supply === 0n || supply > 1_000_000_000_000n,
    sale: !(salePct > 0 && salePct <= 100),
    soft: soft < 0n || (hard > 0n && soft > hard),
    hard: hard <= 0n,
    max: max < 0n,
    info: f.info.trim().length > 200,
  };
  const ready = Boolean(f.name.trim() && f.symbol.trim()) && !Object.values(bad).some(Boolean);
  const saleTokens = ready ? (supply * BigInt(Math.round(salePct * 100))) / 10_000n : 0n;
  const keepTokens = ready ? supply - saleTokens : 0n;
  const atHard = ready ? hard : 0n;
  const platformFee = (atHard * feeBps) / 10_000n;
  const toHolders = (platformFee * holderBps) / 10_000n;
  const short = fee !== undefined && balance.data !== undefined && balance.data.value < fee;

  async function launch() {
    if (!fee || !ready) return;
    const params = {
      name: f.name.trim(),
      symbol: f.symbol.trim().toUpperCase(),
      supplyTokens: supply,
      saleBps: BigInt(Math.round(salePct * 100)),
      softCap: soft,
      hardCap: hard,
      maxPerWallet: max,
      duration: BigInt(f.duration),
      info: f.info.trim(),
    };
    // A little over the quoted fee covers a price move before the block; the launchpad sends the rest back.
    await run('launch', `$${params.symbol} is live`, () => write.mutateAsync({ address: pad, abi: fheLaunchpadAbi, chainId, functionName: 'createLaunch', args: [params], value: fee + fee / 20n }), async () => {
      setF((x) => ({ ...x, name: '', symbol: '', info: '' }));
      onDone();
      location.hash = 'sales';
    });
  }

  return (
    <div className="lp-create">
      <Panel title="Your token" id="create-form">
        <div className="lp-form">
          <Field label="Name" value={f.name} onChange={set('name')} placeholder="Cipher Coin" bad={bad.name} />
          <Field label="Symbol" value={f.symbol} onChange={set('symbol')} placeholder="CIPH" bad={bad.symbol} hint="Up to 11 letters or digits" />
          <Field label="Supply (tokens)" value={f.supply} onChange={set('supply')} inputMode="numeric" bad={bad.supply} hint="6 decimals, up to 1 trillion" />
          <Field label="For sale (%)" value={f.sale} onChange={set('sale')} inputMode="decimal" bad={bad.sale} hint="The rest is yours after the sale" />
          <Field label="Soft cap (ETH)" value={f.soft} onChange={set('soft')} inputMode="decimal" bad={bad.soft} hint="Below this, everyone is refunded" />
          <Field label="Hard cap (ETH)" value={f.hard} onChange={set('hard')} inputMode="decimal" bad={bad.hard} hint="The sale closes once it is full" />
          <Field label="Max per wallet (ETH)" value={f.max} onChange={set('max')} placeholder="No limit" inputMode="decimal" bad={bad.max} />
          <label className="owner-field">
            <span>Sale runs for</span>
            <select className="field" value={f.duration} onChange={(e) => setF((x) => ({ ...x, duration: Number(e.target.value) }))}>
              {DURATIONS.map(([label, s]) => (
                <option key={s} value={s}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Field label="Website, X link or one line" value={f.info} onChange={set('info')} placeholder="https://x.com/yourtoken" bad={bad.info} />
      </Panel>

      <Panel title="Summary" value={fee ? `$1 ≈ ${eth(fee)} ETH` : undefined}>
        <dl className="spec-data lp-summary">
          <div>
            <dt>Token</dt>
            <dd>{f.symbol.trim() ? `$${f.symbol.trim().toUpperCase()}` : '-'}</dd>
          </div>
          <div>
            <dt>For sale</dt>
            <dd>{ready ? tokens(saleTokens * 10n ** BigInt(DECIMALS)) : '-'}</dd>
          </div>
          <div>
            <dt>You keep</dt>
            <dd>{ready ? tokens(keepTokens * 10n ** BigInt(DECIMALS)) : '-'}</dd>
          </div>
          <div>
            <dt>Tokens per ETH if full</dt>
            <dd>{ready && hard > 0n ? perEth(saleTokens * 10n ** BigInt(DECIMALS), hard) : '-'}</dd>
          </div>
          <div>
            <dt>Launch fee now</dt>
            <dd>{fee ? `${eth(fee)} ETH` : '-'}</dd>
          </div>
          <div>
            <dt>Fee if it fills</dt>
            <dd>{ready ? `${eth(platformFee)} ETH` : '-'}</dd>
          </div>
          <div>
            <dt>Of which to cats</dt>
            <dd>{ready ? `${eth(toHolders)} ETH` : '-'}</dd>
          </div>
        </dl>
        <p className="owner-note">
          The launch fee is paid now. The {Number(feeBps) / 100}% platform fee is only taken from a sale that succeeds; you get the rest of the
          ETH and your share of the supply when it closes.
        </p>
        {!isConnected ? (
          <ConnectButton />
        ) : (
          <>
            <button className="btn btn-wide" disabled={!fee || !ready || busy !== null || short} onClick={() => void launch()}>
              <span>{busy ? 'Launching…' : 'Launch for $1'}</span>
              <Sprite name="i-arrow" />
            </button>
            {short && (
              <p className="owner-note">
                Not enough Sepolia ETH for the fee.{' '}
                <a className="link" href={SEPOLIA_FAUCET} target="_blank" rel="noreferrer">
                  Get free test ETH
                </a>
              </p>
            )}
          </>
        )}
        {note && <p className={`note ${note.ok ? 'ok' : 'error'}`}>{note.text}</p>}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FheCat holders' share
// ---------------------------------------------------------------------------

export function RewardsPanel({ chainId, rewards, totalSupply, mintHref }: { chainId: number; rewards: `0x${string}`; totalSupply: bigint | undefined; mintHref: string }) {
  const { isConnected } = useConnection();
  const { cats } = useMyCats(totalSupply);
  const ids = cats.map((c) => c.tokenId);
  const vault = useBalance({ address: rewards, chainId, query: POLL });
  const pending = useReadContract({ address: rewards, abi: fheCatRewardsAbi, chainId, functionName: 'pendingMany', args: [ids], query: { enabled: ids.length > 0, ...POLL } });
  const { run, busy, note, write } = useRunner(chainId);
  const owed = (pending.data as bigint | undefined) ?? 0n;

  return (
    <Panel title="Your FheCat share" value={vault.data ? `in the vault ${eth(vault.data.value)} ETH` : undefined}>
      <p className="owner-note">
        Half of the platform fee from every successful sale is split between the cats minted at that moment. The share follows the cat: whoever
        holds it claims it, whenever they like.
      </p>
      {!isConnected ? (
        <ConnectButton />
      ) : ids.length === 0 ? (
        <>
          <p className="owner-note">No cats in this wallet yet. A cat minted now shares in every sale that succeeds from here on.</p>
          <a className="btn btn-sm" href={mintHref}>
            <span>Mint a cat</span>
            <Sprite name="i-arrow" />
          </a>
        </>
      ) : (
        <>
          <dl className="spec-data">
            <div>
              <dt>Your cats</dt>
              <dd>{ids.length}</dd>
            </div>
            <div>
              <dt>To claim</dt>
              <dd>{eth(owed)} ETH</dd>
            </div>
          </dl>
          <button
            className="btn btn-sm"
            disabled={owed === 0n || busy !== null}
            onClick={() =>
              void run('claim', `Claimed ${eth(owed)} ETH`, () => write.mutateAsync({ address: rewards, abi: fheCatRewardsAbi, chainId, functionName: 'claim', args: [ids] }), async () => void pending.refetch())
            }
          >
            {busy ? 'Claiming…' : 'Claim'}
          </button>
        </>
      )}
      {note && <p className={`note ${note.ok ? 'ok' : 'error'}`}>{note.text}</p>}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// the sales
// ---------------------------------------------------------------------------

const FILTERS: [string, (p: Phase) => boolean][] = [
  ['Live', (p) => p === 'live'],
  ['Ended', (p) => p !== 'live'],
  ['All', () => true],
];

export function SaleList({ chainId, pad, launches, loaded, onChange }: { chainId: number; pad: `0x${string}`; launches: Launch[]; loaded: boolean; onChange: () => void }) {
  useClock();
  const live = launches.filter((l) => phaseOf(l) === 'live').length;
  const [filter, setFilter] = useState<number | null>(null);
  const shown = filter ?? (live > 0 ? 0 : 2);
  const list = launches.filter((l) => FILTERS[shown][1](phaseOf(l)));
  // Live first, ending soonest; then the rest, newest first.
  list.sort((a, b) => {
    const la = phaseOf(a) === 'live',
      lb = phaseOf(b) === 'live';
    if (la !== lb) return la ? -1 : 1;
    return la ? Number(a.end - b.end) : Number(b.id - a.id);
  });

  // A shared link (#sale-3) scrolls to its card once the list is in.
  useEffect(() => {
    const m = /^#sale-(\d+)$/.exec(location.hash);
    if (m && loaded) {
      if (filter === null) setFilter(2);
      setTimeout(() => document.getElementById(`sale-${m[1]}`)?.scrollIntoView({ block: 'center' }), 50);
    }
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="lp-list-bar">
        <div className="seg" role="group" aria-label="Show sales">
          {FILTERS.map(([name], i) => (
            <button key={name} className={i === shown ? 'active' : ''} aria-pressed={i === shown} onClick={() => setFilter(i)}>
              {name}
              {i === 0 && live > 0 ? ` · ${live}` : ''}
            </button>
          ))}
        </div>
        <a className="link" href="#create">
          Launch yours
        </a>
      </div>
      {!loaded ? (
        <div className="empty box">
          <p>Reading the sales from the chain…</p>
        </div>
      ) : list.length === 0 ? (
        <div className="empty box">
          <Sprite name="noiseCat" className="empty-cat" />
          <div>
            <p>{shown === 0 ? 'No sale is live right now.' : 'Nothing here yet.'}</p>
            <a className="btn" href="#create">
              <span>Launch the next one</span>
              <Sprite name="i-arrow" />
            </a>
          </div>
        </div>
      ) : (
        <div className="lp-list">
          {list.map((l) => (
            <LaunchCard key={l.id.toString()} l={l} chainId={chainId} pad={pad} onChange={onChange} />
          ))}
        </div>
      )}
    </>
  );
}

function LaunchCard({ l, chainId, pad, onChange }: { l: Launch; chainId: number; pad: `0x${string}`; onChange: () => void }) {
  const { address, isConnected } = useConnection();
  const toast = useToast();
  const call = { address: pad, abi: fheLaunchpadAbi, chainId } as const;
  const tok = { address: l.token, abi: fheLaunchTokenAbi, chainId } as const;
  const mine = useReadContracts({
    contracts: [
      { ...call, functionName: 'contributed', args: [l.id, address!] },
      { ...call, functionName: 'claimable', args: [l.id, address!] },
      { ...call, functionName: 'claimed', args: [l.id, address!] },
      { ...tok, functionName: 'balanceOf', args: [address!] },
      { ...tok, functionName: 'shieldedBalanceOf', args: [address!] },
    ],
    allowFailure: false,
    query: { enabled: Boolean(address), ...POLL },
  });
  const { run, busy, note, write } = useRunner(chainId);
  const [amount, setAmount] = useState('');

  const [contributed, claimable, claimed, publicBal, shieldedHandle] = (mine.data ?? [0n, 0n, false, 0n, '0x0']) as [bigint, bigint, boolean, bigint, `0x${string}`];
  const refetch = () => {
    onChange();
    void mine.refetch();
  };
  const phase = phaseOf(l);
  const end = Number(l.end);
  // The contract answers 0 once claimed; the share itself is the same arithmetic.
  const share = l.raised > 0n ? (l.saleSupply * contributed) / l.raised : 0n;
  const pct = Number((l.raised * 1000n) / l.hardCap) / 10;
  const lit = Number((l.raised * BigInt(CELLS) + l.hardCap - 1n) / l.hardCap);
  const softMet = l.raised >= l.softCap;
  const room = l.hardCap - l.raised;
  const walletRoom = l.maxPerWallet > 0n ? l.maxPerWallet - contributed : room;
  const canSend = room < walletRoom ? room : walletRoom;
  const link = `${location.origin}${location.pathname}#sale-${l.id}`;

  const buy = () => {
    let value: bigint;
    try {
      value = parseEther(amount);
    } catch {
      return;
    }
    if (value <= 0n) return;
    void run('buy', `You're in $${l.symbol} with ${formatEth(value > canSend ? canSend : value)} ETH`, () => write.mutateAsync({ ...call, functionName: 'contribute', args: [l.id], value }), async () => {
      setAmount('');
      refetch();
    });
  };

  return (
    <article className={`box lp-card is-${phase}`} id={`sale-${l.id}`}>
      <header className="lp-card-head">
        <div>
          <p className="lp-symbol mono">${l.symbol}</p>
          <h4>{l.name}</h4>
        </div>
        <span className={`lp-status is-${phase}`}>{PHASE_LABEL[phase]}</span>
      </header>
      {l.info && (
        <p className="lp-info">
          {/^https:\/\/[^\s]+$/.test(l.info) ? (
            <a className="link" href={l.info} target="_blank" rel="noreferrer noopener nofollow">
              {l.info.replace(/^https:\/\//, '')}
            </a>
          ) : (
            l.info
          )}
        </p>
      )}

      <p className="lp-raised">
        <span>
          Raised · {pct.toFixed(pct < 10 ? 1 : 0)}%{l.softCap > 0n ? (softMet ? ' · soft cap met' : '') : ''}
        </span>
        <b className="mono">
          {formatEth(l.raised)} / {formatEth(l.hardCap)} ETH
        </b>
      </p>
      <div className="cells" role="progressbar" aria-label="Raised" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        {Array.from({ length: CELLS }, (_, i) => (
          <i key={i} className={i < lit ? 'on' : undefined} />
        ))}
      </div>
      <dl className="spec-data">
        <div>
          <dt>{phase === 'live' ? 'Ends in' : 'Ended'}</dt>
          <dd>{phase === 'live' ? timeLeft(end) : new Date(end * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</dd>
        </div>
        <div>
          <dt>For sale</dt>
          <dd>{tokens(l.saleSupply)}</dd>
        </div>
        <div>
          <dt>Soft cap</dt>
          <dd>{l.softCap === 0n ? 'None' : `${formatEth(l.softCap)} ETH`}</dd>
        </div>
        {l.maxPerWallet > 0n && (
          <div>
            <dt>Per wallet</dt>
            <dd>{formatEth(l.maxPerWallet)} ETH</dd>
          </div>
        )}
        <div>
          <dt>Tokens per ETH</dt>
          <dd>{l.raised > 0n ? perEth(l.saleSupply, l.raised) : '-'}</dd>
        </div>
        <div>
          <dt>Creator</dt>
          <dd className="mono">
            <a className="link" href={explorerUrl(chainId, 'address', l.creator)} target="_blank" rel="noreferrer">
              {shortAddress(l.creator)}
            </a>
          </dd>
        </div>
        <div>
          <dt>Token</dt>
          <dd className="mono">
            <a className="link" href={explorerUrl(chainId, 'token', l.token)} target="_blank" rel="noreferrer">
              {shortAddress(l.token)}
            </a>
          </dd>
        </div>
      </dl>

      {!isConnected ? (
        phase === 'live' && <ConnectButton />
      ) : (
        <>
          {contributed > 0n && (
            <p className="lp-mine">
              You sent {formatEth(contributed)} ETH
              {phase !== 'failed' && share > 0n ? ` · ${phase === 'succeeded' ? 'your share' : 'your share now'} ${tokens(share)} $${l.symbol}` : ''}
              {claimed ? ' · claimed' : ''}
            </p>
          )}

          {phase === 'live' && (
            <div className="lp-row">
              <input className="field" value={amount} placeholder="ETH" inputMode="decimal" onChange={(e) => setAmount(e.target.value)} aria-label={`ETH to send to $${l.symbol}`} />
              <button className="btn btn-sm" disabled={!amount || busy !== null || canSend <= 0n} onClick={buy}>
                {busy === 'buy' ? 'Sending…' : 'Buy in'}
              </button>
            </div>
          )}
          {phase === 'closing' && (
            <>
              <button className="btn btn-sm" disabled={busy !== null} onClick={() => void run('finalize', `$${l.symbol} sale closed`, () => write.mutateAsync({ ...call, functionName: 'finalize', args: [l.id] }), async () => refetch())}>
                {busy === 'finalize' ? 'Closing…' : 'Close the sale'}
              </button>
              <p className="owner-note">The sale is over. Anyone can close it; then buyers claim their tokens{l.softCap > 0n && !softMet ? ' (or, below the soft cap, their ETH back)' : ''}.</p>
            </>
          )}
          {phase === 'succeeded' && claimable > 0n && !claimed && (
            <div className="lp-row">
              <button className="btn btn-sm" disabled={busy !== null} onClick={() => void run('claim', `${tokens(claimable)} $${l.symbol} claimed`, () => write.mutateAsync({ ...call, functionName: 'claim', args: [l.id, false] }), async () => refetch())}>
                Claim
              </button>
              <button className="btn btn-sm btn-ghost" disabled={busy !== null} onClick={() => void run('claim', `${tokens(claimable)} $${l.symbol} claimed into your shielded balance`, () => write.mutateAsync({ ...call, functionName: 'claim', args: [l.id, true] }), async () => refetch())}>
                <Sprite name="i-lock" />
                <span>Claim shielded</span>
              </button>
            </div>
          )}
          {phase === 'failed' && contributed > 0n && (
            <button className="btn btn-sm" disabled={busy !== null} onClick={() => void run('refund', 'ETH sent back', () => write.mutateAsync({ ...call, functionName: 'refund', args: [l.id] }), async () => refetch())}>
              Take my ETH back
            </button>
          )}

          {phase === 'succeeded' && (publicBal > 0n || BigInt(shieldedHandle) !== 0n) && (
            <Wallet chainId={chainId} token={l.token} symbol={l.symbol} publicBal={publicBal} handle={shieldedHandle} onChange={refetch} />
          )}
        </>
      )}
      <footer className="lp-card-foot">
        <button
          className="link-btn"
          onClick={() => {
            void navigator.clipboard?.writeText(link).then(() => toast('Link copied'), () => {});
          }}
        >
          Copy link
        </button>
        <span className="mono">#{l.id.toString()}</span>
      </footer>
      {note && <p className={`note ${note.ok ? 'ok' : 'error'}`}>{note.text}</p>}
    </article>
  );
}

/** A holder's two balances of one token, and the moves between them. */
function Wallet(props: { chainId: number; token: `0x${string}`; symbol: string; publicBal: bigint; handle: `0x${string}`; onChange: () => void }) {
  const { chainId, token, symbol, publicBal, handle, onChange } = props;
  const cofhe = useCofhe();
  const publicClient = usePublicClient({ chainId });
  const { run, busy, note, setNote, write } = useRunner(chainId);
  const [shielded, setShielded] = useState<bigint | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [amount, setAmount] = useState('');
  const [to, setTo] = useState('');
  const call = { address: token, abi: fheLaunchTokenAbi, chainId } as const;

  // A new ciphertext means the decrypted number is out of date.
  useEffect(() => setShielded(null), [handle]);

  async function reveal() {
    if (!cofhe || BigInt(handle) === 0n) return setShielded(0n);
    setRevealing(true);
    setNote(null);
    try {
      await ensurePermit(cofhe);
      // The coprocessor may still be working on a fresh balance; the threshold network answers once it's done.
      setShielded((await retry(() => cofhe.decryptForView(handle, FheTypes.Uint64).execute(), 10, 4000)) as bigint);
    } catch (e) {
      setNote({ ok: false, text: failure(e) });
    } finally {
      setRevealing(false);
    }
  }

  const units = () => {
    try {
      const v = parseUnits(amount, DECIMALS);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  };
  const encrypt = async (v: bigint) => {
    if (!cofhe) throw new Error('Connect your wallet first');
    const [hash, proof] = await cofhe.encryptInputs([Encryptable.uint64(v)]).setConsumingContract(token).execute();
    return [hash as `0x${string}`, proof as `0x${string}`] as const;
  };
  const done = async () => {
    setAmount('');
    onChange();
  };

  function shield() {
    const v = units();
    if (!v) return setNote({ ok: false, text: 'Enter an amount.' });
    void run('shield', `${amount} $${symbol} shielded`, () => write.mutateAsync({ ...call, functionName: 'shield', args: [v] }), done);
  }
  function send() {
    const v = units();
    if (!v || !/^0x[0-9a-fA-F]{40}$/.test(to)) return setNote({ ok: false, text: 'Enter an amount and a wallet address.' });
    void run('send', `Sent privately to ${shortAddress(to)}`, async () => {
      const [hash, proof] = await encrypt(v);
      return write.mutateAsync({ ...call, functionName: 'transferShielded', args: [to as `0x${string}`, hash, proof] });
    }, done);
  }
  function unshield() {
    const v = units();
    if (!v || !publicClient) return setNote({ ok: false, text: 'Enter an amount.' });
    void run(
      'unshield',
      `${amount} $${symbol} back in your public balance`,
      async () => {
        const [hash, proof] = await encrypt(v);
        return write.mutateAsync({ ...call, functionName: 'unshield', args: [hash, proof] });
      },
      async (receipt) => {
        // Step two: the threshold network decrypts that one amount, and its proof credits it.
        const ev = receipt.logs
          .map((log) => {
            try {
              return decodeEventLog({ abi: fheLaunchTokenAbi, data: log.data, topics: log.topics });
            } catch {
              return null;
            }
          })
          .find((e) => e?.eventName === 'UnshieldRequested');
        if (!ev || ev.eventName !== 'UnshieldRequested') throw new Error('Unshield request not found');
        const { id, amountHandle } = ev.args;
        const { decryptedValue, signature } = await cofhe!.decryptForTx(amountHandle).withoutACP().set404RetryTimeout(90_000).execute();
        const hash = await write.mutateAsync({ ...call, functionName: 'finishUnshield', args: [id, BigInt(decryptedValue), signature as `0x${string}`] });
        const r = await publicClient.waitForTransactionReceipt({ hash });
        if (r.status !== 'success') throw new Error('Finishing the unshield failed');
        await done();
      },
    );
  }

  return (
    <div className="lp-wallet">
      <p className="panel-head">
        <span>Your ${symbol}</span>
      </p>
      <dl className="spec-data">
        <div>
          <dt>Public</dt>
          <dd>{tokens(publicBal)}</dd>
        </div>
        <div>
          <dt>Shielded</dt>
          <dd>
            {shielded !== null ? (
              tokens(shielded)
            ) : (
              <button className="link-btn" disabled={revealing || !cofhe} onClick={() => void reveal()}>
                {revealing ? 'Decrypting…' : 'Encrypted · show me'}
              </button>
            )}
          </dd>
        </div>
      </dl>
      <div className="lp-row">
        <input className="field" value={amount} placeholder={`Amount of $${symbol}`} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} aria-label={`Amount of ${symbol}`} />
      </div>
      <div className="lp-row">
        <button className="btn btn-sm btn-ghost" disabled={busy !== null || publicBal === 0n} onClick={shield}>
          {busy === 'shield' ? 'Shielding…' : 'Shield'}
        </button>
        <button className="btn btn-sm btn-ghost" disabled={busy !== null || BigInt(handle) === 0n} onClick={unshield}>
          {busy === 'unshield' ? 'Unshielding…' : 'Unshield'}
        </button>
      </div>
      <div className="lp-row">
        <input className="field" value={to} placeholder="Send privately to 0x…" spellCheck={false} onChange={(e) => setTo(e.target.value.trim())} aria-label="Recipient" />
        <button className="btn btn-sm" disabled={busy !== null || BigInt(handle) === 0n} onClick={send}>
          {busy === 'send' ? 'Sending…' : 'Send'}
        </button>
      </div>
      <p className="owner-note">Shielded amounts stay encrypted on-chain; only you can read yours. Sending more than you hold moves nothing. Unshielding takes two transactions.</p>
      {note && <p className={`note ${note.ok ? 'ok' : 'error'}`}>{note.text}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// the mint site's pointer to the launchpad
// ---------------------------------------------------------------------------

export function LaunchpadTeaser({ n, chainId, deployment, href }: { n: string; chainId: number; deployment: Deployment; href: string }) {
  const lp = useLaunchpad(deployment.launchpad!, chainId);
  return (
    <section className="chapter" id="launch">
      <Stars density={0.5} seed={88} />
      <div className="wrap split">
        <ChapterHead n={n} label="Launchpad" title="Launch in the dark.">
          <p>
            Launch a token for $1. Buyers get their share in the open or straight into a shielded balance only they can read. Half of the 2%
            platform fee from every successful sale goes to FheCat holders.
          </p>
          <div className="hero-cta lp-teaser-cta">
            <a className="btn" href={href}>
              <span>Open the launchpad</span>
              <Sprite name="i-arrow" />
            </a>
          </div>
        </ChapterHead>
        <div className="box lp-teaser-box">
          <LaunchStats stats={lp.stats} feeBps={lp.feeBps} holderBps={lp.holderBps} />
        </div>
      </div>
    </section>
  );
}

export function LaunchStats({ stats, feeBps, holderBps }: { stats: ReturnType<typeof useLaunchpad>['stats']; feeBps: bigint; holderBps: bigint }) {
  return (
    <dl className="lp-stats">
      <div>
        <dt>Launches</dt>
        <dd>{stats.launches.toString()}</dd>
      </div>
      <div>
        <dt>Live now</dt>
        <dd>{stats.live}</dd>
      </div>
      <div>
        <dt>Raised</dt>
        <dd>{eth(stats.raised)} ETH</dd>
      </div>
      <div>
        <dt>To FheCat holders</dt>
        <dd>{eth(stats.toHolders)} ETH</dd>
      </div>
      <div>
        <dt>Launch fee</dt>
        <dd>$1</dd>
      </div>
      <div>
        <dt>Platform fee</dt>
        <dd>
          {Number(feeBps) / 100}% · {Number(holderBps) / 100}% of it to cats
        </dd>
      </div>
    </dl>
  );
}
