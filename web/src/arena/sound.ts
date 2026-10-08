import type { Script, Side } from './stage';

/**
 * The arena's sound: an announcer, chiptune music and effects, all following a fight's Script.
 *
 * The music and the effects are synthesized here with WebAudio, so there is nothing to download;
 * the announcer is nine short clips in public/arena/voice (made with scripts/arena-voice.py). The
 * scene calls tick(t) every frame with its own clock, so the sound follows the picture through
 * Skip, Replay and a result that comes in mid-fight. One AudioContext per page, started on a
 * click; whether it is muted is remembered.
 */

export interface SoundInfo {
  /** 0 when the challenger won, 1 when the opponent did, null while the arena decides. */
  winner: Side | null;
  /** The winner was a sealed box. */
  sealed?: boolean;
  /** The viewer's side, when they hold one of the two cats. */
  mine?: Side | null;
}

export interface ArenaSound {
  muted(): boolean;
  setMuted(muted: boolean): void;
  /** A new fight, or the same one with a new script (a result, or the tactics, came in). */
  scene(script: Script, info: SoundInfo): void;
  /** Every frame while the fight plays, with the scene's clock in seconds. */
  tick(t: number): void;
  /** The fight stopped playing: closed, or held on a still frame. */
  pause(): void;
  /** Starts downloading the announcer's clips (no sound, no AudioContext yet). */
  preload(): void;
}

type Line = 'arena' | 'locked' | 'fight' | 'ko' | 'challenger' | 'defender' | 'sealed' | 'youwin' | 'youlose';
const LINES: Line[] = ['arena', 'locked', 'fight', 'ko', 'challenger', 'defender', 'sealed', 'youwin', 'youlose'];

const STORE = 'fhecat.arena.sound';

/** A speaker, for the sound button; with a cross when it is off. */
export const SOUND_ICON = ['...X..X.', '..XX...X', 'XXXX.X.X', 'XXXX.X.X', 'XXXX.X.X', '..XX...X', '...X..X.'];
export const SOUND_OFF_ICON = ['...X....', '..XX....', 'XXXX.X.X', 'XXXX..X.', 'XXXX.X.X', '..XX....', '...X....'];
const LEVEL = { master: 0.7, music: 0.3, sfx: 0.5, voice: 0.9 };

// ---------------------------------------------------------------------------
// The audio graph, made once
// ---------------------------------------------------------------------------

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
  voice: GainNode;
  noise: AudioBuffer;
  pulse: Record<'p12' | 'p25', PeriodicWave>;
}

let graph: Graph | null = null;
let mutedNow = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORE) === 'off';
  } catch {
    return false;
  }
}

/** A pulse wave of the given duty cycle, the NES way. */
function pulseWave(ctx: AudioContext, duty: number): PeriodicWave {
  const n = 40;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

function audio(): Graph | null {
  if (graph) return graph;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  let ctx: AudioContext;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  const gain = (value: number, to: AudioNode) => {
    const g = ctx.createGain();
    g.gain.value = value;
    g.connect(to);
    return g;
  };
  // Keeps the loudest moments (a line over the fanfare) from clipping.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 6;
  comp.ratio.value = 12;
  comp.attack.value = 0.002;
  comp.release.value = 0.15;
  comp.connect(ctx.destination);
  const master = gain(mutedNow ? 0 : LEVEL.master, comp);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  let seed = 0x5eed;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 4294967296) * 2 - 1;
  }
  graph = {
    ctx,
    master,
    music: gain(LEVEL.music, master),
    sfx: gain(LEVEL.sfx, master),
    voice: gain(LEVEL.voice, master),
    noise,
    pulse: { p12: pulseWave(ctx, 0.125), p25: pulseWave(ctx, 0.25) },
  };
  // Hidden tab, no sound: the picture stops too.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void ctx.suspend().catch(() => {});
    else if (!mutedNow) void ctx.resume().catch(() => {});
  });
  return graph;
}

