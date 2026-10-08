import { useEffect, useRef } from 'react';
import type { FighterLook, PoseName } from '@art';
import { fighterFrame, lookKey, type Facing } from '../arena/pixels';
import { REDUCED_MOTION } from '../pixel/fc';

/** One clock for every fighter on the page: four ticks a second, still while the tab is hidden. */
const listeners = new Set<(tick: number) => void>();
let timer = 0;
let ticks = 0;

function subscribe(fn: (tick: number) => void) {
  listeners.add(fn);
  fn(ticks);
  if (!timer) {
    timer = window.setInterval(() => {
      if (document.hidden) return;
      ticks++;
      listeners.forEach((l) => l(ticks));
    }, 250);
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size) {
      clearInterval(timer);
      timer = 0;
    }
  };
}

/** The part of the 48×48 fighter frame a list shows: the body standing, with a pixel or two around it. */
const CROP = { x: 4, y: 7, w: 40, h: 40 };
/** The whole frame, aura and all. */
const FULL = { x: 0, y: 0, w: 48, h: 48 };

/** A few ticks of offset per fighter, so a row of them does not breathe in step. */
function phaseOf(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 4;
}

interface Props {
  look: FighterLook;
  /** Size of one art pixel, in CSS pixels. */
  scale?: number;
  facing?: Facing;
  /** Breathing in place (the default), or one pose held. */
  pose?: PoseName | 'idle';
  /** The whole 48×48 frame (aura and all) instead of the body cropped for lists. */
  full?: boolean;
  /** What the picture shows, for screen readers; without it the fighter is decoration. */
  label?: string;
  className?: string;
}

/**
 * A fighter, full body: a revealed cat on its fighter's body with its coat, accessory and aura,
 * or a sealed box on shadow paws. It breathes in place, on the page's shared clock.
 */
export function Fighter({ look, scale = 2, facing = 'right', pose = 'idle', full = false, label, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const view = full ? FULL : CROP;
  const key = lookKey(look);
  const lookRef = useRef(look);
  lookRef.current = look;

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const offset = phaseOf(key);
    const draw = (tick: number) => {
      const t = tick + offset;
      const p: PoseName = pose === 'idle' ? (Math.floor(t / 2) % 2 ? 'idle2' : 'idle') : pose;
      ctx.clearRect(0, 0, view.w, view.h);
      ctx.drawImage(fighterFrame(lookRef.current, p, facing, t), -view.x, -view.y);
    };
    if (REDUCED_MOTION) return void draw(0);
    return subscribe(draw);
  }, [key, pose, facing, view]);

  return (
    <canvas
      ref={ref}
      width={view.w}
      height={view.h}
      className={`fighter${className ? ` ${className}` : ''}`}
      style={{ width: view.w * scale, height: view.h * scale }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
