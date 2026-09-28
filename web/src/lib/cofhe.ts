import { useEffect, useState } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/web';
import type { CofheClient } from '@cofhe/sdk';
import type { PublicClient, WalletClient } from 'viem';
import { COFHE_CHAINS } from '../config/chains';

// One CoFHE client for the whole app. ACPs (decryption permits) it creates are
// cached in this site's localStorage, so a holder signs once and can peek for 30 days.
const client: CofheClient = createCofheClient(
  createCofheConfig({
    supportedChains: COFHE_CHAINS,
    // FHE public keys are only needed to encrypt inputs, which this site never does.
    // Without this the SDK injects a third-party iframe to cache them.
    fheKeyStorage: null,
    mocks: { decryptDelay: 400, encryptDelay: 0 },
  }),
);

/** The CoFHE client, connected to the wallet's current account and chain (null until it is). */
export function useCofhe(): CofheClient | null {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [ready, setReady] = useState<CofheClient | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(null);
    if (!publicClient || !walletClient) {
      client.disconnect();
      return;
    }
    client
      .connect(publicClient as PublicClient, walletClient as WalletClient)
      .then(() => !cancelled && setReady(client))
      .catch((e) => console.error('CoFHE connect failed', e));
    return () => {
      cancelled = true;
    };
  }, [publicClient, walletClient]);

  return ready;
}

/** Makes sure the holder has a decryption permit (one EIP-712 signature, free). */
export async function ensurePermit(c: CofheClient) {
  await c.acp.getOrCreateSelfACP();
}
