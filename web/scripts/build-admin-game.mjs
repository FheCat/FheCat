// Builds the arena's fighters and fight player for the admin's Arena tab
// (fhecat.com/admin) from the mint site's own engine (src/arena, /art), as one
// script without React: landing/admin/mint/arena-game.js. It sits in the admin
// copy's folder because it holds the collection's art, so landing/middleware.js
// serves it only to a signed-in admin. `npm run build:admin-copy` runs it too.
//
//   npm run build:admin-game   (then commit landing/admin/mint/arena-game.js)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const web = fileURLToPath(new URL('..', import.meta.url));
const out = fileURLToPath(new URL('../../landing/admin/mint/', import.meta.url));
const file = 'arena-game.js';

await build({
  configFile: false,
  root: web,
  logLevel: 'warn',
  resolve: { alias: { '@art': fileURLToPath(new URL('../../art', import.meta.url)) } },
  build: {
    lib: { entry: 'src/arena/standalone.ts', formats: ['iife'], name: 'FheCatArenaGame', fileName: () => file },
    outDir: out,
    emptyOutDir: false,
    copyPublicDir: false,
    minify: true,
    target: 'es2022',
  },
});

const banner = '/* FheCat arena game for fhecat.com/admin, built from web/src/arena by `npm run build:admin-game`. Do not edit. */\n';
writeFileSync(out + file, banner + readFileSync(out + file, 'utf8'));
console.log(`wrote landing/admin/mint/${file}`);
