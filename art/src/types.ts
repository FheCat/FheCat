/**
 * Fur colours are resolved per cat, so sprites can reference them by role.
 * Everything else is a fixed hex colour.
 */
export type FurRole = 'outline' | 'main' | 'shade' | 'light' | 'ink';

/** `ink` draws facial lines (closed eyes); it is light on dark furs so they stay visible. */
export const FUR_ROLES: readonly FurRole[] = ['outline', 'main', 'shade', 'light', 'ink'];

export type ColorRef = { role: FurRole } | { hex: string };

export interface SpritePart {
  /** Left offset on the 32×32 canvas. */
  x: number;
  /** Top offset on the 32×32 canvas. */
  y: number;
  /** One string per row. '.' is transparent, every other char must be in `colors`. */
  rows: string[];
  /** Also stamp a horizontally mirrored copy at x' = 32 - x - width. */
  mirror?: boolean;
}

export interface Sprite {
  colors: Record<string, ColorRef>;
  parts: SpritePart[];
}

export interface TraitOption {
  name: string;
  /** Out of 256 per trait; the weights of a trait must sum to exactly 256. */
  weight: number;
  sprite?: Sprite;
}

/** A background also carries the flat fill colour painted under everything. */
export interface BackgroundOption extends TraitOption {
  fill: string;
}

export interface FurOption {
  name: string;
  weight: number;
  palette: Record<FurRole, string>;
}

/** [x, y, width, height] */
export type Rect = [number, number, number, number];

export interface ColorGroup {
  /** 0-4 = fur role (FUR_ROLES order), 5+ = fixed colour `color - 5`. */
  color: number;
  rects: Rect[];
}

export type Layer = ColorGroup[];
