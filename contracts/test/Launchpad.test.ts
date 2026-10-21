import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { Encryptable, FheTypes } from '@cofhe/sdk';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { cofheFor, deployFixture, mintPublic, mockPlaintext } from './helpers';
import type { FheCatRewards, FheLaunchToken, FheLaunchpad, MockPriceFeed } from '../typechain-types';

const ETH_USD = 2500_00000000n; // $2,500 with 8 decimals
const ONE_DOLLAR = (10n ** 26n + ETH_USD - 1n) / ETH_USD; // wei, rounded up
const HOUR = 3600n;
const E = (n: string) => ethers.parseEther(n);
const T = (n: bigint) => n * 10n ** 6n; // whole tokens -> base units

describe('Launchpad', () => {
  async function fixture() {
    const base = await deployFixture();
    const [, , , , , platform, creator, dave, erin] = await ethers.getSigners();
    const feed = (await ethers.deployContract('MockPriceFeed', [ETH_USD])) as unknown as MockPriceFeed;
    const rewards = (await ethers.deployContract('FheCatRewards', [await base.nft.getAddress()])) as unknown as FheCatRewards;
    const pad = (await ethers.deployContract('FheLaunchpad', [
      base.owner.address,
      platform.address,
      await rewards.getAddress(),
      await feed.getAddress(),
    ])) as unknown as FheLaunchpad;
    return { ...base, platform, creator, dave, erin, feed, rewards, pad };
  }

  type F = Awaited<ReturnType<typeof fixture>>;

  const params = (o: Partial<Parameters<FheLaunchpad['createLaunch']>[0]> = {}) => ({
    name: 'Cipher Coin',
    symbol: 'CIPH',
    supplyTokens: 1_000_000n,
    saleBps: 6_000n,
    softCap: E('1'),
    hardCap: E('10'),
    maxPerWallet: 0n,
    duration: 24n * HOUR,
    info: 'https://x.com/ciphercoin',
    ...o,
  });

  async function launch(f: F, o = {}) {
    await f.pad.connect(f.creator).createLaunch(params(o), { value: ONE_DOLLAR });
    const id = (await f.pad.launchCount()) - 1n;
    const token = (await ethers.getContractAt('FheLaunchToken', (await f.pad.getLaunch(id)).token)) as unknown as FheLaunchToken;
    return { id, token };
  }

  async function encrypted(token: FheLaunchToken, who: HardhatEthersSigner, amount: bigint) {
    const [ctHash, signature] = await (await cofheFor(who))
      .encryptInputs([Encryptable.uint64(amount)])
      .setConsumingContract(await token.getAddress())
      .execute();
    return { ctHash, signature };
  }

  async function shieldedOf(token: FheLaunchToken, who: HardhatEthersSigner) {
    const handle = await token.shieldedBalanceOf(who.address);
    if (BigInt(handle) === 0n) return 0n;
    return (await cofheFor(who)).decryptForView(handle, FheTypes.Uint64).execute();
  }

  describe('launch fee', () => {
    it('is $1 in ETH at the feed price and goes to the treasury', async () => {
      const f = await loadFixture(fixture);
      expect(await f.pad.launchFeeWei()).to.equal(ONE_DOLLAR);
      await expect(f.pad.connect(f.creator).createLaunch(params(), { value: ONE_DOLLAR })).to.changeEtherBalances(
        [f.creator, f.platform],
        [-ONE_DOLLAR, ONE_DOLLAR],
      );
    });

    it('sends back anything above the fee and refuses less', async () => {
      const f = await loadFixture(fixture);
      await expect(f.pad.connect(f.creator).createLaunch(params(), { value: E('1') })).to.changeEtherBalance(f.creator, -ONE_DOLLAR);
      await expect(f.pad.connect(f.creator).createLaunch(params(), { value: ONE_DOLLAR - 1n }))
        .to.be.revertedWithCustomError(f.pad, 'LaunchFeeTooLow')
        .withArgs(ONE_DOLLAR);
    });

    it('refuses a stale or broken price', async () => {
      const f = await loadFixture(fixture);
      await f.feed.set(ETH_USD, (await time.latest()) - 2 * 86400);
      await expect(f.pad.launchFeeWei()).to.be.revertedWithCustomError(f.pad, 'StalePrice');
      await f.feed.set(0, await time.latest());
      await expect(f.pad.launchFeeWei()).to.be.revertedWithCustomError(f.pad, 'StalePrice');
    });

    it('mints the whole supply to the launchpad, 6 decimals', async () => {
      const f = await loadFixture(fixture);
      const { token } = await launch(f);
      expect(await token.decimals()).to.equal(6);
      expect(await token.totalSupply()).to.equal(T(1_000_000n));
      expect(await token.balanceOf(await f.pad.getAddress())).to.equal(T(1_000_000n));
    });

    it('checks its parameters', async () => {
      const f = await loadFixture(fixture);
      for (const bad of [{ name: '' }, { supplyTokens: 0n }, { saleBps: 10_001n }, { softCap: E('11') }, { duration: 60n }]) {
        await expect(f.pad.connect(f.creator).createLaunch(params(bad), { value: ONE_DOLLAR })).to.be.revertedWithCustomError(f.pad, 'BadParams');
      }
    });
  });

  describe('sale', () => {
    it('takes ETH up to the hard cap and the wallet limit, sending back the rest', async () => {
      const f = await loadFixture(fixture);
      const { id } = await launch(f, { hardCap: E('3'), maxPerWallet: E('2') });
      await expect(f.pad.connect(f.alice).contribute(id, { value: E('2.5') })).to.changeEtherBalance(f.alice, -E('2'));
      await expect(f.pad.connect(f.bob).contribute(id, { value: E('2') })).to.changeEtherBalance(f.bob, -E('1'));
      await expect(f.pad.connect(f.carol).contribute(id, { value: E('1') })).to.be.revertedWithCustomError(f.pad, 'SaleFull');
      expect((await f.pad.getLaunch(id)).raised).to.equal(E('3'));
    });

    it('closes early once full, not before its time otherwise', async () => {
      const f = await loadFixture(fixture);
      const { id } = await launch(f, { hardCap: E('2') });
      await f.pad.connect(f.alice).contribute(id, { value: E('1') });
      await expect(f.pad.finalize(id)).to.be.revertedWithCustomError(f.pad, 'SaleNotOver');
      await f.pad.connect(f.bob).contribute(id, { value: E('1') });
      await expect(f.pad.finalize(id)).to.emit(f.pad, 'Finalized');
    });

    it('refuses buys after the end', async () => {
      const f = await loadFixture(fixture);
      const { id } = await launch(f);
      await time.increase(24 * 3600);
      await expect(f.pad.connect(f.alice).contribute(id, { value: E('1') })).to.be.revertedWithCustomError(f.pad, 'SaleOver');
    });
  });

  describe('a successful sale', () => {
    async function succeeded() {
      const f = await loadFixture(fixture);
      // three cats are minted before the sale ends: their holders share the holder part of the fee
      await mintPublic(f.nft, f.alice, 2);
      await mintPublic(f.nft, f.bob, 1);
      const l = await launch(f);
      await f.pad.connect(f.dave).contribute(l.id, { value: E('3') });
      await f.pad.connect(f.erin).contribute(l.id, { value: E('1') });
      await time.increase(24 * 3600);
      return { ...f, ...l };
    }

    it('pays 2% platform fee, half to FheCat holders, the rest to the creator with their tokens', async () => {
      const f = await succeeded();
      const raised = E('4');
      const fee = (raised * 200n) / 10_000n; // 0.08
      const toHolders = fee / 2n;
      await expect(f.pad.finalize(f.id)).to.changeEtherBalances(
        [f.pad, f.rewards, f.platform, f.creator],
        [-raised, toHolders, fee - toHolders, raised - fee],
      );
      expect(await f.token.balanceOf(f.creator.address)).to.equal(T(400_000n));
    });

    it('splits the holders part equally between the cats minted, claimable by whoever holds them', async () => {
      const f = await succeeded();
      await f.pad.finalize(f.id);
      const perCat = E('0.04') / 3n;
      expect(await f.rewards.pending(1)).to.equal(perCat);
      expect(await f.rewards.pending(3)).to.equal(perCat);
      // a cat minted afterwards gets nothing from this sale
      await mintPublic(f.nft, f.carol, 1);
      expect(await f.rewards.pending(4)).to.equal(0);
      await expect(f.rewards.connect(f.bob).claim([1])).to.be.revertedWithCustomError(f.rewards, 'NotHolder');
      // the share follows the cat
      await f.nft.connect(f.alice).transferFrom(f.alice.address, f.carol.address, 2);
      await expect(f.rewards.connect(f.carol).claim([2])).to.changeEtherBalance(f.carol, perCat);
      await expect(f.rewards.connect(f.alice).claim([1])).to.changeEtherBalance(f.alice, perCat);
      await expect(f.rewards.connect(f.alice).claim([1])).to.be.revertedWithCustomError(f.rewards, 'NothingToClaim');
      // the next deposit counts the new cat too
      await f.rewards.deposit({ value: E('0.4') });
      expect(await f.rewards.pending(4)).to.equal(E('0.1'));
      expect(await f.rewards.pending(1)).to.equal(E('0.1'));
      expect(await f.rewards.pending(3)).to.equal(perCat + E('0.1'));
    });

    it('gives each buyer their share of the sale supply, public or shielded', async () => {
      const f = await succeeded();
      await f.pad.finalize(f.id);
      // 600,000 for sale: dave sent 3 of 4 ETH
      await f.pad.connect(f.dave).claim(f.id, false);
      expect(await f.token.balanceOf(f.dave.address)).to.equal(T(450_000n));
      await f.pad.connect(f.erin).claim(f.id, true);
      expect(await f.token.balanceOf(f.erin.address)).to.equal(0);
      expect(await shieldedOf(f.token, f.erin)).to.equal(T(150_000n));
      await expect(f.pad.connect(f.erin).claim(f.id, true)).to.be.revertedWithCustomError(f.pad, 'NothingToClaim');
      // nobody else can read erin's shielded balance
      await expect((await cofheFor(f.dave)).decryptForView(await f.token.shieldedBalanceOf(f.erin.address), FheTypes.Uint64).execute()).to.be.rejected;
    });
  });

  describe('a failed sale', () => {
    it('gives everyone their ETH back and pays no fee', async () => {
      const f = await loadFixture(fixture);
      const { id } = await launch(f, { softCap: E('5') });
      await f.pad.connect(f.alice).contribute(id, { value: E('2') });
      await time.increase(24 * 3600);
      await expect(f.pad.finalize(id)).to.changeEtherBalances([f.rewards, f.platform], [0, 0]);
      await expect(f.pad.connect(f.alice).claim(id, false)).to.be.revertedWithCustomError(f.pad, 'NotSucceeded');
      await expect(f.pad.connect(f.alice).refund(id)).to.changeEtherBalance(f.alice, E('2'));
      await expect(f.pad.connect(f.alice).refund(id)).to.be.revertedWithCustomError(f.pad, 'NothingToClaim');
    });
  });

  describe('dual-mode token', () => {
    async function holding() {
      const f = await loadFixture(fixture);
      const l = await launch(f, { softCap: 0n, hardCap: E('1') });
      await f.pad.connect(f.dave).contribute(l.id, { value: E('1') });
      await f.pad.finalize(l.id);
      await f.pad.connect(f.dave).claim(l.id, false); // 600,000 public
      return { ...f, ...l };
    }

    it('shields, sends privately and keeps amounts encrypted', async () => {
      const f = await holding();
      await f.token.connect(f.dave).shield(T(100_000n));
      expect(await f.token.balanceOf(f.dave.address)).to.equal(T(500_000n));
      expect(await shieldedOf(f.token, f.dave)).to.equal(T(100_000n));

      const amt = await encrypted(f.token, f.dave, T(30_000n));
      await f.token.connect(f.dave).transferShielded(f.erin.address, amt.ctHash, amt.signature);
      expect(await shieldedOf(f.token, f.dave)).to.equal(T(70_000n));
      expect(await shieldedOf(f.token, f.erin)).to.equal(T(30_000n));
    });

    it('moves nothing when a shielded transfer asks for more than the balance', async () => {
      const f = await holding();
      await f.token.connect(f.dave).shield(T(10n));
      const amt = await encrypted(f.token, f.dave, T(11n));
      await f.token.connect(f.dave).transferShielded(f.erin.address, amt.ctHash, amt.signature);
      expect(await shieldedOf(f.token, f.dave)).to.equal(T(10n));
      expect(await shieldedOf(f.token, f.erin)).to.equal(0n);
    });

    it('unshields with the threshold network proof, once', async () => {
      const f = await holding();
      await f.token.connect(f.dave).shield(T(100n));
      const amt = await encrypted(f.token, f.dave, T(40n));
      await f.token.connect(f.dave).unshield(amt.ctHash, amt.signature);
      const id = await f.token.unshieldCount();
      const handle = (await f.token.unshields(id)).amount;
      expect(await mockPlaintext(handle)).to.equal(T(40n));
      // anyone can finish it with the public decryption; the tokens go to dave
      const { decryptedValue, signature } = await (await cofheFor(f.erin)).decryptForTx(handle).withoutACP().execute();
      await expect(f.token.connect(f.erin).finishUnshield(id, decryptedValue, signature)).to.changeTokenBalance(f.token, f.dave, T(40n));
      await expect(f.token.finishUnshield(id, decryptedValue, signature)).to.be.revertedWithCustomError(f.token, 'AlreadyUnshielded');
      expect(await shieldedOf(f.token, f.dave)).to.equal(T(60n));
    });

    it('rejects a wrong unshield amount', async () => {
      const f = await holding();
      await f.token.connect(f.dave).shield(T(100n));
      const amt = await encrypted(f.token, f.dave, T(40n));
      await f.token.connect(f.dave).unshield(amt.ctHash, amt.signature);
      const id = await f.token.unshieldCount();
      const { signature } = await (await cofheFor(f.dave)).decryptForTx((await f.token.unshields(id)).amount).withoutACP().execute();
      await expect(f.token.finishUnshield(id, T(99n), signature)).to.be.revertedWithCustomError(f.token, 'InvalidDecryptionProof');
    });

    it('lets only the launchpad pay into shielded balances', async () => {
      const f = await holding();
      await expect(f.token.connect(f.dave).shieldFor(f.dave.address, 1)).to.be.revertedWithCustomError(f.token, 'NotLaunchpad');
    });
  });
});
