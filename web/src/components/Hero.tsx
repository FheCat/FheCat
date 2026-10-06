import { useRef } from 'react';
import { Sprite } from '../pixel/Sprite';
import { SceneCat, Wordmark, useNightScene } from '../pixel/Sky';

/** The banner, alive: the same night scene as the homepage, with the mint one click away. */
export function Hero({ status }: { status: string }) {
  const ref = useRef<HTMLElement>(null);
  const scene = useNightScene(ref, { moon: 'left', tapPaws: true });
  return (
    <section className="hero" id="top" ref={ref}>
      <div className="scene" aria-hidden="true" />
      <div className="hero-inner">
        <Sprite name="logo" className="hero-logo" />
        <h1 className="hero-word">
          <span className="sr">FheCat</span>
          <Wordmark decode />
        </h1>
        <p className="hero-tag">Pixel cats, born encrypted.</p>
        <p className="hero-sub">The mint · Powered by Fhenix FHE</p>
        <div className="hero-cta">
          <a className="btn" href="#mint">
            <span>Mint a cat</span>
            <Sprite name="i-arrow" />
          </a>
          <a className="btn btn-ghost" href="#how">
            <span>How it works</span>
            <Sprite name="i-down" />
          </a>
        </div>
        <p className="hero-date">
          <i className="blink-dot" aria-hidden="true" />
          {status}
        </p>
      </div>
      <SceneCat scene={scene} />
      <p className="sky-hint" aria-hidden="true">
        Tap the sky · or the cat
      </p>
    </section>
  );
}
