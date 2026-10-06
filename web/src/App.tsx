import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { MintPanel } from './components/MintPanel';
import { HowItWorks } from './components/HowItWorks';
import { MyCats } from './components/MyCats';
import { Latest } from './components/Latest';
import { Arena } from './components/Arena';
import { Traits } from './components/Traits';
import { Finale, Footer } from './components/Footer';
import { OwnerPanel } from './components/OwnerPanel';
import { chainInfo } from './config/chains';
import { useCollection, useOwnership } from './lib/hooks';
import { Clouds } from './pixel/Sky';
import { Ticker, type TickerItem } from './pixel/Ticker';
import { ToastProvider } from './pixel/Toast';

const PHASES = ['Sale closed', 'Allowlist mint', 'Public mint'];

export function App() {
  const col = useCollection();
  const ownership = useOwnership();
  const live = col.deployment;
  const chain = chainInfo(col.chainId)?.chain.name ?? '';
  const supply = `${col.totalSupply}/${col.maxSupply}`;
  const soldOut = col.loaded && col.maxSupply > 0n && col.totalSupply >= col.maxSupply;

  // Chapters number themselves in page order, as on the homepage.
  const chapters = [
    { id: 'mint', label: 'Mint', on: true },
    // Only the owner, or the address offered ownership, sees this one.
    { id: 'owner', label: 'Owner', on: Boolean(live && ownership.role) },
    { id: 'cats', label: 'My cats', on: Boolean(live) },
    { id: 'arena', label: 'Arena', on: Boolean(live && col.arena) },
    { id: 'how', label: 'How it works', on: true },
    { id: 'latest', label: 'Latest', on: Boolean(live && col.totalSupply > 0n) },
    { id: 'traits', label: 'Traits', on: true },
  ].filter((c) => c.on);
  const n = (id: string) => String(chapters.findIndex((c) => c.id === id) + 1).padStart(2, '0');

  const status = !live
    ? 'Mint opens soon'
    : !col.loaded
      ? chain
      : soldOut
        ? `Sold out · ${supply}`
        : `${PHASES[Number(col.phase)] ?? ''} · ${chain}`;

  const ticker: TickerItem[] = [
    ['FheCat', true],
    ['Pixel cats', false],
    ['Born encrypted', true],
  ];
  if (live && col.loaded) ticker.push([`Minted ${supply}`, true], [PHASES[Number(col.phase)] ?? '', false]);
  ticker.push(
    ['Peek in private', false],
    ['Open for everyone', false],
    ['Duel sealed', true],
    ['Powered by Fhenix FHE', false],
    ['Traits: encrypted', false],
    ['Follow the signal @FheCat', false],
  );

  return (
    <ToastProvider>
      <a className="skip" href="#mint">
        Skip to the mint
      </a>
      <Header links={chapters.filter((c) => c.id !== 'latest').map((c): [string, string] => [`#${c.id}`, c.label])} />
      <main>
        <Hero status={status} />
        <Ticker items={ticker} />
        {/* A mint bumps totalSupply, which refetches the holder's cats below. */}
        <MintPanel n={n('mint')} col={col} />
        {live && ownership.role && (
          <>
            <Clouds seed={6} />
            <OwnerPanel n={n('owner')} col={col} ownership={ownership} />
          </>
        )}
        {live && (
          <>
            <Clouds seed={1} />
            <MyCats n={n('cats')} chainId={col.chainId} contract={live.fheCat} totalSupply={col.totalSupply} />
          </>
        )}
        {live && col.arena && (
          <>
            <Clouds seed={2} />
            <Arena n={n('arena')} chainId={col.chainId} contract={live.fheCat} arena={col.arena} totalSupply={col.totalSupply} />
          </>
        )}
        <Clouds seed={3} />
        <HowItWorks n={n('how')} />
        {live && col.totalSupply > 0n && (
          <>
            <Clouds seed={4} />
            <Latest n={n('latest')} totalSupply={col.totalSupply} />
          </>
        )}
        <Clouds seed={5} />
        <Traits n={n('traits')} />
        <Finale />
      </main>
      <Footer />
    </ToastProvider>
  );
}
