import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, formatEther } from 'viem';

export function shortAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function formatEth(wei: bigint): string {
  const s = formatEther(wei);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

export function dnaHex(dna: bigint): string {
  return '0x' + dna.toString(16).padStart(16, '0');
}

export function isUserRejection(e: unknown): boolean {
  if (e instanceof BaseError && e.walk((x) => x instanceof UserRejectedRequestError)) return true;
  const text = String((e as { message?: string })?.message ?? e);
  return /user (rejected|denied)|rejected the request|ACTION_REJECTED/i.test(text);
}

/** A short, human-readable reason: the contract's custom error name when there is one. */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) return revert.data.errorName;
    return e.shortMessage || fallback;
  }
  const text = (e as { message?: string })?.message;
  return text ? text.split('\n')[0].slice(0, 160) : fallback;
}

export function formatDuration(seconds: number, lang: 'en' | 'tr'): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const u = lang === 'tr' ? { d: 'g', h: 's', m: 'dk', s: 'sn' } : { d: 'd', h: 'h', m: 'm', s: 's' };
  if (d > 0) return `${d}${u.d} ${h}${u.h}`;
  if (h > 0) return `${h}${u.h} ${m}${u.m}`;
  return `${m}${u.m} ${s}${u.s}`;
}
