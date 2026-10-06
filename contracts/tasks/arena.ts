import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { arenaAt, cofheClient, fheCatAt, loadDeployment, saveDeployment } from './lib';

// The arena from the command line: blind duels and power tiers. Results are
// decrypted by the CoFHE threshold network and settled on-chain with its proof.
//
//   npx hardhat arena:enter 12 --network arb-sepolia
//   npx hardhat arena:duel 12 --opponent 40 --network arb-sepolia

const TIERS = ['', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const STATUS = ['none', 'open', 'fought', 'settled', 'cancelled'];

/** Waits for the threshold network to decrypt a public ebool, then returns it with its proof. */
async function publicBool(hre: HardhatRuntimeEnvironment, signer: HardhatEthersSigner, handle: string) {
  const client = await cofheClient(hre, signer);
  const { decryptedValue, signature } = await client.decryptForTx(handle).withoutACP().set404RetryTimeout(60_000).execute();
  return { value: decryptedValue === 1n, signature };
}

task('arena:deploy', 'Deploy FheCatArena for this network’s FheCat and point FheCat at it').setAction(async (_, hre) => {
  const d = loadDeployment(hre.network.name);
  const arena = await hre.ethers.deployContract('FheCatArena', [d.fheCat]);
  await arena.waitForDeployment();
  const address = await arena.getAddress();
  const nft = await fheCatAt(hre);
  await (await nft.setArena(address)).wait();
  saveDeployment({ ...d, arena: address });
  console.log(`FheCatArena ${address}, set as FheCat's arena. Holders must enter again: arena:enter <token>`);
});

task('arena:enter', 'Let the arena compute on one of your cats (needed once per arena)')
  .addPositionalParam('token', 'token id', undefined, types.int)
  .setAction(async ({ token }: { token: number }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const nft = await fheCatAt(hre, signer);
    await (await nft.enterArena(token)).wait();
    console.log(`FheCat #${token} entered the arena`);
  });

task('arena:duel', 'Challenge a cat (or anyone) with one of your cats')
  .addPositionalParam('token', 'your token id', undefined, types.int)
  .addOptionalParam('opponent', 'token id to challenge (default: open to any cat)', 0, types.int)
  .setAction(async ({ token, opponent }: { token: number; opponent: number }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const arena = await arenaAt(hre, signer);
    await (await arena.challenge(token, opponent)).wait();
    const id = await arena.duelCount();
    console.log(`Duel #${id}: FheCat #${token} vs ${opponent ? `FheCat #${opponent}` : 'anyone'}. Waiting for: arena:accept ${id} <token>`);
  });

task('arena:accept', 'Accept a duel with one of your cats, then settle it')
  .addPositionalParam('duel', 'duel id', undefined, types.int)
  .addPositionalParam('token', 'your token id', undefined, types.int)
  .setAction(async ({ duel, token }: { duel: number; token: number }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const arena = await arenaAt(hre, signer);
    await (await arena.accept(duel, token)).wait();
    console.log(`Duel #${duel} fought. Waiting for the threshold network...`);
    await hre.run('arena:settle', { duel });
  });

task('arena:settle', 'Publish a fought duel’s result with its decryption proof (anyone can)')
  .addPositionalParam('duel', 'duel id', undefined, types.int)
  .setAction(async ({ duel }: { duel: number }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const arena = await arenaAt(hre, signer);
    const d = await arena.duels(duel);
    if (d.status !== 2n) throw new Error(`Duel #${duel} is ${STATUS[Number(d.status)]}, not fought`);
    const { value, signature } = await publicBool(hre, signer, d.challengerWins);
    await (await arena.settle(duel, value, signature)).wait();
    const [winner, loser] = value ? [d.challenger, d.opponent] : [d.opponent, d.challenger];
    console.log(`Duel #${duel}: FheCat #${winner} beat FheCat #${loser}`);
  });

task('arena:tier', 'Prove one of your cats reaches a tier (1 Rare, 2 Epic, 3 Legendary, 4 Mythic), sealed')
  .addPositionalParam('token', 'your token id', undefined, types.int)
  .addPositionalParam('tier', '1-4', undefined, types.int)
  .setAction(async ({ token, tier }: { token: number; tier: number }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const arena = await arenaAt(hre, signer);
    await (await arena.claimTier(token, tier)).wait();
    const id = await arena.claimCount();
    console.log(`Claim #${id}: FheCat #${token} is ${TIERS[tier]}? Waiting for the threshold network...`);
    const { value, signature } = await publicBool(hre, signer, (await arena.claims(id)).reached);
    await (await arena.settleTier(id, value, signature)).wait();
    console.log(value ? `Proven: FheCat #${token} is ${TIERS[tier]}` : `Not proven: FheCat #${token} is below ${TIERS[tier]}`);
  });

task('arena:status', 'Show a cat’s arena record, or the arena totals')
  .addOptionalPositionalParam('token', 'token id', undefined, types.int)
  .setAction(async ({ token }: { token?: number }, hre) => {
    const arena = await arenaAt(hre);
    if (token === undefined) {
      console.table({ arena: await arena.getAddress(), duels: await arena.duelCount(), claims: await arena.claimCount() });
      return;
    }
    const r = await arena.records(token);
    console.table({
      cat: `FheCat #${token}`,
      wins: r.wins,
      losses: r.losses,
      tier: TIERS[Number(r.tier)] || 'none proven',
      power: (await arena.powerHandle(token)) === hre.ethers.ZeroHash ? 'not sealed yet' : 'sealed',
    });
  });
