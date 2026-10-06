import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useBalance, usePublicClient, useReadContracts, useWriteContract } from 'wagmi';
import { getAddress, parseEther, zeroHash } from 'viem';
import { fheCatAbi } from '../config/abi';
import { useAllowlistTree, useOwnership, type Collection } from '../lib/hooks';
import { failure, formatEth, shortAddress } from '../lib/format';
import { Stars } from '../pixel/Sky';
import { useToast } from '../pixel/Toast';
import { ChapterHead } from './Chapter';

const PHASES = ['Closed', 'Allowlist', 'Public'];

interface Props {
  n: string;
  col: Collection;
  ownership: ReturnType<typeof useOwnership>;
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

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="owner-field">
      <span>{label}</span>
      <input className="field" value={value} placeholder={placeholder} spellCheck={false} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/**
 * The sale, run from the owner's own wallet: phases, prices, limits, the
 * allowlist root, the team reserve, funds, royalty and ownership. Only the
 * owner (or the address offered ownership) ever sees it.
 */
export function OwnerPanel({ n, col, ownership }: Props) {
  const toast = useToast();
  const write = useWriteContract();
  const publicClient = usePublicClient({ chainId: col.chainId });
  const contract = col.deployment!.fheCat;
  const call = { address: contract, abi: fheCatAbi, chainId: col.chainId } as const;
  const extra = useReadContracts({
    contracts: [
      { ...call, functionName: 'allowlistRoot' },
      // Royalty on a sale of 10000 wei is the rate in basis points.
      { ...call, functionName: 'royaltyInfo', args: [1n, 10_000n] },
    ],
    allowFailure: false,
    query: { refetchInterval: 12_000 },
  });
  const balance = useBalance({ address: contract, chainId: col.chainId, query: { refetchInterval: 12_000 } });
  const published = useAllowlistTree();
  // Every mint pays the contract: show the new balance as soon as the supply moves.
  const refetchBalance = balance.refetch;
  useEffect(() => {
    void refetchBalance();
  }, [col.totalSupply, refetchBalance]);

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  // Form values; null shows what is on-chain.
  const [prices, setPrices] = useState<{ pub: string; al: string } | null>(null);
  const [limits, setLimits] = useState<{ pub: string; al: string } | null>(null);
  const [royalty, setRoyalty] = useState<{ to: string; pct: string } | null>(null);
  const [reserve, setReserve] = useState({ to: '', qty: '1' });
  const [payTo, setPayTo] = useState('');
  const [nextOwner, setNextOwner] = useState('');

  const [root, royaltyInfo] = extra.data ?? [];
  const owner = ownership.owner;
  const phase = Number(col.phase);
  const listMatches = Boolean(published && root && published.root === root);

  async function run(key: string, done: string, tx: () => Promise<`0x${string}`>) {
    setBusy(key);
    setNote(null);
    try {
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: await tx() });
      if (receipt.status !== 'success') throw new Error('Transaction reverted');
      setNote({ ok: true, text: done });
      toast(done);
      await Promise.all([col.refetch(), ownership.refetch(), extra.refetch(), balance.refetch()]);
      return true;
    } catch (e) {
      console.error(e);
      setNote({ ok: false, text: failure(e) });
      return false;
    } finally {
      setBusy(null);
    }
  }

  const submit = (fn: () => void) => (e: FormEvent) => {
    e.preventDefault();
    fn();
  };
  const ready = busy === null;
  const working = (key: string) =>
    busy === key && (
      <span className="step-text">
        <i className="blink-dot" aria-hidden="true" />
        Confirm in your wallet, then wait…
      </span>
    );

  const head = (
    <ChapterHead n={n} label="Owner" title="Run the sale." wide>
      <p>Only the contract owner sees this chapter. Every change here is a transaction from your own wallet, exactly as on mainnet.</p>
    </ChapterHead>
  );

  if (ownership.role === 'pending') {
    return (
      <section className="chapter" id="owner">
        <Stars density={0.5} seed={117} />
        <div className="wrap">
          {head}
          <div className="box owner-box owner-accept">
            <p>
              {owner ? shortAddress(owner) : 'The owner'} offered you the contract. It becomes yours when you accept from this wallet.
            </p>
            <button
              className="btn"
              disabled={!ready}
              onClick={() => run('accept', 'You own the contract now', () => write.mutateAsync({ ...call, functionName: 'acceptOwnership' }))}
            >
              <span>Accept ownership</span>
            </button>
            {working('accept')}
          </div>
          {note && <p className={`note ${note.ok ? 'ok' : 'error'}`}>{note.text}</p>}
        </div>
      </section>
    );
  }

  const shownPrices = prices ?? { pub: formatEth(col.publicPrice), al: formatEth(col.allowlistPrice) };
  const shownLimits = limits ?? { pub: col.maxPerWallet.toString(), al: col.allowlistMaxPerWallet.toString() };
  const shownRoyalty = royalty ?? { to: royaltyInfo?.[0] ?? '', pct: royaltyInfo ? (Number(royaltyInfo[1]) / 100).toString() : '' };

  return (
    <section className="chapter" id="owner">
      <Stars density={0.5} seed={117} />
      <div className="wrap">
        {head}
        {note && <p className={`note ${note.ok ? 'ok' : 'error'}`}>{note.text}</p>}

        <div className="owner-grid">
          <Panel title="Sale phase" value={PHASES[phase]}>
            <div className="seg" role="group" aria-label="Sale phase">
              {PHASES.map((name, i) => (
                <button
                  key={name}
                  className={i === phase ? 'active' : ''}
                  aria-pressed={i === phase}
                  disabled={!ready || i === phase}
                  onClick={() => run('phase', `Sale phase: ${name}`, () => write.mutateAsync({ ...call, functionName: 'setPhase', args: [i] }))}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="owner-note">Allowlist mints work only while this site’s list matches the contract (see Allowlist).</p>
            {working('phase')}
          </Panel>

          <Panel title="Allowlist" value={listMatches ? 'in sync' : 'not in sync'}>
            <dl className="spec-data">
              <div>
                <dt>Contract root</dt>
                <dd className="mono">{!root || root === zeroHash ? 'not set' : shortAddress(root)}</dd>
              </div>
              <div>
                <dt>Site list</dt>
                <dd>{published ? `${published.length} wallets` : 'None'}</dd>
              </div>
              <div>
                <dt>Site root</dt>
                <dd className="mono">{published ? shortAddress(published.root) : '-'}</dd>
              </div>
            </dl>
            <button
              className="btn btn-sm"
              disabled={!ready || !published || listMatches}
              onClick={() =>
                run('root', `Allowlist set: ${published!.length} wallets`, () =>
                  write.mutateAsync({ ...call, functionName: 'setAllowlistRoot', args: [published!.root as `0x${string}`] }),
                )
              }
            >
              Use this site’s list
            </button>
            {working('root')}
          </Panel>

          <Panel title="Prices" value="ETH">
            <form
              onSubmit={submit(() =>
                run('prices', 'Prices saved', () =>
                  write.mutateAsync({ ...call, functionName: 'setPrices', args: [parseEther(shownPrices.pub.trim()), parseEther(shownPrices.al.trim())] }),
                ).then((ok) => ok && setPrices(null)),
              )}
            >
              <Field label="Public" value={shownPrices.pub} onChange={(pub) => setPrices({ ...shownPrices, pub })} />
              <Field label="Allowlist" value={shownPrices.al} onChange={(al) => setPrices({ ...shownPrices, al })} />
              <button className="btn btn-sm" disabled={!ready || !prices}>
                Save prices
              </button>
              {working('prices')}
            </form>
          </Panel>

          <Panel title="Per wallet" value="0 = no limit">
            <form
              onSubmit={submit(() =>
                run('limits', 'Wallet limits saved', () =>
                  write.mutateAsync({ ...call, functionName: 'setWalletLimits', args: [BigInt(shownLimits.pub.trim()), BigInt(shownLimits.al.trim())] }),
                ).then((ok) => ok && setLimits(null)),
              )}
            >
              <Field label="Public" value={shownLimits.pub} onChange={(pub) => setLimits({ ...shownLimits, pub })} />
              <Field label="Allowlist" value={shownLimits.al} onChange={(al) => setLimits({ ...shownLimits, al })} />
              <button className="btn btn-sm" disabled={!ready || !limits}>
                Save limits
              </button>
              {working('limits')}
            </form>
          </Panel>

          <Panel title="Team reserve" value={`${col.totalSupply} / ${col.maxSupply}`}>
            <form
              onSubmit={submit(() => {
                const qty = Number(reserve.qty);
                void run('reserve', `Minted ${qty} to ${shortAddress(reserve.to || owner!)}`, () =>
                  write.mutateAsync({ ...call, functionName: 'ownerMint', args: [getAddress(reserve.to.trim() || owner!), BigInt(qty)] }),
                );
              })}
            >
              <Field label="To" value={reserve.to} placeholder={owner} onChange={(to) => setReserve({ ...reserve, to })} />
              <Field label="How many (1-10)" value={reserve.qty} onChange={(qty) => setReserve({ ...reserve, qty })} />
              <p className="owner-note">Ignores the phase and wallet limits; counts toward the supply.</p>
              <button className="btn btn-sm" disabled={!ready}>
                Mint
              </button>
              {working('reserve')}
            </form>
          </Panel>

          <Panel title="Funds" value={balance.data ? `${formatEth(balance.data.value)} ETH` : '…'}>
            <form
              onSubmit={submit(
                () => void run('withdraw', 'Funds withdrawn', () => write.mutateAsync({ ...call, functionName: 'withdraw', args: [getAddress(payTo.trim() || owner!)] })),
              )}
            >
              <Field label="Send to" value={payTo} placeholder={owner} onChange={setPayTo} />
              <button className="btn btn-sm" disabled={!ready || !balance.data?.value}>
                Withdraw all
              </button>
              {working('withdraw')}
            </form>
          </Panel>

          <Panel title="Royalty" value={royaltyInfo ? `${Number(royaltyInfo[1]) / 100}%` : '…'}>
            <form
              onSubmit={submit(() =>
                run('royalty', 'Royalty saved', () =>
                  write.mutateAsync({
                    ...call,
                    functionName: 'setDefaultRoyalty',
                    args: [getAddress(shownRoyalty.to.trim()), BigInt(Math.round(Number(shownRoyalty.pct) * 100))],
                  }),
                ).then((ok) => ok && setRoyalty(null)),
              )}
            >
              <Field label="Receiver" value={shownRoyalty.to} onChange={(to) => setRoyalty({ ...shownRoyalty, to })} />
              <Field label="Percent" value={shownRoyalty.pct} onChange={(pct) => setRoyalty({ ...shownRoyalty, pct })} />
              <button className="btn btn-sm" disabled={!ready || !royalty}>
                Save royalty
              </button>
              {working('royalty')}
            </form>
          </Panel>

          <Panel title="Ownership" value={owner ? shortAddress(owner) : '…'}>
            <form
              onSubmit={submit(() =>
                run('transfer', 'Ownership offered', () =>
                  write.mutateAsync({ ...call, functionName: 'transferOwnership', args: [getAddress(nextOwner.trim())] }),
                ).then((ok) => ok && setNextOwner('')),
              )}
            >
              {ownership.pendingOwner && <p className="owner-note">Offered to {shortAddress(ownership.pendingOwner)}, not accepted yet.</p>}
              <Field label="Offer to" value={nextOwner} placeholder="0x…" onChange={setNextOwner} />
              <p className="owner-note">The new owner accepts from their own wallet. Until then you stay the owner.</p>
              <button className="btn btn-sm btn-ghost" disabled={!ready || !nextOwner.trim()}>
                Offer ownership
              </button>
              {working('transfer')}
            </form>
          </Panel>
        </div>
      </div>
    </section>
  );
}
