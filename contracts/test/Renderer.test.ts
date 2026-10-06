import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ART, contractUri, renderCatSvg, renderEncryptedSvg, renderMotifSvg, tokenUri, traitsOf } from '../../art';
import { decodeDataUri } from './helpers';
import type { FheCatRenderer } from '../typechain-types';

/**
 * The web app renders cats with the TypeScript renderer in /art (e.g. right after
 * a private peek, when the DNA must not leave the browser). These tests pin the
 * Solidity renderer to it byte for byte.
 */
describe('FheCatRenderer', () => {
  async function fixture() {
    return { renderer: (await ethers.deployContract('FheCatRenderer')) as unknown as FheCatRenderer };
  }

  // splitmix64: reproducible pseudo-random DNAs
  function rng(seed: bigint) {
    return () => {
      seed = (seed + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
      let z = seed;
      z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
      z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
      return z ^ (z >> 31n);
    };
  }

  /** DNAs hitting the first and last byte value of every option of every trait. */
  function boundaryDnas(): bigint[] {
    const out: bigint[] = [0n, 0xffffffffffffffffn];
    ART.traits.forEach((t, i) => {
      let start = 0;
      for (const w of t.weights) {
        for (const v of [start, start + w - 1]) {
          // vary the other bytes too so every option shows up next to different traits
          const other = (BigInt(v) * 0x0101010101010101n) & 0xffffffffffffffffn;
          out.push((other & ~(0xffn << BigInt(8 * i))) | (BigInt(v) << BigInt(8 * i)));
        }
        start += w;
      }
    });
    return out;
  }

  it('matches the TypeScript renderer on every trait boundary', async () => {
    const { renderer } = await loadFixture(fixture);
    for (const dna of boundaryDnas()) {
      expect(await renderer.catSvg(dna), `dna 0x${dna.toString(16)}`).to.equal(renderCatSvg(dna));
    }
  });

  it('matches the TypeScript renderer on random DNAs', async () => {
    const { renderer } = await loadFixture(fixture);
    const next = rng(20260928n);
    for (let i = 0; i < 150; i++) {
      const dna = next();
      expect(await renderer.catSvg(dna), `dna 0x${dna.toString(16)}`).to.equal(renderCatSvg(dna));
    }
  });

  it('decodes the same traits', async () => {
    const { renderer } = await loadFixture(fixture);
    const next = rng(7n);
    for (let i = 0; i < 60; i++) {
      const dna = next();
      const [labels, values] = await renderer.traits(dna);
      const expected = traitsOf(dna);
      expect([...labels]).to.deep.equal(expected.map((t) => t.trait_type));
      expect([...values]).to.deep.equal(expected.map((t) => t.value));
    }
  });

  it('draws the encrypted placeholder and collection image identically', async () => {
    const { renderer } = await loadFixture(fixture);
    const next = rng(99n);
    const handles = [ethers.ZeroHash, '0x' + 'ff'.repeat(32)];
    for (let i = 0; i < 20; i++) handles.push(ethers.toBeHex((next() << 192n) | (next() << 128n) | next(), 32));
    for (const h of handles) expect(await renderer.encryptedSvg(h), h).to.equal(renderEncryptedSvg(h));
    expect(await renderer.motifSvg()).to.equal(renderMotifSvg());
  });

  it('builds identical token and collection metadata', async () => {
    const { renderer } = await loadFixture(fixture);
    const handle = ethers.toBeHex(0xabcdef0123456789n << 190n, 32);
    for (const state of [0, 1, 2] as const) {
      expect(await renderer.tokenURI(42, state, 0, handle), `state ${state}`).to.equal(
        tokenUri({ tokenId: 42n, state, handle }),
      );
    }
    expect(await renderer.tokenURI(7, 3, 0x1234567890abcdefn, handle)).to.equal(
      tokenUri({ tokenId: 7n, state: 3, dna: 0x1234567890abcdefn }),
    );
    expect(await renderer.contractURI()).to.equal(contractUri());
    const json = JSON.parse(
      decodeDataUri(await renderer.tokenURI(7, 3, 0x1234567890abcdefn, handle), 'data:application/json;base64,'),
    );
    expect(json.name).to.equal('FheCat #7');
  });

  it('stays well inside eth_call gas limits', async () => {
    const { renderer } = await loadFixture(fixture);
    // heaviest combination: the biggest layer of every trait
    const heaviest = ART.traits.reduce((dna, t, i) => {
      const sizes = t.layers.map((l) => (l < 0 ? 0 : ART.layers[l].reduce((s, g) => s + g.rects.length + 1, 0)));
      const k = sizes.indexOf(Math.max(...sizes));
      const start = t.weights.slice(0, k).reduce((a, b) => a + b, 0);
      return dna | (BigInt(start) << BigInt(8 * i));
    }, 0n);
    const gas = await renderer.tokenURI.estimateGas(1, 3, heaviest, ethers.ZeroHash);
    expect(gas).to.be.lessThan(10_000_000n);
  });
});
