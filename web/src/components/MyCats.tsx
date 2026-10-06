import { useConnection } from 'wagmi';
import { useCofhe } from '../lib/cofhe';
import { STATE, useAllowed, useMyCats } from '../lib/hooks';
import { Sprite } from '../pixel/Sprite';
import { Stars } from '../pixel/Sky';
import { ChapterHead } from './Chapter';
import { CatCard } from './CatCard';
import { ConnectButton } from './ConnectButton';

interface Props {
  n: string;
  chainId: number;
  contract: `0x${string}`;
  totalSupply: bigint;
}

export function MyCats({ n, chainId, contract, totalSupply }: Props) {
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
  const count = (...states: number[]) => cats.filter((c) => states.includes(Number(c.state))).length;
  const tally = [
    `${cats.length} ${cats.length === 1 ? 'cat' : 'cats'}`,
    `${count(STATE.Unopened, STATE.Peeked)} sealed`,
    count(STATE.Opened) ? `${count(STATE.Opened)} open` : '',
    `${count(STATE.Revealed)} revealed`,
  ];

  return (
    <section className="chapter" id="cats">
      <Stars density={0.5} seed={61} />
      <div className="wrap">
        <ChapterHead n={n} label="Your cats" title="Yours to open." wide>
          <p>Every box is yours to decide. Keep it sealed, peek in private or open it for everyone. Nobody else can open it for you.</p>
        </ChapterHead>

        {!isConnected ? (
          <div className="empty box">
            <Sprite name="noiseCat" className="empty-cat" />
            <div>
              <p>Connect your wallet to see your cats.</p>
              <ConnectButton />
            </div>
          </div>
        ) : cats.length === 0 ? (
          <div className="empty box">
            <Sprite name="noiseCat" className="empty-cat" />
            <div>
              <p>No cats yet. Your first box is one mint away.</p>
              <a className="btn" href="#mint">
                <span>Mint a cat</span>
                <Sprite name="i-arrow" />
              </a>
            </div>
          </div>
        ) : (
          <>
            <p className="tally mono" aria-live="polite">
              {tally.filter(Boolean).join(' · ')}
            </p>
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
          </>
        )}
      </div>
    </section>
  );
}
