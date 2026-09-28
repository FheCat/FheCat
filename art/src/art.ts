import { ColorTable, compileSprite } from './compile';
import { BODY, HEAD, MOTIF } from './sprites/base';
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
  traits: CompiledTrait[];
  /** Fixed-colour index of each background's flat fill. */
  backgroundFills: number[];
  /** Fixed-colour indices [outline, main, shade, light, ink] per fur. */
  furPalettes: number[][];
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

  const traits = TRAITS.map((t) => ({
    key: t.key,
    label: t.label,
    names: t.options.map((o) => o.name),
    weights: t.options.map((o) => o.weight),
    layers: t.options.map((o) => ('sprite' in o && o.sprite ? add(compileSprite(o.sprite, colors)) : -1)),
  }));

  return { colors: colors.hexes, layers, bodyLayer, headLayer, motifLayer, traits, backgroundFills, furPalettes };
}

export const ART: CompiledArt = compileArt();
