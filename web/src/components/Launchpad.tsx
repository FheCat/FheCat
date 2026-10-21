import { useEffect, useState, type ReactNode } from 'react';
import { decodeEventLog, formatUnits, parseEther, parseUnits, type Hash } from 'viem';
import { useBalance, useConnection, usePublicClient, useReadContract, useReadContracts, useWriteContract } from 'wagmi';
import { Encryptable, FheTypes } from '@cofhe/sdk';
import { fheCatRewardsAbi, fheLaunchTokenAbi, fheLaunchpadAbi } from '../config/abi';
import { explorerUrl, type Deployment } from '../config/chains';
import { ensurePermit, useCofhe } from '../lib/cofhe';
import { useMyCats } from '../lib/hooks';
import { failure, formatEth, retry, shortAddress } from '../lib/format';
import { Sprite } from '../pixel/Sprite';
import { Stars } from '../pixel/Sky';
import { useToast } from '../pixel/Toast';
import { ChapterHead } from './Chapter';
import { ConnectButton } from './ConnectButton';

const POLL = { refetchInterval: 12_000 };
const SHOWN = 12n;
const DECIMALS = 6;
const CELLS = 20;
const STATUS = ['Live', 'Succeeded', 'Failed'] as const;
const DURATIONS: [string, number][] = [
  ['10 minutes', 600],
  ['1 hour', 3600],
  ['6 hours', 6 * 3600],
  ['1 day', 86400],
  ['3 days', 3 * 86400],
  ['7 days', 7 * 86400],
];

type Note = { ok: boolean; text: string } | null;

/** A small ETH amount without a tail of digits: 0.0004007 rather than 0.000400691853... */
const eth = (wei: bigint) => (wei === 0n ? '0' : Number(formatEth(wei)).toPrecision(4).replace(/(\.\d*?)0+(e|$)/, '$1$2').replace(/\.(e|$)/, '$1'));

const tokens = (v: bigint) => Number(formatUnits(v, DECIMALS)).toLocaleString('en-US', { maximumFractionDigits: 2 });

