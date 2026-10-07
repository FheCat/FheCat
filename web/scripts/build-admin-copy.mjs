// Builds the copy of this site that fhecat.com/admin/mint/ serves to signed-in
// admins (landing/middleware.js guards it), for testing the sale on the testnet
// with real wallets. It talks to the published deployments only: a local-dev
// deployments.local.json is set aside for the build.
//
//   npm run build:admin-copy   (then commit landing/admin/mint/)
import { execFileSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const local = 'src/config/deployments.local.json';
const aside = `${local}.aside`;
const setAside = existsSync(local);
if (setAside) renameSync(local, aside);
try {
  execFileSync('npx', ['tsc', '-b'], { stdio: 'inherit' });
  execFileSync('npx', ['vite', 'build', '--base', '/admin/mint/', '--outDir', '../landing/admin/mint', '--emptyOutDir'], {
    stdio: 'inherit',
  });
} finally {
  if (setAside) renameSync(aside, local);
}
