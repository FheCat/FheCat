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
  { name: 'Midnight', weight: 40, fill: '#032842' },
  { name: 'Starry Night', weight: 32, fill: '#04223a', sprite: bg.STARS },
  { name: 'Deep Sea', weight: 30, fill: '#022d4d', sprite: bg.BUBBLES },
  { name: 'Dusk', weight: 28, fill: '#1e1640', sprite: bg.DUSK_STARS },
  { name: 'Teal Glow', weight: 26, fill: '#063b45' },
  { name: 'Sakura', weight: 24, fill: '#2a1530', sprite: bg.SAKURA },
  { name: 'Sunset', weight: 22, fill: '#b8483a', sprite: bg.SUNSET },
  { name: 'Cipher Grid', weight: 20, fill: '#041f33', sprite: bg.GRID },
  { name: 'Moonlit', weight: 18, fill: '#03213a', sprite: bg.MOON },
  { name: 'Aurora', weight: 16, fill: '#041c30', sprite: bg.AURORA },
];

export const FURS: FurOption[] = [
  { name: 'Steel Blue', weight: 32, palette: { outline: '#22354d', main: '#5e7b9d', shade: '#4a6384', light: '#8fa9c6', ink: '#22354d' } },
  { name: 'Midnight Black', weight: 30, palette: { outline: '#07090f', main: '#262e3d', shade: '#1b2230', light: '#465169', ink: '#8d97ab' } },
  { name: 'Snow White', weight: 30, palette: { outline: '#6b7c93', main: '#f2f5f9', shade: '#ccd6e2', light: '#ffffff', ink: '#3a4658' } },
  { name: 'Ginger', weight: 28, palette: { outline: '#6b2f0f', main: '#f08a3c', shade: '#c9652a', light: '#ffd2a6', ink: '#6b2f0f' } },
  { name: 'Ash Grey', weight: 26, palette: { outline: '#2e3440', main: '#8e97a6', shade: '#6c7482', light: '#c4cad3', ink: '#2e3440' } },
  { name: 'Cream', weight: 24, palette: { outline: '#7a5a3a', main: '#f2d7b0', shade: '#d9b98c', light: '#fff3e0', ink: '#7a5a3a' } },
  { name: 'Chocolate', weight: 22, palette: { outline: '#2e1a12', main: '#7a4a33', shade: '#5e3726', light: '#a9765a', ink: '#2e1a12' } },
  { name: 'Lilac', weight: 18, palette: { outline: '#4b3d6b', main: '#b9a7e0', shade: '#9a86c8', light: '#dcd2f4', ink: '#4b3d6b' } },
  { name: 'Strawberry', weight: 16, palette: { outline: '#7a2448', main: '#ff9ec4', shade: '#e67aa5', light: '#ffd6e7', ink: '#7a2448' } },
  { name: 'Mint', weight: 14, palette: { outline: '#1f5e4a', main: '#8fe3c4', shade: '#62c4a3', light: '#d2f7ea', ink: '#1f5e4a' } },
  { name: 'Cyber Cyan', weight: 10, palette: { outline: '#035a66', main: '#0df3ff', shade: '#0ab8c9', light: '#9cfbff', ink: '#035a66' } },
  { name: 'Gold', weight: 6, palette: { outline: '#6b4a00', main: '#f5c542', shade: '#d4a017', light: '#ffe89a', ink: '#6b4a00' } },
];

export const PATTERNS: TraitOption[] = [
  { name: 'None', weight: 56 },
  { name: 'Tabby', weight: 40, sprite: pat.TABBY },
  { name: 'Tuxedo', weight: 30, sprite: pat.TUXEDO },
  { name: 'Spots', weight: 28, sprite: pat.SPOTS },
  { name: 'Blaze', weight: 24, sprite: pat.BLAZE },
  { name: 'Bandit Mask', weight: 20, sprite: pat.BANDIT },
  { name: 'Tiger', weight: 18, sprite: pat.TIGER },
  { name: 'Siamese', weight: 16, sprite: pat.SIAMESE },
  { name: 'Calico', weight: 14, sprite: pat.CALICO },
  { name: 'Heart Mark', weight: 10, sprite: pat.HEART_MARK },
];

