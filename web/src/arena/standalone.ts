import type { FighterLook } from '@art';
import { fighterFrame, lookKey } from './pixels';
import { buildScript, captionOf, type Side } from './script';
import { SOUND_ICON, SOUND_OFF_ICON, arenaSound, unlockArenaSound } from './sound';
import { STAGE_W, render, type Script } from './stage';

/**
 * The arena's fighters and fights for a page without React: the admin's Arena tab
 * (landing/admin.html with js/admin-arena.js). The same engine and the same look as the mint
 * site, built by `npm run build:admin-copy` into landing/admin/mint/arena-game.js, which is served
 * only behind the admin sign-in, like the rest of the art. It sets window.FheCat.arenaGame.
 *
 * The admin never holds a cat in the duels it watches, so it sees what any spectator sees: the
 * fight cloud and who comes out of it. Nobody but the two holders can decrypt the tactics.
 */

/** A cat as the admin API sends it: its box (0 Sealed … 3 Revealed), its ciphertext handle (the box's barcode), its DNA once revealed. */
export interface CatLook {
  state: number;
  handle?: string;
  dna?: string;
}

/** A settled duel to watch. */
export interface Bout {
  id: number;
  /** The two cats, the challenger's first: it fights from the left. */
  ids: [number, number];
  cats: [CatLook | undefined, CatLook | undefined];
  /** 0 when the challenger won, 1 when the opponent did. */
  winner: Side;
  /** The winner was a sealed box: 4 points instead of 3. */
  sealed: boolean;
}

const BOX = ['Sealed', 'Peeked', 'Opened', 'Revealed'];
const LOCK_ICON = ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'XX.XX', 'XXXXX'];
const POINTS = { win: 3, sealedWin: 4, loss: 1 };
const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
/** The announcer's clips sit next to this script, in the admin copy's arena/voice/. */
function voiceBase() {
  try {
    return new URL('arena/voice/', (document.currentScript as HTMLScriptElement | null)?.src || location.href).href;
  } catch {
    return 'arena/voice/'; // an inline copy on a blank page: no clips, the fight plays on
  }
}
const sound = arenaSound(voiceBase());

/** A revealed cat as itself; any other as its sealed box, with its own barcode. */
function lookOf(cat: CatLook | undefined): FighterLook {
  if (cat && cat.state === 3 && cat.dna) return { kind: 'cat', dna: BigInt(cat.dna) };
  return { kind: 'box', state: Math.min(cat?.state ?? 0, 2) as 0 | 1 | 2, handle: cat?.handle };
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

/** The homepage's pixel sprite as an <svg>, when js/pixel.js is on the page. */
function icon(rows: string[]): Node {
  const pixel = (window as unknown as { FheCat?: { pixel?: { svg(rows: string[]): SVGSVGElement } } }).FheCat?.pixel;
  return pixel ? pixel.svg(rows) : document.createTextNode('');
}

// ---------------------------------------------------------------------------
// Fighters in the lists, breathing on one shared clock
// ---------------------------------------------------------------------------

/** The part of the 48×48 frame a list shows: the body standing, a pixel or two around it. */
const CROP = { x: 4, y: 7, w: 40, h: 40 };

interface Breathing {
  canvas: HTMLCanvasElement;
  look: FighterLook;
  offset: number;
  born: number;
  seen: boolean;
}

const breathing = new Set<Breathing>();
let timer = 0;
let ticks = 0;

function paint(f: Breathing, tick: number) {
  const t = tick + f.offset;
  const ctx = f.canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, CROP.w, CROP.h);
  ctx.drawImage(fighterFrame(f.look, Math.floor(t / 2) % 2 ? 'idle2' : 'idle', 'right', t), -CROP.x, -CROP.y);
}

function step() {
  if (document.hidden) return;
  ticks++;
  for (const f of breathing) {
    if (f.canvas.isConnected) {
      f.seen = true;
      paint(f, ticks);
    } else if (f.seen || ticks - f.born > 8) breathing.delete(f); // taken off the page, or never put on it
  }
  if (!breathing.size) {
    clearInterval(timer);
    timer = 0;
  }
}

