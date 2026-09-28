import type { BackgroundOption, FurOption, TraitOption } from './types';
import * as bg from './sprites/backgrounds';
import * as eyes from './sprites/eyes';
import * as mouths from './sprites/mouths';
import * as pat from './sprites/patterns';
import * as hats from './sprites/headwear';
import * as acc from './sprites/accessories';
import * as aura from './sprites/auras';

/**
 * Rarity tables. Every table sums to 256: one DNA byte picks one option.
 * The DNA itself is a uint64 drawn with FHE.randomEuint64(), so nobody —
 * not the team, not the minter — knows a cat's traits until it is decrypted.
 */

export const BACKGROUNDS: BackgroundOption[] = [
  { name: 'Midnight', weight: 60, fill: '#032842' },
  { name: 'Deep Sea', weight: 50, fill: '#022d4d', sprite: bg.BUBBLES },
  { name: 'Starry Night', weight: 40, fill: '#032842', sprite: bg.STARS },
  { name: 'Cipher Grid', weight: 30, fill: '#041f33', sprite: bg.GRID },
  { name: 'Dusk', weight: 30, fill: '#1e1640', sprite: bg.DUSK_STARS },
  { name: 'Teal Glow', weight: 24, fill: '#063b45' },
  { name: 'Moonlit', weight: 14, fill: '#032842', sprite: bg.MOON },
  { name: 'Aurora', weight: 8, fill: '#041c30', sprite: bg.AURORA },
];

export const FURS: FurOption[] = [
  { name: 'Steel Blue', weight: 40, palette: { outline: '#22354d', main: '#5e7b9d', shade: '#4a6384', light: '#8fa9c6', ink: '#22354d' } },
  { name: 'Midnight Black', weight: 36, palette: { outline: '#07090f', main: '#262e3d', shade: '#1b2230', light: '#465169', ink: '#c9d4e0' } },
  { name: 'Snow White', weight: 32, palette: { outline: '#6b7c93', main: '#f2f5f9', shade: '#ccd6e2', light: '#ffffff', ink: '#3a4658' } },
  { name: 'Ginger', weight: 32, palette: { outline: '#6b2f0f', main: '#f08a3c', shade: '#c9652a', light: '#ffd2a6', ink: '#6b2f0f' } },
  { name: 'Ash Grey', weight: 30, palette: { outline: '#2e3440', main: '#8e97a6', shade: '#6c7482', light: '#c4cad3', ink: '#2e3440' } },
  { name: 'Cream', weight: 28, palette: { outline: '#7a5a3a', main: '#f2d7b0', shade: '#d9b98c', light: '#fff3e0', ink: '#7a5a3a' } },
  { name: 'Chocolate', weight: 24, palette: { outline: '#2e1a12', main: '#7a4a33', shade: '#5e3726', light: '#a9765a', ink: '#2e1a12' } },
  { name: 'Lilac', weight: 16, palette: { outline: '#4b3d6b', main: '#b9a7e0', shade: '#9a86c8', light: '#dcd2f4', ink: '#4b3d6b' } },
  { name: 'Cyber Cyan', weight: 12, palette: { outline: '#035a66', main: '#0df3ff', shade: '#0ab8c9', light: '#9cfbff', ink: '#035a66' } },
  { name: 'Gold', weight: 6, palette: { outline: '#6b4a00', main: '#f5c542', shade: '#d4a017', light: '#ffe89a', ink: '#6b4a00' } },
];

export const PATTERNS: TraitOption[] = [
  { name: 'None', weight: 80 },
  { name: 'Tabby', weight: 50, sprite: pat.TABBY },
  { name: 'Tuxedo', weight: 40, sprite: pat.TUXEDO },
  { name: 'Spots', weight: 30, sprite: pat.SPOTS },
  { name: 'Bandit Mask', weight: 24, sprite: pat.BANDIT },
  { name: 'Blaze', weight: 20, sprite: pat.BLAZE },
  { name: 'Calico', weight: 12, sprite: pat.CALICO },
];

