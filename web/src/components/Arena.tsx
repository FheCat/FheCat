import { useState } from 'react';
import { useConnection, usePublicClient, useWriteContract } from 'wagmi';
import { parseEventLogs, type TransactionReceipt } from 'viem';
import type { CofheClient } from '@cofhe/sdk';
import { fheCatAbi, fheCatArenaAbi } from '../config/abi';
import { useCofhe } from '../lib/cofhe';
import { DUEL, STATE, TIERS, tierName, useAllowed, useArena, useMyCats, type CatView, type Duel, type TierClaim } from '../lib/hooks';
import { failure, retry } from '../lib/format';
import { Sprite } from '../pixel/Sprite';
import { Stars } from '../pixel/Sky';
import { useToast } from '../pixel/Toast';
import { ChapterHead } from './Chapter';
import { CatImage } from './CatImage';

interface Props {
  n: string;
  chainId: number;
  contract: `0x${string}`;
  arena: `0x${string}`;
  totalSupply: bigint;
}

/** Decrypts a yes/no the arena made public, with the threshold network's proof. Anyone can. */
async function publicAnswer(c: CofheClient, handle: `0x${string}`) {
  const { decryptedValue, signature } = await retry(() => c.decryptForTx(handle).withoutACP().execute());
  return { value: decryptedValue === 1n, signature };
}

const beat = (w: bigint, l: bigint) => `#${w} beat #${l}`;
const proven = (id: bigint, level: number, yes: boolean) => `#${id} is ${yes ? '' : 'not '}${tierName(level)}`;

function Thumb({ cat }: { cat: CatView }) {
  const state = Number(cat.state);
  return (
    <div className="arena-thumb">
      {state === STATE.Revealed ? (
        <CatImage dna={cat.dna} alt="" />
      ) : (
        <CatImage handle={cat.dnaHandle} state={state as 0 | 1 | 2} alt="" />
      )}
    </div>
  );
}

/** "#12 vs #34" with a pixel VS between the two. */
function Versus({ a, b }: { a: string; b: string }) {
  return (
    <span className="versus">
      <b>{a}</b> <i className="vs">vs</i> <b>{b}</b>
    </span>
  );
}

/**
 * Blind duels and tier proofs. Every result is computed on the cats' encrypted
 * DNA; the site only ever decrypts the one public bit and settles it on-chain.
 */
