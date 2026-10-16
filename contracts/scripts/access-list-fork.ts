/**
 * What a mint does on Fhenix mainnet once CoFHE is switched on, depending on the TaskManager's
 * access list. Runs on a fork of Arbitrum One (nothing is sent to the real chain): impersonates
 * the TaskManager's admin to flip the switches Fhenix holds.
 *
 *   COFHE_SKIP_MOCKS_DEPLOY=1 FORK=arbitrum npx hardhat run scripts/access-list-fork.ts
 */
import { ethers, network } from 'hardhat';

const BOOK = '0xC0F4e00E531a2B086492Ae3DCC1515038307196b';
const ERRORS: Record<string, string> = { '0xd8aba367': 'CofheIsUnavailable()', '0xb688c6f5': 'NotOnAccessList(address)' };

async function main() {
  // Calls run on a locally mined block, not the forked (historical) one.
  await ethers.provider.send('evm_mine', []);
  const book = new ethers.Contract(BOOK, ['function getTm(uint256) view returns (address)'], ethers.provider);
  const tmAddress: string = await book.getTm(1);
  const tm = new ethers.Contract(
    tmAddress,
    [
      'function isEnabled() view returns (bool)',
      'function accessListEnabled() view returns (bool)',
      'function accessList(address) view returns (bool)',
      'function defaultAdmin() view returns (address)',
      'function hasRole(bytes32,address) view returns (bool)',
      'function grantRole(bytes32,address)',
      'function ACCESS_LIST_MANAGER_ROLE() view returns (bytes32)',
      'function enable()',
      'function addToAccessList(address[])',
      'function removeFromAccessList(address[])',
      'function disableAccessList()',
    ],
    ethers.provider,
  );
  console.log(`chain ${network.config.chainId} (fork of the real chain), TaskManager ${tmAddress}`);
  console.log(`today: isEnabled ${await tm.isEnabled()}, accessListEnabled ${await tm.accessListEnabled()}`);

  // FheCat exactly as it will be deployed, with the public sale open.
  const [owner, buyer] = await ethers.getSigners();
  const renderer = await ethers.deployContract('FheCatRenderer');
  const nft = await ethers.deployContract('FheCat', ['FheCat', 'FCAT', 4444, owner.address, await renderer.getAddress(), owner.address, 500]);
  await nft.setPhase(2);
  const cat = await nft.getAddress();
  const tryMint = async (label: string) => {
    try {
      await nft.connect(buyer).getFunction('mint').staticCall(1);
      console.log(`   ${label}: mint WORKS`);
    } catch (e) {
      const text = `${(e as Error).message} ${JSON.stringify(e, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`;
      const hit = Object.entries(ERRORS).find(([sel]) => text.includes(sel));
      console.log(`   ${label}: mint REFUSED with ${hit ? hit[1] : (e as Error).message.split('\n')[0]}`);
    }
  };

  const now = `CoFHE ${(await tm.isEnabled()) ? 'on' : 'off'}, list ${(await tm.accessListEnabled()) ? 'on' : 'off'}`;
  await tryMint(`1. the chain as it is now (${now}), FheCat not on the list`);

  // Fhenix's admin, as on chain
  const adminAddress: string = await tm.defaultAdmin();
  await network.provider.request({ method: 'hardhat_impersonateAccount', params: [adminAddress] });
  await network.provider.send('hardhat_setBalance', [adminAddress, '0x8AC7230489E80000']);
  const admin = tm.connect(await ethers.getSigner(adminAddress)) as typeof tm;
  const role = await tm.ACCESS_LIST_MANAGER_ROLE();
  if (!(await tm.hasRole(role, adminAddress))) await (await admin.grantRole(role, adminAddress)).wait();

  if (!(await tm.isEnabled())) await (await admin.enable()).wait();
  console.log(`CoFHE on: isEnabled ${await tm.isEnabled()}, accessListEnabled ${await tm.accessListEnabled()}, FheCat on the list ${await tm.accessList(cat)}`);
  await tryMint('2. CoFHE on, list on, FheCat not on it');

  await (await admin.addToAccessList([cat])).wait();
  await tryMint('3. CoFHE on, list on, FheCat added to it');

  await (await admin.removeFromAccessList([cat])).wait();
  await (await admin.disableAccessList()).wait();
  console.log(`after disableAccessList(): accessListEnabled ${await tm.accessListEnabled()}, FheCat on the list ${await tm.accessList(cat)}`);
  await tryMint('4. CoFHE on, list switched off');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