function timeLeft(end: number): string {
  const s = Math.max(0, Math.floor(end - Date.now() / 1000));
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

function Panel({ title, value, children }: { title: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="box owner-box">
      <p className="panel-head">
        <span>{title}</span>
        {value !== undefined && <span className="mono">{value}</span>}
      </p>
      {children}
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: 'decimal' | 'numeric' }) {
  return (
    <label className="owner-field">
      <span>{props.label}</span>
      <input
        className="field"
        value={props.value}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        spellCheck={false}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

/** Sends a transaction and waits for it; `label` names it while it runs. */
function useRunner(chainId: number) {
  const toast = useToast();
  const write = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);

  async function run(label: string, done: string, send: () => Promise<Hash>, after?: (r: Awaited<ReturnType<NonNullable<typeof publicClient>['waitForTransactionReceipt']>>) => Promise<void>) {
    if (!publicClient) return;
    setBusy(label);
    setNote(null);
    try {
      const hash = await send();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
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

interface Props {
  n: string;
  chainId: number;
  deployment: Deployment;
  totalSupply: bigint | undefined;
}

/**
 * The FheCat launchpad: anyone launches a dual-mode token for $1; buyers get their share public
 * or straight into an encrypted balance; 2% of a successful sale is the platform fee, half of it
 * for FheCat holders.
 */
export function Launchpad({ n, chainId, deployment, totalSupply }: Props) {
  const pad = { address: deployment.launchpad!, abi: fheLaunchpadAbi, chainId } as const;
  const info = useReadContracts({
    contracts: [
      { ...pad, functionName: 'launchCount' },
      { ...pad, functionName: 'launchFeeWei' },
      { ...pad, functionName: 'feeBps' },
      { ...pad, functionName: 'holderShareBps' },
    ],
    query: POLL,
  });
  const [count, fee, feeBps, holderBps] = (info.data ?? []).map((r) => r.result as bigint | undefined);
  const ids: bigint[] = [];
  for (let i = count ?? 0n; i > 0n && ids.length < Number(SHOWN); i--) ids.push(i - 1n);

  return (
    <section className="chapter" id="launch">
      <Stars density={0.5} seed={88} />
      <div className="wrap">
        <ChapterHead n={n} label="Launchpad" title="Launch in the dark." wide>
          <p>
            Launch a token for $1. Buyers send ETH while the sale runs and get their share of the supply when it ends: in the open, or straight
            into a shielded balance that only they can read, powered by Fhenix FHE.
          </p>
          <p>
            A successful sale pays a {feeBps !== undefined ? Number(feeBps) / 100 : 2}% platform fee
            {holderBps !== undefined ? `, and ${Number(holderBps) / 100}% of that fee goes to FheCat holders` : ''}. If a sale misses its
            soft cap, everyone takes their ETH back.
          </p>
        </ChapterHead>

        <div className="owner-grid lp-grid">
          <CreatePanel chainId={chainId} pad={pad.address} fee={fee} onDone={() => void info.refetch()} />
          <RewardsPanel chainId={chainId} rewards={deployment.rewards!} totalSupply={totalSupply} />
        </div>

        <h3 className="lp-list-head">{count ? `Launches · ${count.toString()}` : 'No launches yet. Be the first.'}</h3>
        <div className="lp-list">
          {ids.map((id) => (
            <LaunchCard key={id.toString()} id={id} chainId={chainId} pad={pad.address} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CreatePanel({ chainId, pad, fee, onDone }: { chainId: number; pad: `0x${string}`; fee?: bigint; onDone: () => void }) {
  const { isConnected } = useConnection();
  const { run, busy, note, setNote, write } = useRunner(chainId);
  const [f, setF] = useState({ name: '', symbol: '', supply: '1000000', sale: '60', soft: '0.01', hard: '0.1', max: '', duration: 86400, info: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function launch() {
    if (!fee) return;
    let params;
    try {
      params = {
        name: f.name.trim(),
        symbol: f.symbol.trim().toUpperCase(),
        supplyTokens: BigInt(f.supply.replace(/[,_\s]/g, '')),
        saleBps: BigInt(Math.round(Number(f.sale) * 100)),
        softCap: parseEther(f.soft || '0'),
        hardCap: parseEther(f.hard),
        maxPerWallet: f.max ? parseEther(f.max) : 0n,
        duration: BigInt(f.duration),
        info: f.info.trim(),
      };
    } catch {
      setNote({ ok: false, text: 'Check the numbers: supply in whole tokens, caps in ETH.' });
      return;
    }
    if (!params.name || !params.symbol) return setNote({ ok: false, text: 'Give the token a name and a symbol.' });
    // A little over the quoted fee covers a price move before the block; the launchpad sends the rest back.
    await run('launch', `${params.symbol} is live`, () => write.mutateAsync({ address: pad, abi: fheLaunchpadAbi, chainId, functionName: 'createLaunch', args: [params], value: fee + fee / 20n }), async () => onDone());
  }

  return (
    <Panel title="Launch a token" value={fee ? `fee ${eth(fee)} ETH ≈ $1` : undefined}>
      <div className="lp-form">
        <Field label="Name" value={f.name} onChange={set('name')} placeholder="Cipher Coin" />
        <Field label="Symbol" value={f.symbol} onChange={set('symbol')} placeholder="CIPH" />
        <Field label="Supply (tokens)" value={f.supply} onChange={set('supply')} inputMode="numeric" />
        <Field label="For sale (%)" value={f.sale} onChange={set('sale')} inputMode="decimal" />
        <Field label="Soft cap (ETH)" value={f.soft} onChange={set('soft')} inputMode="decimal" />
        <Field label="Hard cap (ETH)" value={f.hard} onChange={set('hard')} inputMode="decimal" />
        <Field label="Max per wallet (ETH)" value={f.max} onChange={set('max')} placeholder="no limit" inputMode="decimal" />
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
        <Field label="Link or one line" value={f.info} onChange={set('info')} placeholder="https://x.com/yourtoken" />
      </div>
      <p className="owner-note">The rest of the supply is yours when the sale succeeds, with the ETH raised minus the fee.</p>
      {isConnected ? (
        <button className="btn btn-sm" disabled={!fee || busy !== null} onClick={() => void launch()}>
          {busy ? 'Launching…' : 'Launch for $1'}
        </button>
      ) : (
        <ConnectButton />
      )}
      {note && <p className={`note ${note.ok ? 'ok' : 'error'}`}>{note.text}</p>}
    </Panel>
  );
}

function RewardsPanel({ chainId, rewards, totalSupply }: { chainId: number; rewards: `0x${string}`; totalSupply: bigint | undefined }) {
  const { isConnected } = useConnection();
  const { cats } = useMyCats(totalSupply);
  const ids = cats.map((c) => c.tokenId);
  const vault = useBalance({ address: rewards, chainId, query: POLL });
  const pending = useReadContract({ address: rewards, abi: fheCatRewardsAbi, chainId, functionName: 'pendingMany', args: [ids], query: { enabled: ids.length > 0, ...POLL } });
  const { run, busy, note, write } = useRunner(chainId);
  const owed = (pending.data as bigint | undefined) ?? 0n;

  return (
    <Panel title="FheCat holder rewards" value={vault.data ? `vault ${eth(vault.data.value)} ETH` : undefined}>
      <p className="owner-note">
        Half of the platform fee on every successful sale is split between the cats minted at that moment. The share follows the cat: whoever holds it claims it.
      </p>
      {!isConnected ? (
        <ConnectButton />
      ) : ids.length === 0 ? (
        <p className="owner-note">No cats in this wallet. Mint one to share in the next launches.</p>
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
            {busy ? 'Claiming…' : 'Claim rewards'}
          </button>
        </>
      )}
      {note && <p className={`note ${note.ok ? 'ok' : 'error'}`}>{note.text}</p>}
    </Panel>
  );
}

interface LaunchView {
  creator: `0x${string}`;
  token: `0x${string}`;
  saleSupply: bigint;
  creatorSupply: bigint;
  softCap: bigint;
  hardCap: bigint;
  maxPerWallet: bigint;
  start: bigint;
  end: bigint;
  raised: bigint;
  status: number;
  info: string;
}

function LaunchCard({ id, chainId, pad }: { id: bigint; chainId: number; pad: `0x${string}` }) {
  const { address, isConnected } = useConnection();
  const call = { address: pad, abi: fheLaunchpadAbi, chainId } as const;
  const launch = useReadContract({ ...call, functionName: 'getLaunch', args: [id], query: POLL });
  const l = launch.data as LaunchView | undefined;
  const tok = { address: l?.token, abi: fheLaunchTokenAbi, chainId } as const;
  const meta = useReadContracts({ contracts: [{ ...tok, functionName: 'name' }, { ...tok, functionName: 'symbol' }], allowFailure: false, query: { enabled: Boolean(l) } });
  const mine = useReadContracts({
    contracts: [
      { ...call, functionName: 'contributed', args: [id, address!] },
      { ...call, functionName: 'claimable', args: [id, address!] },
      { ...call, functionName: 'claimed', args: [id, address!] },
      { ...tok, functionName: 'balanceOf', args: [address!] },
      { ...tok, functionName: 'shieldedBalanceOf', args: [address!] },
    ],
    allowFailure: false,
    query: { enabled: Boolean(l && address), ...POLL },
  });
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const { run, busy, note, write } = useRunner(chainId);
  const [amount, setAmount] = useState('');

  if (!l || !meta.data) return <div className="box lp-card lp-loading">Loading launch #{id.toString()}…</div>;
  const [name, symbol] = meta.data as [string, string];
  const [contributed, claimable, claimed, publicBal, shieldedHandle] = (mine.data ?? [0n, 0n, false, 0n, '0x0']) as [bigint, bigint, boolean, bigint, `0x${string}`];
  const refetch = () => {
    void launch.refetch();
    void mine.refetch();
  };

  const end = Number(l.end);
  const full = l.raised >= l.hardCap;
  const over = Date.now() / 1000 >= end || full;
  const status = STATUS[l.status];
  const label = status === 'Live' ? (over ? 'Sale over' : 'Live') : status;
  const lit = Number((l.raised * BigInt(CELLS) + l.hardCap - 1n) / l.hardCap);
  const price = l.raised > 0n ? Number(formatEth(l.raised)) / Number(formatUnits(l.saleSupply, DECIMALS)) : 0;

  const buy = () => {
    let value: bigint;
    try {
      value = parseEther(amount);
    } catch {
      return;
    }
    void run('buy', `You're in ${symbol} with ${formatEth(value)} ETH`, () => write.mutateAsync({ ...call, functionName: 'contribute', args: [id], value }), async () => {
      setAmount('');
      refetch();
    });
  };

  return (
    <article className="box lp-card">
      <header className="lp-card-head">
        <div>
          <p className="lp-symbol mono">${symbol}</p>
          <h4>{name}</h4>
        </div>
        <span className={`lp-status is-${label.toLowerCase().replace(' ', '-')}`}>{label}</span>
      </header>
      {l.info && <p className="lp-info">{/^https:\/\//.test(l.info) ? <a className="link" href={l.info} target="_blank" rel="noreferrer noopener">{l.info.replace(/^https:\/\//, '')}</a> : l.info}</p>}

      <p className="lp-raised">
        <span>Raised</span>
        <b className="mono">
          {formatEth(l.raised)} / {formatEth(l.hardCap)} ETH
        </b>
      </p>
      <div className="cells" role="progressbar" aria-label="Raised" aria-valuenow={Number((l.raised * 100n) / l.hardCap)} aria-valuemin={0} aria-valuemax={100}>
        {Array.from({ length: CELLS }, (_, i) => (
          <i key={i} className={i < lit ? 'on' : undefined} />
        ))}
      </div>
      <dl className="spec-data">
        <div>
          <dt>For sale</dt>
          <dd>{tokens(l.saleSupply)}</dd>
        </div>
        <div>
          <dt>Soft cap</dt>
          <dd>{l.softCap === 0n ? 'None' : `${formatEth(l.softCap)} ETH`}</dd>
        </div>
        <div>
          <dt>{status === 'Live' && !over ? 'Ends in' : 'Ended'}</dt>
          <dd>{status === 'Live' && !over ? timeLeft(end) : new Date(end * 1000).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Price per token</dt>
          <dd>{price ? `${price.toPrecision(3)} ETH` : '-'}</dd>
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
        <ConnectButton />
      ) : (
        <>
          {contributed > 0n && (
            <p className="lp-mine">
              You sent {formatEth(contributed)} ETH{status !== 'Failed' && claimable > 0n ? ` · your share ${tokens(claimable)} ${symbol}` : ''}
              {claimed ? ' · claimed' : ''}
            </p>
          )}

          {status === 'Live' && !over && (
            <div className="lp-row">
              <input className="field" value={amount} placeholder="ETH" inputMode="decimal" onChange={(e) => setAmount(e.target.value)} aria-label={`ETH to send to ${symbol}`} />
              <button className="btn btn-sm" disabled={!amount || busy !== null} onClick={buy}>
                {busy === 'buy' ? 'Sending…' : 'Buy in'}
              </button>
            </div>
          )}
          {status === 'Live' && over && (
            <button className="btn btn-sm" disabled={busy !== null} onClick={() => void run('finalize', `${symbol} sale closed`, () => write.mutateAsync({ ...call, functionName: 'finalize', args: [id] }), async () => refetch())}>
              {busy === 'finalize' ? 'Closing…' : 'Close the sale'}
            </button>
          )}
          {status === 'Succeeded' && claimable > 0n && !claimed && (
            <div className="lp-row">
              <button className="btn btn-sm" disabled={busy !== null} onClick={() => void run('claim', `${tokens(claimable)} ${symbol} claimed`, () => write.mutateAsync({ ...call, functionName: 'claim', args: [id, false] }), async () => refetch())}>
                Claim
              </button>
              <button className="btn btn-sm btn-ghost" disabled={busy !== null} onClick={() => void run('claim', `${tokens(claimable)} ${symbol} claimed into your shielded balance`, () => write.mutateAsync({ ...call, functionName: 'claim', args: [id, true] }), async () => refetch())}>
                <Sprite name="i-lock" />
                <span>Claim shielded</span>
              </button>
            </div>
          )}
          {status === 'Failed' && contributed > 0n && (
            <button className="btn btn-sm" disabled={busy !== null} onClick={() => void run('refund', 'ETH sent back', () => write.mutateAsync({ ...call, functionName: 'refund', args: [id] }), async () => refetch())}>
              Take my ETH back
            </button>
          )}

          {status === 'Succeeded' && (publicBal > 0n || BigInt(shieldedHandle) !== 0n) && (
            <Wallet chainId={chainId} token={l.token} symbol={symbol} publicBal={publicBal} handle={shieldedHandle} onChange={refetch} />
          )}
        </>
      )}
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
    if (v) void run('shield', `${amount} ${symbol} shielded`, () => write.mutateAsync({ ...call, functionName: 'shield', args: [v] }), done);
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
    if (!v || !publicClient) return;
    void run(
      'unshield',
      `${amount} ${symbol} back in your public balance`,
      async () => {
        const [hash, proof] = await encrypt(v);
        return write.mutateAsync({ ...call, functionName: 'unshield', args: [hash, proof] });
      },
      async (receipt) => {
        // Step two: the threshold network decrypts that one amount, and the proof credits it.
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
      <dl className="spec-data">
        <div>
          <dt>Public</dt>
          <dd>
            {tokens(publicBal)} {symbol}
          </dd>
        </div>
        <div>
          <dt>Shielded</dt>
          <dd>
            {shielded !== null ? (
              `${tokens(shielded)} ${symbol}`
            ) : (
              <button className="link-btn" disabled={revealing || !cofhe} onClick={() => void reveal()}>
                {revealing ? 'Decrypting…' : 'Encrypted · show me'}
              </button>
            )}
          </dd>
        </div>
      </dl>
      <div className="lp-row">
        <input className="field" value={amount} placeholder={`Amount of ${symbol}`} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} aria-label={`Amount of ${symbol}`} />
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
      <p className="owner-note">Shielded amounts are encrypted on-chain; sending more than you hold moves nothing. Unshielding takes two transactions.</p>
      {note && <p className={`note ${note.ok ? 'ok' : 'error'}`}>{note.text}</p>}
    </div>
  );
}
