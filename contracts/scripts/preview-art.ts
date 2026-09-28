/**
 * Writes art/preview/index.html: the collection image plus a grid of sample
 * cats for random DNAs. Open it in a browser to eyeball the art.
 *
 *   npx ts-node scripts/preview-art.ts [count] [seed]
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { renderCatSvg, renderEncryptedSvg, renderMotifSvg, svgDataUri, traitsOf } from '../../art';

const count = Number(process.argv[2] ?? 48);
let seed = BigInt(process.argv[3] ?? 42);

// splitmix64, so previews are reproducible
function next(): bigint {
  seed = (seed + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
  let z = seed;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
  return z ^ (z >> 31n);
}

const cards: string[] = [];
cards.push(card(renderMotifSvg(), 'Collection', ['logo mark']));
cards.push(card(renderEncryptedSvg(next() << 192n), 'Encrypted', ['placeholder']));
for (let i = 0; i < count; i++) {
  const dna = next();
  cards.push(card(renderCatSvg(dna), '0x' + dna.toString(16).padStart(16, '0'), traitsOf(dna).map((t) => t.value)));
}

function card(svg: string, title: string, lines: string[]): string {
  return `<figure><img src="${svgDataUri(svg)}"/><figcaption><b>${title}</b><br>${lines.join(' · ')}</figcaption></figure>`;
}

const html = `<!doctype html><meta charset="utf-8"><title>FheCat preview</title>
<style>body{background:#021f36;color:#cfe3f5;font:12px system-ui;margin:16px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
figure{margin:0;background:#032842;padding:8px;border-radius:8px}img{width:100%;image-rendering:pixelated;display:block}
figcaption{margin-top:6px;line-height:1.4}</style><main>${cards.join('')}</main>`;

const outDir = join(__dirname, '..', '..', 'art', 'preview');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), html);
console.log(`wrote ${join(outDir, 'index.html')} (${count} cats)`);
