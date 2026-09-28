import { useEffect, useMemo, useState } from 'react';
import { useConnection, useReadContract, useReadContracts } from 'wagmi';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { fheCatAbi } from '../config/abi';
import { DEFAULT_CHAIN, DEPLOYMENTS, IS_LAUNCHED, type Deployment } from '../config/chains';

export type CatView = {
  tokenId: bigint;
  owner: `0x${string}`;
  dnaHandle: `0x${string}`;
  revealed: boolean;
  publicDecryption: boolean;
  dna: bigint;
};

/** Chain whose deployment the site shows: the wallet's chain if the collection lives there. */
export function useViewChain(): { chainId: number; deployment?: Deployment; walletOnWrongChain: boolean } {
  const { chainId: walletChain, isConnected } = useConnection();
  const onDeployedChain = walletChain !== undefined && Boolean(DEPLOYMENTS[walletChain]);
  const chainId = onDeployedChain ? walletChain! : DEFAULT_CHAIN.id;
  return { chainId, deployment: DEPLOYMENTS[chainId], walletOnWrongChain: IS_LAUNCHED && isConnected && !onDeployedChain };
}

const POLL = { refetchInterval: 12_000 };

export function useCollection() {
  const { chainId, deployment } = useViewChain();
  const { address } = useConnection();
  const contract = { address: deployment?.fheCat, abi: fheCatAbi, chainId } as const;

  const global = useReadContracts({
    contracts: [
      { ...contract, functionName: 'totalSupply' },
      { ...contract, functionName: 'maxSupply' },
      { ...contract, functionName: 'phase' },
      { ...contract, functionName: 'publicPrice' },
      { ...contract, functionName: 'allowlistPrice' },
      { ...contract, functionName: 'maxPerWallet' },
      { ...contract, functionName: 'allowlistMaxPerWallet' },
      { ...contract, functionName: 'grandRevealAt' },
      { ...contract, functionName: 'MAX_PER_TX' },
    ],
    allowFailure: false,
    query: { enabled: Boolean(deployment), ...POLL },
  });

  const mine = useReadContracts({
    contracts: [
      { ...contract, functionName: 'publicMinted', args: [address!] },
      { ...contract, functionName: 'allowlistMinted', args: [address!] },
    ],
    allowFailure: false,
    query: { enabled: Boolean(deployment && address), ...POLL },
  });

  const [totalSupply, maxSupply, phase, publicPrice, allowlistPrice, maxPerWallet, allowlistMaxPerWallet, grandRevealAt, maxPerTx] =
    global.data ?? [];
  const [publicMinted, allowlistMinted] = mine.data ?? [];

  return {
    chainId,
    deployment,
    loaded: global.isSuccess,
    totalSupply: totalSupply ?? 0n,
    maxSupply: maxSupply ?? 0n,
    phase: phase ?? 0,
    publicPrice: publicPrice ?? 0n,
    allowlistPrice: allowlistPrice ?? 0n,
    maxPerWallet: maxPerWallet ?? 0n,
    allowlistMaxPerWallet: allowlistMaxPerWallet ?? 0n,
    grandRevealAt: grandRevealAt ?? 0n,
    maxPerTx: maxPerTx ?? 10n,
    publicMinted: publicMinted ?? 0n,
    allowlistMinted: allowlistMinted ?? 0n,
    refetch: () => Promise.all([global.refetch(), mine.refetch()]),
  };
}

export function useMyCats(totalSupply: bigint) {
  const { chainId, deployment } = useViewChain();
  const { address } = useConnection();
  const q = useReadContract({
    address: deployment?.fheCat,
    abi: fheCatAbi,
    chainId,
    functionName: 'catsOfOwner',
    args: [address!, 1n, totalSupply],
    query: { enabled: Boolean(deployment && address && totalSupply > 0n), ...POLL },
  });
  return { cats: (q.data ?? []) as readonly CatView[], refetch: q.refetch, loading: q.isLoading };
}

export function useLatestCats(totalSupply: bigint, count = 12n) {
  const { chainId, deployment } = useViewChain();
  const from = totalSupply > count ? totalSupply - count + 1n : 1n;
  const q = useReadContract({
    address: deployment?.fheCat,
    abi: fheCatAbi,
    chainId,
    functionName: 'catsInRange',
    args: [from, totalSupply],
    query: { enabled: Boolean(deployment && totalSupply > 0n), ...POLL },
  });
  return useMemo(() => [...((q.data ?? []) as readonly CatView[])].reverse(), [q.data]);
}

type Dump = Parameters<typeof StandardMerkleTree.load<[string]>>[0];

/** Merkle proof for `address` from /allowlist.json (written by `npx hardhat fhecat:allowlist`). */
export function useAllowlistProof(address?: string): { proof?: `0x${string}`[]; listed: boolean } {
  const [tree, setTree] = useState<StandardMerkleTree<[string]> | null>(null);
  useEffect(() => {
    fetch('/allowlist.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((dump: Dump | null) => dump && setTree(StandardMerkleTree.load(dump)))
      .catch(() => setTree(null));
  }, []);
  return useMemo(() => {
    if (!tree || !address) return { listed: false };
    for (const [i, [a]] of tree.entries()) {
      if (a.toLowerCase() === address.toLowerCase()) return { proof: tree.getProof(i) as `0x${string}`[], listed: true };
    }
    return { listed: false };
  }, [tree, address]);
}

/** Seconds until `timestamp` (negative once passed), ticking every second. */
export function useCountdown(timestamp: bigint): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return Number(timestamp) - now;
}
