import { useState } from 'react';
import { ART } from '@art';
import { useI18n } from '../i18n';
import { dnaFor } from '../lib/art';
import { CatImage } from './CatImage';

// Every sample shares this cat and swaps one trait.
const BASE = [0, 0, 0, 0, 0, 0, 0, 0];

export function Traits() {
  const { t } = useI18n();
  const [active, setActive] = useState(1);
  const trait = ART.traits[active];
  const options = ART.traits.reduce((n, tr) => n + tr.names.length, 0);

  return (
    <section className="section" id="traits">
      <div className="container">
        <div className="section-head">
          <h2>{t.traits.title}</h2>
          <p className="chip">{t.traits.count(ART.traits.length, options)}</p>
        </div>
        <p className="muted">{t.traits.body}</p>
        <div className="tabs" role="tablist">
          {ART.traits.map((tr, i) => (
            <button key={tr.key} role="tab" aria-selected={i === active} className={i === active ? 'active' : ''} onClick={() => setActive(i)}>
              {t.traits.labels[i] ?? tr.label}
            </button>
          ))}
        </div>
        <div className="trait-grid">
          {trait.names.map((name, k) => {
            const picks = [...BASE];
            picks[active] = k;
            return (
              <figure key={name} className="trait-item">
                <CatImage dna={dnaFor(picks)} alt={name} />
                <figcaption>
                  <b>{name}</b>
                  <span>{((trait.weights[k] / 256) * 100).toFixed(1)}%</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