export const EYES: TraitOption[] = [
  { name: 'Amber', weight: 40, sprite: eyes.AMBER_EYES },
  { name: 'Emerald', weight: 36, sprite: eyes.EMERALD_EYES },
  { name: 'Sky', weight: 32, sprite: eyes.SKY_EYES },
  { name: 'Sleepy', weight: 30, sprite: eyes.SLEEPY_EYES },
  { name: 'Odd Eyes', weight: 20, sprite: eyes.ODD_EYES },
  { name: 'Happy', weight: 26, sprite: eyes.HAPPY_EYES },
  { name: 'Wink', weight: 20, sprite: eyes.WINK_EYES },
  { name: 'Cipher Eyes', weight: 16, sprite: eyes.CIPHER_EYES },
  { name: 'Pixel Shades', weight: 16, sprite: eyes.PIXEL_SHADES },
  { name: 'Glow', weight: 12, sprite: eyes.GLOW_EYES },
  { name: '3D Glasses', weight: 8, sprite: eyes.GLASSES_3D },
];

export const MOUTHS: TraitOption[] = [
  { name: 'Classic', weight: 70, sprite: mouths.CAT_MOUTH },
  { name: 'Smile', weight: 50, sprite: mouths.SMILE },
  { name: 'Blep', weight: 40, sprite: mouths.BLEP },
  { name: 'Fangs', weight: 30, sprite: mouths.FANGS },
  { name: 'Fish', weight: 20, sprite: mouths.FISH },
  { name: 'Meow', weight: 30, sprite: mouths.MEOW },
  { name: 'Bubblegum', weight: 16, sprite: mouths.BUBBLEGUM },
];

export const HEADWEAR: TraitOption[] = [
  { name: 'None', weight: 70 },
  { name: 'Beanie', weight: 30, sprite: hats.BEANIE },
  { name: 'Headphones', weight: 26, sprite: hats.HEADPHONES },
  { name: 'Crown', weight: 10, sprite: hats.CROWN },
  { name: 'Party Hat', weight: 24, sprite: hats.PARTY_HAT },
  { name: 'Halo', weight: 14, sprite: hats.HALO },
  { name: 'Headband', weight: 26, sprite: hats.HEADBAND },
  { name: 'Wizard Hat', weight: 16, sprite: hats.WIZARD_HAT },
  { name: 'Cap', weight: 26, sprite: hats.CAP },
  { name: 'Cipher Crown', weight: 6, sprite: hats.CIPHER_CROWN },
  { name: 'Flower', weight: 8, sprite: hats.FLOWER },
];

export const ACCESSORIES: TraitOption[] = [
  { name: 'None', weight: 80 },
  { name: 'Bell Collar', weight: 40, sprite: acc.BELL_COLLAR },
  { name: 'Bow Tie', weight: 30, sprite: acc.BOW_TIE },
  { name: 'Scarf', weight: 30, sprite: acc.SCARF },
  { name: 'Gold Chain', weight: 20, sprite: acc.GOLD_CHAIN },
  { name: 'FHE Key', weight: 20, sprite: acc.FHE_KEY },
  { name: 'Hoodie', weight: 24, sprite: acc.HOODIE },
  { name: 'Cape', weight: 12, sprite: acc.CAPE },
];

export const AURAS: TraitOption[] = [
  { name: 'None', weight: 200 },
  { name: 'Sparkles', weight: 30, sprite: aura.SPARKLES },
  { name: 'Cipher Rain', weight: 16, sprite: aura.CIPHER_RAIN },
  { name: 'Backlight', weight: 8, sprite: aura.BACKLIGHT },
  { name: 'Encrypted Aura', weight: 2, sprite: aura.ENCRYPTED_AURA },
];

/** DNA byte i (least significant first) selects TRAITS[i]. */
export const TRAITS = [
  { key: 'background', label: 'Background', options: BACKGROUNDS },
  { key: 'fur', label: 'Fur', options: FURS },
  { key: 'pattern', label: 'Pattern', options: PATTERNS },
  { key: 'eyes', label: 'Eyes', options: EYES },
  { key: 'mouth', label: 'Mouth', options: MOUTHS },
  { key: 'headwear', label: 'Headwear', options: HEADWEAR },
  { key: 'accessory', label: 'Accessory', options: ACCESSORIES },
  { key: 'aura', label: 'Aura', options: AURAS },
] as const;

export type TraitKey = (typeof TRAITS)[number]['key'];

for (const t of TRAITS) {
  const total = t.options.reduce((s, o) => s + o.weight, 0);
  if (total !== 256) throw new Error(`${t.label} weights sum to ${total}, expected 256`);
}
