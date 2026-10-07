/**
 * The whole sale, rehearsed on a live CoFHE testnet with throwaway wallets:
 * allowlist and public mints, every refusal, peek, both kinds of reveal, a
 * transfer, the arena, the owner's tools and the two-step ownership hand-over.
 * Each step checks what it did on-chain and the run ends with the sale closed.
 *
 *   REHEARSAL_KEYS=keys.json REHEARSAL_STATE=state.json \
 *     npx hardhat run scripts/rehearse.ts --network arb-sepolia
 *
 * keys.json holds { owner, alice, bob, carol } private keys and must live
 * outside the repo. The owner is the deployer; alice and carol are on the
 * allowlist (allowlist/<network>.txt), bob is not. Completed steps are kept in
 * state.json, so a run interrupted by a slow network resumes where it stopped.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import hre from 'hardhat';
import type { ContractTransactionResponse, Wallet } from 'ethers';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia, baseSepolia, hardhat, sepolia } from 'viem/chains';
import { FheTypes, type CofheClient } from '@cofhe/sdk';
import { renderCatSvg, renderSealedSvg } from '../../art';
import { loadDeployment } from '../tasks/lib';
import type { FheCat, FheCatArena } from '../typechain-types';

type Name = 'owner' | 'alice' | 'bob' | 'carol';
interface State {
  done: string[];
  tokens: Partial<Record<Name, string[]>>;
  duel?: string;
  /** The DNA alice decrypted in private, to compare with the public reveal later. */
  seen?: string;
  log: { step: string; what: string; gas?: string; fee?: string; tx?: string; ms?: number }[];
}

