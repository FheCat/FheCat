import { useEffect, useState, type ReactNode } from 'react';
import { useConnection, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi';
import { fheCatAbi } from '../config/abi';
import { DEFAULT_CHAIN, X_URL, chainInfo, chainLabel, explorerUrl } from '../config/chains';
import { useAllowlistProof, useViewChain, type Collection } from '../lib/hooks';
import { failure, formatEth, shortAddress } from '../lib/format';
import { REDUCED_MOTION } from '../pixel/fc';
import { Sprite } from '../pixel/Sprite';
import { Stars } from '../pixel/Sky';
import { useToast } from '../pixel/Toast';
import { ChapterHead } from './Chapter';
import { ConnectButton } from './ConnectButton';
import { CatImage } from './CatImage';

type Status = { kind: 'idle' } | { kind: 'confirm' } | { kind: 'pending'; hash: string } | { kind: 'done'; n: number } | { kind: 'error'; message: string };

const PHASES = ['Closed', 'Allowlist', 'Public'];
const CELLS = 20;
const min = (...xs: bigint[]) => xs.reduce((a, b) => (b < a ? b : a));

function randomHandle() {
  return '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The next cat's box. Its ciphertext does not exist yet, so the barcode keeps changing. */
function NextBox() {
  const [handle, setHandle] = useState(randomHandle);
  useEffect(() => {
    if (REDUCED_MOTION) return;
    const t = setInterval(() => setHandle(randomHandle()), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mint-portrait">
      <CatImage handle={handle} alt="" />
      <span className="scanline" aria-hidden="true" />
    </div>
  );
}

export function MintPanel({ n, col }: { n: string; col: Collection }) {
  const toast = useToast();
  const { address, isConnected } = useConnection();
  const { walletOnWrongChain } = useViewChain();
  const { proof, listed } = useAllowlistProof(address);
  const write = useWriteContract();
  const switchChain = useSwitchChain();
  const publicClient = usePublicClient({ chainId: col.chainId });
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const chapter = (box: ReactNode) => (
    <section className="chapter" id="mint">
      <Stars density={0.6} seed={50} />
      <div className="wrap split mint-split">
        <ChapterHead n={n} label="The mint" title="Adopt a sealed box.">
          <p>
            Every FheCat is born in a sealed box. Its DNA is an encrypted random number drawn by Fhenix, so nobody knows what's inside: not
            the team, not a bot, not even you.
          </p>
          <p>Mint blind. Then it's your call: keep the box sealed, peek in private or open it for everyone.</p>
        </ChapterHead>
        {box}
      </div>
    </section>
  );

  if (!col.deployment) {
    return chapter(
      <div className="mintbox box">
        <p className="spec-head">
          <span>Next box</span>
          <span className="spec-state">
            <i className="blink-dot" />
            Soon
          </span>
        </p>
        <NextBox />
        <p className="mint-soon">The mint opens soon. The date lands on X first.</p>
        <a className="btn btn-wide" href={X_URL} target="_blank" rel="noreferrer">
          <Sprite name="i-x" />
          <span>Follow @FheCat</span>
        </a>
      </div>,
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
  // A started mint lights the first cell.
  const lit = col.maxSupply > 0n ? Number((col.totalSupply * BigInt(CELLS) + col.maxSupply - 1n) / col.maxSupply) : 0;
  const chain = chainInfo(col.chainId);
  const busy = status.kind === 'confirm' || status.kind === 'pending';

  const blocked = !col.loaded
    ? 'Loading…'
    : left === 0n
      ? 'Sold out'
      : phase === 0
        ? 'Sale is closed'
        : isConnected && onAllowlist && !listed
          ? 'Not on the allowlist'
          : isConnected && walletLeft === 0n
            ? 'Wallet limit reached'
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
      setStatus({ kind: 'done', n: quantity });
      toast(quantity === 1 ? 'A cat was born in a sealed box' : `${quantity} cats were born in sealed boxes`);
      await col.refetch();
    } catch (e) {
      setStatus({ kind: 'error', message: failure(e) });
    }
  }

  const tx = status.kind === 'pending' ? { hash: status.hash, url: explorerUrl(col.chainId, 'tx', status.hash) } : null;
  const contractUrl = explorerUrl(col.chainId, 'address', col.deployment.fheCat);

  return chapter(
    <div className="mintbox box">
      <p className="spec-head">
        <span>Next box</span>
        <span className="spec-state">
          <i className="blink-dot" />
          {left === 0n ? 'Sold out' : `#${col.totalSupply + 1n}`}
        </span>
      </p>
      <NextBox />

      <div className="supply">
        <p className="supply-head">
          <span>Minted</span>
          <b className="mono">
            {col.totalSupply.toString()} / {col.maxSupply.toString()}
          </b>
        </p>
        <div className="cells" role="progressbar" aria-label="Minted" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          {Array.from({ length: CELLS }, (_, i) => (
            <i key={i} className={i < lit ? 'on' : undefined} />
          ))}
        </div>
      </div>

      <dl className="spec-data">
        <div>
          <dt>Phase</dt>
          <dd>{PHASES[phase] ?? '-'}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>{price === 0n ? 'Free' : `${formatEth(price)} ETH`}</dd>
        </div>
        <div>
          <dt>Per wallet</dt>
          <dd>{limit === 0n ? 'No limit' : `Max ${limit}`}</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>{chainLabel(col.chainId)}</dd>
        </div>
      </dl>

      {!blocked && isConnected && !walletOnWrongChain && (
        <div className="qty">
          <span>Quantity</span>
          <div className="stepper">
            <button onClick={() => setQty(Math.max(1, quantity - 1))} disabled={busy || quantity <= 1} aria-label="One less">
              -
            </button>
            <output aria-live="polite">{quantity}</output>
            <button onClick={() => setQty(Math.min(maxQty, quantity + 1))} disabled={busy || quantity >= maxQty} aria-label="One more">
              +
            </button>
          </div>
        </div>
      )}

      {!isConnected ? (
        <ConnectButton size="wide" />
      ) : walletOnWrongChain ? (
        <button className="btn btn-warn btn-wide" onClick={() => switchChain.mutate({ chainId: DEFAULT_CHAIN.id })}>
          <span>Switch to {chainLabel(DEFAULT_CHAIN.id)}</span>
        </button>
      ) : blocked ? (
        <button className="btn btn-wide" disabled>
          <span>{blocked}</span>
        </button>
      ) : (
        <button className="btn btn-wide btn-mint" onClick={mint} disabled={busy}>
          <span>
            {status.kind === 'confirm'
              ? 'Confirm in your wallet…'
              : status.kind === 'pending'
                ? 'Minting…'
                : `Mint ${quantity} ${quantity === 1 ? 'cat' : 'cats'}`}
          </span>
        </button>
      )}

      {status.kind === 'done' && (
        <p className="note ok">
          Minted! {status.n === 1 ? 'Your cat was born in a sealed box.' : 'Your cats were born in sealed boxes.'}{' '}
          <a href="#cats">Find them below.</a>
        </p>
      )}
      {status.kind === 'error' && <p className="note error">{status.message}</p>}
      {tx?.url && (
        <p className="note">
          <a href={tx.url} target="_blank" rel="noreferrer">
            Transaction {shortAddress(tx.hash)} ↗
          </a>
        </p>
      )}

      <p className="mint-foot">
        {chain?.faucet && (
          <a className="link" href={chain.faucet} target="_blank" rel="noreferrer">
            Testnet ETH faucet <Sprite name="i-ext" />
          </a>
        )}
        {contractUrl ? (
          <a className="link" href={contractUrl} target="_blank" rel="noreferrer">
            Contract {shortAddress(col.deployment.fheCat)} <Sprite name="i-ext" />
          </a>
        ) : (
          <span>Contract {shortAddress(col.deployment.fheCat)}</span>
        )}
      </p>
    </div>,
  );
}
