import { createConfig, http, injected, mock } from 'wagmi';
import { hardhat } from 'viem/chains';
import { DEPLOYMENTS, WAGMI_CHAINS } from './chains';

/** Hardhat's first dev account; only offered on a local chain with VITE_DEV_WALLET=true. */
const DEV_ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
export const DEV_WALLET = import.meta.env.VITE_DEV_WALLET === 'true' && Boolean(DEPLOYMENTS[hardhat.id]);

export const wagmiConfig = createConfig({
  chains: WAGMI_CHAINS,
  // EIP-6963 discovery lists every installed browser wallet (MetaMask, Rabby, OKX, ...).
  connectors: [injected(), ...(DEV_WALLET ? [mock({ accounts: [DEV_ACCOUNT], features: { reconnect: true } })] : [])],
  transports: Object.fromEntries(WAGMI_CHAINS.map((c) => [c.id, http()])),
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
