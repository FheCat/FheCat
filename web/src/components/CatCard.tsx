import { useMemo, useState } from 'react';
import { usePublicClient, useWriteContract } from 'wagmi';
import { FheTypes, type CofheClient } from '@cofhe/sdk';
import { renderCatSvg, traitsOf } from '@art';
import { useI18n } from '../i18n';
import { fheCatAbi } from '../config/abi';
import { explorerUrl } from '../config/chains';
import { ensurePermit } from '../lib/cofhe';
import { STATE, type CatView } from '../lib/hooks';
import { errorMessage, isUserRejection, retry } from '../lib/format';
import { CatImage } from './CatImage';

type Step = 'idle' | 'confirm' | 'mining' | 'signing' | 'decrypting';

interface Props {
  cat: CatView;
  chainId: number;
  contract: `0x${string}`;
  cofhe: CofheClient | null;
  /** Whether the connected holder is already on the DNA's access list (undefined while loading). */
  canDecrypt: boolean | undefined;
  onChanged: () => void;
}

/**
 * One of the holder's cats, in whichever state its box is: Unopened (peek or
 * open), Peeked (look again, or reveal with your own proof), Opened (anyone can
 * reveal) or Revealed.
 */
export function CatCard({ cat, chainId, contract, cofhe, canDecrypt, onChanged }: Props) {
  const { t } = useI18n();
  const write = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const [seen, setSeen] = useState<bigint | null>(null);
  const [ask, setAsk] = useState<'peek' | 'open' | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);

  const id = cat.tokenId;
  const state = Number(cat.state);
  const revealed = state === STATE.Revealed;
  const dna = revealed ? cat.dna : seen;
  const traits = useMemo(() => (dna !== null ? traitsOf(dna) : null), [dna]);
  const busy = step !== 'idle';

  async function run(action: (c: CofheClient) => Promise<void>) {
    if (!cofhe) return;
    setAsk(null);
    setError(null);
    try {
      await action(cofhe);
    } catch (e) {
      console.error(e);
      setError(isUserRejection(e) ? t.errors.rejected : errorMessage(e, t.errors.generic));
    } finally {
      setStep('idle');
    }
  }

  async function mined(hash: `0x${string}`) {
    setStep('mining');
    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Transaction reverted');
  }

  const call = { address: contract, abi: fheCatAbi, chainId } as const;

  async function reveal(c: CofheClient, withPermit: boolean) {
    setStep('decrypting');
    // A fresh grant can take a few seconds to reach the threshold network.
    const { decryptedValue, signature } = await retry(() =>
      withPermit ? c.decryptForTx(cat.dnaHandle).withACP().execute() : c.decryptForTx(cat.dnaHandle).withoutACP().execute(),
    );
    setStep('confirm');
    await mined(await write.mutateAsync({ ...call, functionName: 'reveal', args: [id, decryptedValue, signature] }));
    setSeen(null);
    onChanged();
  }

  /** Peek: join the DNA's access list if needed (one transaction), then decrypt it in the browser. */
  const peek = () =>
    run(async (c) => {
      if (!canDecrypt) {
        setStep('confirm');
        await mined(await write.mutateAsync({ ...call, functionName: 'peek', args: [id] }));
        onChanged();
      }
      setStep('signing');
      await ensurePermit(c);
      setStep('decrypting');
      setSeen((await retry(() => c.decryptForView(cat.dnaHandle, FheTypes.Uint64).execute())) as bigint);
    });

  /** Open the box for everyone, then finish the reveal straight away. */
  const open = () =>
    run(async (c) => {
      setStep('confirm');
      await mined(await write.mutateAsync({ ...call, functionName: 'open', args: [id] }));
      onChanged();
      await reveal(c, false);
    });

  /** A holder who peeked reveals with their own proof; an open cat with the public one. */
  const revealNow = () =>
    run(async (c) => {
      if (state === STATE.Peeked) await ensurePermit(c);
      await reveal(c, state === STATE.Peeked);
    });

  function saveSvg() {
    if (dna === null) return;
    const url = URL.createObjectURL(new Blob([renderCatSvg(dna)], { type: 'image/svg+xml' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `fhecat-${id}.svg` });
    a.click();
    URL.revokeObjectURL(url);
  }

  const stepText = { signing: t.cats.signing, decrypting: t.cats.decrypting, confirm: t.cats.confirm, mining: t.cats.mining, idle: '' }[step];
  const privateView = seen !== null && !revealed;
  const ready = Boolean(cofhe) && !busy;
  const tokenUrl = explorerUrl(chainId, 'token', `${contract}?a=${id}`);

  return (
    <article className={`panel cat-card ${privateView ? 'is-private' : ''}`} data-token={id.toString()} data-state={state}>
      <div className="cat-art">
        {dna !== null ? (
          <CatImage dna={dna} alt={`FheCat #${id}`} />
        ) : (
          <CatImage handle={cat.dnaHandle} state={state as 0 | 1 | 2} alt={`FheCat #${id}`} />
        )}
        {privateView && <span className="ribbon">👁 {t.cats.seen}</span>}
      </div>
      <div className="cat-head">
        <h3>#{id.toString()}</h3>
        <span className={`chip state-${state} ${revealed ? 'chip-ok' : privateView ? 'chip-private' : ''}`}>{t.cats.states[state]}</span>
      </div>
      {traits ? (
        <ul className="traits">
          {traits.map((tr) => (
            <li key={tr.trait_type} title={tr.trait_type}>
              {tr.value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">{t.cats.stateNotes[state]}</p>
      )}
      {privateView && <p className="small muted">{t.cats.peekNote}</p>}

      {ask && (
        <div className="ask">
          <p className="small">{ask === 'peek' ? t.cats.peekWarn : t.cats.openWarn}</p>
          <div className="cat-actions">
            <button className="btn btn-small" onClick={ask === 'peek' ? peek : open} disabled={!ready}>
              {ask === 'peek' ? t.cats.confirmPeek : t.cats.confirmOpen}
            </button>
            <button className="btn btn-small btn-ghost" onClick={() => setAsk(null)}>
              {t.cats.cancel}
            </button>
          </div>
        </div>
      )}
      {busy && <p className="small step-text">{stepText}</p>}
      {error && <p className="small note error">{error}</p>}

      {!ask && (
        <div className="cat-actions">
          {state === STATE.Unopened && (
            <>
              <button className="btn btn-small btn-ghost" onClick={() => setAsk('peek')} disabled={!ready}>
                {t.cats.peek}
              </button>
              <button className="btn btn-small" onClick={() => setAsk('open')} disabled={!ready}>
                {t.cats.open}
              </button>
            </>
          )}
          {state === STATE.Peeked && (
            <>
              {seen === null ? (
                <button className="btn btn-small btn-ghost" onClick={peek} disabled={!ready || canDecrypt === undefined}>
                  {t.cats.peek}
                </button>
              ) : (
                <button className="btn btn-small btn-ghost" onClick={() => setSeen(null)} disabled={busy}>
                  {t.cats.hide}
                </button>
              )}
              {canDecrypt ? (
                <button className="btn btn-small" onClick={revealNow} disabled={!ready}>
                  {t.cats.reveal}
                </button>
              ) : (
                <button className="btn btn-small" onClick={() => setAsk('open')} disabled={!ready || canDecrypt === undefined}>
                  {t.cats.open}
                </button>
              )}
            </>
          )}
          {state === STATE.Opened && (
            <button className="btn btn-small" onClick={revealNow} disabled={!ready}>
              {t.cats.reveal}
            </button>
          )}
          {dna !== null && (
            <button className="btn btn-small btn-ghost" onClick={saveSvg}>
              {t.cats.save}
            </button>
          )}
          {tokenUrl && (
            <a className="link small" href={tokenUrl} target="_blank" rel="noreferrer">
              {t.cats.view} ↗
            </a>
          )}
        </div>
      )}
    </article>
  );
}
