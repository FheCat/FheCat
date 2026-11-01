import { useEffect, useState } from 'react';
import { Sprite } from '../pixel/Sprite';
import { Wordmark } from '../pixel/Sky';
import { ConnectButton } from './ConnectButton';

/**
 * The homepage's top bar: see-through over the hero, solid once the page scrolls.
 * `app` is a separate app (the launchpad), shown as a button apart from the section links.
 */
export function Header({ links, app }: { links: [href: string, label: string][]; app?: [href: string, label: string] }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const update = () => setSolid(window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <header className={`topbar ${solid ? 'solid' : ''}`} id="topbar">
      <div className="wrap bar">
        <a className="brand" href="#top" aria-label="FheCat, back to top">
          <Sprite name="logo" className="brand-logo" />
          <Wordmark className="brand-word" />
        </a>
        <nav className="nav" aria-label="Sections">
          {links.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        {app && (
          <a className="btn btn-sm btn-ghost bar-app" href={app[0]}>
            <span>{app[1]}</span>
          </a>
        )}
        <ConnectButton size="sm" />
      </div>
    </header>
  );
}