/** A few ticks of offset per cat, so a list of them does not breathe in step. */
function phaseOf(key: string) {
  let n = 0;
  for (let i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0;
  return n % 4;
}

/** A cat as it fights, full body and breathing: a 40×40 canvas, `scale` CSS pixels per art pixel. */
export function fighter(cat: CatLook | undefined, scale = 1, label?: string): HTMLCanvasElement {
  const canvas = h('canvas', 'fighter');
  canvas.width = CROP.w;
  canvas.height = CROP.h;
  canvas.style.width = `${CROP.w * scale}px`;
  canvas.style.height = `${CROP.h * scale}px`;
  if (label) {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', label);
  } else canvas.setAttribute('aria-hidden', 'true');
  const look = lookOf(cat);
  const f: Breathing = { canvas, look, offset: phaseOf(lookKey(look)), born: ticks, seen: false };
  paint(f, 0);
  if (!REDUCED_MOTION) {
    breathing.add(f);
    timer ||= window.setInterval(step, 250);
  }
  return canvas;
}

// ---------------------------------------------------------------------------
// Watching a duel: the mint site's fight scene, as a spectator sees it
// ---------------------------------------------------------------------------

type Phase = 'intro' | 'vs' | 'lock' | 'clash' | 'result';

function phaseAt(s: Script, t: number): Phase {
  if (s.marks.result !== undefined && t >= s.marks.result) return 'result';
  if (t >= s.marks.clash) return 'clash';
  if (t >= s.marks.lock) return 'lock';
  if (t >= s.marks.vs[0]) return 'vs';
  return 'intro';
}

/** Plays a settled duel in a dialog over the page; Escape, Close or a click outside ends it. */
export function watch(bout: Bout) {
  unlockArenaSound(); // still inside the click on Watch
  const plan = { winner: bout.winner, tactics: null };
  const script = buildScript(plan);
  const looks: [FighterLook, FighterLook] = [lookOf(bout.cats[0]), lookOf(bout.cats[1])];
  const [a, b] = bout.ids;
  const loser: Side = bout.winner === 0 ? 1 : 0;

  const dialog = h('dialog', 'fight');
  dialog.setAttribute('aria-labelledby', 'fight-title');
  const box = h('div', 'box fight-box');
  dialog.append(box);

  const top = h('div', 'fight-top');
  const title = h('h2', 'fight-title', `Blind Arena · Duel #${bout.id}`);
  title.id = 'fight-title';
  const close = h('button', 'btn btn-sm btn-ghost fight-close', 'Close');
  close.type = 'button';
  const soundBtn = h('button', 'btn btn-sm btn-ghost fight-sound');
  soundBtn.type = 'button';
  soundBtn.setAttribute('aria-label', 'Sound');
  const paintSound = () => {
    const off = sound.muted();
    soundBtn.setAttribute('aria-pressed', String(!off));
    soundBtn.title = off ? 'Sound off' : 'Sound on';
    soundBtn.replaceChildren(icon(off ? SOUND_OFF_ICON : SOUND_ICON));
  };
  paintSound();
  soundBtn.addEventListener('click', () => {
    sound.setMuted(!sound.muted());
    paintSound();
  });
  const tools = h('div', 'fight-tools');
  tools.append(soundBtn, close);
  top.append(title, tools);

  const cards = h('div', 'fight-cards');
  const slots: HTMLElement[] = [];
  const cardEls: HTMLElement[] = [];
  bout.ids.forEach((id, s) => {
    const card = h('div', `fight-card ${s === 0 ? 'is-left' : 'is-right'}`);
    const name = h('p', 'fight-name');
    name.append(h('b', undefined, `#${id}`));
    const state = Math.min(Math.max(bout.cats[s]?.state ?? 0, 0), 3);
    const slot = h('span', 'fight-tactic is-ready', 'Ready');
    card.append(name, h('span', `fight-chip is-${state}`, BOX[state]), slot);
    slots.push(slot);
    cardEls.push(card);
    cards.append(card);
  });
  const vs = h('span', 'fight-vs', 'VS');
  vs.setAttribute('aria-hidden', 'true');
  cards.append(vs);

  const stage = h('div', 'fight-stage');
  const screen = h('div', 'fight-screen');
  const canvas = h('canvas');
  canvas.width = STAGE_W;
  canvas.height = 90;
  canvas.setAttribute('aria-hidden', 'true');
  screen.append(canvas);
  stage.append(screen);

  const caption = h('p', 'fight-caption');
  const said = h('p', 'sr-only');
  said.setAttribute('aria-live', 'polite');
  const actions = h('div', 'fight-actions');
  const skip = h('button', 'btn btn-sm btn-ghost', 'Skip');
  const replay = h('button', 'btn btn-sm btn-ghost', REDUCED_MOTION ? 'Play' : 'Replay');
  skip.type = replay.type = 'button';
  actions.append(skip, replay);
  box.append(top, cards, stage, caption, said, actions);

  // The result: who won, the points over each fighter.
  const banner = h('p', 'fight-banner', `#${bout.ids[bout.winner]} wins`);
  if (bout.sealed) banner.append(h('span', 'fight-sealed', 'sealed'));
  const pts = ([0, 1] as const).map((s) => {
    const p = h('span', `fight-pts${s === bout.winner ? ' is-win' : ''}`, `+${s === bout.winner ? (bout.sealed ? POINTS.sealedWin : POINTS.win) : POINTS.loss}`);
    p.setAttribute('aria-hidden', 'true');
    p.style.left = `${(script.rest[s] / STAGE_W) * 100}%`;
    return p;
  });

  let clock = 0;
  let moving = !REDUCED_MOTION;
  let raf = 0;
  let last = 0;
  let phase: Phase | null = null;
  const ctx = canvas.getContext('2d')!;

  function show(p: Phase) {
    if (p === phase) return;
    phase = p;
    box.dataset.phase = p;
    vs.classList.toggle('on', p !== 'intro');
    slots.forEach((slot) => {
      slot.textContent = '';
      const ready = p === 'intro' || p === 'vs';
      slot.className = `fight-tactic ${ready ? 'is-ready' : 'is-locked'}`;
      if (!ready) slot.append(icon(LOCK_ICON));
      slot.append(ready ? 'Ready' : p === 'lock' ? 'Locked' : 'Secret');
    });
    const done = p === 'result';
    cardEls[bout.winner].classList.toggle('is-winner', done);
    if (done) screen.append(banner, ...pts);
    else [banner, ...pts].forEach((n) => n.remove());
    caption.textContent =
      p === 'result'
        ? captionOf(plan)
        : p === 'clash'
          ? 'Nobody sees the tactics, only the fight.'
          : p === 'lock'
            ? 'Both tactics are locked and sealed.'
            : `#${a} challenges #${b}.`;
    said.textContent = done ? `#${bout.ids[bout.winner]} beat #${bout.ids[loser]}. ${captionOf(plan)}` : '';
    skip.hidden = done || !moving;
    replay.hidden = !done && moving;
  }

  function frame(now: number) {
    if (moving) clock += Math.min(0.1, (now - last) / 1000);
    last = now;
    const t = moving ? clock : script.marks.end;
    render(ctx, script, { looks }, t);
    if (moving) sound.tick(t);
    show(phaseAt(script, t));
    if (moving) raf = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // The stage at a whole-number scale that fits; under 2× it fills the width instead.
  const fit = () => {
    const scale = Math.min(6, Math.floor(stage.clientWidth / STAGE_W));
    screen.style.width = scale >= 2 ? `${scale * STAGE_W}px` : '';
  };
  const ro = new ResizeObserver(fit);

  function end() {
    cancelAnimationFrame(raf);
    sound.pause();
    ro.disconnect();
    document.documentElement.classList.remove('fight-open');
    if (dialog.open) dialog.close(); // hands focus back to the Watch button
    dialog.remove();
  }

  skip.addEventListener('click', () => {
    clock = Math.max(clock, script.marks.end);
  });
  replay.addEventListener('click', () => {
    clock = 0;
    moving = true;
    phase = null;
    replay.textContent = 'Replay';
    start();
  });
  close.addEventListener('click', end);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    end();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) end();
  });
  dialog.addEventListener('pointerdown', unlockArenaSound);

  sound.scene(script, { winner: bout.winner, sealed: bout.sealed, mine: null });
  document.body.append(dialog);
  dialog.showModal();
  document.documentElement.classList.add('fight-open');
  ro.observe(stage);
  fit();
  start();
}

const api = { fighter, watch };
const root = window as unknown as { FheCat?: Record<string, unknown> };
(root.FheCat ??= {}).arenaGame = api;
