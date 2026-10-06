import { ColorTable, compileSprite, rasterize, SIZE } from './compile';
import { BODY, HEAD, MOTIF } from './sprites/base';
import { BOX, LID_OPENED, LID_PEEKED, LID_UNOPENED } from './sprites/box';
import { BACKGROUNDS, FURS, TRAITS } from './traits';
import { FUR_ROLES, type Layer } from './types';

export interface CompiledTrait {
  key: string;
  label: string;
  names: string[];
  weights: number[];
  /** Layer id drawn for each option, or -1 when the option draws nothing. */
  layers: number[];
}

export interface CompiledArt {
  /** Fixed colours as '#rrggbb'. Colour byte c >= 5 means colors[c - 5]. */
  colors: string[];
  layers: Layer[];
  bodyLayer: number;
  headLayer: number;
  motifLayer: number;
  /** The sealed box, and its lid for each sealed state (Unopened, Peeked, Opened). */
  boxLayer: number;
  lidLayers: number[];
  traits: CompiledTrait[];
  /** Fixed-colour index of each background's flat fill. */
  backgroundFills: number[];
  /** Fixed-colour indices [outline, main, shade, light, ink] per fur. */
  furPalettes: number[][];
  /** Pixels the cat's head and body never cover, row-major, as [x, y]. Stars go here. */
  skyCells: [number, number][];
}

function compileArt(): CompiledArt {
  const colors = new ColorTable();
  // Register fur and background colours first so their indices are stable
  // even when sprites change.
  const furPalettes = FURS.map((f) => FUR_ROLES.map((role) => colors.fixed(f.palette[role])));
  const backgroundFills = BACKGROUNDS.map((b) => colors.fixed(b.fill));

  const layers: Layer[] = [];
  const add = (layer: Layer) => (layers.push(layer), layers.length - 1);

  const bodyLayer = add(compileSprite(BODY, colors));
  const headLayer = add(compileSprite(HEAD, colors));
  const motifLayer = add(compileSprite(MOTIF, colors));
  const boxLayer = add(compileSprite(BOX, colors));
  const lidLayers = [LID_UNOPENED, LID_PEEKED, LID_OPENED].map((lid) => add(compileSprite(lid, colors)));

  const traits = TRAITS.map((t) => ({
    key: t.key,
    label: t.label,
    names: t.options.map((o) => o.name),
    weights: t.options.map((o) => o.weight),
    layers: t.options.map((o) => ('sprite' in o && o.sprite ? add(compileSprite(o.sprite, colors)) : -1)),
  }));

  const scratch = new ColorTable();
  const head = rasterize(HEAD, scratch);
  const body = rasterize(BODY, scratch);
  const skyCells: [number, number][] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (head[y][x] < 0 && body[y][x] < 0) skyCells.push([x, y]);

  return {
    colors: colors.hexes,
    layers,
    bodyLayer,
    headLayer,
    motifLayer,
    boxLayer,
    lidLayers,
    traits,
    backgroundFills,
    furPalettes,
    skyCells,
  };
}

export const ART: CompiledArt = compileArt();
