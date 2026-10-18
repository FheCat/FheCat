import { createConfig, http, injected, mock } from 'wagmi';
import { hardhat } from 'viem/chains';
import { DEPLOYMENTS, WAGMI_CHAINS, chainInfo } from './chains';

/**
 * Hardhat's first two dev accounts; only offered on a local chain with VITE_DEV_WALLET=true.
 * `?dev=1` picks the second, so two tabs can play each other in the arena.
 */
const DEV_ACCOUNTS = ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'] as const;
export const DEV_WALLET = import.meta.env.VITE_DEV_WALLET === 'true' && Boolean(DEPLOYMENTS[hardhat.id]);
const DEV_ACCOUNT = DEV_ACCOUNTS[new URLSearchParams(globalThis.location?.search ?? '').get('dev') === '1' ? 1 : 0];

export const wagmiConfig = createConfig({
  chains: WAGMI_CHAINS,
  // EIP-6963 discovery lists every installed browser wallet (MetaMask, Rabby, OKX, ...).
  connectors: [injected(), ...(DEV_WALLET ? [mock({ accounts: [DEV_ACCOUNT], features: { reconnect: true } })] : [])],
  transports: Object.fromEntries(WAGMI_CHAINS.map((c) => [c.id, http(chainInfo(c.id)?.rpc)])),
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
