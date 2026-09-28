/**
 * Run-length row helper: '3.o12f' → '...offffffffffff'.
 * A char without a count means one pixel.
 */
export function rle(spec: string): string {
  let out = '';
  const re = /(\d*)(\D)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(spec))) out += m[2].repeat(m[1] ? Number(m[1]) : 1);
  return out;
}

export const rows = (...specs: string[]): string[] => specs.map(rle);
