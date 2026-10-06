import { STATE, STATE_NAMES, useLatestCats } from '../lib/hooks';
import { Stars } from '../pixel/Sky';
import { ChapterHead } from './Chapter';
import { CatImage } from './CatImage';

export function Latest({ n, totalSupply }: { n: string; totalSupply: bigint }) {
  const cats = useLatestCats(totalSupply);
  return (
    <section className="chapter" id="latest">
      <Stars density={0.4} seed={95} />
      <div className="wrap">
        <ChapterHead n={n} label="Latest" title="Fresh boxes." wide>
          <p>The newest cats on-chain. A sealed box shows nothing but a barcode made from its ciphertext.</p>
        </ChapterHead>
        <div className="latest-grid">
          {cats.map((c) => {
            const state = Number(c.state);
            return (
              <figure key={c.tokenId.toString()} className="latest-item">
                {state === STATE.Revealed ? (
                  <CatImage dna={c.dna} alt={`FheCat #${c.tokenId}`} />
                ) : (
                  <CatImage handle={c.dnaHandle} state={state as 0 | 1 | 2} alt={`FheCat #${c.tokenId}, sealed`} />
                )}
                <figcaption>
                  <b>#{c.tokenId.toString()}</b>
                  <span className={state === STATE.Revealed ? 'is-out' : undefined}>{STATE_NAMES[state]}</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
