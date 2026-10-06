// The homepage's pixel design system (landing/js), shared as-is: the sprite
// helper, the sprites and the night-sky scenes. The scripts attach themselves
// to window.FheCat; they must load in this order.
import '../../../landing/js/pixel.js';
import '../../../landing/js/sprites.js';
import '../../../landing/js/scene.js';

export type Rows = string[];
export interface Layer {
  rows: Rows;
  cls?: string;
  x?: number;
  y?: number;
}
export interface SpriteDef {
  w: number;
  h: number;
  layers: Layer[];
}

export interface SceneState {
  el: HTMLElement;
  opts: SceneOptions;
  visible: boolean;
  W: number;
  H: number;
  px: number;
  width: number;
  /** The sitting cat's box in CSS pixels, relative to the scene. */
  cat: { x: number; y: number; w: number; h: number };
}
export interface SceneOptions {
  moon?: 'left' | 'right';
  tapPaws?: boolean;
  /** The cat seen from behind, looking at the sky. */
  back?: boolean;
  catAt?: number;
  seed?: number;
  onBuild?: (s: SceneState) => void;
}

interface FheCatNamespace {
  pixel: {
    PALETTE: Record<string, string>;
    paths(rows: Rows, palette?: Record<string, string>): { color: string; d: string }[];
    svg(sprite: SpriteDef | Rows, opts?: { cls?: string }): SVGSVGElement;
    el(name: string, attrs: Record<string, string | number>): SVGElement;
  };
  sprites: Record<string, SpriteDef | Rows>;
  art: { wordmarkCells(): { w: number; h: number; cells: Rows } };
  scene: {
    init(el: HTMLElement, opts?: SceneOptions): SceneState;
    starfield(el: HTMLElement, density?: number, seed?: number): void;
    ribbon(el: HTMLElement, seed: number): void;
  };
}

declare global {
  interface Window {
    FheCat: FheCatNamespace;
  }
}

export const FC = window.FheCat;

export const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
