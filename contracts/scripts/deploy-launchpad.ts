/**
 * Deploys FheCatRewards (the FheCat holders' fee vault) and FheLaunchpad next to an existing
 * FheCat deployment, and adds both to deployments/<network>.json and the web app config.
 *
 *   npx hardhat run scripts/deploy-launchpad.ts --network eth-sepolia
 *
 * TREASURY (default: the deployer) receives launch fees and the platform half of sale fees.
 * PRICE_FEED overrides the Chainlink ETH/USD feed; on a local chain a mock at $2,500 is deployed.
 */
import hre from 'hardhat';
import { LOCAL_CHAIN_ID, loadDeployment, saveDeployment } from '../tasks/lib';

// Chainlink ETH/USD (8 decimals)
const FEEDS: Record<number, string> = {
  1: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  11155111: '0x694AA1769357215DE4FAC081bf1f309aDC325306',
};

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('No deployer account. Set PRIVATE_KEY.');
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if ((chainId === 1 || chainId === 42161) && process.env.CONFIRM_MAINNET !== 'yes') {
    throw new Error('Mainnet: re-run with CONFIRM_MAINNET=yes.');
  }
  const d = loadDeployment(network.name);
  const treasury = ethers.getAddress(process.env.TREASURY || deployer.address);

  let feed = process.env.PRICE_FEED || FEEDS[chainId];
  if (!feed && chainId === LOCAL_CHAIN_ID) {
    const mock = await ethers.deployContract('MockPriceFeed', [2500_00000000n]);
    await mock.waitForDeployment();
    feed = await mock.getAddress();
  }
  if (!feed) throw new Error(`No ETH/USD feed known for chain ${chainId}; set PRICE_FEED.`);

  console.log(`Network   ${network.name} (chain ${chainId}), FheCat ${d.fheCat}`);
  console.log(`Treasury  ${treasury}, feed ${feed}`);

  const rewards = await ethers.deployContract('FheCatRewards', [d.fheCat]);
  await rewards.waitForDeployment();
  console.log(`FheCatRewards  ${await rewards.getAddress()}`);

  const pad = await ethers.deployContract('FheLaunchpad', [deployer.address, treasury, await rewards.getAddress(), feed]);
  const receipt = await pad.deploymentTransaction()!.wait();
  console.log(`FheLaunchpad   ${await pad.getAddress()}  (block ${receipt!.blockNumber})`);
  // Public RPCs can answer from a node that hasn't seen the new code yet.
  for (let i = 0; ; i++) {
    try {
      console.log(`Launch fee now ${ethers.formatEther(await pad.launchFeeWei())} ETH`);
      break;
    } catch (e) {
      if (i >= 5) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  if (network.name === 'hardhat') return;
  saveDeployment({ ...d, launchpad: await pad.getAddress(), rewards: await rewards.getAddress(), launchpadBlock: receipt!.blockNumber });
  console.log(`Saved deployments/${network.name}.json and the web app config`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
