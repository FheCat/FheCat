import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { FheTypes } from '@cofhe/sdk';
import { State, cofheFor, mockPlaintext } from './helpers';
import type { FheCatArena, FheCatFixedDna, FheCatRenderer } from '../typechain-types';

const RARE = 1200n;
const EPIC = 1350n;

/** Sum of the eight DNA bytes: a cat's power. */
function powerOf(dna: bigint): bigint {
  let p = 0n;
  for (let i = 0n; i < 8n; i++) p += (dna >> (8n * i)) & 0xffn;
  return p;
}

/** A DNA whose bytes add up to `power`, spread evenly (low bytes get the remainder). */
function dnaWithPower(power: number): bigint {
  const base = Math.floor(power / 8);
  let rest = power - base * 8;
  let dna = 0n;
  for (let i = 0; i < 8; i++) {
    const b = base + (rest-- > 0 ? 1 : 0);
    if (b > 255) throw new Error('power too high');
    dna |= BigInt(b) << BigInt(8 * i);
  }
  return dna;
}

describe('FheCatArena', () => {
  // Cats 1..6 and their DNAs, by holder: alice 1, 2; bob 3, 4; carol 5, 6.
  const DNAS = [
    0xffffffffffffffffn, // 1: power 2040, the strongest possible
    dnaWithPower(1200), //  2: exactly Rare
    dnaWithPower(1199), //  3: one short of Rare
    0x0000000000000102n, // 4: power 3
    0x0000000000000201n, // 5: power 3 too (a tie with #4)
    0x1234567890abcdefn, // 6: anything
  ];

  async function fixture() {
    const [owner, alice, bob, carol] = await ethers.getSigners();
    const renderer = (await ethers.deployContract('FheCatRenderer')) as unknown as FheCatRenderer;
    const nft = (await ethers.deployContract('FheCatFixedDna', [await renderer.getAddress()])) as unknown as FheCatFixedDna;
    const arena = (await ethers.deployContract('FheCatArena', [await nft.getAddress()])) as unknown as FheCatArena;
    await nft.setArena(await arena.getAddress());
    await nft.queueDna(DNAS);
    await nft.ownerMint(alice.address, 2);
    await nft.ownerMint(bob.address, 2);
    await nft.ownerMint(carol.address, 2);
    const holders = [alice, alice, bob, bob, carol, carol];
    return { nft, arena, owner, alice, bob, carol, holders };
  }

  /** Every cat enters the arena. */
  async function enteredFixture() {
    const f = await fixture();
    for (let id = 1; id <= 6; id++) await f.nft.connect(f.holders[id - 1]).enterArena(id);
    return f;
  }

  /** Decrypts a public result like any onlooker would, returning what `settle` needs. */
  async function publicResult(handle: string) {
    const [, , , , onlooker] = await ethers.getSigners();
    const { decryptedValue, signature } = await (await cofheFor(onlooker)).decryptForTx(handle).withoutACP().execute();
    return { value: decryptedValue === 1n, signature };
  }

  async function fight(arena: FheCatArena, challenger: { id: number; who: any }, opponent: { id: number; who: any }) {
    await arena.connect(challenger.who).challenge(challenger.id, opponent.id);
    const duelId = await arena.duelCount();
    await arena.connect(opponent.who).accept(duelId, opponent.id);
    return { duelId, handle: (await arena.duels(duelId)).challengerWins };
  }

  it('seals each cat’s power as the sum of its DNA bytes, decryptable by nobody', async () => {
    const { arena, alice, bob } = await loadFixture(enteredFixture);
    await expect(arena.connect(alice).challenge(1, 0)).to.emit(arena, 'PowerSealed');
    await arena.connect(bob).challenge(3, 0);
    for (const id of [1, 3]) {
      const handle = await arena.powerHandle(id);
      expect(await mockPlaintext(handle), `cat ${id}`).to.equal(powerOf(DNAS[id - 1]));
      for (const who of [alice, bob]) {
        const client = await cofheFor(who);
        await expect(client.decryptForView(handle, FheTypes.Uint64).execute()).to.be.rejected;
        await expect(client.decryptForTx(handle).withoutACP().execute()).to.be.rejected;
      }
    }
    expect(await arena.powerHandle(2)).to.equal(ethers.ZeroHash); // not sealed until it plays
  });

  it('works out power from all eight bytes, for any DNA', async () => {
    const { nft, arena, owner } = await loadFixture(fixture);
    const dnas = [0n, 0x0101010101010101n, 0xff00ff00ff00ff00n, 0x00000000ffffffffn, 0x8000000000000001n, 0xfedcba9876543210n];
    await nft.queueDna(dnas);
    await nft.ownerMint(owner.address, dnas.length);
    for (let i = 0; i < dnas.length; i++) {
      const id = 7 + i;
      await nft.enterArena(id);
      await arena.challenge(id, 0);
      expect(await mockPlaintext(await arena.powerHandle(id)), dnas[i].toString(16)).to.equal(powerOf(dnas[i]));
    }
  });

  it('needs the holder to let the arena in first', async () => {
    const { nft, arena, alice, bob } = await loadFixture(fixture);
    await expect(arena.connect(alice).challenge(1, 3)).to.be.revertedWithCustomError(arena, 'NotInArena').withArgs(1);
    await nft.connect(alice).enterArena(1);
    await arena.connect(alice).challenge(1, 3);
    await expect(arena.connect(bob).accept(1, 3)).to.be.revertedWithCustomError(arena, 'NotInArena').withArgs(3);
    await nft.connect(bob).enterArena(3);
    await expect(arena.connect(bob).accept(1, 3)).to.emit(arena, 'DuelFought');
  });

  it('only lets holders play their own cats', async () => {
    const { nft, arena, alice, bob, carol } = await loadFixture(enteredFixture);
    await expect(arena.connect(bob).challenge(1, 3)).to.be.revertedWithCustomError(arena, 'NotHolder').withArgs(1);
    await arena.connect(alice).challenge(1, 3);
    await expect(arena.connect(carol).accept(1, 3)).to.be.revertedWithCustomError(arena, 'NotHolder').withArgs(3);
    await expect(arena.connect(carol).accept(1, 5)).to.be.revertedWithCustomError(arena, 'NotChallenged').withArgs(1, 5);
    await expect(arena.connect(bob).cancel(1)).to.be.revertedWithCustomError(arena, 'NotHolder').withArgs(1);
    await expect(arena.connect(alice).challenge(1, 1)).to.be.revertedWithCustomError(arena, 'SameCat');
    await expect(arena.connect(alice).challenge(1, 99)).to.be.revertedWithCustomError(nft, 'ERC721NonexistentToken');
  });

  it('fights a duel blind and makes only the winner public', async () => {
    const { nft, arena, alice, bob } = await loadFixture(enteredFixture);
    await expect(arena.connect(alice).challenge(1, 3)).to.emit(arena, 'DuelOpened').withArgs(1, 1, 3);
    await expect(arena.connect(bob).accept(1, 3)).to.emit(arena, 'DuelFought');
    const duel = await arena.duels(1);
    expect(duel.status).to.equal(2n); // Fought

    const { value, signature } = await publicResult(duel.challengerWins);
    expect(value).to.equal(true); // 2040 > 1199
    await expect(arena.connect(bob).settle(1, value, signature)).to.emit(arena, 'DuelSettled').withArgs(1, 1, 3);
    expect((await arena.duels(1)).winner).to.equal(1n);
    expect((await arena.records(1)).wins).to.equal(1n);
    expect((await arena.records(3)).losses).to.equal(1n);

    // Neither cat was opened: their DNA is as sealed as before.
    expect(await nft.stateOf(1)).to.equal(State.Unopened);
    expect(await nft.stateOf(3)).to.equal(State.Unopened);
    const [, , , , onlooker] = await ethers.getSigners();
    const client = await cofheFor(onlooker);
    for (const id of [1, 3]) {
      await expect(client.decryptForTx((await nft.catOf(id)).dnaHandle).withoutACP().execute()).to.be.rejected;
      await expect(client.decryptForTx(await arena.powerHandle(id)).withoutACP().execute()).to.be.rejected;
    }
  });

  it('gives the weaker challenger the loss, and ties to the defender', async () => {
    const { arena, alice, bob, carol } = await loadFixture(enteredFixture);
    const weak = await fight(arena, { id: 3, who: bob }, { id: 2, who: alice }); // 1199 vs 1200
    const tie = await fight(arena, { id: 5, who: carol }, { id: 4, who: bob }); // 3 vs 3
    for (const [{ duelId, handle }, loser, winner] of [
      [weak, 3n, 2n],
      [tie, 5n, 4n],
    ] as const) {
      const { value, signature } = await publicResult(handle);
      expect(value).to.equal(false);
      await expect(arena.settle(duelId, value, signature))
        .to.emit(arena, 'DuelSettled')
        .withArgs(duelId, winner, loser);
    }
  });

  it('lets any other cat take an open challenge', async () => {
    const { arena, alice, bob } = await loadFixture(enteredFixture);
    await arena.connect(alice).challenge(2, 0);
    await expect(arena.connect(alice).accept(1, 2)).to.be.revertedWithCustomError(arena, 'SameCat');
    await expect(arena.connect(alice).accept(1, 1)).to.emit(arena, 'DuelFought').withArgs(1, 2, 1, anyHandle);
    expect((await arena.duels(1)).opponent).to.equal(1n);
    await expect(arena.connect(bob).accept(1, 3)).to.be.revertedWithCustomError(arena, 'DuelNotOpen').withArgs(1);
  });

  it('settles only with the right answer and its proof, once', async () => {
    const { arena, alice, bob, carol } = await loadFixture(enteredFixture);
    const a = await fight(arena, { id: 1, who: alice }, { id: 3, who: bob });
    const b = await fight(arena, { id: 5, who: carol }, { id: 4, who: bob });
    const ra = await publicResult(a.handle);
    const rb = await publicResult(b.handle);
    await expect(arena.settle(a.duelId, !ra.value, ra.signature)).to.be.revertedWithCustomError(arena, 'InvalidDecryptionProof');
    await expect(arena.settle(a.duelId, rb.value, rb.signature)).to.be.revertedWithCustomError(arena, 'InvalidDecryptionProof');
    await arena.settle(a.duelId, ra.value, ra.signature);
    await expect(arena.settle(a.duelId, ra.value, ra.signature))
      .to.be.revertedWithCustomError(arena, 'DuelNotFought')
      .withArgs(a.duelId);
    await expect(arena.settle(99, true, ra.signature)).to.be.revertedWithCustomError(arena, 'DuelNotFought');
  });

  it('cancels only open duels, by the challenging cat’s holder', async () => {
    const { nft, arena, alice, bob } = await loadFixture(enteredFixture);
    await arena.connect(alice).challenge(1, 0);
    await nft.connect(alice).transferFrom(alice.address, bob.address, 1);
    await expect(arena.connect(alice).cancel(1)).to.be.revertedWithCustomError(arena, 'NotHolder').withArgs(1);
    await expect(arena.connect(bob).cancel(1)).to.emit(arena, 'DuelCancelled').withArgs(1);
    await expect(arena.connect(bob).accept(1, 3)).to.be.revertedWithCustomError(arena, 'DuelNotOpen');
    await expect(arena.connect(bob).cancel(1)).to.be.revertedWithCustomError(arena, 'DuelNotOpen');
  });

  it('proves a tier without revealing the cat', async () => {
    const { nft, arena, alice, bob } = await loadFixture(enteredFixture);
    expect(await arena.tierThreshold(1)).to.equal(RARE);
    expect(await arena.tierThreshold(2)).to.equal(EPIC);

    // #2 has exactly 1200: Rare, not Epic.
    await expect(arena.connect(alice).claimTier(2, 1)).to.emit(arena, 'TierClaimed');
    await arena.connect(alice).claimTier(2, 2);
    // #3 has 1199: not Rare.
    await arena.connect(bob).claimTier(3, 1);
    const expected = [true, false, false];
    for (let id = 1; id <= 3; id++) {
      const claim = await arena.claims(id);
      const { value, signature } = await publicResult(claim.reached);
      expect(value, `claim ${id}`).to.equal(expected[id - 1]);
      await expect(arena.settleTier(id, value, signature))
        .to.emit(arena, 'TierSettled')
        .withArgs(id, claim.tokenId, claim.tier, value);
    }
    expect((await arena.records(2)).tier).to.equal(1n); // the failed Epic claim does not lower or raise it
    expect((await arena.records(3)).tier).to.equal(0n);
    expect(await nft.stateOf(2)).to.equal(State.Unopened);

    const mythic = await (async () => {
      await arena.connect(alice).claimTier(1, 4);
      return publicResult((await arena.claims(4)).reached);
    })();
    await arena.settleTier(4, mythic.value, mythic.signature);
    expect((await arena.records(1)).tier).to.equal(4n);
  });

  it('guards tier claims', async () => {
    const { arena, alice, bob } = await loadFixture(enteredFixture);
    await expect(arena.connect(alice).claimTier(1, 0)).to.be.revertedWithCustomError(arena, 'InvalidTier').withArgs(0);
    await expect(arena.connect(alice).claimTier(1, 5)).to.be.revertedWithCustomError(arena, 'InvalidTier').withArgs(5);
    await expect(arena.connect(bob).claimTier(1, 1)).to.be.revertedWithCustomError(arena, 'NotHolder').withArgs(1);
    await arena.connect(alice).claimTier(1, 1);
    const { value, signature } = await publicResult((await arena.claims(1)).reached);
    await expect(arena.settleTier(1, !value, signature)).to.be.revertedWithCustomError(arena, 'InvalidDecryptionProof');
    await expect(arena.settleTier(2, value, signature)).to.be.revertedWithCustomError(arena, 'UnknownClaim').withArgs(2);
    await arena.settleTier(1, value, signature);
    await expect(arena.settleTier(1, value, signature)).to.be.revertedWithCustomError(arena, 'AlreadySettled').withArgs(1);
  });
});

/** Matches any bytes32 handle in `.withArgs`. */
function anyHandle(value: unknown): boolean {
  return typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value);
}