export function Arena({ n, chainId, contract, arena, totalSupply }: Props) {
  const toast = useToast();
  const { isConnected } = useConnection();
  const cofhe = useCofhe();
  const write = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const { cats, refetch: refetchCats } = useMyCats(totalSupply);
  const access = useAllowed(
    cats.map((c) => c.dnaHandle),
    arena,
  );
  const entered = access.allowed;
  const mine = cats.map((c) => c.tokenId);
  const { duels, claims, records, refetch } = useArena(arena, mine);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<{ token: bigint; kind: 'challenge' | 'tier' } | null>(null);
  const [opponent, setOpponent] = useState('');
  const [tier, setTier] = useState(1);
  const [picked, setPicked] = useState<Record<string, string>>({});

  const arenaCall = { address: arena, abi: fheCatArenaAbi, chainId } as const;
  const ready = Boolean(cofhe) && busy === null;

  async function act(key: string, fn: (c: CofheClient) => Promise<void>) {
    if (!cofhe) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn(cofhe);
    } catch (e) {
      console.error(e);
      setError(failure(e));
    } finally {
      setBusy(null);
      void refetch();
      void refetchCats();
      access.refetch();
    }
  }

  async function mined(hash: `0x${string}`): Promise<TransactionReceipt> {
    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Transaction reverted');
    return receipt;
  }

  function announce(text: string) {
    setNotice(text);
    toast(text);
  }

  async function settleDuel(c: CofheClient, duelId: bigint, challenger: bigint, opp: bigint, outcome: `0x${string}`) {
    const { value, signature } = await publicAnswer(c, outcome);
    await mined(await write.mutateAsync({ ...arenaCall, functionName: 'settle', args: [duelId, value, signature] }));
    const [w, l] = value ? [challenger, opp] : [opp, challenger];
    announce(beat(w, l));
  }

  async function settleClaim(c: CofheClient, claimId: bigint, tokenId: bigint, level: number, handle: `0x${string}`) {
    const { value, signature } = await publicAnswer(c, handle);
    await mined(await write.mutateAsync({ ...arenaCall, functionName: 'settleTier', args: [claimId, value, signature] }));
    announce(proven(tokenId, level, value));
  }

  const enter = (id: bigint) =>
    act(`enter-${id}`, async () => {
      await mined(await write.mutateAsync({ address: contract, abi: fheCatAbi, chainId, functionName: 'enterArena', args: [id] }));
      toast(`#${id} entered the arena`);
    });

  const challenge = (id: bigint) =>
    act(`cat-${id}`, async () => {
      const raw = opponent.trim().replace(/^#/, '');
      const opp = raw ? BigInt(raw) : 0n;
      await mined(await write.mutateAsync({ ...arenaCall, functionName: 'challenge', args: [id, opp] }));
      setForm(null);
      setOpponent('');
      toast(opp ? `#${id} challenged #${opp}` : `#${id} is waiting for a rival`);
    });

  const proveTier = (id: bigint) =>
    act(`cat-${id}`, async (c) => {
      const receipt = await mined(await write.mutateAsync({ ...arenaCall, functionName: 'claimTier', args: [id, tier] }));
      setForm(null);
      const [claimed] = parseEventLogs({ abi: fheCatArenaAbi, logs: receipt.logs, eventName: 'TierClaimed' });
      await settleClaim(c, claimed.args.claimId, id, tier, claimed.args.resultHandle);
    });

  const accept = (d: Duel, token: bigint) =>
    act(`duel-${d.id}`, async (c) => {
      const receipt = await mined(await write.mutateAsync({ ...arenaCall, functionName: 'accept', args: [d.id, token] }));
      const [fought] = parseEventLogs({ abi: fheCatArenaAbi, logs: receipt.logs, eventName: 'DuelFought' });
      await settleDuel(c, d.id, d.challenger, token, fought.args.outcomeHandle);
    });

  const cancel = (d: Duel) =>
    act(`duel-${d.id}`, async () => {
      await mined(await write.mutateAsync({ ...arenaCall, functionName: 'cancel', args: [d.id] }));
    });

  const settle = (d: Duel) => act(`duel-${d.id}`, (c) => settleDuel(c, d.id, d.challenger, d.opponent, d.outcome));
  const settleTier = (cl: TierClaim) => act(`claim-${cl.id}`, (c) => settleClaim(c, cl.id, cl.tokenId, cl.tier, cl.reached));

  const fighters = cats.filter((_, i) => entered[i]).map((c) => c.tokenId);
  const open = duels.filter((d) => d.status === DUEL.Open);
  const fought = duels.filter((d) => d.status === DUEL.Fought);
  const unsettled = claims.filter((c) => !c.settled);
  const results = [
    ...duels
      .filter((d) => d.status === DUEL.Settled)
      .map((d) => ({ key: `d${d.id}`, text: beat(d.winner, d.winner === d.challenger ? d.opponent : d.challenger), win: mine.includes(d.winner) })),
    ...claims.filter((c) => c.settled).map((c) => ({ key: `c${c.id}`, text: proven(c.tokenId, c.tier, c.result), win: c.result })),
  ];
  const working = (key: string) =>
    busy === key && (
      <span className="step-text">
        <i className="blink-dot" aria-hidden="true" />
        Working…
      </span>
    );

  return (
    <section className="chapter" id="arena">
      <Stars density={0.5} seed={73} />
      <div className="wrap">
        <ChapterHead n={n} label="The arena" title="Blind duels." wide>
          <p>
            Cats fight sealed. A cat’s Power is the sum of its eight DNA bytes, worked out under FHE and never decrypted; rarer traits mean more
            power. A duel only makes the winner public, a tier proof only a yes or a no.
          </p>
        </ChapterHead>

        <ol className="tiers">
          {TIERS.slice(1).map((t, i) => (
            <li key={t!.name} className={`tier tier-${i + 1}`}>
              <b>{t!.name}</b>
              <span className="mono">{t!.power}+ power</span>
              <span>About {t!.odds}</span>
            </li>
          ))}
        </ol>

        {error && <p className="note error">{error}</p>}
        {notice && <p className="note ok">{notice}</p>}

        <div className="arena-grid">
          <div className="box arena-panel">
            <p className="panel-head">
              <span>Your fighters</span>
              <span className="mono">{fighters.length} in the arena</span>
            </p>
            {!isConnected ? (
              <p className="panel-empty">Connect your wallet to fight.</p>
            ) : cats.length === 0 ? (
              <p className="panel-empty">Mint a cat to play.</p>
            ) : (
              <ul className="arena-list">
                {cats.map((cat, i) => {
                  const id = cat.tokenId;
                  const r = records.get(id);
                  return (
                    <li key={id.toString()} className="arena-cat" data-token={id.toString()}>
                      <Thumb cat={cat} />
                      <div className="arena-main">
                        <div className="arena-info">
                          <b>#{id.toString()}</b>
                          <span className="record mono">
                            {r?.wins ?? 0}W · {r?.losses ?? 0}L
                          </span>
                          {r && r.tier > 0 && <span className="chip chip-ok">{tierName(r.tier)}</span>}
                        </div>
                        <div className="cat-actions">
                          {entered[i] === false && (
                            <button className="btn btn-sm" onClick={() => enter(id)} disabled={!ready}>
                              Enter arena
                            </button>
                          )}
                          {entered[i] && (
                            <>
                              <button className="btn btn-sm" onClick={() => setForm({ token: id, kind: 'challenge' })} disabled={!ready}>
                                Challenge
                              </button>
                              <button className="btn btn-sm btn-ghost" onClick={() => setForm({ token: id, kind: 'tier' })} disabled={!ready}>
                                Prove tier
                              </button>
                            </>
                          )}
                          {working(`enter-${id}`)}
                          {working(`cat-${id}`)}
                        </div>
                      </div>
                      {form?.token === id && (
                        <div className="arena-form">
                          {form.kind === 'challenge' ? (
                            <input
                              className="field"
                              inputMode="numeric"
                              aria-label="Opponent"
                              placeholder="Opponent # (empty: anyone)"
                              value={opponent}
                              onChange={(e) => setOpponent(e.target.value)}
                            />
                          ) : (
                            <select className="field" aria-label="Tier" value={tier} onChange={(e) => setTier(Number(e.target.value))}>
                              {[1, 2, 3, 4].map((k) => (
                                <option key={k} value={k}>
                                  {tierName(k)} · {TIERS[k]!.power}+ power
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            className="btn btn-sm"
                            onClick={() => (form.kind === 'challenge' ? challenge(id) : proveTier(id))}
                            disabled={!ready || (form.kind === 'challenge' && !/^#?\d*$/.test(opponent.trim()))}
                          >
                            {form.kind === 'challenge' ? 'Send' : 'Prove tier'}
                          </button>
                          <button className="btn btn-sm btn-ghost" onClick={() => setForm(null)}>
                            Cancel
                          </button>
                          {form.kind === 'tier' && <p className="form-note">The answer becomes public either way.</p>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="arena-side">
            <div className="box arena-panel">
              <p className="panel-head">
                <span>Open challenges</span>
                <span className="mono">{open.length}</span>
              </p>
              {open.length === 0 ? (
                <p className="panel-empty">No open challenges. Send the first one.</p>
              ) : (
                <ul className="arena-list">
                  {open.map((d) => {
                    const mineChallenger = mine.includes(d.challenger);
                    const eligible = fighters.filter((f) => f !== d.challenger && (d.opponent === 0n || d.opponent === f));
                    const choice = picked[d.id.toString()] ?? eligible[0]?.toString();
                    return (
                      <li key={d.id.toString()} className="arena-row" data-duel={d.id.toString()}>
                        <Versus a={`#${d.challenger}`} b={d.opponent === 0n ? 'anyone' : `#${d.opponent}`} />
                        <div className="cat-actions">
                          {eligible.length > 0 && (
                            <>
                              <select
                                className="field field-sm"
                                aria-label="Accept with"
                                value={choice}
                                onChange={(e) => setPicked({ ...picked, [d.id.toString()]: e.target.value })}
                              >
                                {eligible.map((f) => (
                                  <option key={f.toString()} value={f.toString()}>
                                    #{f.toString()}
                                  </option>
                                ))}
                              </select>
                              <button className="btn btn-sm" onClick={() => accept(d, BigInt(choice!))} disabled={!ready}>
                                Accept
                              </button>
                            </>
                          )}
                          {mineChallenger && (
                            <button className="btn btn-sm btn-ghost" onClick={() => cancel(d)} disabled={!ready}>
                              Withdraw
                            </button>
                          )}
                          {working(`duel-${d.id}`)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {(fought.length > 0 || unsettled.length > 0) && (
              <div className="box arena-panel">
                <p className="panel-head">
                  <span>Waiting for a result</span>
                  <span className="mono">{fought.length + unsettled.length}</span>
                </p>
                <ul className="arena-list">
                  {fought.map((d) => (
                    <li key={`d${d.id}`} className="arena-row">
                      <Versus a={`#${d.challenger}`} b={`#${d.opponent}`} />
                      <div className="cat-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => settle(d)} disabled={!ready}>
                          Settle
                        </button>
                        {working(`duel-${d.id}`)}
                      </div>
                    </li>
                  ))}
                  {unsettled.map((c) => (
                    <li key={`c${c.id}`} className="arena-row">
                      <span className="versus">
                        <b>#{c.tokenId.toString()}</b> {tierName(c.tier)}?
                      </span>
                      <div className="cat-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => settleTier(c)} disabled={!ready}>
                          Settle
                        </button>
                        {working(`claim-${c.id}`)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {results.length > 0 && (
              <div className="box arena-panel">
                <p className="panel-head">
                  <span>Results</span>
                  <span className="mono">{results.length}</span>
                </p>
                <ul className="arena-list arena-results">
                  {results.map((r) => (
                    <li key={r.key} className={r.win ? 'is-win' : undefined}>
                      <Sprite name={r.win ? 'i-star' : 'i-diamond'} />
                      {r.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
