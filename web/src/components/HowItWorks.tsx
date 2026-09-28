import { useI18n } from '../i18n';
import { dnaNamed } from '../lib/art';
import { CatImage } from './CatImage';

const GINGER = dnaNamed(['Starry Night', 'Ginger', 'Tabby', 'Emerald', 'Smile', 'Cap', 'Scarf', 'None']);
const GRID = [
  dnaNamed(['Midnight', 'Snow White', 'None', 'Sky', 'Blep', 'Party Hat', 'None', 'None']),
  dnaNamed(['Dusk', 'Midnight Black', 'Tuxedo', 'Glow', 'Classic', 'None', 'Bow Tie', 'None']),
  dnaNamed(['Teal Glow', 'Lilac', 'None', 'Happy', 'Meow', 'Halo', 'None', 'None']),
  dnaNamed(['Cipher Grid', 'Steel Blue', 'Bandit Mask', 'Pixel Shades', 'Fangs', 'Headphones', 'Hoodie', 'None']),
];

export function HowItWorks() {
  const { t } = useI18n();
  const art = [
    <CatImage key="0" handle={'0x' + '3c'.repeat(32)} alt="" />,
    <div key="1" className="peek-art">
      <CatImage dna={GINGER} alt="" />
      <span className="badge">👁 {t.how.badges.private}</span>
    </div>,
    <div key="2" className="peek-art">
      <CatImage dna={GINGER} alt="" />
      <span className="badge ok">✓ {t.how.badges.onchain}</span>
    </div>,
    <div key="3" className="mini-grid">
      {GRID.map((dna, i) => (
        <CatImage key={i} dna={dna} alt="" />
      ))}
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
