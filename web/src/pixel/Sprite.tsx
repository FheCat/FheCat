import type { CSSProperties } from 'react';
import { FC, type Rows, type SpriteDef } from './fc';

interface Compiled {
  w: number;
  h: number;
  frames: number;
  layers: { cls?: string; transform?: string; paths: { color: string; d: string }[] }[];
}

const byName = new Map<string, Compiled>();
const byArt = new WeakMap<SpriteDef | Rows, Compiled>();

/** The same SVG as the homepage's pixel.svg(): crisp rectangles, sized in CSS by --w x --h pixels of var(--u). */
function compile(sprite: SpriteDef | Rows): Compiled {
  const s: SpriteDef = Array.isArray(sprite)
    ? { w: Math.max(...sprite.map((r) => r.length)), h: sprite.length, layers: [{ rows: sprite }] }
    : sprite;
  // Animation frames are layers classed f0, f1, ...; CSS cycles them.
  const frames = Math.max(0, ...s.layers.map((l) => Number(/\bf(\d+)\b/.exec(l.cls ?? '')?.[1] ?? -1) + 1));
  return {
    w: s.w,
    h: s.h,
    frames,
    layers: s.layers.map((l) => ({
      cls: l.cls,
      transform: l.x || l.y ? `translate(${l.x ?? 0} ${l.y ?? 0})` : undefined,
      paths: FC.pixel.paths(l.rows),
    })),
  };
}

function compiled(name?: string, art?: SpriteDef | Rows): Compiled {
  if (art) {
    let c = byArt.get(art);
    if (!c) byArt.set(art, (c = compile(art)));
    return c;
  }
  let c = byName.get(name!);
  if (!c) {
    const sprite = FC.sprites[name!];
    if (!sprite) throw new Error(`unknown sprite ${name}`);
    byName.set(name!, (c = compile(sprite)));
  }
  return c;
}

interface Props {
  /** A sprite from the homepage's set (landing/js/sprites.js)... */
  name?: string;
  /** ...or pixel rows / a layered sprite of its own. */
  art?: SpriteDef | Rows;
  className?: string;
  /** Size of one art pixel, in CSS pixels. */
  u?: number;
  style?: CSSProperties;
}

export function Sprite({ name, art, className, u, style }: Props) {
  const s = compiled(name, art);
  const cls = ['px', s.frames ? `frames-${s.frames}` : '', name ? `sprite-${name}` : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <svg
      viewBox={`0 0 ${s.w} ${s.h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={cls}
      style={{ '--w': s.w, '--h': s.h, ...(u ? { '--u': `${u}px` } : {}), ...style } as CSSProperties}
    >
      {s.layers.map((l, i) => (
        <g key={i} className={l.cls} transform={l.transform}>
          {l.paths.map((p) => (
            <path key={p.color} fill={p.color} d={p.d} />
          ))}
        </g>
      ))}
    </svg>
  );
}