/** Makes (or wakes) the page's AudioContext. Call it from a click: browsers only allow sound after one. */
export function unlockArenaSound() {
  if (mutedNow) return;
  const g = audio();
  if (!g) return;
  if (g.ctx.state !== 'running') void g.ctx.resume().catch(() => {});
  // Decode the announcer now, so the first line is ready when the fight opens.
  for (const s of sounds.values()) s.decodeAll(g);
}

// ---------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

interface ToneOpts {
  /** Slide to this frequency by the end. */
  to?: number;
  attack?: number;
  /** Hold at full level for this long before the decay. */
  hold?: number;
  detune?: number;
}

function tone(g: Graph, out: AudioNode, wave: OscillatorType | PeriodicWave, freq: number, at: number, dur: number, vol: number, o: ToneOpts = {}) {
  const osc = g.ctx.createOscillator();
  if (typeof wave === 'object') osc.setPeriodicWave(wave);
  else osc.type = wave;
  osc.frequency.setValueAtTime(freq, at);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + dur);
  if (o.detune) osc.detune.value = o.detune;
  const env = g.ctx.createGain();
  const attack = o.attack ?? 0.004;
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(vol, at + attack);
  env.gain.setValueAtTime(vol, at + attack + (o.hold ?? 0));
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(env).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

interface NoiseOpts {
  type?: BiquadFilterType;
  freq?: number;
  /** Sweep the filter to this frequency by the end. */
  to?: number;
  q?: number;
  attack?: number;
}

function hiss(g: Graph, out: AudioNode, at: number, dur: number, vol: number, o: NoiseOpts = {}) {
  const src = g.ctx.createBufferSource();
  src.buffer = g.noise;
  src.loop = true;
  const filter = g.ctx.createBiquadFilter();
  filter.type = o.type ?? 'lowpass';
  filter.frequency.setValueAtTime(o.freq ?? 2000, at);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, at + dur);
  filter.Q.value = o.q ?? 0.7;
  const env = g.ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(vol, at + (o.attack ?? 0.003));
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filter).connect(env).connect(out);
  // Start somewhere in the buffer, so no two bursts sound the same.
  src.start(at, (at * 7.31) % 0.9);
  src.stop(at + dur + 0.02);
}

const kick = (g: Graph, o: AudioNode, at: number, v = 0.9) => tone(g, o, 'sine', 150, at, 0.16, v, { to: 42 });
const snare = (g: Graph, o: AudioNode, at: number, v = 0.5) => {
  hiss(g, o, at, 0.13, v, { type: 'bandpass', freq: 1900, q: 0.7 });
  tone(g, o, 'triangle', 190, at, 0.07, v * 0.6, { to: 150 });
};
const hat = (g: Graph, o: AudioNode, at: number, v = 0.16, open = false) => hiss(g, o, at, open ? 0.14 : 0.035, v, { type: 'highpass', freq: 7000 });
const crash = (g: Graph, o: AudioNode, at: number, v = 0.22) => hiss(g, o, at, 1.3, v, { type: 'highpass', freq: 4200 });

// ---------------------------------------------------------------------------
// Music: a jingle in, a pulse while the arena computes, a battle loop, a fanfare out
// ---------------------------------------------------------------------------

/** MIDI notes, one per 16th: 0 rests, -1 holds the note before. */
type Notes = number[];
interface Part {
  inst: 'lead' | 'harm' | 'bass' | 'blip';
  notes: Notes;
  vol?: number;
}
interface Song {
  bpm: number;
  steps: number;
  loop: boolean;
  parts: Part[];
  /** Drum lanes, one character per 16th: x hits, . rests (o is an open hat). */
  drums?: { k?: string; s?: string; h?: string; c?: string };
}

const _ = 0;
const H = -1;
const bar = (...halves: Notes[]) => halves.flat();

