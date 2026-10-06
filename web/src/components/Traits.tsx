import { useState } from 'react';
import { ART } from '@art';
import { dnaFor } from '../lib/art';
import { Stars } from '../pixel/Sky';
import { ChapterHead } from './Chapter';
import { CatImage } from './CatImage';

// Every sample shares this cat and swaps one trait.
const BASE = [0, 0, 0, 0, 0, 0, 0, 0];

export function Traits({ n }: { n: string }) {
  const [active, setActive] = useState(1);
  const trait = ART.traits[active];
  const options = ART.traits.reduce((sum, tr) => sum + tr.names.length, 0);

  return (
    <section className="chapter" id="traits">
      <Stars density={0.5} seed={106} />
      <div className="wrap">
        <ChapterHead n={n} label="Traits" title="What could be inside." wide>
          <p>
            {ART.traits.length} traits, {options} options. The rarity weights are public and fixed in the contract; which traits a cat gets
            stays sealed until its box is opened.
          </p>
        </ChapterHead>
        <div className="tabs" role="tablist" aria-label="Traits">
          {ART.traits.map((tr, i) => (
            <button key={tr.key} role="tab" aria-selected={i === active} className={i === active ? 'active' : ''} onClick={() => setActive(i)}>
              {tr.label}
            </button>
          ))}
        </div>
        <div className="trait-grid" role="tabpanel" aria-label={trait.label}>
          {trait.names.map((name, k) => {
            const picks = [...BASE];
            picks[active] = k;
            return (
              <figure key={name} className="trait-item">
                <CatImage dna={dnaFor(picks)} alt={name} />
                <figcaption>
                  <b>{name}</b>
                  <span className="mono">{((trait.weights[k] / 256) * 100).toFixed(1)}%</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
