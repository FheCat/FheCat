import type { ReactNode } from 'react';
import { Sprite } from '../pixel/Sprite';
import { Decrypt } from '../pixel/Decrypt';

/** A chapter's opening, as on the homepage: "01 · Label", a heading that decrypts as it scrolls in, then the copy. */
export function ChapterHead({ n, label, title, wide, children }: { n: string; label: string; title: string; wide?: boolean; children?: ReactNode }) {
  return (
    <div className={`copy ${wide ? 'copy-wide' : ''}`}>
      <p className="label">
        <Sprite name="i-diamond" />
        {n} · {label}
      </p>
      <Decrypt as="h2" onView text={title} />
      {children}
    </div>
  );
}
