import { formatUnits } from 'viem';
import { useReadContracts } from 'wagmi';
import { fheLaunchTokenAbi, fheLaunchpadAbi } from '../config/abi';
import { formatEth } from './format';

const POLL = { refetchInterval: 12_000 };
/** Newest launches the site reads; older ones stay on-chain. */
const MAX_SHOWN = 60n;

export const DECIMALS = 6;

interface LaunchView {
  creator: `0x${string}`;
  token: `0x${string}`;
  saleSupply: bigint;
  creatorSupply: bigint;
  softCap: bigint;
  hardCap: bigint;
  maxPerWallet: bigint;
  start: bigint;
  end: bigint;
  raised: bigint;
  status: number;
  info: string;
}

export interface Launch extends LaunchView {
  id: bigint;
  name: string;
  symbol: string;
}

/** Where a sale stands for the people looking at it, not only for the contract. */
export type Phase = 'live' | 'closing' | 'succeeded' | 'failed';

export function phaseOf(l: LaunchView, now = Date.now() / 1000): Phase {
  if (l.status === 1) return 'succeeded';
  if (l.status === 2) return 'failed';
  return now >= Number(l.end) || l.raised >= l.hardCap ? 'closing' : 'live';
}

export const PHASE_LABEL: Record<Phase, string> = { live: 'Live', closing: 'Ended · to close', succeeded: 'Succeeded', failed: 'Refunding' };

/** A small ETH amount without a tail of digits: 0.0004007 rather than 0.000400691853... */
export const eth = (wei: bigint) =>
  wei === 0n ? '0' : Number(formatEth(wei)).toPrecision(4).replace(/(\.\d*?)0+(e|$)/, '$1$2').replace(/\.(e|$)/, '$1');

export const tokens = (v: bigint) => Number(formatUnits(v, DECIMALS)).toLocaleString('en-US', { maximumFractionDigits: 2 });

export function timeLeft(end: number): string {
  const s = Math.max(0, Math.floor(end - Date.now() / 1000));
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

/** The launchpad's settings and every recent launch with its token's name and symbol. */
export function useLaunchpad(pad: `0x${string}`, chainId: number) {
  const call = { address: pad, abi: fheLaunchpadAbi, chainId } as const;
  const info = useReadContracts({
    contracts: [
      { ...call, functionName: 'launchCount' },
      { ...call, functionName: 'launchFeeWei' },
      { ...call, functionName: 'feeBps' },
      { ...call, functionName: 'holderShareBps' },
    ],
    query: POLL,
  });
  const [count, fee, feeBps, holderBps] = (info.data ?? []).map((r) => r.result as bigint | undefined);

  const ids: bigint[] = [];
  for (let i = count ?? 0n; i > 0n && BigInt(ids.length) < MAX_SHOWN; i--) ids.push(i - 1n);
  const list = useReadContracts({
    contracts: ids.map((id) => ({ ...call, functionName: 'getLaunch' as const, args: [id] as const })),
    allowFailure: false,
    query: { enabled: ids.length > 0, ...POLL },
  });
  const views = (list.data ?? []) as unknown as LaunchView[];
  const meta = useReadContracts({
    contracts: views.flatMap((l) => [
      { address: l.token, abi: fheLaunchTokenAbi, chainId, functionName: 'name' as const },
      { address: l.token, abi: fheLaunchTokenAbi, chainId, functionName: 'symbol' as const },
    ]),
    allowFailure: false,
    query: { enabled: views.length > 0, staleTime: Infinity },
  });
  const names = (meta.data ?? []) as unknown as string[];
  const launches: Launch[] = names.length === views.length * 2 ? views.map((l, i) => ({ ...l, id: ids[i], name: names[2 * i], symbol: names[2 * i + 1] })) : [];

  const fBps = feeBps ?? 200n;
  const hBps = holderBps ?? 5000n;
  const succeeded = launches.filter((l) => l.status === 1);
  const raised = succeeded.reduce((a, l) => a + l.raised, 0n);
  const stats = {
    launches: count ?? 0n,
    live: launches.filter((l) => phaseOf(l) === 'live').length,
    raised,
    toHolders: succeeded.reduce((a, l) => a + (((l.raised * fBps) / 10_000n) * hBps) / 10_000n, 0n),
  };

  const refetch = () => {
    void info.refetch();
    void list.refetch();
  };
  return {
    loaded: count !== undefined && (ids.length === 0 || launches.length === ids.length),
    fee,
    feeBps: fBps,
    holderBps: hBps,
    launches,
    stats,
    refetch,
  };
}
