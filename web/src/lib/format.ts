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

function isUserRejection(e: unknown): boolean {
  if (e instanceof BaseError && e.walk((x) => x instanceof UserRejectedRequestError)) return true;
  const text = String((e as { message?: string })?.message ?? e);
  return /user (rejected|denied)|rejected the request|ACTION_REJECTED/i.test(text);
}

/** A short, human-readable reason: the contract's custom error name when there is one. */
function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) return revert.data.errorName;
    return e.shortMessage || fallback;
  }
  const text = (e as { message?: string })?.message;
  return text ? text.split('\n')[0].slice(0, 160) : fallback;
}

/** What to tell the holder when a wallet request or transaction fails. */
export function failure(e: unknown): string {
  return isUserRejection(e) ? 'Request rejected in the wallet.' : errorMessage(e, 'Something went wrong');
}

/** Retries `fn` while the threshold network catches up with a fresh on-chain permission or result. */
export async function retry<T>(fn: () => Promise<T>, attempts = 8, delayMs = 4000): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts || isUserRejection(e)) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
