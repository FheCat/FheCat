import { Fragment, useLayoutEffect, useRef } from 'react';
import { Sprite } from './Sprite';

/** [text, highlighted] */
export type TickerItem = [string, boolean];

/** The homepage's slow LED marquee: two copies of a row, scrolled one 4px step at a time. */
export function Ticker({ items }: { items: TickerItem[] }) {
  const track = useRef<HTMLDivElement>(null);
  const content = items.map((i) => i.join(':')).join('|');

  useLayoutEffect(() => {
    const t = track.current!;
    const measure = () => {
      const rows = Array.from(t.children) as HTMLElement[];
      rows.forEach((r) => (r.style.width = ''));
      // Pad the loop to a multiple of 4px so every step is a whole pixel.
      const padded = Math.ceil(rows[0].getBoundingClientRect().width / 4) * 4;
      rows.forEach((r) => (r.style.width = `${padded}px`));
      t.style.setProperty('--dist', `${padded}px`);
      t.style.setProperty('--steps', String(padded / 4));
      t.style.setProperty('--dur', `${(padded / 48).toFixed(1)}s`);
    };
    measure();
    void document.fonts?.ready.then(measure);
    document.addEventListener('fhecat:rebuild', measure);
    return () => document.removeEventListener('fhecat:rebuild', measure);
  }, [content]);

  const row = (
    <div className="ticker-item">
      {items.map(([text, hi], i) => (
        <Fragment key={i}>
          {hi ? <b>{text}</b> : <span>{text}</span>}
          <Sprite name="i-diamond" />
        </Fragment>
      ))}
    </div>
  );
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track" ref={track}>
        {row}
        {row}
      </div>
    </div>
  );
}
