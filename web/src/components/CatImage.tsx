import { useMemo } from 'react';
import { renderCatSvg, renderSealedSvg, svgDataUri } from '@art';

type Props =
  | { dna: bigint; handle?: undefined; state?: undefined; alt: string; className?: string }
  | { handle: string; dna?: undefined; state?: 0 | 1 | 2; alt: string; className?: string };

/**
 * A cat drawn in the browser with the same renderer the contract uses: the cat
 * itself when its DNA is known, otherwise its sealed box (Unopened by default).
 */
export function CatImage({ dna, handle, state, alt, className }: Props) {
  const src = useMemo(
    () => svgDataUri(dna !== undefined ? renderCatSvg(dna) : renderSealedSvg(state ?? 0, handle!)),
    [dna, handle, state],
  );
  return <img className={`pixel ${className ?? ''}`} src={src} alt={alt} width={256} height={256} loading="lazy" />;
}
