import type { ReactNode } from 'react';
import { FHENIX_URL } from '../config/chains';
import { Sprite } from '../pixel/Sprite';
import { Stars } from '../pixel/Sky';
import { ChapterHead } from './Chapter';
import { CatImage } from './CatImage';

// Sample ciphertext handles: the barcode on a box is read from its handle.
const BOX = (byte: string) => '0x' + byte.repeat(32);

const STEPS: { title: string; art: ReactNode; body: string }[] = [
  {
    title: 'Mint blind',
    art: <CatImage handle={BOX('3c')} alt="" />,
    body: 'The contract asks Fhenix for an encrypted random 64-bit DNA. At birth only the contract may use the ciphertext: nobody can decrypt it, not even you.',
  },
  {
    title: 'Peek in private',
    art: <CatImage handle={BOX('5a')} state={1} alt="" />,
    body: 'Peek and the contract adds you to the DNA’s access list; a free permit decrypts your cat inside your browser. The box is marked Peeked for good, so buyers know it may have been seen.',
  },
  {
    title: 'Open the box',
    art: <CatImage handle={BOX('a5')} state={2} alt="" />,
    body: 'Open the box and the DNA becomes publicly decryptable. The Fhenix threshold network decrypts and signs it, the contract checks the signature and your cat appears for everyone.',
  },
  {
    title: 'Or stay sealed',
    art: (
      <div className="duel-art">
        <CatImage handle={BOX('c3')} alt="" />
        <i className="vs">vs</i>
        <CatImage handle={BOX('69')} state={1} alt="" />
      </div>
    ),
    body: 'Nothing ever forces a reveal. A sealed cat can still fight blind duels in the arena, where only the winner is made public.',
  },
];

export function HowItWorks({ n }: { n: string }) {
  return (
    <section className="chapter" id="how">
      <Stars density={0.5} seed={84} />
      <div className="wrap">
        <ChapterHead n={n} label="How it works" title="Schrödinger’s box." wide>
          <p>
            A cat’s DNA is fixed the moment it is minted, but until somebody looks, nobody knows which cat is inside. The contract only ever
            holds it encrypted, and you choose who gets to see it, and when.
          </p>
        </ChapterHead>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="step box">
              <div className="step-art">{s.art}</div>
              <h3>
                <span className="mono">{i + 1}</span>
                {s.title}
              </h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="aside">
          <Sprite name="paw" className="aside-paw" />
          <span>No rarity sniping: traits cannot be known at mint time, not even by the contract owner.</span>
        </p>
        <p>
          <a className="link" href={FHENIX_URL} target="_blank" rel="noreferrer">
            Learn more at fhenix.io
            <Sprite name="i-arrow" />
          </a>
        </p>
      </div>
    </section>
  );
}
