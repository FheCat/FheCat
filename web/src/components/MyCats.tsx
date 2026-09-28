import { useConnection } from 'wagmi';
import { useI18n } from '../i18n';
import { useCofhe } from '../lib/cofhe';
import { useCountdown, useMyCats } from '../lib/hooks';
import { formatDuration } from '../lib/format';
import { CatCard } from './CatCard';

/** Ticks every second on its own, so the cat grid does not re-render. */
function GrandRevealChip({ at }: { at: bigint }) {
  const { t, lang } = useI18n();
  const left = useCountdown(at);
  return <p className="chip">{left > 0 ? t.cats.grand(formatDuration(left, lang)) : t.cats.grandOpen}</p>;
}

interface Props {
  chainId: number;
  contract?: `0x${string}`;
  totalSupply: bigint;
  grandRevealAt: bigint;
}

export function MyCats({ chainId, contract, totalSupply, grandRevealAt }: Props) {
  const { t } = useI18n();
  const { isConnected } = useConnection();
  const cofhe = useCofhe();
  const { cats, refetch } = useMyCats(totalSupply);
  if (!contract) return null;

  return (
    <section className="section" id="cats">
      <div className="container">
        <div className="section-head">
          <h2>{t.cats.title}</h2>
          {grandRevealAt > 0n && <GrandRevealChip at={grandRevealAt} />}
        </div>
        {!isConnected ? (
          <p className="muted">{t.cats.connect}</p>
        ) : cats.length === 0 ? (
          <p className="muted">{t.cats.empty}</p>
        ) : (
          <div className="cat-grid">
            {cats.map((cat) => (
              <CatCard
                key={cat.tokenId.toString()}
                cat={cat}
                chainId={chainId}
                contract={contract}
                cofhe={cofhe}
                onChanged={() => void refetch()}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
