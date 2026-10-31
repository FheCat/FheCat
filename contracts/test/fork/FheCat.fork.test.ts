import { expect } from 'chai';
import { ethers } from 'hardhat';
import { COFHE_ADDRESS_BOOK_ADDRESS, TASK_MANAGER_ID } from '@cofhe/sdk';
import type { FheCat, FheCatArena } from '../../typechain-types';

/**
 * Runs the production contracts (real FHE.randomEuint64) against the live CoFHE
 * TaskManager and ACL of a forked chain, found through the CoFHEAddressBook just
 * like FHE.sol finds them. The coprocessor itself is off-chain, so this covers
 * everything the chain does: handle creation, ACL grants on mint and transfer,
 * allowPublic and decryption-proof verification.
 *
 *   npm run test:fork              # FORK=arb-sepolia by default
 *   FORK=base-sepolia COFHE_SKIP_MOCKS_DEPLOY=1 npx hardhat test test/fork/FheCat.fork.test.ts
 *   FORK=arbitrum ...              # mainnet forks work too (nothing is sent to the real chain)
 */
const describeFork = process.env.FORK ? describe : describe.skip;

/** TaskManager errors: CofheIsUnavailable() and NotOnAccessList(address). */
const COFHE_UNAVAILABLE = '0xd8aba367';
const NOT_ON_ACCESS_LIST = '0xb688c6f5';
const EBOOL = 0n;
const EUINT64 = 5n;
async function liveTaskManager() {
  expect(await ethers.provider.getCode(COFHE_ADDRESS_BOOK_ADDRESS)).to.not.equal('0x', 'no CoFHEAddressBook on this chain');
  const book = new ethers.Contract(COFHE_ADDRESS_BOOK_ADDRESS, ['function getTm(uint256) view returns (address)'], ethers.provider);
  const address: string = await book.getTm(TASK_MANAGER_ID);
  expect(await ethers.provider.getCode(address)).to.not.equal('0x', 'no TaskManager behind the address book');
  return new ethers.Contract(address, taskManagerAbi, ethers.provider);
}

const taskManagerAbi = [
  'function isAllowed(uint256 ctHash, address account) view returns (bool)',
  'function isPubliclyAllowed(uint256 ctHash) view returns (bool)',
  'function decryptResultSigner() view returns (address)',
];

const forkTitle = process.env.FORK ? `FheCat on a fork of ${process.env.FORK}` : 'FheCat on a fork (skipped: set FORK to run)';

