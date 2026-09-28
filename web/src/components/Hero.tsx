import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { X_URL } from '../config/chains';
import { CatImage } from './CatImage';

function random64(): bigint {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return (BigInt(words[0]) << 32n) | BigInt(words[1]);
}

/** A random DNA and a random-looking ciphertext handle (the placeholder barcode reads its top bits). */
function randomCat() {
  return { dna: random64(), handle: '0x' + (random64() << 192n).toString(16).padStart(64, '0') };
}

/** Cycles random cats: ciphertext first, then the decrypted cat. */
function DecryptingCat() {
  const [cat, setCat] = useState(randomCat);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = setTimeout(
      () => {
        if (revealed) setCat(randomCat());
        setRevealed((r) => !r);
      },
      revealed ? 2600 : 1400,
    );
    return () => clearTimeout(id);
  }, [revealed]);

  return (
    <div className={`hero-cat ${revealed ? 'is-revealed' : ''}`} aria-hidden>
      <CatImage handle={cat.handle} alt="" className="hero-cat-img hero-cat-hidden" />
      <CatImage dna={cat.dna} alt="" className="hero-cat-img hero-cat-shown" />
      <div className="hero-cat-label">{revealed ? 'decrypted' : 'euint64'}</div>
    </div>
  );
}

export function Hero() {
  const { t } = useI18n();
  return (
    <section className="hero" id="top">
      <div className="container hero-inner">
        <div className="hero-copy">
          <p className="kicker">{t.hero.kicker}</p>
          <h1>{t.hero.title}</h1>
          <p className="lead">{t.hero.body}</p>
          <div className="hero-cta">
            <a className="btn" href="#mint">
              {t.hero.mint}
            </a>
            <a className="btn btn-ghost" href={X_URL} target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                <path
                  fill="currentColor"
                  d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.8-6.3L6.4 22H3.3l7.3-8.3L1 2h6.3l4.4 5.8L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z"
                />
              </svg>
              {t.hero.follow}
            </a>
          </div>
        </div>
        <DecryptingCat />
      </div>
    </section>
  );
}
