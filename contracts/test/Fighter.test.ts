import { expect } from 'chai';
import { ART, FIGHTER_H, FIGHTER_W, POSES, POSE_NAMES, fighterGrid, type FighterGrid } from '../../art';

/**
 * The arena's full-body fighters (site art, not on chain): every trait option draws in every
 * pose, a fighter facing left keeps its face the right way round, and a sealed box shows its
 * box and its barcode and nothing else.
 */
describe('Fighters', () => {
  /** A DNA with option `k` of trait `i` (its first byte value) and every other trait at its first option. */
  function dnaWith(i: number, k: number): bigint {
    const start = ART.traits[i].weights.slice(0, k).reduce((a, b) => a + b, 0);
    return BigInt(start) << BigInt(8 * i);
  }

  const HEX = /^#[0-9a-f]{6}$/i;

  /** What is wrong with a grid, if anything (checked in plain code: thousands of grids). */
  function problems(grid: FighterGrid): string | null {
    if (grid.length !== FIGHTER_H) return `${grid.length} rows`;
    let drawn = 0;
    for (const row of grid) {
      if (row.length !== FIGHTER_W) return `a row of ${row.length}`;
      for (const c of row) {
        if (c === null) continue;
        if (!HEX.test(c)) return `colour ${c}`;
        drawn++;
      }
    }
    return drawn > 500 ? null : `only ${drawn} pixels`;
  }

  const json = (g: FighterGrid) => JSON.stringify(g);

  it('draws every option of every trait in every pose, both ways round', () => {
    const bad: string[] = [];
    let grids = 0;
    for (let i = 1; i < ART.traits.length; i++) {
      ART.traits[i].names.forEach((name, k) => {
        const dna = dnaWith(i, k);
        for (const pose of POSE_NAMES)
          for (const facing of ['right', 'left'] as const)
            for (const tick of [0, 1]) {
              const p = problems(fighterGrid({ kind: 'cat', dna }, pose, { facing, tick }));
              grids++;
              if (p) bad.push(`${ART.traits[i].label} ${name}, ${pose} ${facing} ${tick}: ${p}`);
            }
      });
    }
    expect(bad).to.deep.equal([]);
    expect(grids).to.be.greaterThan(3000);
  });

  it('draws the same fighter for the same cat', () => {
    const dna = 0x9c4a2e71b05d8f36n;
    for (const pose of POSE_NAMES)
      for (const facing of ['right', 'left'] as const)
        expect(json(fighterGrid({ kind: 'cat', dna }, pose, { facing })), pose).to.equal(json(fighterGrid({ kind: 'cat', dna }, pose, { facing })));
  });

  it('turns the body to face left but never mirrors the face', () => {
    const eyes = ART.traits.findIndex((t) => t.label === 'Eyes');
    const dna = dnaWith(eyes, ART.traits[eyes].names.indexOf('Wink'));
    for (const pose of POSE_NAMES) {
      const [hx, hy] = POSES[pose].head;
      const right = fighterGrid({ kind: 'cat', dna }, pose, { facing: 'right' });
      const left = fighterGrid({ kind: 'cat', dna }, pose, { facing: 'left' });
      // The head's frame moves to the mirrored spot; from the ears to the eyes it is the same picture.
      const moved: string[] = [];
      for (let y = hy + 2; y < hy + 16; y++)
        for (let x = 6; x < 26; x++) if (left[y][16 - hx + x] !== right[y][hx + x]) moved.push(`(${x}, ${y - hy})`);
      expect(moved, pose).to.deep.equal([]);
    }
  });

  it('shows a sealed box as its box, its lid and its own barcode, nothing more', () => {
    const a = 0x9f3a5c7e1b2d4f6081a3c5e7092b4d6f8a1c3e5072941b6d8f0a2c4e6183a5c7n;
    const b = a ^ ((1n << 256n) - 1n);
    for (const state of [0, 1, 2] as const)
      for (const pose of POSE_NAMES) {
        const ga = fighterGrid({ kind: 'box', state, handle: a }, pose);
        const gb = fighterGrid({ kind: 'box', state, handle: b }, pose);
        expect(problems(ga), `box ${state} ${pose}`).to.equal(null);
        // Two opposite handles differ only in the barcode: two rows of 20 bars.
        let diff = 0;
        ga.forEach((row, y) => row.forEach((c, x) => (diff += Number(c !== gb[y][x]))));
        expect(diff, `box ${state} ${pose}`).to.be.within(1, 40);
        expect(json(fighterGrid({ kind: 'box', state, handle: a }, pose))).to.equal(json(ga));
      }
  });

  it('stands every pose on the ground, except the pounce in mid-leap', () => {
    for (const pose of POSE_NAMES) {
      const grid = fighterGrid({ kind: 'cat', dna: 0n }, pose);
      const lowest = grid.reduce((y, row, i) => (row.some((c) => c !== null) ? i : y), -1);
      if (pose === 'pounce') expect(lowest, pose).to.be.below(46);
      else expect(lowest, pose).to.be.within(44, 46);
    }
  });
});
