import { useRef } from 'react';
import { hardhat } from 'viem/chains';
import { FHENIX_URL, X_URL, chainInfo } from '../config/chains';
import { useViewChain } from '../lib/hooks';
import { Sprite } from '../pixel/Sprite';
import { useNightScene } from '../pixel/Sky';

/** The banner's ground again, seen from behind the cat, as at the end of the homepage. */
export function Finale() {
  const ref = useRef<HTMLElement>(null);
  useNightScene(ref, { moon: 'right', back: true, catAt: 0.8, seed: 0x5eed });
  return (
    <section className="finale" ref={ref}>
      <div className="scene scene-end" aria-hidden="true" />
      <div className="wrap finale-inner">
        <p className="label label-center">
          <Sprite name="i-diamond" />
          Transmission ends
        </p>
        <h2>The boxes stay shut.</h2>
        <p>Every sealed box stays a secret until its holder decides otherwise. News lands on X first.</p>
        <div className="hero-cta">
          <a className="btn" href="#mint">
            <span>Mint a cat</span>
            <Sprite name="i-arrow" />
          </a>
          <a className="btn btn-ghost" href={X_URL} target="_blank" rel="noreferrer">
            <Sprite name="i-x" />
            <span>Follow @FheCat</span>
          </a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const { chainId } = useViewChain();
  const chain = chainInfo(chainId)?.chain;
  const testnet = Boolean(chain?.testnet) || chainId === hardhat.id;
  return (
    <footer className="foot">
      <div className="wrap foot-inner">
        <span>© {new Date().getFullYear()} FheCat</span>
        <a className="link" href={FHENIX_URL} target="_blank" rel="noreferrer">
          Powered by Fhenix FHE
        </a>
        <a className="link" href={X_URL} target="_blank" rel="noreferrer">
          X / @FheCat
        </a>
        <a className="link" href="https://fhecat.com">
          fhecat.com
        </a>
      </div>
      <p className="wrap foot-note">
        {testnet && `${chain?.name ?? 'Testnet'} is a test network: its tokens have no monetary value. `}
        Art and metadata are generated fully on-chain.
      </p>
    </footer>
  );
}
