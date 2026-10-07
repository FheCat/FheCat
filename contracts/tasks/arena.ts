import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { arenaAt, cofheClient, fheCatAt, LOCAL_CHAIN_ID, loadDeployment, saveDeployment } from './lib';

// The Blind Arena from the command line: duels with sealed tactics, and power tiers. Tactics are
// encrypted here, with your key; results are decrypted by the CoFHE threshold network and
// settled on-chain with its proof.
//
//   npx hardhat arena:enter 12 --network arb-sepolia
//   npx hardhat arena:duel 12 --opponent 40 --tactic guard --network arb-sepolia

const TACTICS = ['pounce', 'trick', 'guard'];
const TIERS = ['', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const STATUS = ['none', 'open', 'fought', 'settled', 'cancelled'];
const BADGES = ['First Blood', 'Won Blind', 'Hat-trick', 'Sealed Legend', 'Weekly Crown'];

function tacticOf(name: string): number {
  const t = TACTICS.indexOf(name.toLowerCase());
  if (t < 0) throw new Error(`--tactic must be one of: ${TACTICS.join(', ')}`);
  return t;
}

/** A tactic encrypted by `signer` for the arena: only that wallet can use it, and only there. */
async function lockTactic(hre: HardhatRuntimeEnvironment, signer: HardhatEthersSigner, arena: string, tactic: number) {
  const { Encryptable } = await import('@cofhe/sdk');
  const client = await cofheClient(hre, signer);
  const [hash, proof] = await client.encryptInputs([Encryptable.uint8(BigInt(tactic))]).setConsumingContract(arena).execute();
  return [hash, proof] as const;
}

/** Waits for the threshold network to decrypt a public value, then returns it with its proof. */
async function publicValue(hre: HardhatRuntimeEnvironment, signer: HardhatEthersSigner, handle: string) {
  const client = await cofheClient(hre, signer);
  const { decryptedValue, signature } = await client.decryptForTx(handle).withoutACP().set404RetryTimeout(60_000).execute();
  return { value: BigInt(decryptedValue), signature };
}

task('arena:deploy', 'Deploy FheCatArena for this network’s FheCat and point FheCat at it').setAction(async (_, hre) => {
  const d = loadDeployment(hre.network.name);
  const local = Number((await hre.ethers.provider.getNetwork()).chainId) === LOCAL_CHAIN_ID;
  // The CoFHE mocks cannot draw encrypted randomness: locally the luck is pseudo-random.
  const arena = await hre.ethers.deployContract(local ? 'FheCatArenaLocal' : 'FheCatArena', [d.fheCat]);
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

task('arena:duel', 'Challenge a cat (or anyone) with one of your cats and a sealed tactic')
  .addPositionalParam('token', 'your token id', undefined, types.int)
  .addParam('tactic', `${TACTICS.join(', ')} (encrypted before it leaves this machine)`)
  .addOptionalParam('opponent', 'token id to challenge (default: open to any cat)', 0, types.int)
  .setAction(async ({ token, tactic, opponent }: { token: number; tactic: string; opponent: number }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const arena = await arenaAt(hre, signer);
    const [hash, proof] = await lockTactic(hre, signer, await arena.getAddress(), tacticOf(tactic));
    await (await arena.challenge(token, opponent, hash, proof)).wait();
    const id = await arena.duelCount();
    console.log(`Duel #${id}: FheCat #${token} vs ${opponent ? `FheCat #${opponent}` : 'anyone'}, tactic sealed. Waiting for: arena:accept ${id} <token> --tactic <t>`);
  });

task('arena:accept', 'Accept a duel with one of your cats and a sealed tactic, then settle it')
  .addPositionalParam('duel', 'duel id', undefined, types.int)
  .addPositionalParam('token', 'your token id', undefined, types.int)
  .addParam('tactic', TACTICS.join(', '))
  .setAction(async ({ duel, token, tactic }: { duel: number; token: number; tactic: string }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const arena = await arenaAt(hre, signer);
    const [hash, proof] = await lockTactic(hre, signer, await arena.getAddress(), tacticOf(tactic));
    await (await arena.accept(duel, token, hash, proof)).wait();
    console.log(`Duel #${duel} fought under FHE. Waiting for the threshold network...`);
    await hre.run('arena:settle', { duel });
  });

task('arena:settle', 'Publish a fought duel’s result with its decryption proof (anyone can)')
  .addPositionalParam('duel', 'duel id', undefined, types.int)
  .setAction(async ({ duel }: { duel: number }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const arena = await arenaAt(hre, signer);
    const d = await arena.duels(duel);
    if (d.status !== 2n) throw new Error(`Duel #${duel} is ${STATUS[Number(d.status)]}, not fought`);
    const { value, signature } = await publicValue(hre, signer, d.outcome);
    await (await arena.settle(duel, value, signature)).wait();
    const [winner, loser] = value === 1n ? [d.challenger, d.opponent] : [d.opponent, d.challenger];
    const sealed = value === 1n ? d.challengerSealed : d.opponentSealed;
    console.log(`Duel #${duel}: FheCat #${winner} beat FheCat #${loser}${sealed ? ', with a sealed box' : ''}`);
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
    const { value, signature } = await publicValue(hre, signer, (await arena.claims(id)).reached);
    await (await arena.settleTier(id, value === 1n, signature)).wait();
    console.log(value === 1n ? `Proven: FheCat #${token} is ${TIERS[tier]}` : `Not proven: FheCat #${token} is below ${TIERS[tier]}`);
  });

task('arena:status', 'Show a cat’s arena record, or the arena totals')
  .addOptionalPositionalParam('token', 'token id', undefined, types.int)
  .setAction(async ({ token }: { token?: number }, hre) => {
    const arena = await arenaAt(hre);
    const week = await arena.currentWeek();
    if (token === undefined) {
      const leader = await arena.weeklyLeader(week);
      console.table({
        arena: await arena.getAddress(),
        duels: await arena.duelCount(),
        claims: await arena.claimCount(),
        'week leader': leader ? `FheCat #${leader} (${await arena.weeklyPoints(week, leader)} pts)` : 'none yet',
      });
      return;
    }
    const r = await arena.records(token);
    console.table({
      cat: `FheCat #${token}`,
      wins: r.wins,
      losses: r.losses,
      'sealed wins': r.sealedWins,
      streak: `${r.streak} (best ${r.bestStreak})`,
      'points this week': await arena.weeklyPoints(week, token),
      badges: BADGES.filter((_, i) => (Number(r.badges) >> i) & 1).join(', ') || 'none',
      tier: TIERS[Number(r.tier)] || 'none proven',
      power: (await arena.powerHandle(token)) === hre.ethers.ZeroHash ? 'not sealed yet' : 'sealed',
    });
  });
