import type { Chain } from 'viem';
import { arbitrum, arbitrumSepolia, baseSepolia, hardhat, mainnet, sepolia } from 'viem/chains';
import { chains as cofheChains, type CofheChain } from '@cofhe/sdk/chains';
import published from './deployments.json';

export interface Deployment {
  fheCat: `0x${string}`;
  renderer: `0x${string}`;
  arena?: `0x${string}`;
  deployBlock: number;
}

// deployments.local.json is written by `npm run deploy:local` and git-ignored.
const local = import.meta.glob<Record<string, Deployment>>('./deployments.local.json', {
  eager: true,
  import: 'default',
});

export const DEPLOYMENTS: Record<number, Deployment> = Object.fromEntries(
  Object.entries({ ...(published as Record<string, Deployment>), ...Object.values(local)[0] }).map(([id, d]) => [
    Number(id),
    d,
  ]),
);

interface ChainInfo {
  chain: Chain;
  cofhe: CofheChain;
  faucet?: string;
}

// Fhenix mainnets first, so a mainnet deployment is the default chain wherever it exists.
const KNOWN: ChainInfo[] = [
  { chain: arbitrum, cofhe: cofheChains.arbitrum },
  { chain: mainnet, cofhe: cofheChains.ethereum },
  { chain: arbitrumSepolia, cofhe: cofheChains.arbSepolia, faucet: 'https://www.alchemy.com/faucets/arbitrum-sepolia' },
  { chain: baseSepolia, cofhe: cofheChains.baseSepolia, faucet: 'https://www.alchemy.com/faucets/base-sepolia' },
  { chain: sepolia, cofhe: cofheChains.sepolia, faucet: 'https://www.alchemy.com/faucets/ethereum-sepolia' },
  { chain: hardhat, cofhe: cofheChains.hardhat },
];

/** Before launch the site still needs a chain to talk to; Arbitrum Sepolia is the default home. */
const HOME = KNOWN.find((c) => c.chain.id === arbitrumSepolia.id)!;

/** Chains the collection is deployed on, in the order above. */
export const LIVE: ChainInfo[] = KNOWN.filter((c) => DEPLOYMENTS[c.chain.id]);

export const IS_LAUNCHED = LIVE.length > 0;

const preferred = Number(import.meta.env.VITE_DEFAULT_CHAIN_ID);
export const DEFAULT_CHAIN: Chain = (LIVE.find((c) => c.chain.id === preferred) ?? LIVE[0] ?? HOME).chain;

// The default chain goes first: wallets and connectors without a chain of their own start there.
const SERVED = IS_LAUNCHED ? [...LIVE].sort((a, b) => Number(b.chain.id === DEFAULT_CHAIN.id) - Number(a.chain.id === DEFAULT_CHAIN.id)) : [HOME];

export const WAGMI_CHAINS = SERVED.map((c) => c.chain) as [Chain, ...Chain[]];

export const COFHE_CHAINS: CofheChain[] = SERVED.map((c) => c.cofhe);

export function chainInfo(chainId: number | undefined): ChainInfo | undefined {
  return KNOWN.find((c) => c.chain.id === chainId);
}

export function explorerUrl(chainId: number, kind: 'address' | 'tx' | 'token', value: string): string | undefined {
  const base = chainInfo(chainId)?.chain.blockExplorers?.default.url;
  return base ? `${base}/${kind}/${value}` : undefined;
}

export const X_URL = 'https://x.com/FheCat';
export const FHENIX_URL = 'https://www.fhenix.io';
