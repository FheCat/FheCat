import { useState } from 'react';
import { useConnection, usePublicClient, useWriteContract } from 'wagmi';
import { parseEventLogs, type TransactionReceipt } from 'viem';
import type { CofheClient } from '@cofhe/sdk';
import { useI18n } from '../i18n';
import { fheCatAbi, fheCatArenaAbi } from '../config/abi';
import { useCofhe } from '../lib/cofhe';
import { DUEL, STATE, useAllowed, useArena, useMyCats, type CatView, type Duel, type TierClaim } from '../lib/hooks';
import { errorMessage, isUserRejection, retry } from '../lib/format';
import { CatImage } from './CatImage';

interface Props {
  chainId: number;
  contract?: `0x${string}`;
  arena?: `0x${string}`;
  totalSupply: bigint;
}

/** Decrypts a yes/no the arena made public, with the threshold network's proof. Anyone can. */
async function publicAnswer(c: CofheClient, handle: `0x${string}`) {
  const { decryptedValue, signature } = await retry(() => c.decryptForTx(handle).withoutACP().execute());
  return { value: decryptedValue === 1n, signature };
}

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

/**
 * Blind duels and tier proofs. Every result is computed on the cats' encrypted
 * DNA; the site only ever decrypts the one public bit and settles it on-chain.
 */
