import { useMemo } from 'react';
import { renderCatSvg, renderEncryptedSvg, svgDataUri } from '@art';

type Props =
  | { dna: bigint; handle?: undefined; alt: string; className?: string }
  | { handle: string; dna?: undefined; alt: string; className?: string };

/** A cat drawn in the browser with the same renderer the contract uses. */
export function CatImage({ dna, handle, alt, className }: Props) {
  const src = useMemo(
    () => svgDataUri(dna !== undefined ? renderCatSvg(dna) : renderEncryptedSvg(handle!)),
    [dna, handle],
  );
  return <img className={`pixel ${className ?? ''}`} src={src} alt={alt} width={256} height={256} loading="lazy" />;
}
