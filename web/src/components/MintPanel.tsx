import { useState } from 'react';
import { useConnection, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi';
import { useI18n } from '../i18n';
import { fheCatAbi } from '../config/abi';
import { DEFAULT_CHAIN, X_URL, chainInfo, explorerUrl } from '../config/chains';
import { useAllowlistProof, useCollection, useViewChain } from '../lib/hooks';
import { errorMessage, formatEth, isUserRejection, shortAddress } from '../lib/format';
import { ConnectButton } from './ConnectButton';
import { CatImage } from './CatImage';

type Status = { kind: 'idle' } | { kind: 'confirm' } | { kind: 'pending'; hash: string } | { kind: 'done' } | { kind: 'error'; message: string };

const min = (...xs: bigint[]) => xs.reduce((a, b) => (b < a ? b : a));

export function MintPanel() {
  const { t } = useI18n();
  const col = useCollection();
  const { address, isConnected } = useConnection();
  const { walletOnWrongChain } = useViewChain();
  const { proof, listed } = useAllowlistProof(address);
  const write = useWriteContract();
  const switchChain = useSwitchChain();
  const publicClient = usePublicClient({ chainId: col.chainId });
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  if (!col.deployment) {
    return (
      <section className="section" id="mint">
        <div className="container">
          <div className="panel soon">
            <CatImage handle={'0x' + 'a5'.repeat(32)} alt="" className="soon-img" />
            <div>
              <h2>{t.mint.title}</h2>
              <p className="lead">{t.mint.soon}</p>
              <a className="btn" href={X_URL} target="_blank" rel="noreferrer">
                {t.hero.follow}
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const phase = Number(col.phase);
  const onAllowlist = phase === 1;
  const price = onAllowlist ? col.allowlistPrice : col.publicPrice;
  const limit = onAllowlist ? col.allowlistMaxPerWallet : col.maxPerWallet;
  const already = onAllowlist ? col.allowlistMinted : col.publicMinted;
  const left = col.maxSupply - col.totalSupply;
  const walletLeft = limit === 0n ? col.maxPerTx : limit > already ? limit - already : 0n;
  const maxQty = Number(min(col.maxPerTx, left, walletLeft));
  const quantity = Math.max(1, Math.min(qty, maxQty || 1));
  const pct = col.maxSupply > 0n ? Number((col.totalSupply * 10000n) / col.maxSupply) / 100 : 0;
  const chain = chainInfo(col.chainId);
  const busy = status.kind === 'confirm' || status.kind === 'pending';

  const blocked = !col.loaded
    ? '...'
    : left === 0n
      ? t.mint.soldOut
      : phase === 0
        ? t.mint.closed
        : isConnected && onAllowlist && !listed
          ? t.mint.notListed
          : isConnected && walletLeft === 0n
            ? t.mint.limitReached
            : null;

  async function mint() {
    if (!col.deployment || !publicClient) return;
    setStatus({ kind: 'confirm' });
    try {
      const hash = await write.mutateAsync({
        address: col.deployment.fheCat,
        abi: fheCatAbi,
        chainId: col.chainId,
        ...(onAllowlist
          ? { functionName: 'allowlistMint', args: [BigInt(quantity), proof ?? []] }
          : { functionName: 'mint', args: [BigInt(quantity)] }),
        value: price * BigInt(quantity),
      });
      setStatus({ kind: 'pending', hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Transaction reverted');
      setStatus({ kind: 'done' });
      await col.refetch();
    } catch (e) {
      setStatus({ kind: 'error', message: isUserRejection(e) ? t.errors.rejected : errorMessage(e, t.errors.generic) });
    }
  }

  return (
    <section className="section" id="mint">
      <div className="container mint-grid">
        <div className="panel mint-panel">
          <h2>{t.mint.title}</h2>

          <div className="supply">
            <div className="supply-row">
              <span>{t.mint.minted}</span>
              <b>
                {col.totalSupply.toString()} / {col.maxSupply.toString()}
              </b>
            </div>
            <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${pct}%` }} />
            </div>
          </div>

          <dl className="facts">
            <div>
              <dt>{t.mint.phase}</dt>
              <dd className={`phase phase-${phase}`}>{t.mint.phases[phase] ?? '-'}</dd>
            </div>
            <div>
              <dt>{t.mint.price}</dt>
              <dd>{price === 0n ? t.mint.free : `${formatEth(price)} ETH`}</dd>
            </div>
            <div>
              <dt>{t.mint.network}</dt>
              <dd>{chain?.chain.name}</dd>
            </div>
          </dl>
          <p className="muted small">{limit === 0n ? t.mint.unlimited : t.mint.perWallet(limit.toString())}</p>

          {!blocked && isConnected && !walletOnWrongChain && (
            <div className="qty">
              <span>{t.mint.quantity}</span>
              <div className="stepper">
                <button onClick={() => setQty(Math.max(1, quantity - 1))} disabled={busy || quantity <= 1} aria-label="-">
                  −
                </button>
                <output>{quantity}</output>
                <button onClick={() => setQty(Math.min(maxQty, quantity + 1))} disabled={busy || quantity >= maxQty} aria-label="+">
                  +
                </button>
              </div>
            </div>
          )}

          <div className="mint-action">
            {!isConnected ? (
              <ConnectButton />
            ) : walletOnWrongChain ? (
              <button className="btn btn-warn" onClick={() => switchChain.mutate({ chainId: DEFAULT_CHAIN.id })}>
                {t.wallet.switchTo(DEFAULT_CHAIN.name)}
              </button>
            ) : blocked ? (
              <button className="btn" disabled>
                {blocked}
              </button>
            ) : (
              <button className="btn btn-big" onClick={mint} disabled={busy}>
                {status.kind === 'confirm' ? t.mint.confirm : status.kind === 'pending' ? t.mint.pending : t.mint.button(quantity)}
              </button>
            )}
          </div>

          {status.kind === 'done' && <p className="note ok">{t.mint.success}</p>}
          {status.kind === 'error' && <p className="note error">{status.message}</p>}
          {status.kind === 'pending' && explorerUrl(col.chainId, 'tx', status.hash) && (
            <p className="small">
              <a href={explorerUrl(col.chainId, 'tx', status.hash)} target="_blank" rel="noreferrer">
                {shortAddress(status.hash)} ↗
              </a>
            </p>
          )}

          <div className="mint-foot small muted">
            {chain?.faucet && (
              <span>
                {t.mint.faucet}{' '}
                <a href={chain.faucet} target="_blank" rel="noreferrer">
                  {t.mint.faucetLink} ↗
                </a>
              </span>
            )}
            <span>
              {t.mint.contract}:{' '}
              <a href={explorerUrl(col.chainId, 'address', col.deployment.fheCat)} target="_blank" rel="noreferrer">
                {shortAddress(col.deployment.fheCat)}
              </a>
            </span>
          </div>
        </div>
        <div className="mint-art">
          <CatImage handle={'0x' + '5c'.repeat(32)} alt="" />
          <p className="small muted">{t.how.sniping}</p>
        </div>
      </div>
    </section>
  );
}
