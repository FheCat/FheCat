import { useI18n } from '../i18n';
import { useLatestCats } from '../lib/hooks';
import { CatImage } from './CatImage';

export function Latest({ totalSupply }: { totalSupply: bigint }) {
  const { t } = useI18n();
  const cats = useLatestCats(totalSupply);
  if (totalSupply === 0n) return null;
  return (
    <section className="section" id="latest">
      <div className="container">
        <h2>{t.latest.title}</h2>
        <div className="latest-grid">
          {cats.map((c) => (
            <figure key={c.tokenId.toString()} className="latest-item">
              {c.revealed ? (
                <CatImage dna={c.dna} alt={`FheCat #${c.tokenId}`} />
              ) : (
                <CatImage handle={c.dnaHandle} state={Number(c.state) as 0 | 1 | 2} alt={`FheCat #${c.tokenId}`} />
              )}
              <figcaption>#{c.tokenId.toString()}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
