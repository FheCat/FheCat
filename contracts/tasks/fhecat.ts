import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { task, types } from 'hardhat/config';
import { PHASES, cofheClient, fheCatAt, loadDeployment } from './lib';

// Collection management from the command line. Every task works on the
// deployment recorded in deployments/<network>.json, e.g.
//
//   npx hardhat fhecat:status --network arb-sepolia

task('fhecat:status', 'Show the collection state').setAction(async (_, hre) => {
  const d = loadDeployment(hre.network.name);
  const nft = await fheCatAt(hre);
  const [phase, supply, max, pub, al, maxW, alMaxW, root, grand, owner] = await Promise.all([
    nft.phase(),
    nft.totalSupply(),
    nft.maxSupply(),
    nft.publicPrice(),
    nft.allowlistPrice(),
    nft.maxPerWallet(),
    nft.allowlistMaxPerWallet(),
    nft.allowlistRoot(),
    nft.grandRevealAt(),
    nft.owner(),
  ]);
  const { formatEther } = hre.ethers;
  console.table({
    contract: d.fheCat,
    owner,
    phase: PHASES[Number(phase)],
    minted: `${supply} / ${max}`,
    'public price': `${formatEther(pub)} ETH (max ${maxW || '∞'} per wallet)`,
    'allowlist price': `${formatEther(al)} ETH (max ${alMaxW || '∞'} per wallet)`,
    'allowlist root': root,
    'grand reveal': grand === 0n ? 'not scheduled' : new Date(Number(grand) * 1000).toISOString(),
    balance: `${formatEther(await hre.ethers.provider.getBalance(d.fheCat))} ETH`,
  });
});

task('fhecat:phase', 'Open or close the sale')
  .addPositionalParam('phase', PHASES.join(' | '))
  .setAction(async ({ phase }: { phase: string }, hre) => {
    const i = PHASES.indexOf(phase as (typeof PHASES)[number]);
    if (i < 0) throw new Error(`phase must be one of ${PHASES.join(', ')}`);
    const nft = await fheCatAt(hre);
    await (await nft.setPhase(i)).wait();
    console.log(`Sale phase: ${phase}`);
  });

task('fhecat:prices', 'Set mint prices (in ETH)')
  .addParam('public', 'public mint price', undefined, types.string)
  .addParam('allowlist', 'allowlist mint price', undefined, types.string)
  .setAction(async (args: { public: string; allowlist: string }, hre) => {
    const nft = await fheCatAt(hre);
    await (await nft.setPrices(hre.ethers.parseEther(args.public), hre.ethers.parseEther(args.allowlist))).wait();
    console.log(`Prices: public ${args.public} ETH, allowlist ${args.allowlist} ETH`);
  });

task('fhecat:limits', 'Set mints per wallet (0 = unlimited)')
  .addParam('public', 'public phase limit', undefined, types.int)
  .addParam('allowlist', 'allowlist phase limit', undefined, types.int)
  .setAction(async (args: { public: number; allowlist: number }, hre) => {
    const nft = await fheCatAt(hre);
    await (await nft.setWalletLimits(args.public, args.allowlist)).wait();
    console.log(`Wallet limits: public ${args.public}, allowlist ${args.allowlist}`);
  });