const { ethers, network } = hre;
// localhost is a dry run against the CoFHE mocks (npx hardhat node + deploy:local).
const CHAINS = { 'arb-sepolia': arbitrumSepolia, 'base-sepolia': baseSepolia, 'eth-sepolia': sepolia, localhost: hardhat } as const;
const ADDRESS_BOOK = '0xC0F4e00E531a2B086492Ae3DCC1515038307196b';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name}`);
  return v;
}

const statePath = need('REHEARSAL_STATE');
const keys: Record<Name, string> = JSON.parse(readFileSync(need('REHEARSAL_KEYS'), 'utf8'));
const state: State = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { done: [], tokens: {}, log: [] };
const save = () => writeFileSync(statePath, JSON.stringify(state, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2));

function note(step: string, what: string, extra: Omit<State['log'][number], 'step' | 'what'> = {}) {
  state.log.push({ step, what, ...extra });
  save();
  const cost = extra.gas ? `  gas ${extra.gas}  fee ${extra.fee} ETH` : '';
  const time = extra.ms !== undefined ? `  ${(extra.ms / 1000).toFixed(1)}s` : '';
  console.log(`  ✓ ${what}${cost}${time}`);
}

function check(ok: boolean, what: string) {
  if (!ok) throw new Error(`Check failed: ${what}`);
}

/** Sends, waits and records the gas and fee of one transaction. */
async function tx(step: string, what: string, sent: Promise<ContractTransactionResponse>) {
  const r = await (await sent).wait();
  if (!r || r.status !== 1) throw new Error(`${what}: reverted`);
  note(step, what, { gas: r.gasUsed.toString(), fee: ethers.formatEther(r.gasUsed * r.gasPrice), tx: r.hash });
  return r;
}

/** The custom error a call reverted with: decoded by ethers on a real node, named in the message by Hardhat's. */
function errorName(e: unknown): string | undefined {
  const err = e as { revert?: { name?: string }; message?: string };
  return err.revert?.name ?? /custom error '(\w+)\(/.exec(err.message ?? '')?.[1];
}

/** Expects a call to revert with the named custom error. */
async function refused(step: string, what: string, error: string, call: () => Promise<unknown>) {
  try {
    await call();
  } catch (e) {
    const name = errorName(e);
    check(name === error, `${what}: expected ${error}, got ${name ?? (e as Error).message.split('\n')[0]}`);
    note(step, `${what} → ${error}`);
    return;
  }
  throw new Error(`${what}: expected ${error}, but it went through`);
}

/** The threshold network may need a few seconds to see a fresh grant or result. */
async function retry<T>(fn: () => Promise<T>, attempts = 12, delayMs = 5000): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t = Date.now();
  const v = await fn();
  return [v, Date.now() - t];
}

function svgOf(uri: string): string {
  const json = JSON.parse(Buffer.from(uri.replace('data:application/json;base64,', ''), 'base64').toString('utf8'));
  return Buffer.from(String(json.image).replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8');
}

async function main() {
  const chain = CHAINS[network.name as keyof typeof CHAINS];
  if (!chain) throw new Error(`Run this on a CoFHE testnet or localhost (${Object.keys(CHAINS).join(', ')}), not ${network.name}`);
  const d = loadDeployment(network.name);
  if (!d.arena) throw new Error('No arena in this deployment');

  const w = Object.fromEntries(Object.entries(keys).map(([n, k]) => [n, new ethers.Wallet(k, ethers.provider)])) as Record<Name, Wallet>;
  const nft = (who: Name) => ethers.getContractAt('FheCat', d.fheCat, w[who]) as unknown as Promise<FheCat>;
  const arena = (who: Name) => ethers.getContractAt('FheCatArena', d.arena!, w[who]) as unknown as Promise<FheCatArena>;
  const read = await nft('owner');
  const rpc = (network.config as { url: string }).url;
  const local = network.name === 'localhost';

  const clients = new Map<Name, CofheClient>();
  async function cofhe(who: Name): Promise<CofheClient> {
    if (!clients.has(who)) {
      const { createCofheClient, createCofheConfig } = await import('@cofhe/sdk/node');
      const { chains } = await import('@cofhe/sdk/chains');
      const client = local
        ? hre.cofhe.createClient(await hre.cofhe.createConfig({ environment: 'hardhat', supportedChains: [chains.hardhat] }))
        : createCofheClient(
            createCofheConfig({
              supportedChains: [{ 'arb-sepolia': chains.arbSepolia, 'base-sepolia': chains.baseSepolia, 'eth-sepolia': chains.sepolia }[network.name]!],
            }),
          );
      const transport = http(rpc);
      await client.connect(
        createPublicClient({ chain, transport }),
        createWalletClient({ account: privateKeyToAccount(keys[who] as `0x${string}`), chain, transport }),
      );
      clients.set(who, client);
    }
    return clients.get(who)!;
  }

  const taskManager = await new ethers.Contract(ADDRESS_BOOK, ['function getTm(uint256) view returns (address)'], ethers.provider).getTm(1);
  const acl = new ethers.Contract(taskManager, ['function isAllowed(uint256,address) view returns (bool)'], ethers.provider);
  const tree = StandardMerkleTree.load<[string]>(JSON.parse(readFileSync(join(__dirname, '..', '..', 'web', 'public', 'allowlist.json'), 'utf8')));
  const proofFor = (who: Name) => {
    for (const [i, [a]] of tree.entries()) if (a.toLowerCase() === w[who].address.toLowerCase()) return tree.getProof(i);
    return [];
  };
  const born = (receipt: Awaited<ReturnType<typeof tx>>) =>
    receipt.logs.flatMap((l) => {
      try {
        const e = read.interface.parseLog(l);
        return e?.name === 'CatBorn' ? [e.args.tokenId.toString() as string] : [];
      } catch {
        return [];
      }
    });
  const tokens = (who: Name) => (state.tokens[who] ?? []).map(BigInt);

  console.log(`Rehearsal on ${network.name}: FheCat ${d.fheCat}, arena ${d.arena}, TaskManager ${taskManager}`);
  for (const n of Object.keys(w) as Name[]) {
    console.log(`  ${n.padEnd(6)} ${w[n].address}  ${ethers.formatEther(await ethers.provider.getBalance(w[n].address))} ETH`);
  }
  check((await read.owner()) === w.owner.address, 'the owner key owns the contract');
  const publicPrice = await read.publicPrice();
  const allowlistPrice = await read.allowlistPrice();

  const steps: [string, () => Promise<void>][] = [
    [
      'fund',
      async () => {
        for (const n of ['alice', 'bob', 'carol'] as Name[]) {
          if ((await ethers.provider.getBalance(w[n].address)) >= ethers.parseEther('0.008')) continue;
          const sent = await w.owner.sendTransaction({ to: w[n].address, value: ethers.parseEther('0.012') });
          const r = await sent.wait();
          note('fund', `0.012 ETH to ${n}`, { gas: r!.gasUsed.toString(), fee: ethers.formatEther(r!.gasUsed * r!.gasPrice), tx: r!.hash });
        }
      },
    ],
    [
      'allowlist-phase',
      async () => {
        check((await read.allowlistRoot()) === tree.root, 'the contract root matches the published allowlist');
        if ((await read.phase()) !== 1n) await tx('allowlist-phase', 'sale phase: allowlist', read.setPhase(1));
        check((await read.phase()) === 1n, 'phase is allowlist');
      },
    ],
    [
      'allowlist-refusals',
      async () => {
        const bob = await nft('bob');
        await refused('allowlist-refusals', 'bob (not listed) mints on the allowlist', 'NotOnAllowlist', () =>
          bob.allowlistMint.staticCall(1, proofFor('alice'), { value: allowlistPrice }),
        );
        const alice = await nft('alice');
        await refused('allowlist-refusals', 'alice pays nothing', 'WrongPayment', () => alice.allowlistMint.staticCall(1, proofFor('alice'), { value: 0 }));
        await refused('allowlist-refusals', 'alice mints in the public phase', 'SaleNotActive', () => alice.mint.staticCall(1, { value: publicPrice }));
      },
    ],
    [
      'allowlist-mint',
      async () => {
        const alice = await nft('alice');
        const r = await tx('allowlist-mint', 'alice mints 3 on the allowlist', alice.allowlistMint(3, proofFor('alice'), { value: allowlistPrice * 3n }));
        state.tokens.alice = born(r);
        check(state.tokens.alice.length === 3, 'three cats born');
        for (const id of tokens('alice')) check((await read.stateOf(id)) === 0n, `#${id} is unopened`);
        await refused('allowlist-mint', 'alice mints a 4th', 'ExceedsWalletLimit', () =>
          alice.allowlistMint.staticCall(1, proofFor('alice'), { value: allowlistPrice }),
        );
        const carol = await nft('carol');
        const rc = await tx('allowlist-mint', 'carol mints 1 on the allowlist', carol.allowlistMint(1, proofFor('carol'), { value: allowlistPrice }));
        state.tokens.carol = born(rc);
      },
    ],
    [
      'public-mint',
      async () => {
        await tx('public-mint', 'sale phase: public', read.setPhase(2));
        const bob = await nft('bob');
        await refused('public-mint', 'bob underpays', 'WrongPayment', () => bob.mint.staticCall(1, { value: publicPrice - 1n }));
        const r = await tx('public-mint', 'bob mints 3 in the public sale', bob.mint(3, { value: publicPrice * 3n }));
        state.tokens.bob = born(r);
        check(state.tokens.bob.length === 3, 'three cats born');
        await refused('public-mint', 'bob mints a 4th', 'ExceedsWalletLimit', () => bob.mint.staticCall(1, { value: publicPrice }));
        await refused('public-mint', 'a cat beyond 10 per transaction', 'InvalidQuantity', () => bob.mint.staticCall(11, { value: publicPrice * 11n }));
      },
    ],
    [
      'peek',
      async () => {
        const [a1] = tokens('alice');
        await refused('peek', 'bob peeks at alice’s cat', 'NotHolder', async () => (await nft('bob')).peek.staticCall(a1));
        const alice = await nft('alice');
        await tx('peek', `alice peeks at #${a1}`, alice.peek(a1));
        check((await read.stateOf(a1)) === 1n, `#${a1} is peeked`);
        const handle = (await read.catOf(a1)).dnaHandle;
        check(await acl.isAllowed(handle, w.alice.address), 'alice is on the DNA’s access list');
        check(!(await acl.isAllowed(handle, w.bob.address)), 'bob is not');
        const c = await cofhe('alice');
        await c.acp.getOrCreateSelfACP();
        const [dna, ms] = await timed(() => retry(() => c.decryptForView(handle, FheTypes.Uint64).execute()));
        note('peek', `alice decrypts #${a1} in private: DNA 0x${(dna as bigint).toString(16).padStart(16, '0')}`, { ms });
        state.seen = String(dna);
      },
    ],
    [
      'own-reveal',
      async () => {
        const [, a2] = tokens('alice');
        const alice = await nft('alice');
        await tx('own-reveal', `alice peeks at #${a2}`, alice.peek(a2));
        const handle = (await read.catOf(a2)).dnaHandle;
        const c = await cofhe('alice');
        const [seen] = await timed(() => retry(() => c.decryptForView(handle, FheTypes.Uint64).execute()));
        const [proof, ms] = await timed(() => retry(() => c.decryptForTx(handle).withACP().execute()));
        note('own-reveal', `threshold network signs #${a2}’s DNA for alice`, { ms });
        check(proof.decryptedValue === seen, 'the signed DNA is the one alice saw');
        await refused('own-reveal', 'bob reveals alice’s peeked cat', 'RevealLocked', async () =>
          (await nft('bob')).reveal.staticCall(a2, proof.decryptedValue, proof.signature),
        );
        await refused('own-reveal', 'alice reveals a forged DNA', 'InvalidDecryptionProof', () =>
          alice.reveal.staticCall(a2, (proof.decryptedValue as bigint) ^ 1n, proof.signature),
        );
        await tx('own-reveal', `alice reveals #${a2} with her own proof`, alice.reveal(a2, proof.decryptedValue, proof.signature));
        const cat = await read.catOf(a2);
        check(cat.state === 3n && cat.dna === proof.decryptedValue, `#${a2} is revealed with that DNA`);
        check(svgOf(await read.tokenURI(a2)) === renderCatSvg(cat.dna), 'on-chain art matches the site’s renderer');
        note('own-reveal', `tokenURI art of #${a2} matches the TypeScript renderer byte for byte`);
      },
    ],
    [
      'transfer-open-reveal',
      async () => {
        const [a1] = tokens('alice');
        const alice = await nft('alice');
        await tx('transfer-open-reveal', `alice sends peeked #${a1} to carol`, alice.transferFrom(w.alice.address, w.carol.address, a1));
        check((await read.ownerOf(a1)) === w.carol.address && (await read.stateOf(a1)) === 1n, `#${a1} is carol’s and still marked peeked`);
        const handle = (await read.catOf(a1)).dnaHandle;
        check(!(await acl.isAllowed(handle, w.carol.address)), 'carol cannot decrypt it');
        await tx('transfer-open-reveal', `carol opens #${a1} for everyone`, (await nft('carol')).open(a1));
        check((await read.stateOf(a1)) === 2n, `#${a1} is open`);
        const c = await cofhe('bob');
        const [proof, ms] = await timed(() => retry(() => c.decryptForTx(handle).withoutACP().execute()));
        note('transfer-open-reveal', `public decryption of #${a1}`, { ms });
        check(String(proof.decryptedValue) === state.seen, 'the public DNA is the one alice saw in private');
        await tx('transfer-open-reveal', `bob (not the holder) finishes #${a1}’s reveal`, (await nft('bob')).reveal(a1, proof.decryptedValue, proof.signature));
        check((await read.stateOf(a1)) === 3n, `#${a1} is revealed`);
        const [b1] = tokens('bob');
        const sealed = await read.catOf(b1);
        check(svgOf(await read.tokenURI(b1)) === renderSealedSvg(0, sealed.dnaHandle), 'sealed box art matches the site’s renderer');
        note('transfer-open-reveal', `tokenURI of sealed #${b1} matches the TypeScript renderer`);
      },
    ],
    [
      'arena',
      async () => {
        const [, , a3] = tokens('alice');
        const [b1] = tokens('bob');
        const ar = await arena('alice');
        await refused('arena', `alice challenges with #${a3} before entering`, 'NotInArena', () => ar.challenge.staticCall(a3, 0));
        await tx('arena', `alice lets the arena in for #${a3}`, (await nft('alice')).enterArena(a3));
        await tx('arena', `bob lets the arena in for #${b1}`, (await nft('bob')).enterArena(b1));
        const rc = await tx('arena', `alice challenges anyone with #${a3}`, ar.challenge(a3, 0));
        const event = (r: typeof rc, name: string) => r.logs.map((l) => ar.interface.parseLog(l)).find((e) => e?.name === name)!;
        const duelId = event(rc, 'DuelOpened').args.duelId as bigint;
        state.duel = duelId.toString();
        const ra = await tx('arena', `bob accepts duel #${duelId} with #${b1}`, (await arena('bob')).accept(duelId, b1));
        const fought = event(ra, 'DuelFought');
        const c = await cofhe('carol');
        const [res, ms] = await timed(() => retry(() => c.decryptForTx(fought.args.outcomeHandle).withoutACP().execute()));
        note('arena', `public decryption of the duel’s result`, { ms });
        await tx('arena', 'carol (a bystander) settles the duel', (await arena('carol')).settle(duelId, res.decryptedValue === 1n, res.signature));
        const duel = await ar.duels(duelId);
        const [winner, loser] = res.decryptedValue === 1n ? [a3, b1] : [b1, a3];
        check(duel.status === 3n && duel.winner === winner, 'the duel is settled with that winner');
        const [rw, rl] = [await ar.records(winner), await ar.records(loser)];
        check(rw.wins === 1n && rl.losses === 1n, 'records updated');
        note('arena', `#${winner} beat #${loser}; neither cat was opened (${await read.stateOf(a3)}, ${await read.stateOf(b1)})`);
        const rt = await tx('arena', `bob asks whether #${b1} is Rare`, (await arena('bob')).claimTier(b1, 1));
        const claimed = event(rt, 'TierClaimed');
        const [ans, ms2] = await timed(() => retry(() => c.decryptForTx(claimed.args.resultHandle).withoutACP().execute()));
        note('arena', 'public decryption of the tier answer', { ms: ms2 });
        await tx('arena', `the answer is settled: #${b1} is ${ans.decryptedValue === 1n ? '' : 'not '}Rare`, (await arena('bob')).settleTier(claimed.args.claimId, ans.decryptedValue === 1n, ans.signature));
      },
    ],
    [
      'owner-tools',
      async () => {
        await refused('owner-tools', 'bob opens the sale', 'OwnableUnauthorizedAccount', async () => (await nft('bob')).setPhase.staticCall(0));
        const r = await tx('owner-tools', 'team reserve: 2 cats to carol', read.ownerMint(w.carol.address, 2));
        state.tokens.carol = [...(state.tokens.carol ?? []), ...born(r)];
        await tx('owner-tools', 'prices doubled', read.setPrices(publicPrice * 2n, allowlistPrice * 2n));
        check((await read.publicPrice()) === publicPrice * 2n, 'new public price');
        await tx('owner-tools', 'prices back', read.setPrices(publicPrice, allowlistPrice));
        await tx('owner-tools', 'wallet limits 5/5', read.setWalletLimits(5, 5));
        await tx('owner-tools', 'wallet limits back to 3/3', read.setWalletLimits(3, 3));
        await tx('owner-tools', 'royalty 6.5%', read.setDefaultRoyalty(w.owner.address, 650));
        check((await read.royaltyInfo(1, 10_000))[1] === 650n, 'royalty is 6.5%');
        await tx('owner-tools', 'royalty back to 5%', read.setDefaultRoyalty(w.owner.address, 500));
        const raised = await ethers.provider.getBalance(d.fheCat);
        check(raised === allowlistPrice * 4n + publicPrice * 3n, `the contract holds every mint payment (${ethers.formatEther(raised)} ETH)`);
        await refused('owner-tools', 'bob withdraws', 'OwnableUnauthorizedAccount', async () => (await nft('bob')).withdraw.staticCall(w.bob.address));
        await tx('owner-tools', `withdraw ${ethers.formatEther(raised)} ETH`, read.withdraw(w.owner.address));
        check((await ethers.provider.getBalance(d.fheCat)) === 0n, 'contract emptied');
      },
    ],
    [
      'ownership',
      async () => {
        await tx('ownership', 'owner offers the contract to carol', read.transferOwnership(w.carol.address));
        check((await read.owner()) === w.owner.address && (await read.pendingOwner()) === w.carol.address, 'still owner until carol accepts');
        await refused('ownership', 'bob accepts', 'OwnableUnauthorizedAccount', async () => (await nft('bob')).acceptOwnership.staticCall());
        await tx('ownership', 'carol accepts', (await nft('carol')).acceptOwnership());
        check((await read.owner()) === w.carol.address, 'carol owns it');
        await tx('ownership', 'carol offers it back', (await nft('carol')).transferOwnership(w.owner.address));
        await tx('ownership', 'owner accepts', read.acceptOwnership());
        check((await read.owner()) === w.owner.address, 'owner owns it again');
      },
    ],
    [
      'close',
      async () => {
        await tx('close', 'sale closed (nobody else can mint on the testnet)', read.setPhase(0));
        const supply = await read.totalSupply();
        const cats = await read.catsInRange(1, supply);
        const states = [0, 0, 0, 0];
        for (const c of cats) states[Number(c.state)]++;
        note('close', `${supply} cats: ${states[0]} unopened, ${states[1]} peeked, ${states[2]} opened, ${states[3]} revealed`);
      },
    ],
  ];

  for (const [name, run] of steps) {
    if (state.done.includes(name)) {
      console.log(`- ${name} (done)`);
      continue;
    }
    console.log(`- ${name}`);
    await run();
    state.done.push(name);
    save();
  }

  const fees = state.log.reduce((sum, l) => sum + (l.fee ? ethers.parseEther(l.fee) : 0n), 0n);
  console.log(`\nAll ${steps.length} steps passed. Gas fees paid: ${ethers.formatEther(fees)} ETH. Log: ${statePath}`);
  for (const c of clients.values()) c.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
