import { Link } from 'react-router-dom';
import { Logo } from '../Logo';

export function Landing() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', maxWidth: 640 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Logo size={36} />
          <span style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 800, letterSpacing: -0.02 * 34 }}>Circle</span>
        </div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 48, lineHeight: 1, margin: '0 0 14px', letterSpacing: -1.5 }}>
          Group savings,<br />built on trust.
        </h1>
        <p className="muted" style={{ fontSize: 18, lineHeight: 1.5, margin: '0 auto 28px', maxWidth: 520 }}>
          A modern take on Ajo. Create a circle, invite people you trust, contribute on schedule, and watch the pot rotate.
        </p>
        <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
          <Link to="/login" className="btn" style={{ padding: '14px 28px', fontSize: 16 }}>
            Enter app
          </Link>
          <a href="https://github.com/Jasowills/circle" target="_blank" rel="noreferrer" className="btn ghost" style={{ padding: '14px 28px' }}>
            View code
          </a>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 32 }}>
          Wallet + ledger · Rotation engine · Real-time · Web & mobile
        </p>
      </div>
    </div>
  );
}
