import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { MintPanel } from './components/MintPanel';
import { HowItWorks } from './components/HowItWorks';
import { MyCats } from './components/MyCats';
import { Latest } from './components/Latest';
import { Arena } from './components/Arena';
import { Traits } from './components/Traits';
import { Footer } from './components/Footer';
import { useCollection } from './lib/hooks';

export function App() {
  const col = useCollection();
  return (
    <>
      <Header />
      <main>
        <Hero />
        {/* A mint bumps totalSupply, which refetches the holder's cats below. */}
        <MintPanel />
        <MyCats chainId={col.chainId} contract={col.deployment?.fheCat} totalSupply={col.totalSupply} />
        <Arena chainId={col.chainId} contract={col.deployment?.fheCat} arena={col.arena} totalSupply={col.totalSupply} />
        <HowItWorks />
        <Latest totalSupply={col.totalSupply} />
        <Traits />
      </main>
      <Footer />
    </>
  );
}