describeFork(forkTitle, () => {
  // Mainnet CoFHE is gated: tasks fail with CofheIsUnavailable() before launch, and with
  // NotOnAccessList(contract) for contracts Fhenix has not admitted. Report that and skip.
  before(async function () {
    await ethers.provider.send('evm_mine', []);
    const taskManager = await liveTaskManager();
    const [owner, alice] = await ethers.getSigners();
    const renderer = await ethers.deployContract('FheCatRenderer');
    const nft = await ethers.deployContract('FheCat', ['FheCat', 'FCAT', 100, owner.address, await renderer.getAddress(), owner.address, 500]);
    await nft.setPhase(2);
    try {
      await nft.connect(alice).getFunction('mint').staticCall(1);
    } catch (e) {
      const seen = `${(e as Error).message} ${JSON.stringify(e, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`;
      const reason = seen.includes(COFHE_UNAVAILABLE)
        ? 'CofheIsUnavailable(): CoFHE is not live on this chain yet'
        : seen.includes(NOT_ON_ACCESS_LIST)
          ? 'NotOnAccessList(contract): this TaskManager only serves contracts on its access list'
          : null;
      if (reason) {
        console.log(`      TaskManager ${await taskManager.getAddress()} refused a mint: ${reason}`);
        this.skip();
      }
      throw e;
    }
  });

  it('mints, grants and opens real CoFHE ciphertexts', async () => {
    const [owner, alice, bob] = await ethers.getSigners();
    // Run everything on a locally mined block rather than the forked (historical) one.
    await ethers.provider.send('evm_mine', []);
    const taskManager = await liveTaskManager();
    console.log(`      TaskManager ${await taskManager.getAddress()}`);
    expect(await taskManager.decryptResultSigner()).to.not.equal(ethers.ZeroAddress);

    const renderer = await ethers.deployContract('FheCatRenderer');
    const nft = (await ethers.deployContract('FheCat', [
      'FheCat',
      'FCAT',
      100,
      owner.address,
      await renderer.getAddress(),
      owner.address,
      500,
    ])) as unknown as FheCat;
    await nft.setPhase(2);

    const receipt = await (await nft.connect(alice).mint(3)).wait();
    console.log(`      mint(3) gas: ${receipt!.gasUsed}`);
    const single = await (await nft.connect(alice).mint(1)).wait();
    console.log(`      mint(1) gas: ${single!.gasUsed}`);

    const handles: bigint[] = [];
    for (const id of [1n, 2n, 3n, 4n]) {
      const handle = BigInt((await nft.catOf(id)).dnaHandle);
      expect((handle >> 8n) & 0x7fn, 'handle type').to.equal(EUINT64);
      // born unopened: only the contract itself is on the ACL
      expect(await taskManager.isAllowed(handle, await nft.getAddress())).to.equal(true);
      expect(await taskManager.isAllowed(handle, alice.address)).to.equal(false);
      expect(await taskManager.isAllowed(handle, owner.address)).to.equal(false);
      handles.push(handle);
    }
    expect(new Set(handles).size).to.equal(4);

    const peek = await (await nft.connect(alice).peek(1)).wait();
    console.log(`      peek gas: ${peek!.gasUsed}`);
    expect(await taskManager.isAllowed(handles[0], alice.address)).to.equal(true);
    const transfer = await (await nft.connect(alice).transferFrom(alice.address, bob.address, 1)).wait();
    console.log(`      transfer gas: ${transfer!.gasUsed}`);
    expect(await taskManager.isAllowed(handles[0], bob.address)).to.equal(false);
    expect(await nft.stateOf(1)).to.equal(1n);

    expect(await taskManager.isPubliclyAllowed(handles[1])).to.equal(false);
    const open = await (await nft.connect(alice).open(2)).wait();
    console.log(`      open gas: ${open!.gasUsed}`);
    expect(await taskManager.isPubliclyAllowed(handles[1])).to.equal(true);

    await expect(nft.connect(alice).reveal(3, 12345, '0x' + '11'.repeat(65)))
      .to.be.revertedWithCustomError(nft, 'InvalidDecryptionProof')
      .withArgs(3);

    const uri = await nft.tokenURI(4);
    const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());
    expect(json.attributes).to.deep.equal([{ trait_type: 'Status', value: 'Unopened' }]);
  });

  it('runs the arena on real ciphertexts: power stays sealed, only answers go public', async () => {
    const [owner, alice, bob] = await ethers.getSigners();
    await ethers.provider.send('evm_mine', []);
    const taskManager = await liveTaskManager();

    const renderer = await ethers.deployContract('FheCatRenderer');
    const nft = (await ethers.deployContract('FheCat', [
      'FheCat',
      'FCAT',
      100,
      owner.address,
      await renderer.getAddress(),
      owner.address,
      500,
    ])) as unknown as FheCat;
    const arena = (await ethers.deployContract('FheCatArena', [await nft.getAddress()])) as unknown as FheCatArena;
    const arenaAddress = await arena.getAddress();
    await nft.setArena(arenaAddress);
    await nft.setPhase(2);
    await nft.connect(alice).mint(1);
    await nft.connect(bob).mint(1);

    await expect(arena.connect(alice).claimTier(1, 1)).to.be.revertedWithCustomError(arena, 'NotInArena');
    const enter = await (await nft.connect(alice).enterArena(1)).wait();
    console.log(`      enterArena gas: ${enter!.gasUsed}`);
    expect(await taskManager.isAllowed((await nft.catOf(1)).dnaHandle, arenaAddress)).to.equal(true);

    const claim = await (await arena.connect(alice).claimTier(1, 2)).wait();
    console.log(`      claimTier gas (power sealed, constants made): ${claim!.gasUsed}`);
    const power = BigInt(await arena.powerHandle(1));
    expect((power >> 8n) & 0x7fn, 'power type').to.equal(EUINT64);
    expect(await taskManager.isAllowed(power, arenaAddress)).to.equal(true);
    expect(await taskManager.isPubliclyAllowed(power)).to.equal(false);
    for (const who of [owner, alice, bob]) expect(await taskManager.isAllowed(power, who.address)).to.equal(false);
    const reached = BigInt((await arena.claims(1)).reached);
    expect((reached >> 8n) & 0x7fn, 'answer type').to.equal(EBOOL);
    expect(await taskManager.isPubliclyAllowed(reached)).to.equal(true);
    expect(await nft.stateOf(1)).to.equal(0n); // still unopened
    expect(await taskManager.isPubliclyAllowed((await nft.catOf(1)).dnaHandle)).to.equal(false);

    // A duel needs a tactic the CoFHE verifier signed for this caller and this arena.
    await expect(arena.connect(alice).challenge(1, 2, ethers.ZeroHash.replace(/00$/, '01'), '0x' + '11'.repeat(65))).to.be.reverted;
    await expect(arena.settleTier(1, true, '0x' + '11'.repeat(65))).to.be.revertedWithCustomError(
      arena,
      'InvalidDecryptionProof',
    );
  });
});
