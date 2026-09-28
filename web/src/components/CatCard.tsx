import { useMemo, useState } from 'react';
import { usePublicClient, useWriteContract } from 'wagmi';
import { FheTypes, type CofheClient } from '@cofhe/sdk';
import { renderCatSvg, traitsOf } from '@art';
import { useI18n } from '../i18n';
import { fheCatAbi } from '../config/abi';
import { explorerUrl } from '../config/chains';
import { ensurePermit } from '../lib/cofhe';
import type { CatView } from '../lib/hooks';
import { errorMessage, isUserRejection } from '../lib/format';
import { CatImage } from './CatImage';

type Step = 'idle' | 'signing' | 'decrypting' | 'confirm' | 'revealing';

interface Props {
  cat: CatView;
  chainId: number;
  contract: `0x${string}`;
  cofhe: CofheClient | null;
  onChanged: () => void;
}

/** Retries `fn` while the threshold network catches up with a fresh on-chain permission. */
async function retry<T>(fn: () => Promise<T>, attempts = 6, delayMs = 5000): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts || isUserRejection(e)) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export function CatCard({ cat, chainId, contract, cofhe, onChanged }: Props) {
  const { t } = useI18n();
  const write = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const [peeked, setPeeked] = useState<bigint | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const id = cat.tokenId;
  const dna = cat.revealed ? cat.dna : peeked;
  const traits = useMemo(() => (dna !== null ? traitsOf(dna) : null), [dna]);
  const busy = step !== 'idle';

  async function run(action: (c: CofheClient) => Promise<void>) {
    if (!cofhe) return;
    setError(null);
    setNotice(null);
    try {
      await action(cofhe);
    } catch (e) {
      console.error(e);
      setError(isUserRejection(e) ? t.errors.rejected : errorMessage(e, t.errors.generic));
    } finally {
      setStep('idle');
    }
  }

  const peek = () =>
    run(async (c) => {
      setStep('signing');
      await ensurePermit(c);
      setStep('decrypting');
      setPeeked((await c.decryptForView(cat.dnaHandle, FheTypes.Uint64).execute()) as bigint);
    });

  const confirmAndWait = async (submit: () => Promise<`0x${string}`>) => {
    setStep('confirm');
    const hash = await submit();
    setStep('revealing');
    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Transaction reverted');
  };

  const reveal = () =>
    run(async (c) => {
      let proof;
      if (cat.publicDecryption) {
        setStep('decrypting');
        proof = await retry(() => c.decryptForTx(cat.dnaHandle).withoutACP().execute());
      } else {
        try {
          setStep('signing');
          await ensurePermit(c);
          setStep('decrypting');
          proof = await c.decryptForTx(cat.dnaHandle).withACP().execute();
        } catch (e) {
          if (isUserRejection(e)) throw e;
          // The permit route failed: open this cat's ciphertext to public decryption instead.
          console.warn('permit decryption failed, falling back to public decryption', e);
          setNotice(t.cats.fallback);
          await confirmAndWait(() =>
            write.mutateAsync({ address: contract, abi: fheCatAbi, chainId, functionName: 'enablePublicDecryption', args: [id] }),
          );
          setStep('decrypting');
          proof = await retry(() => c.decryptForTx(cat.dnaHandle).withoutACP().set404RetryTimeout(30_000).execute());
        }
      }
      const { decryptedValue, signature } = proof;
      await confirmAndWait(() =>
        write.mutateAsync({ address: contract, abi: fheCatAbi, chainId, functionName: 'reveal', args: [id, decryptedValue, signature] }),
      );
      setPeeked(null);
      setNotice(null);
      onChanged();
    });

  function saveSvg() {
    if (dna === null) return;
    const url = URL.createObjectURL(new Blob([renderCatSvg(dna)], { type: 'image/svg+xml' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `fhecat-${id}.svg` });
    a.click();
    URL.revokeObjectURL(url);
  }

  const status = cat.revealed ? t.cats.revealed : peeked !== null ? t.cats.peeked : cat.publicDecryption ? t.cats.publicOn : t.cats.encrypted;
  const stepText = { signing: t.cats.signing, decrypting: t.cats.decrypting, confirm: t.cats.confirm, revealing: t.cats.revealing, idle: '' }[step];

  return (
    <article className={`panel cat-card ${peeked !== null && !cat.revealed ? 'is-private' : ''}`} data-token={id.toString()}>
      <div className="cat-art">
        {dna !== null ? <CatImage dna={dna} alt={`FheCat #${id}`} /> : <CatImage handle={cat.dnaHandle} alt={`FheCat #${id}`} />}
        {peeked !== null && !cat.revealed && <span className="ribbon">👁 {t.cats.peeked}</span>}
      </div>
      <div className="cat-head">
        <h3>#{id.toString()}</h3>
        <span className={`chip ${cat.revealed ? 'chip-ok' : peeked !== null ? 'chip-private' : ''}`}>{status}</span>
      </div>
      {traits && (
        <ul className="traits">
          {traits.map((tr) => (
            <li key={tr.trait_type} title={tr.trait_type}>
              {tr.value}
            </li>
          ))}
        </ul>
      )}
      {peeked !== null && !cat.revealed && <p className="small muted">{t.cats.peekNote}</p>}
      {busy && <p className="small step-text">{stepText}</p>}
      {notice && <p className="small note">{notice}</p>}
      {error && <p className="small note error">{error}</p>}
      <div className="cat-actions">
        {!cat.revealed &&
          (peeked === null ? (
            <button className="btn btn-small btn-ghost" onClick={peek} disabled={busy || !cofhe}>
              {t.cats.peek}
            </button>
          ) : (
            <button className="btn btn-small btn-ghost" onClick={() => setPeeked(null)} disabled={busy}>
              {t.cats.hide}
            </button>
          ))}
        {!cat.revealed && (
          <button className="btn btn-small" onClick={reveal} disabled={busy || !cofhe}>
            {t.cats.reveal}
          </button>
        )}
        {dna !== null && (
          <button className="btn btn-small btn-ghost" onClick={saveSvg}>
            {t.cats.save}
          </button>
        )}
        {explorerUrl(chainId, 'token', `${contract}?a=${id}`) && (
          <a className="link small" href={explorerUrl(chainId, 'token', `${contract}?a=${id}`)} target="_blank" rel="noreferrer">
            {t.cats.view} ↗
          </a>
        )}
      </div>
    </article>
  );
}
