import { ART } from './art';
import { FUR_ROLES, type Layer } from './types';

/**
 * Reference renderer. FheCatRenderer.sol produces byte-identical output; the
 * contracts test-suite checks both against each other.
 */

export const COLLECTION_NAME = 'FheCat';
export const EXTERNAL_LINK = 'https://x.com/FheCat';
export const COLLECTION_DESCRIPTION =
  'Pixel cats born encrypted on Fhenix. Every FheCat gets its DNA from FHE randomness at mint, so nobody - not the team, not the minter, not a bot - can see or snipe its traits. The holder can peek privately and reveal the cat on-chain with a threshold-network decryption proof. Art is rendered fully on-chain.';
export const ENCRYPTED_DESCRIPTION =
  'This FheCat is still encrypted. Its DNA is a Fhenix FHE ciphertext: only its holder can peek at it. Reveal it to decrypt the cat for everyone.';
export const REVEALED_DESCRIPTION =
  'A FheCat born encrypted on Fhenix. Its DNA came from FHE randomness, stayed a ciphertext until its holder revealed it, and was decrypted on-chain with a threshold-network proof.';

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
  revealed: boolean;
  dna?: bigint;
  handle?: bigint | string;
}

export function tokenJson({ tokenId, revealed, dna, handle }: TokenState): string {
  const name = `${COLLECTION_NAME} #${tokenId.toString()}`;
  if (!revealed) {
    const image = svgDataUri(renderEncryptedSvg(handle ?? 0n));
    return `{"name":"${name}","description":"${ENCRYPTED_DESCRIPTION}","image":"${image}","attributes":[{"trait_type":"Status","value":"Encrypted"}]}`;
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
