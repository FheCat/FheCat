/**
 * The CoFHE TaskManager keeps every ciphertext's access list (ACL). The site
 * reads it to know whether the connected wallet may already decrypt a cat, and
 * whether a cat has let the arena in. FHE.sol (cofhe-contracts 1.0) finds the
 * TaskManager through the CoFHEAddressBook, which sits at the same address on
 * every chain; the TaskManager behind it differs (e.g. mainnet vs testnets).
 */
export const COFHE_ADDRESS_BOOK = '0xC0F4e00E531a2B086492Ae3DCC1515038307196b' as const;
export const TASK_MANAGER_ID = 1n;

export const addressBookAbi = [
  {
    type: 'function',
    name: 'getTm',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export const taskManagerAbi = [
  {
    type: 'function',
    name: 'isAllowed',
    stateMutability: 'view',
    inputs: [
      { name: 'ctHash', type: 'uint256' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;
