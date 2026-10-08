import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TACTICS, type FighterLook, type Tactic } from '@art';
import { lookKey } from '../arena/pixels';
import { BEATS, buildScript, captionOf, type FightPlan, type Side } from '../arena/script';
import { SOUND_ICON, SOUND_OFF_ICON, arenaSound, unlockArenaSound } from '../arena/sound';
import { STAGE_W, render, type Script } from '../arena/stage';
import { POINTS, TACTIC_LIST } from '../lib/arena';
import { REDUCED_MOTION } from '../pixel/fc';
import { Sprite } from '../pixel/Sprite';

const BOX = ['Sealed', 'Peeked', 'Opened', 'Revealed'];

/** A lock, for a tactic nobody can see yet. */
const LOCK_ICON = ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'XX.XX', 'XXXXX'];

/** The announcer's clips, next to the site's other public files. */
const sound = arenaSound(`${import.meta.env.BASE_URL}arena/voice/`);

export interface FightView {
  duelId: bigint;
  /** The two cats, the challenger's first: it fights from the left. */
  ids: readonly [bigint, bigint];
  looks: readonly [FighterLook, FighterLook];
  /** Their boxes (0 Sealed ... 3 Revealed), for the chips. */
  boxes: readonly [number, number];
  plan: FightPlan;
  /** The winner won with a sealed box: 4 points instead of 3. */
  sealedWin?: boolean;
  /** Badges this duel earned. */
  badges?: readonly { id: bigint; name: string }[];
  /** The viewer's side, when they hold one of the two cats. */
  mine?: Side | null;
  /** While the arena decides: the step under way. */
  status?: string | null;
}

interface Props {
  fight: FightView;
  onClose: () => void;
  /** For a holder of one of the cats: decrypt both tactics (a free signature) and watch them played. Throws a message to show. */
  onReveal?: () => Promise<void>;
}

type Phase = 'intro' | 'vs' | 'lock' | 'clash' | 'result';

function phaseAt(s: Script, t: number): Phase {
  if (s.marks.result !== undefined && t >= s.marks.result) return 'result';
  if (t >= s.marks.clash) return 'clash';
  if (t >= s.marks.lock) return 'lock';
  if (t >= s.marks.vs[0]) return 'vs';
  return 'intro';
}

/** The frame to show without motion: the result, or the face-off while the arena decides. */
const stillAt = (s: Script) => (Number.isFinite(s.marks.end) ? s.marks.end : BEATS.lock + 0.5);

function TacticSlot({ phase, tactic, live }: { phase: Phase; tactic?: Tactic; live: boolean }) {
  if (phase === 'intro' || phase === 'vs') return <span className="fight-tactic is-ready">Ready</span>;
  if ((phase === 'clash' || phase === 'result') && tactic !== undefined) {
    const t = TACTIC_LIST[tactic];
    return (
      <span className={`fight-tactic is-open tactic-${t.id}`}>
        <Sprite art={t.icon} />
        {t.name}
      </span>
    );
  }
  return (
    <span className="fight-tactic is-locked">
      <Sprite art={LOCK_ICON} />
      {phase === 'lock' || live ? 'Locked' : 'Secret'}
    </span>
  );
}

/**
 * A duel, played out: both cats run in, face off and lock their tactics, the arena fights under
 * FHE, and the winner stands over a dazed loser. Holders of the two cats see the tactics played;
 * everyone else sees a fight cloud, because nobody else ever learns them.
 */
