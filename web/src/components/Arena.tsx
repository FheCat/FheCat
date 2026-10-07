import { useEffect, useMemo, useState } from 'react';
import { useConnection, usePublicClient, useWriteContract } from 'wagmi';
import { parseEventLogs, type TransactionReceipt } from 'viem';
import { FheTypes, type CofheClient } from '@cofhe/sdk';
import { instinctsOf, type Tactic } from '@art';
import { fheCatAbi, fheCatArenaAbi } from '../config/abi';
import { ensurePermit, useCofhe } from '../lib/cofhe';
import { DUEL, STATE, TIERS, tierName, useAllowed, useArena, useCats, useMyCats, type CatView, type Duel, type TierClaim } from '../lib/hooks';
import { BADGES, OPEN_FOR, TACTIC_LIST, arenaFailure, badgesOf, lockTactic, timeLeft } from '../lib/arena';
import { retry } from '../lib/format';
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

const BOX = ['Sealed', 'Peeked', 'Opened', 'Revealed'];
const tacticName = (t: number) => TACTIC_LIST[t < 3 ? t : 0].name;

/** Decrypts a value the arena made public, with the CoFHE proof. Anyone can. */
async function publicValue(c: CofheClient, handle: `0x${string}`) {
  const { decryptedValue, signature } = await retry(() => c.decryptForTx(handle).withoutACP().execute());
  return { value: decryptedValue, signature };
}

function Thumb({ cat, small }: { cat?: CatView; small?: boolean }) {
  return (
    <div className={`arena-thumb ${small ? 'is-small' : ''}`}>
      {cat &&
        (Number(cat.state) === STATE.Revealed ? (
          <CatImage dna={cat.dna} alt="" />
        ) : (
          <CatImage handle={cat.dnaHandle} state={Number(cat.state) as 0 | 1 | 2} alt="" />
        ))}
    </div>
  );
}

function BoxChip({ state }: { state: number }) {
  return <span className={`chip box-chip box-${state}`}>{BOX[state]}</span>;
}

function Pips({ value }: { value: number }) {
  return (
    <span className="pips" aria-label={`${value} of 2`}>
      {[0, 1].map((i) => (
        <i key={i} className={i < value ? 'on' : undefined} />
      ))}
    </span>
  );
}

function TacticPicker({ value, onChange, disabled }: { value?: Tactic; onChange: (t: Tactic) => void; disabled?: boolean }) {
  return (
    <div className="tactic-pick" role="radiogroup" aria-label="Tactic">
      {TACTIC_LIST.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={value === t.id}
          className={`tactic-btn tactic-${t.id} ${value === t.id ? 'on' : ''}`}
          onClick={() => onChange(t.id)}
          disabled={disabled}
        >
          <Sprite art={t.icon} />
          {t.name}
        </button>
      ))}
    </div>
  );
}

