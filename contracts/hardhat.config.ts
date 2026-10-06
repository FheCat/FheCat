import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-verify';
import '@typechain/hardhat';
import '@cofhe/hardhat-plugin';
import * as dotenv from 'dotenv';

dotenv.config();

import './tasks/fhecat';
import './tasks/arena';

// The deploy key, from the environment (with or without 0x). It never belongs in a file in this repo.
const key = process.env.PRIVATE_KEY?.trim();
const accounts = key ? [key.startsWith('0x') ? key : `0x${key}`] : [];

const RPC = {
  'eth-sepolia': process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia.publicnode.com',
  'arb-sepolia': process.env.ARBITRUM_SEPOLIA_RPC_URL ?? 'https://sepolia-rollup.arbitrum.io/rpc',
  'base-sepolia': process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org',
  // Fhenix mainnet (CoFHE on Ethereum and Arbitrum One). Use your own RPC for real deployments.
  ethereum: process.env.ETHEREUM_RPC_URL ?? 'https://ethereum.publicnode.com',
  arbitrum: process.env.ARBITRUM_RPC_URL ?? 'https://arb1.arbitrum.io/rpc',
} as const;

const CHAIN_IDS = {
  'eth-sepolia': 11155111,
  'arb-sepolia': 421614,
  'base-sepolia': 84532,
  ethereum: 1,
  arbitrum: 42161,
} as const;

// FORK=arb-sepolia runs the in-process network on top of a live CoFHE testnet (see test/fork).
const fork = process.env.FORK as keyof typeof RPC | undefined;

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      evmVersion: 'cancun',
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: fork ? { forking: { url: RPC[fork] }, chainId: CHAIN_IDS[fork] } : {},
    'eth-sepolia': { url: RPC['eth-sepolia'], chainId: CHAIN_IDS['eth-sepolia'], accounts },
    'arb-sepolia': { url: RPC['arb-sepolia'], chainId: CHAIN_IDS['arb-sepolia'], accounts },
    'base-sepolia': { url: RPC['base-sepolia'], chainId: CHAIN_IDS['base-sepolia'], accounts },
    ethereum: { url: RPC.ethereum, chainId: CHAIN_IDS.ethereum, accounts },
    arbitrum: { url: RPC.arbitrum, chainId: CHAIN_IDS.arbitrum, accounts },
  },
  etherscan: {
    // Etherscan API v2: one key covers Sepolia, Arbitrum Sepolia and Base Sepolia.
    apiKey: process.env.ETHERSCAN_API_KEY ?? '',
  },
  sourcify: { enabled: false },
  cofhe: {
    logMocks: false,
    gasWarning: false,
  },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
  mocha: {
    timeout: 120_000,
  },
};

export default config;
