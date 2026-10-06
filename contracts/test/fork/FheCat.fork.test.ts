import { expect } from 'chai';
import { ethers } from 'hardhat';
import { TASK_MANAGER_ADDRESS } from '@cofhe/sdk';
import type { FheCat } from '../../typechain-types';

/**
 * Runs the production contract (real FHE.randomEuint64) against the live CoFHE
 * TaskManager and ACL of a forked testnet. The coprocessor itself is off-chain,
 * so this covers everything the chain does: handle creation, ACL grants on mint
 * and transfer, allowPublic and decryption-proof verification.
 *
 *   npm run test:fork              # FORK=arb-sepolia by default
 *   FORK=base-sepolia COFHE_SKIP_MOCKS_DEPLOY=1 npx hardhat test test/fork/FheCat.fork.test.ts
 */
const describeFork = process.env.FORK ? describe : describe.skip;

const EUINT64 = 5n;
const taskManagerAbi = [
  'function isAllowed(uint256 ctHash, address account) view returns (bool)',
  'function isPubliclyAllowed(uint256 ctHash) view returns (bool)',
  'function decryptResultSigner() view returns (address)',
];

describeFork(`FheCat on a fork of ${process.env.FORK}`, () => {
  it('mints, grants and opens real CoFHE ciphertexts', async () => {
    const [owner, alice, bob] = await ethers.getSigners();
    // Run everything on a locally mined block rather than the forked (historical) one.
    await ethers.provider.send('evm_mine', []);
    expect(await ethers.provider.getCode(TASK_MANAGER_ADDRESS)).to.not.equal('0x', 'no TaskManager on this chain');
    const taskManager = new ethers.Contract(TASK_MANAGER_ADDRESS, taskManagerAbi, ethers.provider);
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
});
