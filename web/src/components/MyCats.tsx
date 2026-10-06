import { useConnection } from 'wagmi';
import { useI18n } from '../i18n';
import { useCofhe } from '../lib/cofhe';
import { useAllowed, useMyCats } from '../lib/hooks';
import { CatCard } from './CatCard';

interface Props {
  chainId: number;
  contract?: `0x${string}`;
  totalSupply: bigint;
}

export function MyCats({ chainId, contract, totalSupply }: Props) {
  const { t } = useI18n();
  const { address, isConnected } = useConnection();
  const cofhe = useCofhe();
  const { cats, refetch } = useMyCats(totalSupply);
  const access = useAllowed(
    cats.map((c) => c.dnaHandle),
    address,
  );
  const changed = () => {
    void refetch();
    access.refetch();
  };
  if (!contract) return null;

  return (
    <section className="section" id="cats">
      <div className="container">
        <div className="section-head">
          <h2>{t.cats.title}</h2>
        </div>
        {!isConnected ? (
          <p className="muted">{t.cats.connect}</p>
        ) : cats.length === 0 ? (
          <p className="muted">{t.cats.empty}</p>
        ) : (
          <div className="cat-grid">
            {cats.map((cat, i) => (
              <CatCard
                key={cat.tokenId.toString()}
                cat={cat}
                chainId={chainId}
                contract={contract}
                cofhe={cofhe}
                canDecrypt={access.allowed[i]}
                onChanged={changed}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
