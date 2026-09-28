import { useI18n } from '../i18n';
import { ConnectButton } from './ConnectButton';

export function Header() {
  const { t, lang, setLang } = useI18n();
  return (
    <header className="header">
      <div className="container header-inner">
        <a className="brand" href="#top">
          <img src="/brand/logo.jpg" alt="" width={36} height={36} />
          <span>FheCat</span>
        </a>
        <nav className="nav">
          <a href="#mint">{t.nav.mint}</a>
          <a href="#how">{t.nav.how}</a>
          <a href="#cats">{t.nav.cats}</a>
          <a href="#traits">{t.nav.traits}</a>
        </nav>
        <div className="header-actions">
          <button
            className="lang"
            onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}
            aria-label={lang === 'tr' ? 'Switch to English' : 'Türkçeye geç'}
          >
            {lang === 'tr' ? 'EN' : 'TR'}
          </button>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
