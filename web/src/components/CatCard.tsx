import { useMemo, useState } from 'react';
import { usePublicClient, useWriteContract } from 'wagmi';
import { FheTypes, type CofheClient } from '@cofhe/sdk';
import { renderCatSvg, traitsOf } from '@art';
import { fheCatAbi } from '../config/abi';
import { explorerUrl } from '../config/chains';
import { ensurePermit } from '../lib/cofhe';
import { STATE, STATE_NAMES, type CatView } from '../lib/hooks';
import { dnaHex, failure, retry } from '../lib/format';
import { Sprite } from '../pixel/Sprite';
import { useToast } from '../pixel/Toast';
import { CatImage } from './CatImage';

type Step = 'idle' | 'confirm' | 'mining' | 'signing' | 'decrypting';

const STEP_TEXT: Record<Step, string> = {
  idle: '',
  confirm: 'Confirm the transaction…',
  mining: 'Waiting for the transaction…',
  signing: 'Sign the decryption permit…',
  decrypting: 'Decrypting with Fhenix…',
};

const STATE_NOTES = [
  'Nobody has ever seen this cat.',
  'A holder has peeked. Still sealed for everyone else.',
  'The box is open: anyone can finish the reveal.',
  '',
];

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
  const toast = useToast();
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
      setError(failure(e));
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
    toast(`FheCat #${id} is out of the box`);
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

  const privateView = seen !== null && !revealed;
  const ready = Boolean(cofhe) && !busy;
  const tokenUrl = explorerUrl(chainId, 'token', `${contract}?a=${id}`);
  const visibleTo = state >= STATE.Opened ? 'Everyone' : state === STATE.Peeked ? 'Peekers only' : 'Nobody';

  return (
    <article className={`cat-card box ${privateView ? 'is-private' : ''}`} data-token={id.toString()} data-state={state}>
      <p className="spec-head">
        <span>FheCat #{id.toString()}</span>
        <span className={`chip state-${state} ${revealed ? 'chip-ok' : privateView ? 'chip-private' : ''}`}>{STATE_NAMES[state]}</span>
      </p>
      <div className="cat-art">
        {dna !== null ? (
          <CatImage dna={dna} alt={`FheCat #${id}`} />
        ) : (
          <CatImage handle={cat.dnaHandle} state={state as 0 | 1 | 2} alt={`FheCat #${id}, sealed`} />
        )}
        {privateView && (
          <span className="private-tag">
            <Sprite name="eye" />
            Only you
          </span>
        )}
      </div>

      <dl className="spec-data">
        <div>
          <dt>DNA</dt>
          {dna !== null ? (
            <dd className="mono">{dnaHex(dna)}</dd>
          ) : (
            <dd>
              <span className="sr">Encrypted</span>
              <span className="redact" />
              <span className="redact short" />
            </dd>
          )}
        </div>
        <div>
          <dt>Visible to</dt>
          <dd>{visibleTo}</dd>
        </div>
      </dl>

      {traits ? (
        <ul className="traits">
          {traits.map((tr) => (
            <li key={tr.trait_type} title={tr.trait_type}>
              {tr.value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="cat-note">{STATE_NOTES[state]}</p>
      )}
      {privateView && <p className="cat-note">Decrypted in your browser. Nothing was published.</p>}

      {ask && (
        <div className="ask">
          <p>
            {ask === 'peek'
              ? 'Peeking marks this cat as Peeked for good, so later buyers know it may have been seen. Nobody else will see it.'
              : 'Opening makes this cat’s DNA public and shows it to everyone. It cannot be undone.'}
          </p>
          <div className="cat-actions">
            <button className="btn btn-sm" onClick={ask === 'peek' ? peek : open} disabled={!ready}>
              {ask === 'peek' ? 'Peek in private' : 'Open for everyone'}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setAsk(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {busy && (
        <p className="step-text">
          <i className="blink-dot" aria-hidden="true" />
          {STEP_TEXT[step]}
        </p>
      )}
      {error && <p className="note error">{error}</p>}

      {!ask && (
        <div className="cat-actions">
          {state === STATE.Unopened && (
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => setAsk('peek')} disabled={!ready}>
                Peek
              </button>
              <button className="btn btn-sm" onClick={() => setAsk('open')} disabled={!ready}>
                Open the box
              </button>
            </>
          )}
          {state === STATE.Peeked && (
            <>
              {seen === null ? (
                <button className="btn btn-sm btn-ghost" onClick={peek} disabled={!ready || canDecrypt === undefined}>
                  Peek
                </button>
              ) : (
                <button className="btn btn-sm btn-ghost" onClick={() => setSeen(null)} disabled={busy}>
                  Hide
                </button>
              )}
              {canDecrypt ? (
                <button className="btn btn-sm" onClick={revealNow} disabled={!ready}>
                  Reveal
                </button>
              ) : (
                <button className="btn btn-sm" onClick={() => setAsk('open')} disabled={!ready || canDecrypt === undefined}>
                  Open the box
                </button>
              )}
            </>
          )}
          {state === STATE.Opened && (
            <button className="btn btn-sm" onClick={revealNow} disabled={!ready}>
              Reveal
            </button>
          )}
          {dna !== null && (
            <button className="btn btn-sm btn-ghost" onClick={saveSvg}>
              Save SVG
            </button>
          )}
          {tokenUrl && (
            <a className="link" href={tokenUrl} target="_blank" rel="noreferrer">
              Explorer <Sprite name="i-ext" />
            </a>
          )}
        </div>
      )}
    </article>
  );
}
