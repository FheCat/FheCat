/**
 * The CoFHE TaskManager keeps every ciphertext's access list (ACL). The site
 * reads it to know whether the connected wallet may already decrypt a cat, and
 * whether a cat has let the arena in. Same address on every CoFHE chain, and
 * the Hardhat plugin installs its mock there too.
 */
export const TASK_MANAGER = '0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9' as const;

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