export function Arena({ chainId, contract, arena, totalSupply }: Props) {
  const { t } = useI18n();
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

  if (!contract || !arena) return null;
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
      setError(isUserRejection(e) ? t.errors.rejected : errorMessage(e, t.errors.generic));
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

  async function settleDuel(c: CofheClient, duelId: bigint, challenger: bigint, opp: bigint, outcome: `0x${string}`) {
    const { value, signature } = await publicAnswer(c, outcome);
    await mined(await write.mutateAsync({ ...arenaCall, functionName: 'settle', args: [duelId, value, signature] }));
    const [w, l] = value ? [challenger, opp] : [opp, challenger];
    setNotice(t.arena.beat(w.toString(), l.toString()));
  }

  async function settleClaim(c: CofheClient, claimId: bigint, tokenId: bigint, level: number, handle: `0x${string}`) {
    const { value, signature } = await publicAnswer(c, handle);
    await mined(await write.mutateAsync({ ...arenaCall, functionName: 'settleTier', args: [claimId, value, signature] }));
    const name = t.arena.tiers[level];
    setNotice(value ? t.arena.proven(tokenId.toString(), name) : t.arena.notProven(tokenId.toString(), name));
  }

  const enter = (id: bigint) =>
    act(`enter-${id}`, async () => {
      await mined(await write.mutateAsync({ address: contract, abi: fheCatAbi, chainId, functionName: 'enterArena', args: [id] }));
    });

  const challenge = (id: bigint) =>
    act(`cat-${id}`, async () => {
      const raw = opponent.trim().replace(/^#/, '');
      const opp = raw ? BigInt(raw) : 0n;
      await mined(await write.mutateAsync({ ...arenaCall, functionName: 'challenge', args: [id, opp] }));
      setForm(null);
      setOpponent('');
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
    ...duels.filter((d) => d.status === DUEL.Settled).map((d) => ({ key: `d${d.id}`, text: t.arena.beat(d.winner.toString(), (d.winner === d.challenger ? d.opponent : d.challenger).toString()) })),
    ...claims
      .filter((c) => c.settled)
      .map((c) => ({
        key: `c${c.id}`,
        text: c.result ? t.arena.proven(c.tokenId.toString(), t.arena.tiers[c.tier]) : t.arena.notProven(c.tokenId.toString(), t.arena.tiers[c.tier]),
      })),
  ];
  const working = (key: string) => busy === key && <span className="small step-text">{t.arena.working}</span>;

  return (
    <section className="section" id="arena">
      <div className="container">
        <h2>{t.arena.title}</h2>
        <p className="muted arena-intro">{t.arena.body}</p>
        {error && <p className="note error">{error}</p>}
        {notice && <p className="note ok">{notice}</p>}

        <div className="arena-grid">
          <div className="panel arena-panel">
            <h3>{t.arena.yours}</h3>
            {!isConnected ? (
              <p className="muted small">{t.cats.connect}</p>
            ) : cats.length === 0 ? (
              <p className="muted small">{t.arena.noCats}</p>
            ) : (
              <ul className="arena-list">
                {cats.map((cat, i) => {
                  const id = cat.tokenId;
                  const r = records.get(id);
                  return (
                    <li key={id.toString()} className="arena-cat" data-token={id.toString()}>
                      <Thumb cat={cat} />
                      <div className="arena-info">
                        <b>#{id.toString()}</b>
                        <span className="small muted">{t.arena.record(r?.wins ?? 0, r?.losses ?? 0)}</span>
                        {r && r.tier > 0 && <span className="chip chip-ok">{t.arena.tiers[r.tier]}</span>}
                      </div>
                      <div className="cat-actions">
                        {entered[i] === false && (
                          <button className="btn btn-small" onClick={() => enter(id)} disabled={!ready}>
                            {t.arena.enter}
                          </button>
                        )}
                        {entered[i] && (
                          <>
                            <button className="btn btn-small" onClick={() => setForm({ token: id, kind: 'challenge' })} disabled={!ready}>
                              {t.arena.challenge}
                            </button>
                            <button className="btn btn-small btn-ghost" onClick={() => setForm({ token: id, kind: 'tier' })} disabled={!ready}>
                              {t.arena.prove}
                            </button>
                          </>
                        )}
                        {working(`enter-${id}`)}
                        {working(`cat-${id}`)}
                      </div>
                      {form?.token === id && (
                        <div className="arena-form">
                          {form.kind === 'challenge' ? (
                            <input
                              className="field"
                              inputMode="numeric"
                              placeholder={t.arena.opponent}
                              value={opponent}
                              onChange={(e) => setOpponent(e.target.value)}
                            />
                          ) : (
                            <select className="field" value={tier} onChange={(e) => setTier(Number(e.target.value))}>
                              {[1, 2, 3, 4].map((k) => (
                                <option key={k} value={k}>
                                  {t.arena.tiers[k]} · {t.arena.tierInfo[k]}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            className="btn btn-small"
                            onClick={() => (form.kind === 'challenge' ? challenge(id) : proveTier(id))}
                            disabled={!ready || (form.kind === 'challenge' && !/^#?\d*$/.test(opponent.trim()))}
                          >
                            {form.kind === 'challenge' ? t.arena.send : t.arena.prove}
                          </button>
                          <button className="btn btn-small btn-ghost" onClick={() => setForm(null)}>
                            {t.cats.cancel}
                          </button>
                          {form.kind === 'tier' && <p className="small muted">{t.arena.proveWarn}</p>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="arena-side">
            <div className="panel arena-panel">
              <h3>{t.arena.open}</h3>
              {open.length === 0 ? (
                <p className="muted small">{t.arena.noOpen}</p>
              ) : (
                <ul className="arena-list">
                  {open.map((d) => {
                    const mineChallenger = mine.includes(d.challenger);
                    const eligible = fighters.filter((f) => f !== d.challenger && (d.opponent === 0n || d.opponent === f));
                    const choice = picked[d.id.toString()] ?? eligible[0]?.toString();
                    return (
                      <li key={d.id.toString()} className="arena-row" data-duel={d.id.toString()}>
                        <span>
                          {d.opponent === 0n ? t.arena.vsAnyone(d.challenger.toString()) : t.arena.vs(d.challenger.toString(), d.opponent.toString())}
                        </span>
                        <div className="cat-actions">
                          {eligible.length > 0 && (
                            <>
                              <select
                                className="field field-small"
                                aria-label={t.arena.acceptWith}
                                value={choice}
                                onChange={(e) => setPicked({ ...picked, [d.id.toString()]: e.target.value })}
                              >
                                {eligible.map((f) => (
                                  <option key={f.toString()} value={f.toString()}>
                                    #{f.toString()}
                                  </option>
                                ))}
                              </select>
                              <button className="btn btn-small" onClick={() => accept(d, BigInt(choice!))} disabled={!ready}>
                                {t.arena.accept}
                              </button>
                            </>
                          )}
                          {mineChallenger && (
                            <button className="btn btn-small btn-ghost" onClick={() => cancel(d)} disabled={!ready}>
                              {t.arena.withdraw}
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
              <div className="panel arena-panel">
                <h3>{t.arena.pending}</h3>
                <ul className="arena-list">
                  {fought.map((d) => (
                    <li key={`d${d.id}`} className="arena-row">
                      <span>{t.arena.vs(d.challenger.toString(), d.opponent.toString())}</span>
                      <div className="cat-actions">
                        <button className="btn btn-small btn-ghost" onClick={() => settle(d)} disabled={!ready}>
                          {t.arena.settle}
                        </button>
                        {working(`duel-${d.id}`)}
                      </div>
                    </li>
                  ))}
                  {unsettled.map((c) => (
                    <li key={`c${c.id}`} className="arena-row">
                      <span>
                        #{c.tokenId.toString()} · {t.arena.tiers[c.tier]}?
                      </span>
                      <div className="cat-actions">
                        <button className="btn btn-small btn-ghost" onClick={() => settleTier(c)} disabled={!ready}>
                          {t.arena.settle}
                        </button>
                        {working(`claim-${c.id}`)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {results.length > 0 && (
              <div className="panel arena-panel">
                <h3>{t.arena.results}</h3>
                <ul className="arena-list arena-results">
                  {results.map((r) => (
                    <li key={r.key}>{r.text}</li>
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
