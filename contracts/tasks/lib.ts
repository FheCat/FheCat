import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { CofheClient } from '@cofhe/sdk';
import type { FheCat, FheCatArena } from '../typechain-types';

export const LOCAL_CHAIN_ID = 31337;

export interface Deployment {
  network: string;
  chainId: number;
  fheCat: string;
  renderer: string;
  /** FheCatArena, once deployed (FheCat.arena points at it). */
  arena?: string;
  contract: 'FheCat' | 'FheCatLocal';
  deployer: string;
  deployBlock: number;
  deployedAt: string;
}

const DEPLOYMENTS_DIR = join(__dirname, '..', 'deployments');
/** The web app reads addresses from these, keyed by chain id. The local one is git-ignored. */
const WEB_CONFIG = join(__dirname, '..', '..', 'web', 'src', 'config');

export function saveDeployment(d: Deployment) {
  mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  writeFileSync(join(DEPLOYMENTS_DIR, `${d.network}.json`), JSON.stringify(d, null, 2) + '\n');

  const file = join(WEB_CONFIG, d.chainId === LOCAL_CHAIN_ID ? 'deployments.local.json' : 'deployments.json');
  const web = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  web[String(d.chainId)] = { fheCat: d.fheCat, renderer: d.renderer, arena: d.arena, deployBlock: d.deployBlock };
  mkdirSync(WEB_CONFIG, { recursive: true });
  writeFileSync(file, JSON.stringify(web, null, 2) + '\n');
}

export function loadDeployment(network: string): Deployment {
  const file = join(DEPLOYMENTS_DIR, `${network}.json`);
  if (!existsSync(file)) throw new Error(`No deployment for "${network}". Run: npx hardhat run scripts/deploy.ts --network ${network}`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

export async function fheCatAt(hre: HardhatRuntimeEnvironment, signer?: HardhatEthersSigner): Promise<FheCat> {
  const d = loadDeployment(hre.network.name);
  return (await hre.ethers.getContractAt('FheCat', d.fheCat, signer)) as unknown as FheCat;
}

export async function arenaAt(hre: HardhatRuntimeEnvironment, signer?: HardhatEthersSigner): Promise<FheCatArena> {
  const d = loadDeployment(hre.network.name);
  if (!d.arena) throw new Error(`No arena deployed on "${hre.network.name}". Run: npx hardhat arena:deploy --network ${hre.network.name}`);
  return (await hre.ethers.getContractAt('FheCatArena', d.arena, signer)) as unknown as FheCatArena;
}

/** A CoFHE client connected with `signer`: mock-backed on a local chain, the real coprocessor elsewhere. */
export async function cofheClient(hre: HardhatRuntimeEnvironment, signer: HardhatEthersSigner): Promise<CofheClient> {
  const { chainId } = await hre.ethers.provider.getNetwork();
  if (Number(chainId) === LOCAL_CHAIN_ID) return hre.cofhe.createClientWithBatteries(signer);

  const { createCofheConfig, createCofheClient } = await import('@cofhe/sdk/node');
  const { chains } = await import('@cofhe/sdk/chains');
  const { HardhatSignerAdapter } = await import('@cofhe/sdk/adapters');
  const client = createCofheClient(
    createCofheConfig({ supportedChains: [chains.sepolia, chains.arbSepolia, chains.baseSepolia] }),
  );
  const { publicClient, walletClient } = await HardhatSignerAdapter(signer);
  await client.connect(publicClient, walletClient);
  return client;
}

export const PHASES = ['closed', 'allowlist', 'public'] as const;
