import { useEffect, useRef, useState, type RefObject } from 'react';
import { FC, REDUCED_MOTION, type SceneOptions, type SceneState } from './fc';
import { Decrypt } from './Decrypt';

/**
 * Repaints `paint` whenever the element's size changes by a few pixels (the
 * sky is drawn for its exact size, and this page grows as cats load).
 */
function useRepaint(ref: RefObject<HTMLElement | null>, paint: (el: HTMLElement) => void, deps: unknown[]) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = '';
    let timer = 0;
    const run = () => {
      const r = el.getBoundingClientRect();
      const size = `${Math.round(r.width / 16)}x${Math.round(r.height / 16)}`;
      if (size === last || !r.width || !r.height) return;
      last = size;
      paint(el);
    };
    run();
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(run, 150);
    });
    ro.observe(el);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, deps);
}

/** Scattered stars and sparkles behind a chapter (fills its positioned parent). */
export function Stars({ density = 0.6, seed = 7 }: { density?: number; seed?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useRepaint(ref, (el) => FC.scene.starfield(el, density, seed), [density, seed]);
  return <div className="stars" ref={ref} aria-hidden="true" />;
}

/** A ribbon of puffy pixel clouds between two chapters. */
export function Clouds({ seed }: { seed: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useRepaint(ref, (el) => FC.scene.ribbon(el, seed), [seed]);
  return <div className="clouds" ref={ref} aria-hidden="true" />;
}

// scene.init() has no teardown: a scene lives as long as the page. React's
// development double-mount must not start a second one on the same element.
const scenes = new WeakMap<HTMLElement, SceneState>();

/**
 * The banner's night sky, alive: stars, moon, drifting clouds, the antenna and
 * the sitting cat. `ref` is the section that holds a `.scene` layer.
 */
export function useNightScene(ref: RefObject<HTMLElement | null>, opts: SceneOptions) {
  const [scene, setScene] = useState<SceneState | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let s = scenes.get(el);
    if (!s) {
      s = FC.scene.init(el, opts);
      scenes.set(el, s);
    }
    setScene(s);
    // The options are fixed for the life of the scene.
  }, []);
  return scene;
}

const LINES = ['Meow', 'Mrrp?', 'Still encrypted', 'Mint one?', 'Prrr'];

/** The hero cat: say hi and it answers, in cipher first. */
export function SceneCat({ scene }: { scene: SceneState | null }) {
  const hit = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLParagraphElement>(null);
  const [said, setSaid] = useState<{ n: number; on: boolean }>({ n: -1, on: false });

  useEffect(() => {
    if (!scene) return;
    const place = (s: SceneState) => {
      const b = hit.current;
      const p = bubble.current;
      if (!b || !p) return;
      Object.assign(b.style, { left: `${s.cat.x}px`, top: `${s.cat.y}px`, width: `${s.cat.w}px`, height: `${s.cat.h}px` });
      p.style.right = `${Math.max(8, s.width - s.cat.x - s.cat.w + 8)}px`;
      p.style.bottom = `${s.H * s.px - s.cat.y + 24}px`;
    };
    place(scene);
    scene.opts.onBuild = place;
  }, [scene]);

  useEffect(() => {
    if (!said.on) return;
    const t = setTimeout(() => setSaid((s) => ({ ...s, on: false })), 2600);
    return () => clearTimeout(t);
  }, [said]);

  return (
    <>
      <button className="cat-hit" ref={hit} type="button" aria-label="Say hi to the cat" onClick={() => setSaid((s) => ({ n: s.n + 1, on: true }))} />
      <p className={`bubble ${said.on ? 'on' : ''}`} ref={bubble} aria-live="polite">
        {said.n >= 0 && <Decrypt key={said.n} text={LINES[said.n % LINES.length]} />}
      </p>
    </>
  );
}

/** The homepage's wordmark, "FheCat" in hand-drawn pixel letters; the hero one decodes out of noise. */
export function Wordmark({ decode = false, className }: { decode?: boolean; className?: string }) {
  const slot = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = slot.current!;
    const P = FC.pixel;
    const wm = FC.art.wordmarkCells();
    const final = P.svg(wm.cells, { cls: 'wordmark' });
    el.appendChild(final);
    if (!decode || REDUCED_MOTION) return () => el.replaceChildren();

    // Same animation as the homepage: noise settles column by column, then
    // every so often a few columns glitch back and settle again.
    const W = wm.w;
    const H = wm.h;
    const noise = ['#1c88a7', '#3e6d88', '#10d5f7', '#2a4c66'];
    const svg = P.el('svg', {
      viewBox: `0 0 ${W} ${H}`,
      'shape-rendering': 'crispEdges',
      class: 'px wordmark',
      style: `--w:${W};--h:${H}`,
      'aria-hidden': 'true',
    });
    const cells: { r: SVGElement; x: number; final: string }[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const r = P.el('rect', { x, y, width: 1, height: 1, fill: 'none' });
        svg.appendChild(r);
        cells.push({ r, x, final: wm.cells[y][x] });
      }
    }
    const paint = (settledCols: number, busyFrom: number, busyTo: number) => {
      for (const c of cells) {
        const settled = c.x < settledCols && !(c.x >= busyFrom && c.x < busyTo);
        if (settled) c.r.setAttribute('fill', c.final === '.' ? 'none' : P.PALETTE[c.final]);
        else c.r.setAttribute('fill', Math.random() < 0.45 ? noise[(Math.random() * noise.length) | 0] : 'none');
      }
    };
    el.replaceChild(svg, final);
    paint(0, -1, -1);
    let frame = 0;
    let every = 0;
    let glitch = 0;
    const total = 26;
    const first = window.setInterval(() => {
      frame++;
      paint(frame < 6 ? 0 : Math.round(((frame - 6) / (total - 6)) * W), -1, -1);
      if (frame < total) return;
      clearInterval(first);
      el.replaceChild(final, svg);
      every = window.setInterval(() => {
        const r = el.getBoundingClientRect();
        if (document.hidden || r.bottom < 0 || r.top > window.innerHeight) return;
        const from = (Math.random() * (W - 8)) | 0;
        const to = from + 4 + ((Math.random() * 6) | 0);
        let n = 0;
        el.replaceChild(svg, final);
        glitch = window.setInterval(() => {
          paint(W, from, n < 4 ? to : -1);
          if (++n > 4) {
            clearInterval(glitch);
            el.replaceChild(final, svg);
          }
        }, 60);
      }, 7000);
    }, 50);
    return () => {
      [first, every, glitch].forEach(clearInterval);
      el.replaceChildren();
    };
  }, [decode]);
  return <span className={className} ref={slot} aria-hidden="true" />;
}