task('fhecat:allowlist', 'Build the allowlist Merkle tree from a file of addresses and set its root')
  .addPositionalParam('file', 'text file, one address per line (# comments allowed)')
  .setAction(async ({ file }: { file: string }, hre) => {
    const { StandardMerkleTree } = await import('@openzeppelin/merkle-tree');
    const lines = readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.replace(/#.*/, '').trim())
      .filter(Boolean);
    const bad = lines.filter((l) => !hre.ethers.isAddress(l));
    if (bad.length) throw new Error(`Not addresses: ${bad.join(', ')}`);
    const addresses = [...new Set(lines.map((l) => hre.ethers.getAddress(l)))];
    const tree = StandardMerkleTree.of(
      addresses.map((a) => [a]),
      ['address'],
    );

    // The mint site builds proofs from this dump.
    const out = join(__dirname, '..', '..', 'web', 'public', 'allowlist.json');
    mkdirSync(join(out, '..'), { recursive: true });
    writeFileSync(out, JSON.stringify(tree.dump()));
    const nft = await fheCatAt(hre);
    await (await nft.setAllowlistRoot(tree.root)).wait();
    console.log(`Allowlist: ${addresses.length} addresses, root ${tree.root}\nWrote ${out} (commit & redeploy the site)`);
  });

task('fhecat:airdrop', 'Mint cats to an address from the team reserve')
  .addParam('to', 'recipient')
  .addOptionalParam('quantity', 'how many (max 10 per call)', 1, types.int)
  .setAction(async (args: { to: string; quantity: number }, hre) => {
    const nft = await fheCatAt(hre);
    await (await nft.ownerMint(args.to, args.quantity)).wait();
    console.log(`Minted ${args.quantity} to ${args.to}. Supply: ${await nft.totalSupply()}`);
  });

task('fhecat:grand-reveal', 'Schedule when anyone may decrypt any cat')
  .addPositionalParam('when', 'ISO date (2026-12-31T18:00:00Z), unix seconds, "now" or "off"')
  .setAction(async ({ when }: { when: string }, hre) => {
    const ts =
      when === 'off'
        ? 0
        : when === 'now'
          ? Math.floor(Date.now() / 1000)
          : /^\d+$/.test(when)
            ? Number(when)
            : Math.floor(Date.parse(when) / 1000);
    if (Number.isNaN(ts)) throw new Error(`Cannot parse "${when}"`);
    const nft = await fheCatAt(hre);
    await (await nft.setGrandRevealAt(ts)).wait();
    console.log(ts === 0 ? 'Grand reveal cancelled' : `Grand reveal at ${new Date(ts * 1000).toISOString()}`);
  });

task('fhecat:reveal-all', 'After the grand reveal: decrypt and reveal every cat that is still encrypted')
  .addOptionalParam('batch', 'cats per transaction', 10, types.int)
  .setAction(async ({ batch }: { batch: number }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const nft = await fheCatAt(hre, signer);
    if (!(await nft.grandRevealStarted())) throw new Error('The grand reveal has not started (fhecat:grand-reveal)');
    const client = await cofheClient(hre, signer);

    const supply = await nft.totalSupply();
    const hidden = [];
    for (let from = 1n; from <= supply; from += 500n) {
      for (const cat of await nft.catsInRange(from, from + 499n)) if (!cat.revealed) hidden.push(cat);
    }
    console.log(`${hidden.length} of ${supply} cats still encrypted`);

    for (let i = 0; i < hidden.length; i += batch) {
      const chunk = hidden.slice(i, i + batch);
      const closed = chunk.filter((c) => !c.publicDecryption).map((c) => c.tokenId);
      if (closed.length) await (await nft.enablePublicDecryptionBatch(closed)).wait();

      const proofs = [];
      for (const cat of chunk) {
        proofs.push(await client.decryptForTx(cat.dnaHandle).withoutACP().set404RetryTimeout(60_000).execute());
      }
      await (
        await nft.revealBatch(
          chunk.map((c) => c.tokenId),
          proofs.map((p) => p.decryptedValue),
          proofs.map((p) => p.signature),
        )
      ).wait();
      console.log(`  revealed #${chunk.map((c) => c.tokenId).join(', #')}`);
    }
    console.log('Done');
  });

task('fhecat:peek', 'Privately decrypt one of your cats (you must hold it)')
  .addPositionalParam('token', 'token id', undefined, types.int)
  .setAction(async ({ token }: { token: number }, hre) => {
    const { FheTypes } = await import('@cofhe/sdk');
    const { traitsOf } = await import('../../art');
    const [signer] = await hre.ethers.getSigners();
    const nft = await fheCatAt(hre, signer);
    const cat = await nft.catOf(token);
    const client = await cofheClient(hre, signer);
    await client.acp.getOrCreateSelfACP();
    const dna = await client.decryptForView(cat.dnaHandle, FheTypes.Uint64).execute();
    console.log(`FheCat #${token}  DNA 0x${dna.toString(16).padStart(16, '0')}`);
    console.table(Object.fromEntries(traitsOf(dna).map((t) => [t.trait_type, t.value])));
  });

task('fhecat:reveal', 'Reveal one of your cats on-chain')
  .addPositionalParam('token', 'token id', undefined, types.int)
  .setAction(async ({ token }: { token: number }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const nft = await fheCatAt(hre, signer);
    const cat = await nft.catOf(token);
    const client = await cofheClient(hre, signer);
    await client.acp.getOrCreateSelfACP();
    const { decryptedValue, signature } = await client.decryptForTx(cat.dnaHandle).withACP().execute();
    await (await nft.reveal(token, decryptedValue, signature)).wait();
    console.log(`FheCat #${token} revealed with DNA 0x${decryptedValue.toString(16).padStart(16, '0')}`);
  });

task('fhecat:withdraw', 'Send the mint proceeds to an address')
  .addOptionalParam('to', 'recipient (defaults to the signer)')
  .setAction(async (args: { to?: string }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const nft = await fheCatAt(hre, signer);
    const to = args.to ?? signer.address;
    const amount = await hre.ethers.provider.getBalance(await nft.getAddress());
    await (await nft.withdraw(to)).wait();
    console.log(`Sent ${hre.ethers.formatEther(amount)} ETH to ${to}`);
  });
