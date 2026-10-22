import { useRef } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ChapterHead } from './components/Chapter';
import { CreatePanel, LaunchStats, RewardsPanel, SEPOLIA_FAUCET, SaleList } from './components/Launchpad';
import { chainLabel } from './config/chains';
import { useCollection } from './lib/hooks';
import { eth, useLaunchpad } from './lib/launchpad';
import { Sprite } from './pixel/Sprite';
import { Clouds, SceneCat, Stars, useNightScene } from './pixel/Sky';
import { Ticker, type TickerItem } from './pixel/Ticker';
import { ToastProvider } from './pixel/Toast';

const MINT = '../';

const STEPS: [string, string][] = [
  ['Launch', 'Pick a name, a supply, the share for sale, caps and how long the sale runs. The launch fee is $1, paid in ETH at the Chainlink price.'],
  ['Sell fairly', 'Buyers send ETH while the sale is open. Nobody gets a better price: when it closes, each buyer gets the sale supply in proportion to what they sent.'],
  ['Claim in the open or in private', 'Claim to your public balance, or straight into a shielded balance encrypted with Fhenix FHE. Only you can read it; you can send from it without the amount ever showing on-chain.'],
  ['Everyone is paid', 'A successful sale pays a 2% platform fee: half to FheCat holders, half to the platform. The creator gets the rest of the ETH and the unsold share. Below the soft cap, everyone is refunded.'],
];

/** fhecat.com/testnet/launchpad/: the launchpad on its own page. */
export function LaunchpadApp() {
  const col = useCollection();
  const live = col.deployment;
  const chainId = col.chainId;
  const lp = useLaunchpad(live?.launchpad ?? '0x0000000000000000000000000000000000000000', chainId);
  const heroRef = useRef<HTMLElement>(null);
  const scene = useNightScene(heroRef, { moon: 'right', seed: 0x1a0c });

  const ticker: TickerItem[] = [
    ['FheCat Launchpad', true],
    ['$1 to launch', false],
    ['Fair, pro-rata sales', true],
    ['Shielded balances', false],
    ['Half the fee to FheCat holders', true],
    ['Powered by Fhenix FHE', false],
    [`${chainLabel(chainId) ?? 'Testnet'} · no real money`, false],
  ];

  if (!live?.launchpad || !live.rewards) {
    return (
      <ToastProvider>
        <Header links={[[MINT, 'FheCat mint']]} />
        <main>
          <section className="chapter">
            <div className="wrap">
              <p>The launchpad isn't deployed on this network yet.</p>
            </div>
          </section>
        </main>
        <Footer />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <a className="skip" href="#sales">
        Skip to the sales
      </a>
      <Header
        links={[
          ['#sales', 'Sales'],
          ['#create', 'Launch'],
          ['#rewards', 'Holder share'],
          ['#lp-how', 'How it works'],
          [MINT, 'Cats'],
        ]}
      />
      <main>
        <section className="hero lp-hero" id="top" ref={heroRef}>
          <div className="scene" aria-hidden="true" />
          <div className="hero-inner">
            <p className="label label-center">
              <Sprite name="i-diamond" />
              FheCat Launchpad · {chainLabel(chainId)}
            </p>
            <h1 className="lp-hero-title">Launch tokens with private balances.</h1>
            <p className="hero-sub">Fair sales · shielded claims · half the fee to FheCat holders</p>
            <div className="hero-cta">
              <a className="btn" href="#create">
                <span>Launch a token for $1</span>
                <Sprite name="i-arrow" />
              </a>
              <a className="btn btn-ghost" href="#sales">
                <span>See the sales</span>
                <Sprite name="i-down" />
              </a>
            </div>
            <div className="box lp-hero-stats">
              <LaunchStats stats={lp.stats} feeBps={lp.feeBps} holderBps={lp.holderBps} />
            </div>
            <p className="hero-date">
              <i className="blink-dot" aria-hidden="true" />
              Testnet · free test ETH ·{' '}
              <a className="link" href={SEPOLIA_FAUCET} target="_blank" rel="noreferrer">
                get some
              </a>
            </p>
          </div>
          <SceneCat scene={scene} />
        </section>
        <Ticker items={ticker} />

        <section className="chapter" id="sales">
          <Stars density={0.5} seed={91} />
          <div className="wrap">
            <ChapterHead n="01" label="Sales" title="Buy in early, at the same price as everyone." wide>
              <p>Every buyer pays the same price: the sale supply is split in proportion to the ETH sent. Live sales ending soonest come first.</p>
            </ChapterHead>
            <SaleList chainId={chainId} pad={live.launchpad} launches={lp.launches} loaded={lp.loaded} onChange={lp.refetch} />
          </div>
        </section>

        <Clouds seed={8} />
        <section className="chapter" id="create">
          <Stars density={0.5} seed={92} />
          <div className="wrap">
            <ChapterHead n="02" label="Launch" title="Your token, live in one transaction." wide>
              <p>
                Your token is minted in full to the launchpad, which holds the sale supply until the sale closes. Every token can be held in the
                open or shielded with Fhenix FHE.
              </p>
            </ChapterHead>
            <CreatePanel chainId={chainId} pad={live.launchpad} fee={lp.fee} feeBps={lp.feeBps} holderBps={lp.holderBps} onDone={lp.refetch} />
          </div>
        </section>

        <Clouds seed={9} />
        <section className="chapter" id="rewards">
          <Stars density={0.5} seed={93} />
          <div className="wrap split">
            <ChapterHead n="03" label="Holder share" title="Every sale pays the cats.">
              <p>
                Half of the platform fee from every successful sale goes to FheCat holders, split equally between the cats minted at that moment.
                The share stays with the cat when it changes hands.
              </p>
              <p>
                So far: <b>{lp.stats.toHolders > 0n ? `${eth(lp.stats.toHolders)} ETH` : 'nothing yet'}</b> to the cats.
              </p>
            </ChapterHead>
            <RewardsPanel chainId={chainId} rewards={live.rewards} totalSupply={col.loaded ? col.totalSupply : undefined} mintHref={`${MINT}#mint`} />
          </div>
        </section>

        <Clouds seed={10} />
        <section className="chapter" id="lp-how">
          <Stars density={0.5} seed={94} />
          <div className="wrap">
            <ChapterHead n="04" label="How it works" title="Public when you want, private when you don't." wide>
              <p>
                Each token is one ERC-20 with two balances per holder. The public one works with every wallet and explorer. The shielded one is a
                ciphertext: the Fhenix coprocessor adds and subtracts on it without decrypting, and only its holder can read it.
              </p>
            </ChapterHead>
            <ol className="lp-steps">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="box">
                  <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
            <p className="owner-note lp-disclaimer">
              This is a test network: tokens and ETH here have no value. Contracts are not audited yet; mainnet follows Fhenix's approval and an
              audit.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </ToastProvider>
  );
}
