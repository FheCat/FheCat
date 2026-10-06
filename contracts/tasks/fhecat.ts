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
  const [phase, supply, max, pub, al, maxW, alMaxW, root, arena, owner] = await Promise.all([
    nft.phase(),
    nft.totalSupply(),
    nft.maxSupply(),
    nft.publicPrice(),
    nft.allowlistPrice(),
    nft.maxPerWallet(),
    nft.allowlistMaxPerWallet(),
    nft.allowlistRoot(),
    nft.arena(),
    nft.owner(),
  ]);
  const states = [0, 0, 0, 0];
  for (let from = 1n; from <= supply; from += 500n) {
    for (const cat of await nft.catsInRange(from, from + 499n)) states[Number(cat.state)]++;
  }
  const { formatEther } = hre.ethers;
  console.table({
    contract: d.fheCat,
    owner,
    phase: PHASES[Number(phase)],
    minted: `${supply} / ${max}`,
    'public price': `${formatEther(pub)} ETH (max ${maxW || '∞'} per wallet)`,
    'allowlist price': `${formatEther(al)} ETH (max ${alMaxW || '∞'} per wallet)`,
    'allowlist root': root,
    cats: `${states[0]} unopened · ${states[1]} peeked · ${states[2]} opened · ${states[3]} revealed`,
    arena: arena === hre.ethers.ZeroAddress ? 'not set' : arena,
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

task('fhecat:arena', 'Set the arena contract holders may let compute on their cats')
  .addPositionalParam('address', 'arena contract address (0x0 to unset)')
  .setAction(async ({ address }: { address: string }, hre) => {
    const nft = await fheCatAt(hre);
    await (await nft.setArena(address)).wait();
    console.log(`Arena: ${address}`);
  });

task('fhecat:peek', 'Peek at one of your cats privately (marks it Peeked for good)')
  .addPositionalParam('token', 'token id', undefined, types.int)
  .setAction(async ({ token }: { token: number }, hre) => {
    const { FheTypes } = await import('@cofhe/sdk');
    const { traitsOf } = await import('../../art');
    const [signer] = await hre.ethers.getSigners();
    const nft = await fheCatAt(hre, signer);
    const cat = await nft.catOf(token);
    if (cat.state === 0n) await (await nft.peek(token)).wait();
    const client = await cofheClient(hre, signer);
    await client.acp.getOrCreateSelfACP();
    const dna = await client.decryptForView(cat.dnaHandle, FheTypes.Uint64).execute();
    console.log(`FheCat #${token}  DNA 0x${dna.toString(16).padStart(16, '0')}`);
    console.table(Object.fromEntries(traitsOf(dna).map((t) => [t.trait_type, t.value])));
  });

task('fhecat:reveal', 'Open one of your cats and reveal it on-chain')
  .addPositionalParam('token', 'token id', undefined, types.int)
  .setAction(async ({ token }: { token: number }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const nft = await fheCatAt(hre, signer);
    const cat = await nft.catOf(token);
    if (cat.state === 3n) throw new Error(`FheCat #${token} is already revealed`);
    const client = await cofheClient(hre, signer);
    let proof;
    if (cat.state === 1n) {
      // peeked: reveal with the holder's own decryption
      await client.acp.getOrCreateSelfACP();
      proof = await client.decryptForTx(cat.dnaHandle).withACP().execute();
    } else {
      if (cat.state === 0n) await (await nft.open(token)).wait();
      proof = await client.decryptForTx(cat.dnaHandle).withoutACP().set404RetryTimeout(60_000).execute();
    }
    const { decryptedValue, signature } = proof;
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
