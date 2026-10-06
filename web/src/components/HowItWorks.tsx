import { useI18n } from '../i18n';
import { dnaNamed } from '../lib/art';
import { CatImage } from './CatImage';

const GINGER = dnaNamed(['Starry Night', 'Ginger', 'Tabby', 'Emerald', 'Smile', 'Cap', 'Scarf', 'None']);
const BOX = (byte: string) => '0x' + byte.repeat(32);

export function HowItWorks() {
  const { t } = useI18n();
  const art = [
    <CatImage key="0" handle={BOX('3c')} alt="" />,
    <div key="1" className="peek-art">
      <CatImage dna={GINGER} alt="" />
      <span className="badge">👁 {t.how.badges.private}</span>
    </div>,
    <div key="2" className="peek-art">
      <CatImage dna={GINGER} alt="" />
      <span className="badge ok">✓ {t.how.badges.onchain}</span>
    </div>,
    <div key="3" className="duel-art">
      <CatImage handle={BOX('5a')} state={1} alt="" />
      <span className="duel-vs">{t.how.badges.vs}</span>
      <CatImage handle={BOX('c3')} alt="" />
    </div>,
  ];
  return (
    <section className="section" id="how">
      <div className="container">
        <h2>{t.how.title}</h2>
        <ol className="steps">
          {t.how.steps.map((s, i) => (
            <li key={s.title} className="panel step">
              <div className="step-art">{art[i]}</div>
              <h3>
                <span className="step-n">{i + 1}</span> {s.title}
              </h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="callout">{t.how.sniping}</p>
      </div>
    </section>
  );
}
