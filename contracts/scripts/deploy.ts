/**
 * Deploys FheCatRenderer, FheCat and FheCatArena and records the addresses in
 * deployments/<network>.json and web/src/config/deployments(.local).json.
 *
 *   npx hardhat run scripts/deploy.ts --network arb-sepolia
 *
 * Collection settings come from .env (see .env.example). On the local Hardhat
 * network the FheCatLocal variant is deployed, because the CoFHE mocks cannot
 * generate encrypted randomness.
 */
import hre from 'hardhat';
import { LOCAL_CHAIN_ID, saveDeployment } from '../tasks/lib';

const env = (key: string, fallback: string) => process.env[key]?.trim() || fallback;

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('No deployer account. Set PRIVATE_KEY in contracts/.env');
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const local = chainId === LOCAL_CHAIN_ID;
  if ((chainId === 1 || chainId === 42161) && process.env.CONFIRM_MAINNET !== 'yes') {
    throw new Error('This is a mainnet deployment with real funds. Re-run with CONFIRM_MAINNET=yes once docs/MAINNET.md is done.');
  }

  const settings = {
    name: env('COLLECTION_NAME', 'FheCat'),
    symbol: env('COLLECTION_SYMBOL', 'FCAT'),
    maxSupply: BigInt(env('MAX_SUPPLY', '4444')),
    owner: env('OWNER_ADDRESS', deployer.address),
    royaltyReceiver: env('ROYALTY_RECEIVER', deployer.address),
    royaltyBps: BigInt(env('ROYALTY_BPS', '500')),
    publicPrice: ethers.parseEther(env('PUBLIC_PRICE_ETH', '0')),
    allowlistPrice: ethers.parseEther(env('ALLOWLIST_PRICE_ETH', '0')),
    maxPerWallet: BigInt(env('MAX_PER_WALLET', '3')),
    allowlistMaxPerWallet: BigInt(env('ALLOWLIST_MAX_PER_WALLET', '2')),
    openSale: env('OPEN_SALE', local ? 'true' : 'false') === 'true',
  };

  const contract = local ? 'FheCatLocal' : 'FheCat';
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network   ${network.name} (chain ${chainId})`);
  console.log(`Deployer  ${deployer.address}  balance ${ethers.formatEther(balance)} ETH`);
  console.log(`Contract  ${contract}`, settings);

  const renderer = await ethers.deployContract('FheCatRenderer');
  await renderer.waitForDeployment();
  console.log(`FheCatRenderer  ${await renderer.getAddress()}`);

  const fheCat = await ethers.deployContract(contract, [
    settings.name,
    settings.symbol,
    settings.maxSupply,
    deployer.address, // configured below, then handed to OWNER_ADDRESS
    await renderer.getAddress(),
    settings.royaltyReceiver,
    settings.royaltyBps,
  ]);
  const receipt = await fheCat.deploymentTransaction()!.wait();
  const fheCatAddress = await fheCat.getAddress();
  console.log(`${contract}  ${fheCatAddress}  (block ${receipt!.blockNumber})`);

  const arena = await ethers.deployContract('FheCatArena', [fheCatAddress]);
  await arena.waitForDeployment();
  const arenaAddress = await arena.getAddress();
  console.log(`FheCatArena  ${arenaAddress}`);

  const nft = await ethers.getContractAt('FheCat', fheCatAddress);
  const send = async (label: string, tx: Promise<{ wait: () => Promise<unknown> }>) => {
    await (await tx).wait();
    console.log(`  ✓ ${label}`);
  };
  await send('arena', nft.setArena(arenaAddress));
  await send('prices', nft.setPrices(settings.publicPrice, settings.allowlistPrice));
  await send('wallet limits', nft.setWalletLimits(settings.maxPerWallet, settings.allowlistMaxPerWallet));
  if (settings.openSale) await send('public sale open', nft.setPhase(2));
  if (settings.owner.toLowerCase() !== deployer.address.toLowerCase()) {
    // Ownable2Step: the new owner must call acceptOwnership()
    await send(`ownership offered to ${settings.owner}`, nft.transferOwnership(settings.owner));
  }

  if (network.name === 'hardhat') {
    console.log('In-process network: nothing saved. Use `npx hardhat node` + `--network localhost` for a local chain.');
    return;
  }
  saveDeployment({
    network: network.name,
    chainId,
    fheCat: fheCatAddress,
    renderer: await renderer.getAddress(),
    arena: arenaAddress,
    contract,
    deployer: deployer.address,
    deployBlock: receipt!.blockNumber,
    deployedAt: new Date().toISOString(),
  });
  console.log(`Saved deployments/${network.name}.json and the web app config (web/src/config/)`);

  if (!local && process.env.ETHERSCAN_API_KEY) {
    console.log('Verifying on the block explorer...');
    await new Promise((r) => setTimeout(r, 20_000)); // let the explorer index the bytecode
    for (const [address, args] of [
      [await renderer.getAddress(), []],
      [arenaAddress, [fheCatAddress]],
      [
        fheCatAddress,
        [
          settings.name,
          settings.symbol,
          settings.maxSupply,
          deployer.address,
          await renderer.getAddress(),
          settings.royaltyReceiver,
          settings.royaltyBps,
        ],
      ],
    ] as const) {
      try {
        await hre.run('verify:verify', { address, constructorArguments: args });
      } catch (e) {
        console.warn(`  verification of ${address} failed: ${(e as Error).message}`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
