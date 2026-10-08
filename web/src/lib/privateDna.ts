import { useCallback, useSyncExternalStore } from 'react';

/**
 * DNA a holder decrypted in private during this visit (a peek on a cat card, or "Show its
 * instincts" in the arena), so their peeked cats fight as themselves on their own screen.
 * It lives in memory only: never stored, never sent, gone on reload, and kept per wallet.
 */
const dnas = new Map<string, bigint>();
const listeners = new Set<() => void>();
let version = 0;

const keyOf = (holder: string, id: bigint) => `${holder.toLowerCase()}:${id}`;

function changed() {
  version++;
  listeners.forEach((l) => l());
}

export function rememberDna(holder: string, id: bigint, dna: bigint) {
  dnas.set(keyOf(holder, id), dna);
  changed();
}

export function forgetDna(holder: string, id: bigint) {
  if (dnas.delete(keyOf(holder, id))) changed();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The DNA this wallet decrypted for a cat, if it did. */
export function usePrivateDna(holder: string | undefined): (id: bigint) => bigint | undefined {
  const v = useSyncExternalStore(subscribe, () => version);
  return useCallback((id: bigint) => (holder ? dnas.get(keyOf(holder, id)) : undefined), [holder, v]);
}
