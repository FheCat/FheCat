/**
 * Deploys FheCatRenderer, FheCat and FheCatArena and records the addresses in
 * deployments/<network>.json and web/src/config/deployments(.local).json.
 *
 *   npx hardhat run scripts/deploy.ts --network arb-sepolia
 *
 * Collection settings come from launch.json, the same file for the testnet
 * rehearsal and for mainnet. On the local Hardhat network the FheCatLocal and
 * FheCatArenaLocal variants are deployed, because the CoFHE mocks cannot
 * generate encrypted randomness.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import hre from 'hardhat';
import { LOCAL_CHAIN_ID, saveDeployment } from '../tasks/lib';

interface Launch {
  name: string;
  symbol: string;
  maxSupply: number;
  /** Empty: the deployer keeps the contract. */
  owner: string;
  /** Empty: the owner. */
  royaltyReceiver: string;
  royaltyBps: number;
  publicPriceEth: string;
  allowlistPriceEth: string;
  /** 0 = no limit. */
  maxPerWallet: number;
  allowlistMaxPerWallet: number;
}

// Env names a local chain may use to override launch.json (the e2e stack does).
const OVERRIDES: Record<keyof Launch, string> = {
  name: 'COLLECTION_NAME',
  symbol: 'COLLECTION_SYMBOL',
  maxSupply: 'MAX_SUPPLY',
  owner: 'OWNER_ADDRESS',
  royaltyReceiver: 'ROYALTY_RECEIVER',
  royaltyBps: 'ROYALTY_BPS',
  publicPriceEth: 'PUBLIC_PRICE_ETH',
  allowlistPriceEth: 'ALLOWLIST_PRICE_ETH',
  maxPerWallet: 'MAX_PER_WALLET',
  allowlistMaxPerWallet: 'ALLOWLIST_MAX_PER_WALLET',
};

/** launch.json as is on a public network, so the testnet rehearsal and mainnet cannot drift apart. */
function launchSettings(local: boolean): Launch {
  const launch: Launch = JSON.parse(readFileSync(join(__dirname, '..', 'launch.json'), 'utf8'));
  for (const [key, name] of Object.entries(OVERRIDES) as [keyof Launch, string][]) {
    const value = process.env[name]?.trim();
    if (!value) continue;
    if (!local) throw new Error(`${name} is set, but on a public network the settings come only from launch.json. Unset it.`);
    Object.assign(launch, { [key]: typeof launch[key] === 'number' ? Number(value) : value });
  }
  return launch;
}

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('No deployer account. Set PRIVATE_KEY in contracts/.env');
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const local = chainId === LOCAL_CHAIN_ID;
  if ((chainId === 1 || chainId === 42161) && process.env.CONFIRM_MAINNET !== 'yes') {
    throw new Error('This is a mainnet deployment with real funds. Re-run with CONFIRM_MAINNET=yes once docs/MAINNET.md is done.');
  }

  const launch = launchSettings(local);
  const owner = ethers.getAddress(launch.owner || deployer.address);
  const settings = {
    name: launch.name,
    symbol: launch.symbol,
    maxSupply: BigInt(launch.maxSupply),
    owner,
    royaltyReceiver: ethers.getAddress(launch.royaltyReceiver || owner),
    royaltyBps: BigInt(launch.royaltyBps),
    publicPrice: ethers.parseEther(launch.publicPriceEth),
    allowlistPrice: ethers.parseEther(launch.allowlistPriceEth),
    maxPerWallet: BigInt(launch.maxPerWallet),
    allowlistMaxPerWallet: BigInt(launch.allowlistMaxPerWallet),
    // Tests and the e2e stack mint straight away; on a real network the sale opens on purpose, later.
    openSale: local && process.env.OPEN_SALE !== 'false',
  };

  const contract = local ? 'FheCatLocal' : 'FheCat';
  const arenaContract = local ? 'FheCatArenaLocal' : 'FheCatArena';
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

  const arena = await ethers.deployContract(arenaContract, [fheCatAddress]);
  await arena.waitForDeployment();
  const arenaAddress = await arena.getAddress();
  console.log(`${arenaContract}  ${arenaAddress}`);

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
