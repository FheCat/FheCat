import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { Encryptable, FheTypes } from '@cofhe/sdk';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { duelOutcome, instinctsOf, INSTINCT_FROM, instinctFromOption } from '../../art';
import { State, cofheFor, mockPlaintext } from './helpers';
import type { FheCatArenaFixedLuck, FheCatFixedDna, FheCatRenderer } from '../typechain-types';

const POUNCE = 0;
const TRICK = 1;
const GUARD = 2;
const WEEK = 7 * 24 * 3600;
const [FIRST_WIN, SEALED_WIN, HAT_TRICK, SEALED_LEGEND, WEEKLY_CROWN] = [1n, 2n, 4n, 8n, 16n];

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
    dna |= BigInt(b) << BigInt(8 * i);
  }
  return dna;
}

/** A DNA with the given bytes (index = trait). */
function dnaOf(bytes: Partial<Record<number, number>>): bigint {
  let dna = 0n;
  for (const [i, b] of Object.entries(bytes)) dna |= BigInt(b!) << BigInt(8 * Number(i));
  return dna;
}

describe('FheCatArena (Blind Arena)', () => {
  // Cats 1..6 by holder: alice 1, 2; bob 3, 4; carol 5, 6.
  const DNAS = [
    0xffffffffffffffffn, // 1: every instinct 2, power 2040
    0n, //                  2: every instinct 0
    dnaOf({ 2: 255, 3: 255 }), // 3: Pounce 2 only
    dnaOf({ 6: 200, 7: 200 }), // 4: Guard 2 only
    dnaWithPower(1200), //  5: exactly Rare
    dnaWithPower(1199), //  6: one short of Rare
  ];

  async function fixture() {
    const [owner, alice, bob, carol, dave] = await ethers.getSigners();
    const renderer = (await ethers.deployContract('FheCatRenderer')) as unknown as FheCatRenderer;
    const nft = (await ethers.deployContract('FheCatFixedDna', [await renderer.getAddress()])) as unknown as FheCatFixedDna;
    const arena = (await ethers.deployContract('FheCatArenaFixedLuck', [await nft.getAddress()])) as unknown as FheCatArenaFixedLuck;
    await nft.setArena(await arena.getAddress());
    await nft.queueDna(DNAS);
    await nft.ownerMint(alice.address, 2);
    await nft.ownerMint(bob.address, 2);
    await nft.ownerMint(carol.address, 2);
    const holders = [alice, alice, bob, bob, carol, carol];
    return { nft, arena, owner, alice, bob, carol, dave, holders };
  }

  /** Every cat enters the arena. */
  async function enteredFixture() {
    const f = await fixture();
    for (let id = 1; id <= 6; id++) await f.nft.connect(f.holders[id - 1]).enterArena(id);
    return f;
  }

  /** A tactic encrypted in `who`'s client for the arena, as the mint site does it. */
  async function lock(arena: FheCatArenaFixedLuck, who: HardhatEthersSigner, tactic: number) {
    const client = await cofheFor(who);
    const [hash, proof] = await client
      .encryptInputs([Encryptable.uint8(BigInt(tactic))])
      .setConsumingContract(await arena.getAddress())
      .execute();
    return [hash, proof] as const;
  }

  async function challenge(arena: FheCatArenaFixedLuck, who: HardhatEthersSigner, id: number, opponent: number, tactic: number) {
    const [hash, proof] = await lock(arena, who, tactic);
    await arena.connect(who).challenge(id, opponent, hash, proof);
    return arena.duelCount();
  }

  async function accept(arena: FheCatArenaFixedLuck, who: HardhatEthersSigner, duelId: bigint, id: number, tactic: number) {
    const [hash, proof] = await lock(arena, who, tactic);
    return arena.connect(who).accept(duelId, id, hash, proof);
  }

  /** Decrypts a fought duel's public outcome like any onlooker would. */
  async function outcomeOf(arena: FheCatArenaFixedLuck, duelId: bigint) {
    const [, , , , , onlooker] = await ethers.getSigners();
    const { decryptedValue, signature } = await (await cofheFor(onlooker))
      .decryptForTx((await arena.duels(duelId)).outcome)
      .withoutACP()
      .execute();
    return { value: Number(decryptedValue), signature };
  }

  async function settle(arena: FheCatArenaFixedLuck, duelId: bigint) {
    const { value, signature } = await outcomeOf(arena, duelId);
    await arena.settle(duelId, value, signature);
    return value;
  }

  it('works out each cat’s instincts like the published rules, for any DNA', async () => {
    const { nft, arena, owner, alice } = await loadFixture(enteredFixture);
    // Thresholds sit on option boundaries; check the edges and some random DNAs.
    const edges = INSTINCT_FROM.slice(2).flatMap((from, k) => [dnaOf({ [k + 2]: from }), dnaOf({ [k + 2]: from - 1 })]);
    const random = Array.from({ length: 6 }, () => BigInt.asUintN(64, BigInt(ethers.hexlify(ethers.randomBytes(8)))));
    const dnas = [...edges, ...random];
    await nft.queueDna(dnas);
    for (let left = dnas.length; left > 0; left -= 10) await nft.ownerMint(owner.address, Math.min(left, 10));
    for (let i = 0; i < dnas.length; i++) {
      const id = 7 + i;
      await nft.enterArena(id);
      const [hash, proof] = await lock(arena, owner, POUNCE);
      await arena.challenge(id, 0, hash, proof);
      await arena.cancel(await arena.duelCount());
      const pack = await mockPlaintext(await arena.instinctsHandle(id));
      const lanes = [1, 2, 3].map((l) => Number((pack >> BigInt(16 * l)) & 0xffffn));
      expect(lanes, dnas[i].toString(16)).to.deep.equal(instinctsOf(dnas[i]));
      expect(pack & 0xffffn).to.equal(0n);
    }
    expect([2, 3, 4, 5, 6, 7].map(instinctFromOption)).to.deep.equal(['Spots', 'Sleepy', 'Fang', 'Bow', 'Bandana', 'Sparkles']);
    // A cat's instincts are nobody's to decrypt, its holder's included.
    await expect((await cofheFor(alice)).decryptForView(await arena.instinctsHandle(1), FheTypes.Uint64).execute()).to.be.rejected;
  });

  it('scores every tactic pair, luck and tie like the published rules', async () => {
    const { nft, arena, alice, bob } = await loadFixture(enteredFixture);
    await nft.connect(bob).peek(4); // #4 is no longer a sealed box
    const cases: [number, number, number, bigint][] = [];
    for (const [ca, cb] of [
      [1, 3], // instincts 2/2/2 vs Pounce 2
      [2, 4], // 0/0/0 vs Guard 2 (peeked)
      [1, 4], // sealed vs peeked
    ])
      for (let ta = 0; ta < 3; ta++) for (let tb = 0; tb < 3; tb++) cases.push([ca, cb, ta * 3 + tb, BigInt((ta + tb) % 8)]);
    for (const [ca, cb, combo, luck] of cases) {
      const ta = Math.floor(combo / 3);
      const tb = combo % 3;
      await arena.queueLuck([luck]);
      const duelId = await challenge(arena, alice, ca, cb, ta);
      await accept(arena, bob, duelId, cb, tb);
      const { value } = await outcomeOf(arena, duelId);
      const expected = duelOutcome({
        challengerDna: DNAS[ca - 1],
        opponentDna: DNAS[cb - 1],
        challengerTactic: ta,
        opponentTactic: tb,
        luck,
        challengerSealed: true,
        opponentSealed: cb !== 4,
      });
      expect(value, `#${ca} ${ta} vs #${cb} ${tb}, luck ${luck}`).to.equal(expected);
      await time.increase(WEEK); // the same pair may meet again next week
    }
  });

  it('lets the tactic decide, then instincts, luck, the sealed box and a coin', async () => {
    const { nft, arena, alice, bob, carol } = await loadFixture(enteredFixture);
    // #5 and #6 (carol) have instincts Pounce 2, Trick 2, Guard 1; #2 (alice) has none.
    const fight = async (luck: bigint, a: [HardhatEthersSigner, number, number], b: [HardhatEthersSigner, number, number]) => {
      await arena.queueLuck([luck]);
      const d = await challenge(arena, a[0], a[1], b[1], a[2]);
      await accept(arena, b[0], d, b[1], b[2]);
      return (await outcomeOf(arena, d)).value;
    };
    // The tactic: Trick beats Guard, 2 + 2 vs 0 + 0.
    expect(await fight(0n, [alice, 1, TRICK], [bob, 3, GUARD])).to.equal(1);
    // Instincts and luck can turn it: Pounce beats Trick (2 + 0 + 0), but Trick 2 + luck 1 = 3.
    expect(await fight(0b010n, [alice, 2, POUNCE], [carol, 5, TRICK])).to.equal(2);
    // A tie (2 vs 2) goes to the sealed box: #6 has been peeked, #2 has not.
    await nft.connect(carol).peek(6);
    expect(await fight(0n, [alice, 2, POUNCE], [carol, 6, TRICK])).to.equal(1);
    // Between two sealed boxes, the coin (bit 2) decides.
    await time.increase(WEEK);
    expect(await fight(0b100n, [alice, 2, POUNCE], [carol, 5, TRICK])).to.equal(2);
    await time.increase(WEEK);
    expect(await fight(0n, [alice, 2, POUNCE], [carol, 5, TRICK])).to.equal(1);
  });

  it('keeps everything sealed but the winner: tactics only to the two holders', async () => {
    const { nft, arena, alice, bob, carol } = await loadFixture(enteredFixture);
    const duelId = await challenge(arena, alice, 1, 3, TRICK);
    await expect(accept(arena, bob, duelId, 3, GUARD)).to.emit(arena, 'DuelFought');
    const duel = await arena.duels(duelId);
    expect(duel.status).to.equal(2n); // Fought
    expect(duel.challengerSealed && duel.opponentSealed).to.equal(true);

    const [aliceC, bobC, carolC] = await Promise.all([cofheFor(alice), cofheFor(bob), cofheFor(carol)]);
    expect(await aliceC.decryptForView(duel.challengerTactic, FheTypes.Uint8).execute()).to.equal(BigInt(TRICK));
    expect(await aliceC.decryptForView(duel.opponentTactic, FheTypes.Uint8).execute()).to.equal(BigInt(GUARD));
    expect(await bobC.decryptForView(duel.challengerTactic, FheTypes.Uint8).execute()).to.equal(BigInt(TRICK));
    await expect(carolC.decryptForView(duel.challengerTactic, FheTypes.Uint8).execute()).to.be.rejected;
    await expect(carolC.decryptForTx(duel.opponentTactic).withoutACP().execute()).to.be.rejected;
    for (const id of [1, 3]) {
      await expect(carolC.decryptForTx((await nft.catOf(id)).dnaHandle).withoutACP().execute()).to.be.rejected;
      await expect(carolC.decryptForTx(await arena.instinctsHandle(id)).withoutACP().execute()).to.be.rejected;
      expect(await nft.stateOf(id)).to.equal(State.Unopened);
    }
    // Trick beats Guard; #1 has Trick 2: 2 + 2 + luck vs 0 + 0 + luck.
    expect((await outcomeOf(arena, duelId)).value).to.equal(1);
  });

  it('settles once, with the right outcome and its proof', async () => {
    const { arena, alice, bob, carol } = await loadFixture(enteredFixture);
    const a = await challenge(arena, alice, 1, 3, POUNCE);
    await accept(arena, bob, a, 3, POUNCE);
    const b = await challenge(arena, carol, 5, 4, POUNCE);
    await accept(arena, bob, b, 4, GUARD);
    const ra = await outcomeOf(arena, a);
    const rb = await outcomeOf(arena, b);
    await expect(arena.settle(a, 3 - ra.value, ra.signature)).to.be.revertedWithCustomError(arena, 'InvalidDecryptionProof');
    await expect(arena.settle(a, rb.value, rb.signature)).to.be.revertedWithCustomError(arena, 'InvalidDecryptionProof');
    await expect(arena.settle(a, ra.value, ra.signature)).to.emit(arena, 'DuelSettled');
    await expect(arena.settle(a, ra.value, ra.signature)).to.be.revertedWithCustomError(arena, 'DuelNotFought').withArgs(a);
    await expect(arena.settle(99, 1, ra.signature)).to.be.revertedWithCustomError(arena, 'DuelNotFought');
  });

  it('scores the week: 4 for a sealed win, 3 for a peeked one, 1 for a loss', async () => {
    const { nft, arena, alice, bob, carol } = await loadFixture(enteredFixture);
    const week = await arena.currentWeek();
    // #1 (all instincts 2) with Trick beats #3's Guard: sealed win.
    let d = await challenge(arena, alice, 1, 3, TRICK);
    await accept(arena, bob, d, 3, GUARD);
    await expect(arena.settle(d, ...Object.values(await outcomeOf(arena, d)) as [number, string]))
      .to.emit(arena, 'DuelSettled')
      .withArgs(d, 1, 3, week, true);
    expect(await arena.weeklyPoints(week, 1)).to.equal(4n);
    expect(await arena.weeklyPoints(week, 3)).to.equal(1n);
    let r1 = await arena.records(1);
    expect([r1.wins, r1.sealedWins, r1.streak, r1.badges]).to.deep.equal([1n, 1n, 1n, FIRST_WIN | SEALED_WIN]);
    expect((await arena.records(3)).losses).to.equal(1n);

    // Peeked, #5 beats #6 with Pounce over Trick: 3 points and no sealed badge.
    await nft.connect(carol).peek(5);
    d = await challenge(arena, carol, 5, 2, POUNCE);
    await accept(arena, alice, d, 2, TRICK);
    expect(await settle(arena, d)).to.equal(1);
    expect(await arena.weeklyPoints(week, 5)).to.equal(3n);
    const r5 = await arena.records(5);
    expect([r5.wins, r5.sealedWins, r5.badges]).to.deep.equal([1n, 0n, FIRST_WIN]);
    expect(await arena.weeklyLeader(week)).to.equal(1n);
  });

  it('hands out badges that stay with the cat: hat-trick and sealed legend', async () => {
    const { nft, arena, owner, alice } = await loadFixture(enteredFixture);
    // Five fresh opponents (all instincts 0) for #1, held by owner.
    await nft.queueDna([0n, 0n, 0n, 0n, 0n]);
    await nft.ownerMint(owner.address, 5);
    for (let id = 7; id <= 11; id++) await nft.enterArena(id);
    for (let id = 7; id <= 11; id++) {
      const d = await challenge(arena, alice, 1, id, GUARD);
      await accept(arena, owner, d, id, POUNCE); // Guard beats Pounce
      expect(await settle(arena, d)).to.equal(1);
    }
    const r = await arena.records(1);
    expect([r.wins, r.sealedWins, r.streak, r.bestStreak]).to.deep.equal([5n, 5n, 5n, 5n]);
    expect(r.badges).to.equal(FIRST_WIN | SEALED_WIN | HAT_TRICK | SEALED_LEGEND);
    // A loss resets the streak, not the best one or the badges.
    await nft.queueDna([0xffffffffffffffffn]);
    await nft.ownerMint(owner.address, 1);
    await nft.enterArena(12);
    const d = await challenge(arena, alice, 1, 12, POUNCE);
    await accept(arena, owner, d, 12, GUARD);
    expect(await settle(arena, d)).to.equal(2);
    const after = await arena.records(1);
    expect([after.streak, after.bestStreak, after.badges]).to.deep.equal([0n, 5n, r.badges]);
    // The badges follow the cat to its next holder.
    await nft.connect(alice).transferFrom(alice.address, owner.address, 1);
    expect((await arena.records(1)).badges).to.equal(r.badges);
  });

  it('lets two cats meet once a week, and a cat hold one open challenge', async () => {
    const { arena, alice, bob } = await loadFixture(enteredFixture);
    const d = await challenge(arena, alice, 1, 3, POUNCE);
    const [h, p] = await lock(arena, alice, TRICK);
    await expect(arena.connect(alice).challenge(1, 4, h, p)).to.be.revertedWithCustomError(arena, 'AlreadyChallenging').withArgs(d);
    await accept(arena, bob, d, 3, GUARD);
    const [h2, p2] = await lock(arena, alice, TRICK);
    await expect(arena.connect(alice).challenge(1, 3, h2, p2)).to.be.revertedWithCustomError(arena, 'AlreadyMetThisWeek');
    // An open challenge can't be used to dodge the limit either.
    const open = await challenge(arena, alice, 1, 0, POUNCE);
    const [h3, p3] = await lock(arena, bob, POUNCE);
    await expect(arena.connect(bob).accept(open, 3, h3, p3)).to.be.revertedWithCustomError(arena, 'AlreadyMetThisWeek');
    await accept(arena, bob, open, 4, POUNCE); // another cat may
    await time.increase(WEEK);
    const again = await challenge(arena, alice, 1, 3, POUNCE);
    await expect(accept(arena, bob, again, 3, TRICK)).to.emit(arena, 'DuelFought');
  });

  it('guards challenges and accepts', async () => {
    const { nft, arena, alice, bob, carol } = await loadFixture(fixture);
    const [h, p] = await lock(arena, alice, POUNCE);
    await expect(arena.connect(alice).challenge(1, 3, h, p)).to.be.revertedWithCustomError(arena, 'NotInArena').withArgs(1);
    for (let id = 1; id <= 6; id++) await nft.connect([alice, alice, bob, bob, carol, carol][id - 1]).enterArena(id);
    const [h1, p1] = await lock(arena, bob, POUNCE);
    await expect(arena.connect(bob).challenge(1, 3, h1, p1)).to.be.revertedWithCustomError(arena, 'NotHolder').withArgs(1);
    const [h2, p2] = await lock(arena, alice, POUNCE);
    await expect(arena.connect(alice).challenge(1, 1, h2, p2)).to.be.revertedWithCustomError(arena, 'SameCat');
    await expect(arena.connect(alice).challenge(1, 2, h2, p2)).to.be.revertedWithCustomError(arena, 'SameHolder');
    await expect(arena.connect(alice).challenge(1, 99, h2, p2)).to.be.revertedWithCustomError(nft, 'ERC721NonexistentToken');
    // A tactic encrypted for someone else can't be replayed.
    await expect(arena.connect(alice).challenge(1, 3, h1, p1)).to.be.reverted;

    const d = await challenge(arena, alice, 1, 3, POUNCE);
    const [hb, pb] = await lock(arena, bob, POUNCE);
    await expect(arena.connect(bob).accept(d, 4, hb, pb)).to.be.revertedWithCustomError(arena, 'NotChallenged').withArgs(d, 4);
    const [hc, pc] = await lock(arena, carol, POUNCE);
    await expect(arena.connect(carol).accept(d, 3, hc, pc)).to.be.revertedWithCustomError(arena, 'NotHolder').withArgs(3);
    await expect(arena.connect(bob).cancel(d)).to.be.revertedWithCustomError(arena, 'NotHolder').withArgs(1);

    // The same wallet can't take its own open challenge with another cat.
    const open = await challenge(arena, alice, 2, 0, POUNCE);
    const [ha, pa] = await lock(arena, alice, POUNCE);
    await expect(arena.connect(alice).accept(open, 1, ha, pa)).to.be.revertedWithCustomError(arena, 'SameHolder');
    await expect(arena.connect(alice).accept(open, 2, ha, pa)).to.be.revertedWithCustomError(arena, 'SameCat');

    // A challenger that changed hands voids the challenge; its new holder can withdraw it.
    await nft.connect(alice).transferFrom(alice.address, carol.address, 2);
    const [hb2, pb2] = await lock(arena, bob, POUNCE);
    await expect(arena.connect(bob).accept(open, 3, hb2, pb2)).to.be.revertedWithCustomError(arena, 'ChallengerMoved').withArgs(open);
    await expect(arena.connect(carol).cancel(open)).to.emit(arena, 'DuelCancelled').withArgs(open);
    await expect(arena.connect(carol).cancel(open)).to.be.revertedWithCustomError(arena, 'DuelNotOpen');

    // Challenges expire after three days.
    await time.increase(3 * 24 * 3600 + 1);
    expect(await arena.isOpen(d)).to.equal(false);
    await expect(arena.connect(bob).accept(d, 3, hb2, pb2)).to.be.revertedWithCustomError(arena, 'DuelExpired').withArgs(d);
    const fresh = await challenge(arena, alice, 1, 4, TRICK); // the expired one no longer blocks a new one
    expect(await arena.openDuelOf(1)).to.equal(fresh);
  });

  it('counts an out-of-range tactic as Pounce', async () => {
    const { arena, alice, bob } = await loadFixture(enteredFixture);
    await arena.queueLuck([0n]);
    const d = await challenge(arena, alice, 2, 4, 7); // #2 (0/0/0), "7" = Pounce
    await accept(arena, bob, d, 4, TRICK); // Pounce beats Trick: 2 vs 0
    expect((await outcomeOf(arena, d)).value).to.equal(1);
  });

  it('crowns the week’s top cat once the week is over', async () => {
    const { arena, alice, bob, carol } = await loadFixture(enteredFixture);
    const week = await arena.currentWeek();
    await expect(arena.crownWeek(week)).to.be.revertedWithCustomError(arena, 'WeekNotOver').withArgs(week);
    let d = await challenge(arena, carol, 5, 3, GUARD);
    await accept(arena, bob, d, 3, POUNCE);
    await settle(arena, d); // #5 wins sealed: 4
    d = await challenge(arena, alice, 1, 4, TRICK);
    await accept(arena, bob, d, 4, GUARD);
    await settle(arena, d); // #1 wins sealed: 4, ties #5 but came second
    expect(await arena.weeklyLeader(week)).to.equal(5n);
    const [recs, points] = await arena.standings(week, 1, 6);
    expect(points.map(Number)).to.deep.equal([4, 0, 1, 1, 4, 0]);
    expect(recs[0].wins).to.equal(1n);

    // Next week, after the grace day, the first settled duel crowns last week's leader.
    await time.increaseTo(Number(await arena.weekStart(week + 1n)) + 24 * 3600 + 5);
    d = await challenge(arena, alice, 1, 6, TRICK);
    await accept(arena, carol, d, 6, GUARD);
    const { value, signature } = await outcomeOf(arena, d);
    await expect(arena.settle(d, value, signature)).to.emit(arena, 'WeekCrowned').withArgs(week, 5, 4);
    expect(await arena.weeklyChampion(week)).to.equal(5n);
    expect((await arena.records(5)).badges & WEEKLY_CROWN).to.equal(WEEKLY_CROWN);
    await expect(arena.crownWeek(week)).to.be.revertedWithCustomError(arena, 'AlreadyCrowned').withArgs(week);
    await expect(arena.crownWeek(week - 5n)).to.be.revertedWithCustomError(arena, 'NoLeader');
  });

  it('lists duels for the site', async () => {
    const { arena, alice, bob } = await loadFixture(enteredFixture);
    const a = await challenge(arena, alice, 1, 0, POUNCE);
    const b = await challenge(arena, bob, 3, 1, GUARD);
    const list = await arena.duelsInRange(0, 99);
    expect(list.map((d) => [d.challenger, d.opponent, d.status])).to.deep.equal([
      [1n, 0n, 1n],
      [3n, 1n, 1n],
    ]);
    expect([await arena.isOpen(a), await arena.isOpen(b)]).to.deep.equal([true, true]);
  });

  it('proves a tier without revealing the cat', async () => {
    const { nft, arena, alice, carol } = await loadFixture(enteredFixture);
    const claim = async (who: HardhatEthersSigner, id: number, tier: number) => {
      await arena.connect(who).claimTier(id, tier);
      const c = await arena.claims(await arena.claimCount());
      const [, , , , , onlooker] = await ethers.getSigners();
      const { decryptedValue, signature } = await (await cofheFor(onlooker)).decryptForTx(c.reached).withoutACP().execute();
      return { id: await arena.claimCount(), value: decryptedValue === 1n, signature, c };
    };
    const yes = await claim(carol, 5, 1); // exactly 1200
    const no = await claim(carol, 6, 1); // 1199
    expect([yes.value, no.value]).to.deep.equal([true, false]);
    await expect(arena.settleTier(yes.id, !yes.value, yes.signature)).to.be.revertedWithCustomError(arena, 'InvalidDecryptionProof');
    await expect(arena.settleTier(yes.id, yes.value, yes.signature)).to.emit(arena, 'TierSettled').withArgs(yes.id, 5, 1, true);
    await expect(arena.settleTier(yes.id, yes.value, yes.signature)).to.be.revertedWithCustomError(arena, 'AlreadySettled');
    await arena.settleTier(no.id, no.value, no.signature);
    expect((await arena.records(5)).tier).to.equal(1n);
    expect((await arena.records(6)).tier).to.equal(0n);
    expect(await mockPlaintext(await arena.powerHandle(5))).to.equal(powerOf(DNAS[4]));
    const mythic = await claim(alice, 1, 4);
    await arena.settleTier(mythic.id, mythic.value, mythic.signature);
    expect((await arena.records(1)).tier).to.equal(4n);
    expect(await nft.stateOf(5)).to.equal(State.Unopened);
    await expect(arena.connect(alice).claimTier(1, 0)).to.be.revertedWithCustomError(arena, 'InvalidTier').withArgs(0);
    await expect(arena.connect(alice).claimTier(5, 1)).to.be.revertedWithCustomError(arena, 'NotHolder').withArgs(5);
    await expect(arena.settleTier(99, true, mythic.signature)).to.be.revertedWithCustomError(arena, 'UnknownClaim').withArgs(99);
  });
});
