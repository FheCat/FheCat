import { useEffect, useRef, useState, type ElementType } from 'react';
import { REDUCED_MOTION } from './fc';

interface Props {
  text: string;
  as?: ElementType;
  className?: string;
  id?: string;
  /** Wait until the element scrolls into view (headings); otherwise decrypt on every new text. */
  onView?: boolean;
}

/**
 * Text that arrives encrypted, as on the homepage: every character sits behind
 * a flickering cipher block, then they resolve left to right. Widths never
 * change, so nothing jumps around.
 */
export function Decrypt({ text, as: Tag = 'span', className, id, onView = false }: Props) {
  const ref = useRef<HTMLElement>(null);
  const chars = Array.from(text);
  const steps = Math.min(28, 10 + chars.length);
  const [frame, setFrame] = useState(REDUCED_MOTION ? Infinity : 0);
  const [started, setStarted] = useState(!onView);

  // A new text starts over.
  useEffect(() => {
    if (!REDUCED_MOTION) setFrame(0);
  }, [text]);

  useEffect(() => {
    if (!onView || REDUCED_MOTION) return;
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return setStarted(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setStarted(true);
        io.disconnect();
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onView]);

  useEffect(() => {
    if (!started || frame >= steps) return;
    const t = setTimeout(() => setFrame((f) => f + 1), 55);
    return () => clearTimeout(t);
  }, [started, frame, steps]);

  if (frame >= steps) {
    return (
      <Tag ref={ref} className={className} id={id}>
        {text}
      </Tag>
    );
  }
  const settled = Math.floor((frame / steps) * chars.length);
  return (
    <Tag ref={ref} className={className} id={id}>
      <span className="sr">{text}</span>
      {chars.map((ch, k) => (
        <span key={k} aria-hidden="true" className={ch === ' ' || (started && k < settled) ? undefined : Math.random() < 0.5 ? 'x' : 'x x2'}>
          {ch}
        </span>
      ))}
    </Tag>
  );
}