export function FightScene({ fight, onClose, onReveal }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const clock = useRef(0);
  const [script, setScript] = useState<Script>(() => buildScript(fight.plan));
  const scriptRef = useRef(script);
  const phaseRef = useRef<Phase>('intro');
  const [phase, setPhase] = useState<Phase>('intro');
  const [scale, setScale] = useState(0);
  const [moving, setMoving] = useState(!REDUCED_MOTION);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [muted, setMuted] = useState(sound.muted());
  const looksRef = useRef(fight.looks);
  looksRef.current = fight.looks;

  const { plan, ids } = fight;
  const known = plan.winner !== null;
  const planKey = `${fight.duelId}|${plan.winner}|${plan.tactics?.join(',') ?? ''}`;

  // A new plan: the result coming in during a live fight starts the clash from the face-off;
  // tactics coming in after the result replay the fight from the lock; anything else starts over.
  const shown = useRef({ key: planKey, plan });
  useEffect(() => {
    const before = shown.current;
    if (before.key === planKey) return;
    shown.current = { key: planKey, plan };
    const sameDuel = before.key.split('|')[0] === String(fight.duelId);
    let next: Script;
    if (sameDuel && before.plan.winner === null && plan.winner !== null) {
      next = buildScript({ ...plan, clashAt: Math.max(BEATS.clash, clock.current + 0.3) });
    } else if (sameDuel && before.plan.winner !== null && !before.plan.tactics && plan.tactics) {
      next = buildScript(plan);
      clock.current = BEATS.lock - 0.3;
      setMoving(true);
    } else {
      next = buildScript(plan);
      clock.current = 0;
    }
    scriptRef.current = next;
    setScript(next);
  }, [planKey]);

  // The stage at a whole-number scale that fits; under 2× it fills the width instead.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => setScale(Math.min(6, Math.floor(el.clientWidth / STAGE_W)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Open as a modal: the page behind is inert, Escape closes, focus comes back where it was
  // (closed before React removes it, or the browser cannot hand focus back).
  useLayoutEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    document.documentElement.classList.add('fight-open');
    unlockArenaSound();
    return () => {
      document.documentElement.classList.remove('fight-open');
      if (d?.open) d.close();
      sound.pause();
    };
  }, []);

  // The sound follows the script: a new fight, a result coming in, the tactics coming in.
  useEffect(() => {
    sound.scene(script, { winner: plan.winner, sealed: fight.sealedWin, mine: fight.mine });
  }, [script, plan.winner, fight.sealedWin, fight.mine]);
  useEffect(() => {
    if (!moving) sound.pause();
  }, [moving]);

  const castKey = `${lookKey(fight.looks[0])}|${lookKey(fight.looks[1])}`;
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const s = scriptRef.current;
      if (moving) clock.current += Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = moving ? clock.current : stillAt(s);
      render(ctx, s, { looks: [looksRef.current[0], looksRef.current[1]] }, t);
      if (moving) sound.tick(t);
      const p = phaseAt(s, t);
      if (p !== phaseRef.current) {
        phaseRef.current = p;
        setPhase(p);
      }
      if (moving) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [moving, script, castKey]);

  const skip = () => {
    clock.current = Math.max(clock.current, script.marks.end);
  };
  const replay = () => {
    clock.current = 0;
    setMoving(true);
  };
  const reveal = async () => {
    if (!onReveal) return;
    setRevealing(true);
    setRevealError(null);
    try {
      await onReveal();
    } catch (e) {
      setRevealError(e instanceof Error ? e.message : String(e));
    } finally {
      setRevealing(false);
    }
  };

  const winner = plan.winner;
  const atResult = phase === 'result' && winner !== null;
  const winId = winner !== null ? ids[winner] : 0n;
  const loseId = winner !== null ? ids[winner === 0 ? 1 : 0] : 0n;
  const pts = (s: Side) => (s === winner ? (fight.sealedWin ? POINTS.sealedWin : POINTS.win) : POINTS.loss);
  const caption =
    phase === 'result'
      ? captionOf(plan)
      : phase === 'clash'
        ? plan.tactics
          ? `${TACTICS[plan.tactics[0]]} against ${TACTICS[plan.tactics[1]]}!`
          : 'Nobody sees the tactics, only the fight.'
        : phase === 'lock'
          ? known
            ? 'Both tactics are locked and sealed.'
            : captionOf(plan)
          : `#${ids[0]} challenges #${ids[1]}.`;
  const youWon = fight.mine !== undefined && fight.mine !== null && winner !== null ? fight.mine === winner : null;
  const stageWidth = scale >= 2 ? scale * STAGE_W : undefined;

  return (
    <dialog
      ref={dialog}
      className="fight"
      aria-labelledby="fight-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
      onPointerDown={unlockArenaSound}
    >
      <div className="box fight-box" data-phase={phase}>
        <div className="fight-top">
          <h2 className="fight-title" id="fight-title">
            Blind Arena · Duel #{fight.duelId.toString()}
          </h2>
          <div className="fight-tools">
            <button
              type="button"
              className="btn btn-sm btn-ghost fight-sound"
              aria-label="Sound"
              aria-pressed={!muted}
              title={muted ? 'Sound off' : 'Sound on'}
              onClick={() => {
                sound.setMuted(!muted);
                setMuted(!muted);
              }}
            >
              <Sprite art={muted ? SOUND_OFF_ICON : SOUND_ICON} />
            </button>
            <button type="button" className="btn btn-sm btn-ghost fight-close" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="fight-cards">
          {([0, 1] as const).map((s) => (
            <div key={s} className={`fight-card ${s === 0 ? 'is-left' : 'is-right'}${atResult && s === winner ? ' is-winner' : ''}`}>
              <p className="fight-name">
                <b>#{ids[s].toString()}</b>
                {fight.mine === s && <span className="fight-you">you</span>}
              </p>
              <span className={`fight-chip is-${fight.boxes[s]}`}>{BOX[fight.boxes[s]]}</span>
              <TacticSlot phase={phase} tactic={plan.tactics?.[s]} live={!known} />
            </div>
          ))}
          <span className={`fight-vs${phase === 'intro' ? '' : ' on'}`} aria-hidden="true">
            VS
          </span>
        </div>

        <div className="fight-stage" ref={stage}>
          <div className="fight-screen" style={{ width: stageWidth }}>
            <canvas ref={canvas} width={STAGE_W} height={90} aria-hidden="true" />
            {atResult && (
              <>
                <p className="fight-banner">
                  #{winId.toString()} wins
                  {fight.sealedWin && <span className="fight-sealed">sealed</span>}
                </p>
                {([0, 1] as const).map((s) => (
                  <span
                    key={s}
                    className={`fight-pts${s === winner ? ' is-win' : ''}`}
                    style={{ left: `${(script.rest[s] / STAGE_W) * 100}%` }}
                    aria-hidden="true"
                  >
                    +{pts(s)}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>

        <p className="fight-caption">{caption}</p>
        <p className="sr-only" aria-live="polite">
          {atResult
            ? `#${winId} beat #${loseId}. ${captionOf(plan)} ${youWon === null ? '' : youWon ? 'You won.' : 'You lost.'}`
            : !known
              ? (fight.status ?? '')
              : ''}
        </p>

        {atResult && (youWon !== null || (fight.badges && fight.badges.length > 0)) && (
          <div className="fight-after">
            {youWon !== null && (
              <span className={`fight-verdict${youWon ? ' is-win' : ''}`}>
                {youWon ? `You won · +${pts(winner!)} points` : `You lost · +${POINTS.loss} point`}
              </span>
            )}
            {fight.badges?.map((b) => (
              <span key={`${b.id}-${b.name}`} className="badge">
                <Sprite name="i-star" />#{b.id.toString()} {b.name}
              </span>
            ))}
          </div>
        )}

        {revealError && <p className="note error fight-note">{revealError}</p>}

        <div className="fight-actions">
          {known && phase !== 'result' && moving && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={skip}>
              Skip
            </button>
          )}
          {known && (phase === 'result' || !moving) && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={replay}>
              {moving ? 'Replay' : 'Play'}
            </button>
          )}
          {known && !plan.tactics && onReveal && (
            <button type="button" className="btn btn-sm" onClick={reveal} disabled={revealing}>
              {revealing ? 'Decrypting…' : 'Watch with tactics'}
            </button>
          )}
          {!known && (
            <span className="fight-status">
              <i className="blink-dot" aria-hidden="true" />
              {fight.status ?? 'The arena is fighting under FHE…'}
            </span>
          )}
        </div>
      </div>
    </dialog>
  );
}
