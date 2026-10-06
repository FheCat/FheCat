import { useEffect, useMemo, useState } from 'react';
import { useConnection, useReadContract, useReadContracts } from 'wagmi';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { fheCatAbi, fheCatArenaAbi } from '../config/abi';
import { DEFAULT_CHAIN, DEPLOYMENTS, IS_LAUNCHED, type Deployment } from '../config/chains';
import { TASK_MANAGER, taskManagerAbi } from '../config/taskManager';

/** FheCat.State */
export const STATE = { Unopened: 0, Peeked: 1, Opened: 2, Revealed: 3 } as const;

export type CatView = {
  tokenId: bigint;
  owner: `0x${string}`;
  dnaHandle: `0x${string}`;
  state: number;
  peeked: boolean;
  opened: boolean;
  revealed: boolean;
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
const ZERO = '0x0000000000000000000000000000000000000000';

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
      { ...contract, functionName: 'MAX_PER_TX' },
      { ...contract, functionName: 'arena' },
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

  const [totalSupply, maxSupply, phase, publicPrice, allowlistPrice, maxPerWallet, allowlistMaxPerWallet, maxPerTx, arena] =
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
    maxPerTx: maxPerTx ?? 10n,
    /** The arena FheCat lets holders enter, if one is set. */
    arena: arena && arena !== ZERO ? arena : undefined,
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

/** For each handle, whether `account` is on its CoFHE access list (undefined while loading). */
export function useAllowed(
  handles: readonly `0x${string}`[],
  account?: `0x${string}`,
): { allowed: (boolean | undefined)[]; refetch: () => void } {
  const { chainId } = useViewChain();
  const q = useReadContracts({
    contracts: handles.map((h) => ({
      address: TASK_MANAGER,
      abi: taskManagerAbi,
      chainId,
      functionName: 'isAllowed' as const,
      args: [BigInt(h), account!] as const,
    })),
    allowFailure: true,
    query: { enabled: Boolean(account && handles.length), ...POLL },
  });
  const allowed = handles.map((_, i) => (q.data?.[i]?.status === 'success' ? (q.data[i].result as boolean) : undefined));
  return { allowed, refetch: () => void q.refetch() };
}

export type Duel = { id: bigint; challenger: bigint; opponent: bigint; outcome: `0x${string}`; status: number; winner: bigint };
export type TierClaim = { id: bigint; tokenId: bigint; tier: number; reached: `0x${string}`; settled: boolean; result: boolean };
export type ArenaRecord = { wins: number; losses: number; tier: number };

/** FheCatArena.DuelStatus */
export const DUEL = { None: 0, Open: 1, Fought: 2, Settled: 3, Cancelled: 4 } as const;

/** The arena's latest duels and tier claims, and the records of the given cats. */
export function useArena(arena: `0x${string}` | undefined, tokenIds: readonly bigint[], recent = 30n) {
  const { chainId } = useViewChain();
  const at = { address: arena, abi: fheCatArenaAbi, chainId } as const;
  const counts = useReadContracts({
    contracts: [
      { ...at, functionName: 'duelCount' },
      { ...at, functionName: 'claimCount' },
    ],
    allowFailure: false,
    query: { enabled: Boolean(arena), ...POLL },
  });
  const [duelCount, claimCount] = counts.data ?? [0n, 0n];
  const ids = (count: bigint) => {
    const out: bigint[] = [];
    for (let id = count; id > 0n && id > count - recent; id--) out.push(id);
    return out;
  };
  const duelIds = ids(duelCount);
  const claimIds = ids(claimCount);

  const lists = useReadContracts({
    contracts: [
      ...duelIds.map((id) => ({ ...at, functionName: 'duels' as const, args: [id] as const })),
      ...claimIds.map((id) => ({ ...at, functionName: 'claims' as const, args: [id] as const })),
      ...tokenIds.map((id) => ({ ...at, functionName: 'records' as const, args: [id] as const })),
    ],
    allowFailure: false,
    query: { enabled: Boolean(arena && duelIds.length + claimIds.length + tokenIds.length), ...POLL },
  });

  return useMemo(() => {
    const data = (lists.data ?? []) as readonly unknown[];
    const duels: Duel[] = duelIds.flatMap((id, i) => {
      const d = data[i] as readonly [bigint, bigint, `0x${string}`, number, bigint] | undefined;
      return d ? [{ id, challenger: d[0], opponent: d[1], outcome: d[2], status: Number(d[3]), winner: d[4] }] : [];
    });
    const claims: TierClaim[] = claimIds.flatMap((id, i) => {
      const c = data[duelIds.length + i] as readonly [bigint, number, `0x${string}`, boolean, boolean] | undefined;
      return c ? [{ id, tokenId: c[0], tier: Number(c[1]), reached: c[2], settled: c[3], result: c[4] }] : [];
    });
    const records = new Map<bigint, ArenaRecord>();
    tokenIds.forEach((id, i) => {
      const r = data[duelIds.length + claimIds.length + i] as readonly [number, number, number] | undefined;
      if (r) records.set(id, { wins: Number(r[0]), losses: Number(r[1]), tier: Number(r[2]) });
    });
    return { duels, claims, records, refetch: () => Promise.all([counts.refetch(), lists.refetch()]) };
  }, [lists.data, duelCount, claimCount, tokenIds.join(',')]);
}
