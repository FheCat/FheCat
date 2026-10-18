import hre, { ethers } from 'hardhat';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { CofheClient } from '@cofhe/sdk';
import type { FheCatLocal, FheCatRenderer } from '../typechain-types';

export const PRICE = ethers.parseEther('0.01');
export const AL_PRICE = ethers.parseEther('0.005');
export const MAX_SUPPLY = 25n;
export const ROYALTY_BPS = 500n;

export enum Phase {
  Closed,
  Allowlist,
  Public,
}

/** FheCat.State */
export enum State {
  Unopened,
  Peeked,
  Opened,
  Revealed,
}

export async function deployFixture() {
  const [owner, alice, bob, carol, treasury] = await ethers.getSigners();
  const renderer = (await ethers.deployContract('FheCatRenderer')) as unknown as FheCatRenderer;
  const nft = (await ethers.deployContract('FheCatLocal', [
    'FheCat',
    'FCAT',
    MAX_SUPPLY,
    owner.address,
    await renderer.getAddress(),
    treasury.address,
    ROYALTY_BPS,
  ])) as unknown as FheCatLocal;
  await nft.setPrices(PRICE, AL_PRICE);
  await nft.setWalletLimits(5, 2);
  return { nft, renderer, owner, alice, bob, carol, treasury };
}

const clients = new Map<string, { client: Promise<CofheClient>; at: number }>();

/**
 * A connected CoFHE client (with a self ACP) for `signer`, reused while the chain's clock moves forward.
 * An ACP carries its creation time, and the revoker treats an ACP from the future as revoked, so a
 * fixture that rewinds the chain to before the ACP was signed needs a fresh one.
 */
export async function cofheFor(signer: HardhatEthersSigner): Promise<CofheClient> {
  const now = (await ethers.provider.getBlock('latest'))!.timestamp;
  const cached = clients.get(signer.address);
  if (cached && cached.at <= now) return cached.client;
  const client = hre.cofhe.createClientWithBatteries(signer);
  clients.set(signer.address, { client, at: now });
  return client;
}

/** Mints `quantity` cats in the public phase and returns their ids. */
export async function mintPublic(nft: FheCatLocal, signer: HardhatEthersSigner, quantity = 1): Promise<bigint[]> {
  if ((await nft.phase()) !== BigInt(Phase.Public)) await nft.setPhase(Phase.Public);
  const before = await nft.totalSupply();
  await nft.connect(signer).mint(quantity, { value: PRICE * BigInt(quantity) });
  return Array.from({ length: quantity }, (_, i) => before + BigInt(i) + 1n);
}

export async function dnaHandle(nft: FheCatLocal, tokenId: bigint): Promise<string> {
  return (await nft.catOf(tokenId)).dnaHandle;
}

/** The plaintext the CoFHE mocks hold for a ciphertext handle (test-only knowledge). */
export async function mockPlaintext(handle: string): Promise<bigint> {
  return hre.cofhe.mocks.getPlaintext(handle);
}

export function decodeDataUri(uri: string, prefix: string): string {
  if (!uri.startsWith(prefix)) throw new Error(`expected ${prefix}...`);
  return Buffer.from(uri.slice(prefix.length), 'base64').toString('utf8');
}
