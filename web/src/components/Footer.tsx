import { useI18n } from '../i18n';
import { FHENIX_URL, X_URL } from '../config/chains';

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="brand">
          <img src="/brand/logo.jpg" alt="" width={28} height={28} />
          <span>FheCat</span>
        </div>
        <p className="small muted">
          {t.footer.note} {t.footer.art}
        </p>
        <nav className="footer-links">
          <a href={X_URL} target="_blank" rel="noreferrer">
            X / @FheCat
          </a>
          <a href={FHENIX_URL} target="_blank" rel="noreferrer">
            Fhenix
          </a>
        </nav>
      </div>
    </footer>
  );
}
