// Builds a copy of this site on the testnet for fhecat.com, talking to the published deployments only
// (a local-dev deployments.local.json is set aside for the build).
//
//   npm run build:admin-copy     fhecat.com/admin/mint/  for signed-in admins (landing/middleware.js guards it);
//                                the admin's Arena tab gets its fighters and fights from the same folder
//                                (arena-game.js, scripts/build-admin-game.mjs)
//   npm run build:testnet-copy   fhecat.com/testnet/     open to everyone, for anyone to try the sale and the
//                                arena on the testnet; linked from the homepage and open to search engines
//
// Then commit the folder it wrote (landing/admin/mint/ or landing/testnet/).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const open = process.argv.includes('--public');
const base = open ? '/testnet/' : '/admin/mint/';
const outDir = open ? '../landing/testnet' : '../landing/admin/mint';

const local = 'src/config/deployments.local.json';
const aside = `${local}.aside`;
const setAside = existsSync(local);
if (setAside) renameSync(local, aside);
try {
  execFileSync('npx', ['tsc', '-b'], { stdio: 'inherit' });
  execFileSync('npx', ['vite', 'build', '--base', base, '--outDir', outDir, '--emptyOutDir'], { stdio: 'inherit' });
  if (open) {
    // A link shared from here (or found in a search) must not read as the real mint.
    const page = `${outDir}/index.html`;
    let html = readFileSync(page, 'utf8');
    const swap = (from, to) => {
      if (!html.includes(from)) throw new Error(`index.html has no ${from.slice(0, 40)}`);
      html = html.replace(from, to);
    };
    swap('<title>Mint · FheCat · Pixel cats, born encrypted</title>', '<title>Testnet · FheCat · Try the sale and the Blind Arena</title>');
    swap(
      'content="Mint a FheCat: a pixel cat whose DNA is born encrypted with Fhenix FHE. Keep it sealed, peek in private or open it for everyone."',
      'content="Try FheCat on the Ethereum Sepolia testnet: mint a pixel cat whose DNA is born encrypted with Fhenix FHE, peek in private and fight in the Blind Arena. Free test ETH, no real money."',
    );
    swap('<meta property="og:title" content="Mint · FheCat" />', '<meta property="og:title" content="FheCat testnet · try the sale and the Blind Arena" />');
    swap(
      'content="Pixel cats, born encrypted. Keep yours sealed, peek in private or open it for everyone."',
      'content="A practice run on the Ethereum Sepolia testnet: free test ETH, no real money. Mint, peek in private, fight."',
    );
    writeFileSync(page, html);
  } else {
    // The arena game for the admin's Arena tab lives in the same folder, behind the same sign-in.
    execFileSync('node', ['scripts/build-admin-game.mjs'], { stdio: 'inherit' });
  }
} finally {
  if (setAside) renameSync(aside, local);
}
