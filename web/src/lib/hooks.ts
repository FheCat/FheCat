import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { useConnection, useReadContract, useReadContracts } from 'wagmi';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { fheCatAbi, fheCatArenaAbi } from '../config/abi';
import { DEFAULT_CHAIN, DEPLOYMENTS, IS_LAUNCHED, type Deployment } from '../config/chains';
import { COFHE_ADDRESS_BOOK, TASK_MANAGER_ID, addressBookAbi, taskManagerAbi } from '../config/taskManager';

/** FheCat.State */
export const STATE = { Unopened: 0, Peeked: 1, Opened: 2, Revealed: 3 } as const;
export const STATE_NAMES = ['Unopened', 'Peeked', 'Opened', 'Revealed'];

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

export type Collection = ReturnType<typeof useCollection>;

/** The connected wallet's cats. `totalSupply` is undefined while the collection is still loading. */
export function useMyCats(totalSupply: bigint | undefined) {
  const { chainId, deployment } = useViewChain();
  const { address } = useConnection();
  const supply = totalSupply ?? 0n;
  const q = useReadContract({
    address: deployment?.fheCat,
    abi: fheCatAbi,
    chainId,
    functionName: 'catsOfOwner',
    args: [address!, 1n, supply],
    // The supply is part of the query, so every mint (anyone's) starts a new one: keep showing
    // the cats already loaded until it answers, instead of an empty list.
    query: { enabled: Boolean(deployment && address && supply > 0n), placeholderData: keepPreviousData, ...POLL },
  });
  // Until the supply is known and, if anyone has minted, until the list has come back once.
  const loading = Boolean(deployment && address) && (totalSupply === undefined || (supply > 0n && q.data === undefined && !q.isError));
  return { cats: (q.data ?? []) as readonly CatView[], refetch: q.refetch, loading };
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
type AllowlistTree = StandardMerkleTree<[string]>;

let published: Promise<AllowlistTree | null> | undefined;

/** The allowlist this site publishes at /allowlist.json (written by `npx hardhat fhecat:allowlist`), or null. */
export function useAllowlistTree(): AllowlistTree | null {
  const [tree, setTree] = useState<AllowlistTree | null>(null);
  useEffect(() => {
    let live = true;
    published ??= fetch(`${import.meta.env.BASE_URL}allowlist.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((dump: Dump | null) => (dump ? StandardMerkleTree.load(dump) : null))
      .catch(() => null);
    void published.then((t) => live && setTree(t));
    return () => {
      live = false;
    };
  }, []);
  return tree;
}

/** Merkle proof for `address` from the published allowlist. */
export function useAllowlistProof(address?: string): { proof?: `0x${string}`[]; listed: boolean } {
  const tree = useAllowlistTree();
  return useMemo(() => {
    if (!tree || !address) return { listed: false };
    for (const [i, [a]] of tree.entries()) {
      if (a.toLowerCase() === address.toLowerCase()) return { proof: tree.getProof(i) as `0x${string}`[], listed: true };
    }
    return { listed: false };
  }, [tree, address]);
}

/** Who runs the contract: its owner, and the address offered ownership (Ownable2Step) if any. */
export function useOwnership() {
  const { chainId, deployment } = useViewChain();
  const { address } = useConnection();
  const contract = { address: deployment?.fheCat, abi: fheCatAbi, chainId } as const;
  const q = useReadContracts({
    contracts: [
      { ...contract, functionName: 'owner' },
      { ...contract, functionName: 'pendingOwner' },
    ],
    allowFailure: false,
    query: { enabled: Boolean(deployment), ...POLL },
  });
  const [owner, pendingOwner] = q.data ?? [];
  const me = address?.toLowerCase();
  const role = !me ? null : owner?.toLowerCase() === me ? 'owner' : pendingOwner?.toLowerCase() === me ? 'pending' : null;
  return { owner, pendingOwner: pendingOwner && pendingOwner !== ZERO ? pendingOwner : undefined, role, refetch: q.refetch } as const;
}

/** The chain's TaskManager, looked up in the CoFHEAddressBook (it never changes for a session). */
export function useTaskManager(): `0x${string}` | undefined {
  const { chainId } = useViewChain();
  const q = useReadContract({
    address: COFHE_ADDRESS_BOOK,
    abi: addressBookAbi,
    chainId,
    functionName: 'getTm',
    args: [TASK_MANAGER_ID],
    query: { staleTime: Infinity },
  });
  return q.data;
}

/** For each handle, whether `account` is on its CoFHE access list (undefined while loading). */
export function useAllowed(
  handles: readonly `0x${string}`[],
  account?: `0x${string}`,
): { allowed: (boolean | undefined)[]; refetch: () => void } {
  const { chainId } = useViewChain();
  const taskManager = useTaskManager();
  const q = useReadContracts({
    contracts: handles.map((h) => ({
      address: taskManager,
      abi: taskManagerAbi,
      chainId,
      functionName: 'isAllowed' as const,
      args: [BigInt(h), account!] as const,
    })),
    allowFailure: true,
    query: { enabled: Boolean(taskManager && account && handles.length), ...POLL },
  });
  const allowed = handles.map((_, i) => (q.data?.[i]?.status === 'success' ? (q.data[i].result as boolean) : undefined));
  return { allowed, refetch: () => void q.refetch() };
}

export type Duel = {
  id: bigint;
  challenger: bigint;
  opponent: bigint;
  challengerHolder: `0x${string}`;
  opponentHolder: `0x${string}`;
  challengerTactic: `0x${string}`;
  opponentTactic: `0x${string}`;
  outcome: `0x${string}`;
  openedAt: number;
  foughtAt: number;
  status: number;
  challengerSealed: boolean;
  opponentSealed: boolean;
  winner: bigint;
};
export type TierClaim = { id: bigint; tokenId: bigint; tier: number; reached: `0x${string}`; settled: boolean; result: boolean };
export type ArenaRecord = {
  wins: number;
  losses: number;
  sealedWins: number;
  streak: number;
  bestStreak: number;
  tier: number;
  badges: number;
};

/** FheCatArena.DuelStatus */
export const DUEL = { None: 0, Open: 1, Fought: 2, Settled: 3, Cancelled: 4 } as const;

/** FheCatArena power tiers, by level (1-4): the Power a cat must reach and how many cats do. */
export const TIERS = [
  null,
  { name: 'Rare', power: 1200, odds: '1 in 5' },
  { name: 'Epic', power: 1350, odds: '1 in 17' },
  { name: 'Legendary', power: 1500, odds: '1 in 100' },
  { name: 'Mythic', power: 1600, odds: '1 in 500' },
] as const;
export const tierName = (level: number) => TIERS[level]?.name ?? '';

const STANDINGS_PAGE = 1000n;

/**
 * The Blind Arena: its latest duels and tier claims, every cat's record and points this week,
 * and last week's crown.
 */
export function useArena(arena: `0x${string}` | undefined, totalSupply: bigint, recent = 40n) {
  const { chainId } = useViewChain();
  const at = { address: arena, abi: fheCatArenaAbi, chainId } as const;
  const head = useReadContracts({
    contracts: [
      { ...at, functionName: 'duelCount' },
      { ...at, functionName: 'claimCount' },
      { ...at, functionName: 'currentWeek' },
    ],
    allowFailure: false,
    query: { enabled: Boolean(arena), ...POLL },
  });
  const [duelCount, claimCount, week] = head.data ?? [0n, 0n, 0n];
  const claimIds: bigint[] = [];
  for (let id = claimCount; id > 0n && id > claimCount - 30n; id--) claimIds.push(id);
  const pages: [bigint, bigint][] = [];
  for (let from = 1n; from <= totalSupply; from += STANDINGS_PAGE) {
    pages.push([from, from + STANDINGS_PAGE - 1n > totalSupply ? totalSupply : from + STANDINGS_PAGE - 1n]);
  }
  const fromDuel = duelCount > recent ? duelCount - recent + 1n : 1n;

  const lists = useReadContracts({
    contracts: [
      { ...at, functionName: 'duelsInRange' as const, args: [fromDuel, duelCount] as const },
      { ...at, functionName: 'weekStart' as const, args: [week + 1n] as const },
      { ...at, functionName: 'weeklyChampion' as const, args: [week > 0n ? week - 1n : 0n] as const },
      { ...at, functionName: 'weeklyLeader' as const, args: [week > 0n ? week - 1n : 0n] as const },
      ...claimIds.map((id) => ({ ...at, functionName: 'claims' as const, args: [id] as const })),
      ...pages.map(([from, to]) => ({ ...at, functionName: 'standings' as const, args: [week, from, to] as const })),
    ],
    allowFailure: false,
    query: { enabled: Boolean(arena && head.data), ...POLL },
  });

  return useMemo(() => {
    const data = (lists.data ?? []) as readonly unknown[];
    type RawDuel = Omit<Duel, 'id' | 'openedAt' | 'foughtAt' | 'status'> & { openedAt: bigint; foughtAt: bigint; status: number };
    const duels: Duel[] = ((data[0] ?? []) as readonly RawDuel[])
      .map((d, i) => ({ ...d, id: fromDuel + BigInt(i), openedAt: Number(d.openedAt), foughtAt: Number(d.foughtAt), status: Number(d.status) }))
      .reverse();
    const nextWeekAt = Number((data[1] as bigint | undefined) ?? 0n);
    const lastWeek = { champion: (data[2] as bigint | undefined) ?? 0n, leader: (data[3] as bigint | undefined) ?? 0n };
    const claims: TierClaim[] = claimIds.flatMap((id, i) => {
      const c = data[4 + i] as readonly [bigint, number, `0x${string}`, boolean, boolean] | undefined;
      return c ? [{ id, tokenId: c[0], tier: Number(c[1]), reached: c[2], settled: c[3], result: c[4] }] : [];
    });
    const records = new Map<bigint, ArenaRecord>();
    const points = new Map<bigint, number>();
    pages.forEach(([from], p) => {
      const page = data[4 + claimIds.length + p] as readonly [readonly Record<keyof ArenaRecord, number | bigint>[], readonly number[]] | undefined;
      if (!page) return;
      page[0].forEach((r, i) => {
        const id = from + BigInt(i);
        records.set(id, {
          wins: Number(r.wins),
          losses: Number(r.losses),
          sealedWins: Number(r.sealedWins),
          streak: Number(r.streak),
          bestStreak: Number(r.bestStreak),
          tier: Number(r.tier),
          badges: Number(r.badges),
        });
        if (page[1][i]) points.set(id, Number(page[1][i]));
      });
    });
    return {
      duels,
      claims,
      records,
      points,
      week,
      nextWeekAt,
      lastWeek,
      loaded: Boolean(lists.data),
      refetch: () => Promise.all([head.refetch(), lists.refetch()]),
    };
  }, [lists.data, duelCount, claimCount, week, totalSupply]);
}

/** Cat views for a handful of ids (thumbnails and box states around the arena). */
export function useCats(ids: readonly bigint[]) {
  const { chainId, deployment } = useViewChain();
  const q = useReadContracts({
    contracts: ids.map((id) => ({ address: deployment?.fheCat, abi: fheCatAbi, chainId, functionName: 'catOf' as const, args: [id] as const })),
    allowFailure: true,
    query: { enabled: Boolean(deployment && ids.length), ...POLL },
  });
  return useMemo(() => {
    const m = new Map<bigint, CatView>();
    ids.forEach((id, i) => {
      const r = q.data?.[i];
      if (r?.status === 'success') m.set(id, r.result as unknown as CatView);
    });
    return m;
  }, [q.data, ids.join(',')]);
}