const SONGS: Record<'intro' | 'tension' | 'battle' | 'victory' | 'defeat', Song> = {
  // Both cats run in and face off: a rising call to arms, 2.4 s, the crash on VS.
  intro: {
    bpm: 150,
    steps: 24,
    loop: false,
    parts: [
      { inst: 'lead', notes: bar([69, _, 69, 72, _, 76, _, 81], [H, H, 79, H, 76, H, H, _], [74, _, 76, _, 77, _, 79, _]) },
      { inst: 'harm', notes: bar([64, _, 64, 69, _, 72, _, 76], [H, H, 76, H, 72, H, H, _], [71, _, 72, _, 74, _, 76, _]), vol: 0.5 },
      { inst: 'bass', notes: bar([45, _, 45, _, 57, _, 45, _], [43, _, 43, _, 55, _, 43, _], [41, _, 41, _, 40, _, 40, _]) },
    ],
    drums: { k: 'x.....x...x.....x...x...', s: '..........x.....xxxxxxxx', h: 'x.x.x.x.x...x.x.........', c: '..........x.............' },
  },
  // Tactics locked, the arena computes under FHE: a heartbeat and bits, for as long as it takes.
  tension: {
    bpm: 120,
    steps: 32,
    loop: true,
    parts: [
      { inst: 'bass', notes: bar([33, _, _, 33, _, _, _, _], [33, _, _, 33, _, _, _, _], [33, _, _, 33, _, _, _, _], [31, _, _, 31, _, _, 32, _]) },
      {
        inst: 'blip',
        notes: bar([81, _, 88, 84, _, 93, _, 86], [81, _, 91, _, 84, 88, _, _], [81, _, 88, 84, _, 93, _, 86], [79, _, 86, _, 83, 88, _, _]),
      },
    ],
    drums: { h: 'x...x...x...x...x...x...x...x...', k: 'x..x....x..x....x..x....x..x....' },
  },
  // The clash: Am, F, G, E at 150, two bars round and round.
  battle: {
    bpm: 150,
    steps: 32,
    loop: true,
    parts: [
      { inst: 'lead', notes: bar([69, _, 72, _, 76, _, 74, 72], [69, _, 72, _, 77, _, 76, 74], [71, _, 74, _, 79, _, 77, 74], [76, _, 80, _, 83, H, H, _]) },
      { inst: 'harm', notes: bar([64, _, 69, _, 72, _, 71, 69], [65, _, 69, _, 72, _, 72, 69], [67, _, 71, _, 74, _, 74, 71], [68, _, 71, _, 76, H, H, _]), vol: 0.45 },
      { inst: 'bass', notes: bar([45, _, 57, _, 45, _, 57, _], [41, _, 53, _, 41, _, 53, _], [43, _, 55, _, 43, _, 55, _], [40, _, 52, _, 40, _, 52, 40]) },
    ],
    drums: { k: 'x.....x.x.......x.....x.x.....x.', s: '....x.......x.......x.......x.xx', h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.' },
  },
  // The winner stands: a fanfare in A major.
  victory: {
    bpm: 150,
    steps: 32,
    loop: false,
    parts: [
      { inst: 'lead', notes: [76, _, 76, _, 76, _, 81, H, H, H, H, _, 78, _, 80, _, 81, H, H, H, H, H, H, H, H, H, H, H, _, _, _, _] },
      { inst: 'harm', notes: [73, _, 73, _, 73, _, 76, H, H, H, H, _, 74, _, 76, _, 73, H, H, H, H, H, H, H, H, H, H, H, _, _, _, _], vol: 0.5 },
      { inst: 'bass', notes: [45, _, _, _, _, _, 45, _, _, _, _, _, 50, _, 52, _, 45, H, H, H, H, H, H, H, H, H, H, H, _, _, _, _] },
    ],
    drums: { c: 'x...............x...............', s: '............xxxx................', k: 'x.....x.........x...............' },
  },
  // For the holder who lost: wah, wah, wah, waaah.
  defeat: {
    bpm: 120,
    steps: 24,
    loop: false,
    parts: [{ inst: 'lead', notes: [64, H, H, _, 63, H, H, _, 62, H, H, _, 61, H, H, H, H, H, H, H, _, _, _, _], vol: 0.8 }],
  },
};

class Player {
  private song: Song | null = null;
  private out: GainNode | null = null;
  private timer = 0;
  private step = 0;
  private next = 0;

  constructor(private readonly g: Graph) {}

  play(song: Song, at: number) {
    this.stop(at);
    this.song = song;
    this.out = this.g.ctx.createGain();
    this.out.connect(this.g.music);
    this.step = 0;
    this.next = at;
    this.pump();
    this.timer = window.setInterval(() => this.pump(), 25);
  }

  stop(at = this.g.ctx.currentTime) {
    clearInterval(this.timer);
    this.timer = 0;
    this.song = null;
    const out = this.out;
    this.out = null;
    if (!out) return;
    out.gain.setTargetAtTime(0, at, 0.04);
    setTimeout(() => out.disconnect(), Math.max(0, at - this.g.ctx.currentTime) * 1000 + 600);
  }

  /** Schedules the 16ths that start in the next 150 ms. */
  private pump() {
    const s = this.song;
    const out = this.out;
    if (!s || !out) return;
    const sixteenth = 60 / s.bpm / 4;
    // Fell behind (a busy page): skip what was missed rather than play it all at once.
    if (this.next < this.g.ctx.currentTime - 0.05) this.next = this.g.ctx.currentTime + 0.01;
    while (this.next < this.g.ctx.currentTime + 0.15) {
      this.playStep(s, out, this.step, this.next, sixteenth);
      this.next += sixteenth;
      if (++this.step >= s.steps) {
        if (s.loop) this.step = 0;
        else {
          // A jingle ends: let its last notes ring, then let go.
          clearInterval(this.timer);
          this.timer = 0;
          this.song = null;
          setTimeout(() => out.disconnect(), (this.next - this.g.ctx.currentTime) * 1000 + 2500);
          return;
        }
      }
    }
  }

  private playStep(s: Song, out: GainNode, i: number, at: number, sixteenth: number) {
    const g = this.g;
    for (const p of s.parts) {
      const n = p.notes[i];
      if (!n || n < 0) continue;
      let len = 1;
      while (p.notes[i + len] === H) len++;
      const dur = len * sixteenth;
      const v = p.vol ?? 1;
      if (p.inst === 'lead') tone(g, out, g.pulse.p25, hz(n), at, dur * 0.95, 0.16 * v, { hold: dur * 0.5 });
      else if (p.inst === 'harm') tone(g, out, g.pulse.p12, hz(n), at, dur * 0.9, 0.16 * v, { hold: dur * 0.4 });
      else if (p.inst === 'bass') tone(g, out, 'triangle', hz(n), at, dur * 0.95, 0.42 * v, { hold: dur * 0.6 });
      else tone(g, out, g.pulse.p12, hz(n), at, 0.06, 0.07 * v);
    }
    const d = s.drums;
    if (!d) return;
    if (d.k?.[i] === 'x') kick(g, out, at);
    if (d.s?.[i] === 'x') snare(g, out, at);
    if (d.h?.[i] === 'x' || d.h?.[i] === 'o') hat(g, out, at, 0.14, d.h[i] === 'o');
    if (d.c?.[i] === 'x') crash(g, out, at);
  }
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

type Sfx = (g: Graph, at: number) => void;

const SFX = {
  step: ((g, at) => hiss(g, g.sfx, at, 0.05, 0.12, { freq: 900 })) as Sfx,
  jump: ((g, at) => tone(g, g.sfx, g.pulse.p25, 260, at, 0.2, 0.18, { to: 820 })) as Sfx,
  swish: ((g, at) => hiss(g, g.sfx, at, 0.14, 0.35, { type: 'bandpass', freq: 900, to: 4500, q: 1.4, attack: 0.03 })) as Sfx,
  hop: ((g, at) => tone(g, g.sfx, g.pulse.p25, 520, at, 0.12, 0.1, { to: 900 })) as Sfx,
  hit: ((g, at) => {
    hiss(g, g.sfx, at, 0.16, 0.7, { freq: 3200, to: 500 });
    tone(g, g.sfx, 'sine', 140, at, 0.18, 0.8, { to: 50 });
  }) as Sfx,
  bigHit: ((g, at) => {
    hiss(g, g.sfx, at, 0.4, 0.9, { freq: 4000, to: 300 });
    tone(g, g.sfx, 'sine', 120, at, 0.4, 1, { to: 38 });
    tone(g, g.sfx, 'square', 90, at, 0.12, 0.25, { to: 40 });
  }) as Sfx,
  poof: ((g, at) => hiss(g, g.sfx, at, 0.3, 0.4, { freq: 2600, to: 300, attack: 0.02 })) as Sfx,
  bigPoof: ((g, at) => hiss(g, g.sfx, at, 0.55, 0.6, { freq: 3000, to: 200, attack: 0.02 })) as Sfx,
  shield: ((g, at) => {
    tone(g, g.sfx, 'triangle', 1180, at, 0.35, 0.22, { detune: 8 });
    tone(g, g.sfx, 'triangle', 1770, at, 0.3, 0.12);
  }) as Sfx,
  shatter: ((g, at) => {
    hiss(g, g.sfx, at, 0.5, 0.6, { type: 'highpass', freq: 2500 });
    [1568, 1319, 1047, 880].forEach((f, i) => tone(g, g.sfx, 'square', f, at + i * 0.04, 0.12, 0.08));
  }) as Sfx,
  lock: ((g, at) => {
    tone(g, g.sfx, 'square', 1800, at, 0.03, 0.12);
    tone(g, g.sfx, 'square', 900, at + 0.07, 0.05, 0.16);
    hiss(g, g.sfx, at + 0.07, 0.05, 0.3, { type: 'bandpass', freq: 2500, q: 2 });
  }) as Sfx,
  sparkle: ((g, at) => tone(g, g.sfx, 'sine', 2400, at, 0.14, 0.06, { to: 3200 })) as Sfx,
  tweet: ((g, at) => {
    for (let i = 0; i < 4; i++) tone(g, g.sfx, 'sine', i % 2 ? 2200 : 2700, at + 0.3 + i * 0.13, 0.08, 0.05, { to: i % 2 ? 2700 : 3300 });
  }) as Sfx,
  scuffle: ((g, at) => hiss(g, g.sfx, at, 0.08, 0.35, { type: 'bandpass', freq: 600 + ((at * 997) % 1) * 1800, q: 1.2 })) as Sfx,
};

// ---------------------------------------------------------------------------
// Cues: what to play when, read off the Script
// ---------------------------------------------------------------------------

/**
 * sfx and line cues are dropped when the clock jumps past them (Skip); final cues (who won) still
 * play, one after the other; of the music cues jumped past, only the last one counts.
 */
type CueKind = 'sfx' | 'line' | 'final' | 'music';
interface Cue {
  t: number;
  kind: CueKind;
  sfx?: Sfx;
  line?: Line;
  song?: keyof typeof SONGS;
}

function cuesOf(s: Script, info: SoundInfo): Cue[] {
  const cues: Cue[] = [];
  const sfx = (t: number, f: Sfx) => Number.isFinite(t) && cues.push({ t, kind: 'sfx', sfx: f });
  for (const f of s.fx) {
    if (f.kind === 'dust') sfx(f.t0, SFX.step);
    else if (f.kind === 'impact') sfx(f.t0, f.big ? SFX.bigHit : SFX.hit);
    else if (f.kind === 'poof') sfx(f.t0, (f.size ?? 1) > 2 ? SFX.bigPoof : SFX.poof);
    else if (f.kind === 'shield') sfx(f.t0, SFX.shield);
    else if (f.kind === 'shieldBroken') sfx(f.t0, SFX.shatter);
    else if (f.kind === 'glint') sfx(f.t0, SFX.sparkle);
    else if (f.kind === 'dizzy') sfx(f.t0, SFX.tweet);
    else if (f.kind === 'cloud') for (let t = f.t0 + 0.05; t < f.t1; t += 0.11) sfx(t, SFX.scuffle);
  }
  sfx(s.marks.lock, SFX.lock);
  for (const track of s.tracks)
    for (const g of track) {
      if (g.trail && g.poses[0] === 'pounce') sfx(g.t0, (g.arc ?? 0) >= 6 ? SFX.jump : SFX.swish);
      else if (g.poses[0] === 'win' && g.arc) sfx(g.t0, SFX.hop);
    }

  const line = (t: number, l: Line, kind: CueKind = 'line') => Number.isFinite(t) && cues.push({ t, kind, line: l });
  const song = (t: number, name: keyof typeof SONGS) => Number.isFinite(t) && cues.push({ t, kind: 'music', song: name });
  song(0, 'intro');
  line(0.12, 'arena');
  song(s.marks.lock, 'tension');
  line(s.marks.lock + 0.22, 'locked'); // after the padlock's click
  song(s.marks.clash, 'battle');
  line(s.marks.clash, 'fight');
  if (info.winner !== null && s.marks.result !== undefined) {
    // The knockout: the blow that leaves the loser seeing birds.
    const dizzy = s.fx.find((f) => f.kind === 'dizzy');
    const ko = dizzy ? dizzy.t0 - 0.56 : (s.marks.impact ?? s.marks.result);
    line(ko, 'ko');
    const holder = info.mine === 0 || info.mine === 1;
    song(s.marks.result, holder && info.mine !== info.winner ? 'defeat' : 'victory');
    const says = Math.max(ko + 1.05, s.marks.result);
    line(says, holder ? (info.mine === info.winner ? 'youwin' : 'youlose') : info.winner === 0 ? 'challenger' : 'defender', 'final');
    if (info.sealed) line(says + 1.45, 'sealed', 'final');
  }
  return cues.sort((a, b) => a.t - b.t);
}

/** The music a moment of the fight belongs to (null before the first cue). */
function songAt(cues: Cue[], t: number) {
  let name: Cue['song'] = undefined;
  for (const c of cues) if (c.kind === 'music' && c.t <= t) name = c.song;
  return name;
}

// ---------------------------------------------------------------------------
// The sound of one page's fights
// ---------------------------------------------------------------------------

// The clips download as soon as a fight is near (preload) and decode once there is an
// AudioContext. A clip that cannot load just leaves its line out: the fight goes on.
const files = new Map<string, Promise<ArrayBuffer | null>>();
const clips = new Map<string, Promise<AudioBuffer | null>>();

function download(url: string) {
  let f = files.get(url);
  if (!f) {
    f = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
    files.set(url, f);
  }
  return f;
}

function clipAt(g: Graph, url: string) {
  let c = clips.get(url);
  if (!c) {
    c = download(url)
      .then((buf) => (buf ? g.ctx.decodeAudioData(buf.slice(0)) : null))
      .catch(() => null);
    clips.set(url, c);
  }
  return c;
}

class Sound implements ArenaSound {
  private script: Script | null = null;
  private cues: Cue[] = [];
  private cursor = 0;
  private last: number | null = null;
  private player: Player | null = null;
  private current: Cue['song'];
  /** When the announcer is free again (AudioContext time). */
  private voiceFree = 0;
  /** Bumped when the fight stops or starts over, so a line still loading for the old one stays quiet. */
  private generation = 0;

  constructor(private readonly voiceBase: string) {}

  preload() {
    for (const l of LINES) void download(this.url(l));
  }

  decodeAll(g: Graph) {
    for (const l of LINES) void clipAt(g, this.url(l));
  }

  private url(line: Line) {
    return `${this.voiceBase}${line}.mp3`;
  }

  muted() {
    return mutedNow;
  }

  setMuted(muted: boolean) {
    mutedNow = muted;
    try {
      localStorage.setItem(STORE, muted ? 'off' : 'on');
    } catch {
      // private mode: remembered for this page only
    }
    if (muted) {
      this.stopMusic();
      if (graph) graph.master.gain.setTargetAtTime(0, graph.ctx.currentTime, 0.03);
      return;
    }
    const g = audio();
    if (!g) return;
    void g.ctx.resume().catch(() => {});
    g.master.gain.setTargetAtTime(LEVEL.master, g.ctx.currentTime, 0.03);
    this.preload();
    // Back mid-fight: pick the music up where the fight is.
    if (this.last !== null) this.startSong(songAt(this.cues, this.last), true);
  }

  scene(script: Script, info: SoundInfo) {
    if (script === this.script) return;
    this.script = script;
    this.cues = cuesOf(script, info);
    // Whatever is already behind the clock has had its turn.
    if (this.last !== null) this.cursor = this.indexAt(this.last + 1e-6);
    if (!mutedNow) this.preload();
  }

  tick(t: number) {
    if (!this.script) return;
    if (this.last === null || t < this.last - 0.05) {
      // The first frame, a Replay, or back to the lock for the tactics: go on from here.
      this.generation++;
      this.stopMusic();
      this.cursor = this.indexAt(t);
      this.last = t - 0.001;
    }
    const jumped = t - this.last > 0.5;
    const passed: Cue[] = [];
    while (this.cursor < this.cues.length && this.cues[this.cursor].t <= t) passed.push(this.cues[this.cursor++]);
    this.last = t;
    if (mutedNow) return;
    const g = audio();
    if (!g) return;
    if (g.ctx.state !== 'running') {
      // Not allowed to play yet (no click so far): what happens meanwhile goes unheard.
      if (g.ctx.state === 'suspended') void g.ctx.resume().catch(() => {});
      return;
    }
    // A loop that should be playing and isn't (sound just allowed, or unmuted): pick it up.
    if (this.current === undefined) this.startSong(songAt(this.cues, t), true);
    if (!passed.length) return;
    const at = g.ctx.currentTime + 0.01;
    if (!jumped) {
      for (const c of passed) this.run(g, c, at);
      return;
    }
    // Skipped ahead: the music where the fight is now, then who won.
    const music = passed.filter((c) => c.kind === 'music').pop();
    if (music) this.startSong(music.song, false);
    for (const c of passed) if (c.kind === 'final') this.say(g, c.line!, at, true);
  }

  pause() {
    this.generation++;
    this.stopMusic();
    this.last = null;
  }

  /** The first cue at or after t. */
  private indexAt(t: number) {
    const i = this.cues.findIndex((c) => c.t >= t);
    return i < 0 ? this.cues.length : i;
  }

  private run(g: Graph, c: Cue, at: number) {
    if (c.kind === 'sfx') c.sfx!(g, at);
    else if (c.kind === 'music') this.startSong(c.song, false);
    else this.say(g, c.line!, at, c.kind === 'final');
  }

  private startSong(name: Cue['song'], midway: boolean) {
    if (mutedNow || !name || name === this.current) return;
    // Coming back in the middle of a jingle: it has had its moment.
    if (midway && !SONGS[name].loop) return;
    const g = audio();
    if (!g) return;
    this.player ??= new Player(g);
    this.player.play(SONGS[name], g.ctx.currentTime + 0.02);
    this.current = name;
  }

  private stopMusic() {
    this.player?.stop();
    this.current = undefined;
  }

  /**
   * The announcer: one line at a time. A line whose clip is still loading waits for it; a line that
   * would come too late is dropped, unless it says who won.
   */
  private say(g: Graph, line: Line, at: number, mustSay: boolean) {
    const generation = this.generation;
    void clipAt(g, this.url(line)).then((clip) => {
      if (!clip || generation !== this.generation || mutedNow) return;
      const start = Math.max(at, g.ctx.currentTime + 0.005, this.voiceFree);
      if (start - at > (mustSay ? 4 : 0.6)) return;
      this.speak(g, clip, start);
    });
  }

  private speak(g: Graph, clip: AudioBuffer, start: number) {
    const src = g.ctx.createBufferSource();
    src.buffer = clip;
    src.connect(g.voice);
    src.start(start);
    // The hall tail may overlap the next line; the words may not.
    this.voiceFree = start + Math.max(0.3, clip.duration - 0.3);
    // The music steps back while the announcer speaks.
    const m = g.music.gain;
    m.cancelScheduledValues(start);
    m.setTargetAtTime(LEVEL.music * 0.25, start - 0.02, 0.015);
    m.setTargetAtTime(LEVEL.music, start + clip.duration - 0.2, 0.15);
  }
}

const sounds = new Map<string, Sound>();

/** The arena's sound for this page; voice clips load from `voiceBase` (…/arena/voice/). */
export function arenaSound(voiceBase: string): ArenaSound {
  let s = sounds.get(voiceBase);
  if (!s) sounds.set(voiceBase, (s = new Sound(voiceBase)));
  return s;
}