export const EYES: TraitOption[] = [
  { name: 'Amber', weight: 28, sprite: eyes.AMBER_EYES },
  { name: 'Emerald', weight: 26, sprite: eyes.EMERALD_EYES },
  { name: 'Sky', weight: 26, sprite: eyes.SKY_EYES },
  { name: 'Violet', weight: 20, sprite: eyes.VIOLET_EYES },
  { name: 'Happy', weight: 20, sprite: eyes.HAPPY_EYES },
  { name: 'Sleepy', weight: 18, sprite: eyes.SLEEPY_EYES },
  { name: 'Wink', weight: 16, sprite: eyes.WINK_EYES },
  { name: 'Odd Eyes', weight: 14, sprite: eyes.ODD_EYES },
  { name: 'Starry', weight: 14, sprite: eyes.STARRY_EYES },
  { name: 'Pixel Shades', weight: 14, sprite: eyes.PIXEL_SHADES },
  { name: 'Heart Eyes', weight: 12, sprite: eyes.HEART_EYES },
  { name: '3D Glasses', weight: 12, sprite: eyes.GLASSES_3D },
  { name: 'Visor', weight: 10, sprite: eyes.VISOR },
  { name: 'Glow', weight: 10, sprite: eyes.GLOW_EYES },
  { name: 'Cipher Eyes', weight: 8, sprite: eyes.CIPHER_EYES },
  { name: 'Laser Eyes', weight: 8, sprite: eyes.LASER_EYES },
];

export const MOUTHS: TraitOption[] = [
  { name: 'Classic', weight: 50, sprite: mouths.CAT_MOUTH },
  { name: 'Smile', weight: 36, sprite: mouths.SMILE },
  { name: 'Blep', weight: 30, sprite: mouths.BLEP },
  { name: 'Fang', weight: 26, sprite: mouths.FANG },
  { name: 'Meow', weight: 26, sprite: mouths.MEOW },
  { name: 'Grin', weight: 22, sprite: mouths.GRIN },
  { name: 'Fish', weight: 18, sprite: mouths.FISH },
  { name: 'Bubblegum', weight: 18, sprite: mouths.BUBBLEGUM },
  { name: 'Lollipop', weight: 16, sprite: mouths.LOLLIPOP },
  { name: 'Mustache', weight: 14, sprite: mouths.MUSTACHE },
];

export const HEADWEAR: TraitOption[] = [
  { name: 'None', weight: 52 },
  { name: 'Beanie', weight: 22, sprite: hats.BEANIE },
  { name: 'Cap', weight: 20, sprite: hats.CAP },
  { name: 'Headphones', weight: 18, sprite: hats.HEADPHONES },
  { name: 'Headband', weight: 18, sprite: hats.HEADBAND },
  { name: 'Bow', weight: 16, sprite: hats.BOW },
  { name: 'Flower', weight: 16, sprite: hats.FLOWER },
  { name: 'Party Hat', weight: 14, sprite: hats.PARTY_HAT },
  { name: 'Cowboy Hat', weight: 12, sprite: hats.COWBOY_HAT },
  { name: 'Propeller Cap', weight: 12, sprite: hats.PROPELLER_CAP },
  { name: 'Devil Horns', weight: 12, sprite: hats.DEVIL_HORNS },
  { name: 'Wizard Hat', weight: 12, sprite: hats.WIZARD_HAT },
  { name: 'Top Hat', weight: 10, sprite: hats.TOP_HAT },
  { name: 'Halo', weight: 10, sprite: hats.HALO },
  { name: 'Crown', weight: 8, sprite: hats.CROWN },
  { name: 'Cipher Crown', weight: 4, sprite: hats.CIPHER_CROWN },
];

export const ACCESSORIES: TraitOption[] = [
  { name: 'None', weight: 60 },
  { name: 'Bell Collar', weight: 26, sprite: acc.BELL_COLLAR },
  { name: 'Bow Tie', weight: 24, sprite: acc.BOW_TIE },
  { name: 'Scarf', weight: 22, sprite: acc.SCARF },
  { name: 'Bandana', weight: 20, sprite: acc.BANDANA },
  { name: 'Hoodie', weight: 18, sprite: acc.HOODIE },
  { name: 'Necktie', weight: 16, sprite: acc.NECKTIE },
  { name: 'Spiked Collar', weight: 16, sprite: acc.SPIKED_COLLAR },
  { name: 'Pearls', weight: 14, sprite: acc.PEARLS },
  { name: 'Gold Chain', weight: 14, sprite: acc.GOLD_CHAIN },
  { name: 'FHE Key', weight: 14, sprite: acc.FHE_KEY },
  { name: 'Cape', weight: 12, sprite: acc.CAPE },
];

export const AURAS: TraitOption[] = [
  { name: 'None', weight: 154 },
  { name: 'Sparkles', weight: 30, sprite: aura.SPARKLES },
  { name: 'Hearts', weight: 24, sprite: aura.HEARTS },
  { name: 'Cipher Rain', weight: 18, sprite: aura.CIPHER_RAIN },
  { name: 'Backlight', weight: 14, sprite: aura.BACKLIGHT },
  { name: 'Lightning', weight: 12, sprite: aura.LIGHTNING },
  { name: 'Encrypted Aura', weight: 4, sprite: aura.ENCRYPTED_AURA },
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
