import { ART } from './art';
import { FUR_ROLES, type Layer } from './types';

/**
 * Reference renderer. FheCatRenderer.sol produces byte-identical output; the
 * contracts test-suite checks both against each other.
 */

export const COLLECTION_NAME = 'FheCat';
export const EXTERNAL_LINK = 'https://x.com/FheCat';
export const COLLECTION_DESCRIPTION =
  "Schrodinger's cats on Fhenix. Every FheCat is born in a sealed box: its DNA comes from FHE randomness at mint and no wallet - not the team, not the minter, not a bot - can decrypt it. Only its holder decides what happens next: keep it Unopened, Peek privately, or Open it for everyone. Nothing forces a reveal, and a cat can stay sealed forever. Art is rendered fully on-chain.";
export const UNOPENED_DESCRIPTION =
  "An Unopened FheCat. Its DNA is a Fhenix FHE ciphertext that no wallet has ever been able to decrypt, and that is provable on-chain. Only its holder can peek or open the box.";
export const PEEKED_DESCRIPTION =
  'A Peeked FheCat. A holder has taken private decryption rights to its DNA, so it may have been seen. It is still sealed for everyone else, and only its holder can open the box.';
export const OPENED_DESCRIPTION =
  "An Opened FheCat. Its holder made the DNA publicly decryptable, so anyone can now publish it on-chain with the threshold network's proof and draw the cat.";
export const REVEALED_DESCRIPTION =
  'A FheCat born encrypted on Fhenix. Its DNA came from FHE randomness, stayed a ciphertext until its holder opened the box, and was decrypted on-chain with a threshold-network proof.';

/** FheCat.State, in contract order. */
export const STATES = ['Unopened', 'Peeked', 'Opened', 'Revealed'] as const;
export type CatState = 0 | 1 | 2 | 3;
export const SEALED_DESCRIPTIONS = [UNOPENED_DESCRIPTION, PEEKED_DESCRIPTION, OPENED_DESCRIPTION];

export const SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="1024" height="1024" shape-rendering="crispEdges">';
export const SVG_CLOSE = '</svg>';

export const ENCRYPTED_FILL = '#032842';
export const BARCODE_OFF = '#0b4f66';
export const BARCODE_ON = '#0df3ff';

export interface Trait {
  trait_type: string;
  value: string;
}

/** Trait option index for each trait, DNA byte i → TRAITS[i]. */
export function decodeDna(dna: bigint): number[] {
  return ART.traits.map((t, i) => {
    const v = Number((dna >> BigInt(8 * i)) & 0xffn);
    let acc = 0;
    for (let k = 0; k < t.weights.length; k++) {
      acc += t.weights[k];
      if (v < acc) return k;
    }
    throw new Error('unreachable: weights sum to 256');
  });
}

export function traitsOf(dna: bigint): Trait[] {
  const idx = decodeDna(dna);
  return ART.traits.map((t, i) => ({ trait_type: t.label, value: t.names[idx[i]] }));
}

function hexOf(color: number, fur: number[]): string {
  return color < FUR_ROLES.length ? ART.colors[fur[color]] : ART.colors[color - FUR_ROLES.length];
}

function rectPath(x: number, y: number, w: number, h: number): string {
  return `M${x} ${y}h${w}v${h}h-${w}z`;
}

function drawLayer(layer: Layer, fur: number[]): string {
  let out = '';
  for (const g of layer) {
    out += `<path fill="${hexOf(g.color, fur)}" d="`;
    for (const [x, y, w, h] of g.rects) out += rectPath(x, y, w, h);
    out += '"/>';
  }
  return out;
}

export function renderCatSvg(dna: bigint): string {
  const [bg, fur, pattern, eyes, mouth, headwear, accessory, aura] = decodeDna(dna);
  const palette = ART.furPalettes[fur];
  const L = (traitIndex: number, option: number) => {
    const id = ART.traits[traitIndex].layers[option];
    return id < 0 ? '' : drawLayer(ART.layers[id], palette);
  };
  return (
    SVG_OPEN +
    `<rect width="32" height="32" fill="${ART.colors[ART.backgroundFills[bg]]}"/>` +
    L(0, bg) +
    L(7, aura) +
    drawLayer(ART.layers[ART.bodyLayer], palette) +
    drawLayer(ART.layers[ART.headLayer], palette) +
    L(2, pattern) +
    L(3, eyes) +
    L(4, mouth) +
    L(6, accessory) +
    L(5, headwear) +
    SVG_CLOSE
  );
}

/** Two 20-bit rows taken from the top of the ciphertext handle, unique per token. */
function barcode(handle: bigint): string {
  let off = '';
  let on = '';
  for (let row = 0; row < 2; row++) {
    let col = 0;
    while (col < 20) {
      const bit = (i: number) => (handle >> BigInt(255 - (row * 20 + i))) & 1n;
      const b = bit(col);
      let w = 1;
      while (col + w < 20 && bit(col + w) === b) w++;
      const d = rectPath(6 + col, 27 + row, w, 1);
      if (b === 1n) on += d;
      else off += d;
      col += w;
    }
  }
  return `<path fill="${BARCODE_OFF}" d="${off}"/><path fill="${BARCODE_ON}" d="${on}"/>`;
}

export function renderMotifSvg(): string {
  return SVG_OPEN + `<rect width="32" height="32" fill="${ENCRYPTED_FILL}"/>` + drawLayer(ART.layers[ART.motifLayer], []) + SVG_CLOSE;
}

export function renderEncryptedSvg(handle: bigint | string): string {
  const h = BigInt(handle);
  return (
    SVG_OPEN +
    `<rect width="32" height="32" fill="${ENCRYPTED_FILL}"/>` +
    drawLayer(ART.layers[ART.motifLayer], []) +
    barcode(h) +
    SVG_CLOSE
  );
}

/** Base64 of an ASCII string (browsers and Node 16+ both provide btoa). */
export function base64(ascii: string): string {
  return btoa(ascii);
}

export function svgDataUri(svg: string): string {
  return 'data:image/svg+xml;base64,' + base64(svg);
}

export interface TokenState {
  tokenId: bigint | number;
  /** FheCat.State: 0 Unopened, 1 Peeked, 2 Opened, 3 Revealed. */
  state: CatState;
  dna?: bigint;
  handle?: bigint | string;
}

export function tokenJson({ tokenId, state, dna, handle }: TokenState): string {
  const name = `${COLLECTION_NAME} #${tokenId.toString()}`;
  if (state < 3) {
    const image = svgDataUri(renderEncryptedSvg(handle ?? 0n));
    return `{"name":"${name}","description":"${SEALED_DESCRIPTIONS[state]}","image":"${image}","attributes":[{"trait_type":"Status","value":"${STATES[state]}"}]}`;
  }
  const image = svgDataUri(renderCatSvg(dna ?? 0n));
  const attrs = traitsOf(dna ?? 0n)
    .map((t) => `,{"trait_type":"${t.trait_type}","value":"${t.value}"}`)
    .join('');
  return `{"name":"${name}","description":"${REVEALED_DESCRIPTION}","image":"${image}","attributes":[{"trait_type":"Status","value":"Revealed"}${attrs}]}`;
}

export function tokenUri(state: TokenState): string {
  return 'data:application/json;base64,' + base64(tokenJson(state));
}

export function contractJson(): string {
  return `{"name":"${COLLECTION_NAME}","description":"${COLLECTION_DESCRIPTION}","image":"${svgDataUri(renderMotifSvg())}","external_link":"${EXTERNAL_LINK}"}`;
}

export function contractUri(): string {
  return 'data:application/json;base64,' + base64(contractJson());
}