/** Ticks every 30 seconds, for countdowns. */
function useNow() {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/**
 * The Blind Arena: duels between sealed boxes. Each side locks a tactic, encrypted in the
 * browser; the contract scores both under FHE with the cats' hidden instincts and a little luck,
 * and only the winner is ever made public.
 */
export function Arena({ n, chainId, contract, arena, totalSupply }: Props) {
  const toast = useToast();
  const { isConnected } = useConnection();
  const cofhe = useCofhe();
  const write = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const now = useNow();
  const { cats, refetch: refetchCats, loading: catsLoading } = useMyCats(totalSupply);
  const access = useAllowed(
    cats.map((c) => c.dnaHandle),
    arena,
  );
  const entered = access.allowed;
  const A = useArena(arena, totalSupply);
  const mine = cats.map((c) => c.tokenId);
  const isMine = (id: bigint) => mine.includes(id);

  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<{ token: bigint; kind: 'challenge' | 'tier' } | null>(null);
  const [opponent, setOpponent] = useState('');
  const [tactic, setTactic] = useState<Record<string, Tactic>>({});
  const [acceptWith, setAcceptWith] = useState<Record<string, string>>({});
  const [tier, setTier] = useState(1);
  const [seen, setSeen] = useState<Record<string, [number, number]>>({});
  const [instincts, setInstincts] = useState<Record<string, [number, number, number]>>({});

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
      setError(arenaFailure(e));
    } finally {
      setBusy(null);
      setStep(null);
      void A.refetch();
      void refetchCats();
      access.refetch();
    }
  }

  async function mined(hash: `0x${string}`): Promise<TransactionReceipt> {
    setStep('Waiting for the chain…');
    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Transaction reverted');
    return receipt;
  }

  function announce(text: string) {
    setNotice(text);
    toast(text);
  }

  /** Both tactics of a duel you fought, decrypted for your eyes only. */
  async function revealTactics(c: CofheClient, d: Pick<Duel, 'id' | 'challengerTactic' | 'opponentTactic'>) {
    await ensurePermit(c);
    const [a, b] = await Promise.all([
      retry(() => c.decryptForView(d.challengerTactic, FheTypes.Uint8).execute()),
      retry(() => c.decryptForView(d.opponentTactic, FheTypes.Uint8).execute()),
    ]);
    const pair: [number, number] = [Number(a), Number(b)];
    setSeen((s) => ({ ...s, [d.id.toString()]: pair }));
    return pair;
  }

  async function settleDuel(c: CofheClient, d: Pick<Duel, 'id' | 'challenger' | 'opponent' | 'outcome'>) {
    setStep('Decrypting the winner…');
    const { value, signature } = await publicValue(c, d.outcome);
    setStep('Confirm in your wallet');
    await mined(await write.mutateAsync({ ...arenaCall, functionName: 'settle', args: [d.id, Number(value), signature] }));
    const [w, l] = value === 1n ? [d.challenger, d.opponent] : [d.opponent, d.challenger];
    return { winner: w, loser: l };
  }

  async function settleClaim(c: CofheClient, claimId: bigint, tokenId: bigint, level: number, handle: `0x${string}`) {
    setStep('Decrypting the answer…');
    const { value, signature } = await publicValue(c, handle);
    setStep('Confirm in your wallet');
    await mined(await write.mutateAsync({ ...arenaCall, functionName: 'settleTier', args: [claimId, value === 1n, signature] }));
    announce(`#${tokenId} is ${value === 1n ? '' : 'not '}${tierName(level)}`);
  }

  const enter = (id: bigint) =>
    act(`enter-${id}`, async () => {
      setStep('Confirm in your wallet');
      await mined(await write.mutateAsync({ address: contract, abi: fheCatAbi, chainId, functionName: 'enterArena', args: [id] }));
      toast(`#${id} entered the arena`);
    });

  const challenge = (id: bigint) =>
    act(`cat-${id}`, async (c) => {
      const raw = opponent.trim().replace(/^#/, '');
      const opp = raw ? BigInt(raw) : 0n;
      if (opp > totalSupply) throw new Error(`There is no cat #${opp} yet.`);
      const t = tactic[`cat-${id}`]!;
      setStep('Encrypting your tactic…');
      const [hash, proof] = await lockTactic(c, arena, t);
      setStep('Confirm in your wallet');
      await mined(await write.mutateAsync({ ...arenaCall, functionName: 'challenge', args: [id, opp, hash, proof] }));
      setForm(null);
      setOpponent('');
      announce(opp ? `#${id} challenged #${opp}. Your ${tacticName(t)} is locked and sealed.` : `#${id} is waiting for a rival. Your ${tacticName(t)} is locked and sealed.`);
    });

  const accept = (d: Duel, token: bigint) =>
    act(`duel-${d.id}`, async (c) => {
      const t = tactic[`duel-${d.id}`]!;
      setStep('Encrypting your tactic…');
      const [hash, proof] = await lockTactic(c, arena, t);
      setStep('Confirm in your wallet');
      const receipt = await mined(await write.mutateAsync({ ...arenaCall, functionName: 'accept', args: [d.id, token, hash, proof] }));
      const [fought] = parseEventLogs({ abi: fheCatArenaAbi, logs: receipt.logs, eventName: 'DuelFought' });
      setStep('The arena is fighting under FHE…');
      const { winner, loser } = await settleDuel(c, { id: d.id, challenger: d.challenger, opponent: token, outcome: fought.args.outcomeHandle });
      const won = winner === token;
      let text = `${won ? 'You won' : 'You lost'}: #${winner} beat #${loser}.`;
      try {
        setStep('Sign once to see both tactics (free)');
        const [a, b] = await revealTactics(c, { id: d.id, challengerTactic: d.challengerTactic, opponentTactic: await opponentTacticOf(d.id) });
        text += ` They played ${tacticName(a)}, you played ${tacticName(b)}.`;
      } catch (e) {
        console.warn('tactics stay hidden for now', e); // seeing them is optional
      }
      announce(text);
    });

  /** The opponent's locked tactic handle, read fresh after a fight. */
  async function opponentTacticOf(duelId: bigint) {
    const d = (await publicClient!.readContract({ ...arenaCall, functionName: 'duels', args: [duelId] })) as readonly unknown[];
    return d[5] as `0x${string}`;
  }

  const settle = (d: Duel) =>
    act(`duel-${d.id}`, async (c) => {
      const { winner, loser } = await settleDuel(c, d);
      announce(`#${winner} beat #${loser}`);
    });

  const cancel = (d: Duel) =>
    act(`duel-${d.id}`, async () => {
      setStep('Confirm in your wallet');
      await mined(await write.mutateAsync({ ...arenaCall, functionName: 'cancel', args: [d.id] }));
    });

  const showTactics = (d: Duel) => act(`seen-${d.id}`, async (c) => void (await revealTactics(c, d)));

  const showInstincts = (cat: CatView) =>
    act(`inst-${cat.tokenId}`, async (c) => {
      setStep('Sign once to decrypt (free)');
      await ensurePermit(c);
      setStep('Decrypting in private…');
      const dna = (await retry(() => c.decryptForView(cat.dnaHandle, FheTypes.Uint64).execute())) as bigint;
      setInstincts((s) => ({ ...s, [cat.tokenId.toString()]: instinctsOf(dna) }));
    });

  const crown = (week: bigint) =>
    act('crown', async () => {
      setStep('Confirm in your wallet');
      await mined(await write.mutateAsync({ ...arenaCall, functionName: 'crownWeek', args: [week] }));
      toast('Crowned');
    });

  const proveTier = (id: bigint) =>
    act(`cat-${id}`, async (c) => {
      setStep('Confirm in your wallet');
      const receipt = await mined(await write.mutateAsync({ ...arenaCall, functionName: 'claimTier', args: [id, tier] }));
      setForm(null);
      const [claimed] = parseEventLogs({ abi: fheCatArenaAbi, logs: receipt.logs, eventName: 'TierClaimed' });
      setStep('The arena is checking under FHE…');
      await settleClaim(c, claimed.args.claimId, id, tier, claimed.args.resultHandle);
    });

  const settleTier = (cl: TierClaim) => act(`claim-${cl.id}`, (c) => settleClaim(c, cl.id, cl.tokenId, cl.tier, cl.reached));

  // ---------------------------------------------------------------------------
  const fighters = cats.filter((_, i) => entered[i]).map((c) => c.tokenId);
  const live = (d: Duel) => d.status === DUEL.Open && now <= d.openedAt + OPEN_FOR;
  const open = A.duels.filter(live);
  const openOf = new Map(open.map((d) => [d.challenger, d]));
  const fought = A.duels.filter((d) => d.status === DUEL.Fought);
  const settled = A.duels.filter((d) => d.status === DUEL.Settled).slice(0, 12);
  const unsettled = A.claims.filter((c) => !c.settled);
  const proofs = A.claims.filter((c) => c.settled).slice(0, 6);
  const board = [...A.points.entries()]
    .map(([id, pts]) => ({ id, pts, r: A.records.get(id)! }))
    .sort((a, b) => b.pts - a.pts || b.r.wins - a.r.wins || Number(a.id - b.id))
    .slice(0, 10);
  const weekEnds = A.nextWeekAt;
  const graceOver = weekEnds > 0 && now >= weekEnds - 6 * 86400;
  const canCrown = A.lastWeek.champion === 0n && A.lastWeek.leader !== 0n && graceOver;
  const others = useMemo(() => {
    const ids = new Set<bigint>();
    for (const d of [...open, ...fought, ...settled]) {
      ids.add(d.challenger);
      if (d.opponent) ids.add(d.opponent);
    }
    for (const b of board) ids.add(b.id);
    if (A.lastWeek.champion) ids.add(A.lastWeek.champion);
    return [...ids].sort((a, b) => Number(a - b));
  }, [A.duels, A.points, A.lastWeek.champion]);
  const catsById = useCats(others);
  const catOf = (id: bigint) => cats.find((c) => c.tokenId === id) ?? catsById.get(id);

  const working = (key: string) =>
    busy === key && (
      <span className="step-text">
        <i className="blink-dot" aria-hidden="true" />
        {step ?? 'Working…'}
      </span>
    );

  return (
    <section className="chapter" id="arena">
      <Stars density={0.5} seed={73} />
      <div className="wrap">
        <ChapterHead n={n} label="The Blind Arena" title="Fight before you peek." wide>
          <p>
            Lock a tactic in secret. Your cat’s hidden instincts and a little luck do the rest, all under FHE. Only the winner ever comes out of
            the box: not the DNA, not the tactics, not the score. You don’t need to see your cat to become a legend.
          </p>
        </ChapterHead>

        <ol className="tactics">
          {TACTIC_LIST.map((t) => (
            <li key={t.id} className={`tactic tactic-${t.id}`}>
              <Sprite art={t.icon} />
              <b>{t.name}</b>
              <span>Beats {t.beats}</span>
              <span className="tactic-from">Instinct: rare {t.from}</span>
            </li>
          ))}
        </ol>
        <p className="arena-rule">
          Each side scores <b>2</b> if its tactic wins, <b>+0–2</b> for its instinct, <b>+0–1</b> luck. A tie goes to the sealed box. Peek to
          learn your instincts; stay sealed to win the ties.
        </p>

        {error && <p className="note error">{error}</p>}
        {notice && <p className="note ok">{notice}</p>}

        <div className="arena-grid">
          <div className="arena-side">
            <div className="box arena-panel">
              <p className="panel-head">
                <span>Your fighters</span>
                <span className="mono">{fighters.length} in the arena</span>
              </p>
              {!isConnected ? (
                <p className="panel-empty">Connect your wallet to fight.</p>
              ) : catsLoading ? (
                <p className="panel-empty">Looking for your cats…</p>
              ) : cats.length === 0 ? (
                <p className="panel-empty">Mint a cat to play.</p>
              ) : (
                <ul className="arena-list">
                  {cats.map((cat, i) => {
                    const id = cat.tokenId;
                    const key = id.toString();
                    const r = A.records.get(id);
                    const state = Number(cat.state);
                    const known = state === STATE.Revealed ? instinctsOf(cat.dna) : instincts[key];
                    const myOpen = openOf.get(id);
                    const formKey = `cat-${id}`;
                    return (
                      <li key={key} className="arena-cat" data-token={key}>
                        <Thumb cat={cat} />
                        <div className="arena-main">
                          <div className="arena-info">
                            <b>#{key}</b>
                            <BoxChip state={state} />
                            <span className="record mono">
                              {r?.wins ?? 0}W · {r?.losses ?? 0}L{r?.sealedWins ? ` · ${r.sealedWins} sealed` : ''}
                              {r && r.streak > 1 ? ` · streak ${r.streak}` : ''}
                            </span>
                            {r && r.tier > 0 && <span className="chip chip-ok">{tierName(r.tier)}</span>}
                          </div>
                          {known ? (
                            <p className="instincts">
                              {TACTIC_LIST.map((t) => (
                                <span key={t.id}>
                                  {t.name} <Pips value={known[t.id]} />
                                </span>
                              ))}
                              {state !== STATE.Revealed && <em>only you see this</em>}
                            </p>
                          ) : state === STATE.Peeked && isConnected ? (
                            <p className="instincts">
                              <button className="link-btn" onClick={() => showInstincts(cat)} disabled={!ready}>
                                Show its instincts
                              </button>
                              {working(`inst-${id}`)}
                            </p>
                          ) : (
                            <p className="instincts is-sealed">Instincts sealed. Peek to learn them, or fight blind.</p>
                          )}
                          {r && r.badges > 0 && (
                            <p className="badges">
                              {badgesOf(r.badges).map((b) => (
                                <span key={b.bit} className="badge" title={b.about}>
                                  <Sprite name="i-star" />
                                  {b.name}
                                </span>
                              ))}
                            </p>
                          )}
                          <div className="cat-actions">
                            {entered[i] === false && (
                              <button className="btn btn-sm" onClick={() => enter(id)} disabled={!ready}>
                                Enter arena
                              </button>
                            )}
                            {entered[i] && !myOpen && (
                              <button className="btn btn-sm" onClick={() => setForm({ token: id, kind: 'challenge' })} disabled={!ready}>
                                Challenge
                              </button>
                            )}
                            {entered[i] && (
                              <button className="btn btn-sm btn-ghost" onClick={() => setForm({ token: id, kind: 'tier' })} disabled={!ready}>
                                Prove tier
                              </button>
                            )}
                            {myOpen && (
                              <>
                                <span className="waiting mono">waiting · {timeLeft(myOpen.openedAt + OPEN_FOR, now)}</span>
                                <button className="btn btn-sm btn-ghost" onClick={() => cancel(myOpen)} disabled={!ready}>
                                  Withdraw
                                </button>
                              </>
                            )}
                            {working(`enter-${id}`)}
                            {working(`cat-${id}`)}
                            {myOpen && working(`duel-${myOpen.id}`)}
                          </div>
                        </div>
                        {form?.token === id && (
                          <div className="arena-form">
                            {form.kind === 'challenge' ? (
                              <>
                                <input
                                  className="field"
                                  inputMode="numeric"
                                  aria-label="Opponent"
                                  placeholder="Opponent # (empty: anyone)"
                                  value={opponent}
                                  onChange={(e) => setOpponent(e.target.value)}
                                />
                                <TacticPicker value={tactic[formKey]} onChange={(t) => setTactic({ ...tactic, [formKey]: t })} disabled={!ready} />
                                <button
                                  className="btn btn-sm"
                                  onClick={() => challenge(id)}
                                  disabled={!ready || tactic[formKey] === undefined || !/^#?\d*$/.test(opponent.trim())}
                                >
                                  Lock &amp; challenge
                                </button>
                              </>
                            ) : (
                              <>
                                <select className="field" aria-label="Tier" value={tier} onChange={(e) => setTier(Number(e.target.value))}>
                                  {[1, 2, 3, 4].map((k) => (
                                    <option key={k} value={k}>
                                      {tierName(k)} · {TIERS[k]!.power}+ power · {TIERS[k]!.odds}
                                    </option>
                                  ))}
                                </select>
                                <button className="btn btn-sm" onClick={() => proveTier(id)} disabled={!ready}>
                                  Prove tier
                                </button>
                              </>
                            )}
                            <button className="btn btn-sm btn-ghost" onClick={() => setForm(null)}>
                              Cancel
                            </button>
                            <p className="form-note">
                              {form.kind === 'challenge'
                                ? 'Your tactic is encrypted in your browser. Nobody can see it, your opponent included; after the fight only the two of you can.'
                                : 'Power is the sum of the DNA bytes, checked under FHE. The yes or no becomes public either way.'}
                            </p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="box arena-panel">
              <p className="panel-head">
                <span>This week</span>
                <span className="mono">{weekEnds ? `ends in ${timeLeft(weekEnds, now)}` : ''}</span>
              </p>
              {board.length === 0 ? (
                <p className="panel-empty">No duels settled this week yet. The table resets every Monday, 00:00 UTC.</p>
              ) : (
                <ol className="board">
                  {board.map((b, i) => (
                    <li key={b.id.toString()} className={isMine(b.id) ? 'is-mine' : undefined}>
                      <span className="rank mono">{i + 1}</span>
                      <Thumb cat={catOf(b.id)} small />
                      <b>#{b.id.toString()}</b>
                      <span className="record mono">
                        {b.r.wins}W · {b.r.losses}L
                      </span>
                      <span className="board-badges">
                        {badgesOf(b.r.badges).map((x) => (
                          <span key={x.bit} title={x.name}>
                            <Sprite name="i-star" />
                          </span>
                        ))}
                      </span>
                      <span className="pts mono">{b.pts} {b.pts === 1 ? 'pt' : 'pts'}</span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="board-note">Win 3 points, 4 with a sealed box; a loss still gets 1. Two cats meet once a week.</p>
              {A.lastWeek.champion !== 0n ? (
                <p className="crown-line">
                  <Sprite name="i-star" /> Last week’s crown: <b>#{A.lastWeek.champion.toString()}</b>
                </p>
              ) : (
                canCrown && (
                  <div className="cat-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => crown(A.week - 1n)} disabled={!ready}>
                      Crown last week’s top cat
                    </button>
                    {working('crown')}
                  </div>
                )
              )}
            </div>
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
                    const ch = catOf(d.challenger);
                    const chState = ch ? Number(ch.state) : 0;
                    const mineChallenger = isMine(d.challenger);
                    const eligible = fighters.filter((f) => f !== d.challenger && (d.opponent === 0n || d.opponent === f));
                    const choice = acceptWith[d.id.toString()] ?? eligible[0]?.toString();
                    const key = `duel-${d.id}`;
                    return (
                      <li key={d.id.toString()} className="duel-open" data-duel={d.id.toString()}>
                        <div className="duel-head">
                          <Thumb cat={ch} small />
                          <div>
                            <p className="duel-title">
                              <b>#{d.challenger.toString()}</b>
                              <i className="vs">vs</i>
                              <b>{d.opponent === 0n ? 'anyone' : `#${d.opponent}`}</b>
                            </p>
                            <p className="duel-meta">
                              <BoxChip state={chState} />
                              <span className="mono">{timeLeft(d.openedAt + OPEN_FOR, now)} left</span>
                            </p>
                          </div>
                        </div>
                        {chState === STATE.Peeked && !mineChallenger && <p className="bluff">Its holder has peeked and knows its instincts. Bluff?</p>}
                        {chState === STATE.Unopened && !mineChallenger && <p className="bluff">A sealed box: it wins the ties.</p>}
                        {eligible.length > 0 && !mineChallenger && (
                          <div className="arena-form">
                            <select
                              className="field field-sm"
                              aria-label="Accept with"
                              value={choice}
                              onChange={(e) => setAcceptWith({ ...acceptWith, [d.id.toString()]: e.target.value })}
                            >
                              {eligible.map((f) => (
                                <option key={f.toString()} value={f.toString()}>
                                  #{f.toString()}
                                </option>
                              ))}
                            </select>
                            <TacticPicker value={tactic[key]} onChange={(t) => setTactic({ ...tactic, [key]: t })} disabled={!ready} />
                            <button className="btn btn-sm" onClick={() => accept(d, BigInt(choice!))} disabled={!ready || tactic[key] === undefined}>
                              Lock &amp; fight
                            </button>
                          </div>
                        )}
                        {mineChallenger && <p className="bluff">Your challenge. Waiting for a rival.</p>}
                        {working(key)}
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
                      <span className="versus">
                        <b>#{d.challenger.toString()}</b> <i className="vs">vs</i> <b>#{d.opponent.toString()}</b>
                      </span>
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

            {(settled.length > 0 || proofs.length > 0) && (
              <div className="box arena-panel">
                <p className="panel-head">
                  <span>Results</span>
                  <span className="mono">{settled.length + proofs.length}</span>
                </p>
                <ul className="arena-list arena-results">
                  {settled.map((d) => {
                    const loser = d.winner === d.challenger ? d.opponent : d.challenger;
                    const sealedWin = d.winner === d.challenger ? d.challengerSealed : d.opponentSealed;
                    const fought = isMine(d.challenger) || isMine(d.opponent);
                    const seenPair = seen[d.id.toString()];
                    // the winner's tactic first, as the line reads
                    const pair = seenPair && (d.winner === d.challenger ? seenPair : ([seenPair[1], seenPair[0]] as const));
                    return (
                      <li key={`d${d.id}`} className={isMine(d.winner) ? 'is-win' : undefined}>
                        <Sprite name={sealedWin ? 'i-star' : 'i-diamond'} />
                        <span>
                          #{d.winner.toString()} beat #{loser.toString()}
                          {sealedWin && <em> sealed</em>}
                          {pair && (
                            <em>
                              {' '}
                              · {tacticName(pair[0])} vs {tacticName(pair[1])}
                            </em>
                          )}
                        </span>
                        {fought && !pair && (
                          <button className="link-btn" onClick={() => showTactics(d)} disabled={!ready}>
                            Tactics
                          </button>
                        )}
                        {working(`seen-${d.id}`)}
                      </li>
                    );
                  })}
                  {proofs.map((c) => (
                    <li key={`c${c.id}`} className={c.result ? 'is-win' : undefined}>
                      <Sprite name={c.result ? 'i-star' : 'i-diamond'} />
                      <span>
                        #{c.tokenId.toString()} is {c.result ? '' : 'not '}
                        {tierName(c.tier)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="box arena-panel">
              <p className="panel-head">
                <span>Badges</span>
                <span className="mono">stay with the cat</span>
              </p>
              <ul className="badge-list">
                {BADGES.map((b) => (
                  <li key={b.bit}>
                    <Sprite name="i-star" />
                    <b>{b.name}</b>
                    <span>{b.about}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
