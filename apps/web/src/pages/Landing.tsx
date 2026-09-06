import { Link } from 'react-router-dom';
import { Logo } from '../Logo';

export function Landing() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#000000' }}>
      <div style={{ textAlign: 'center', maxWidth: 640 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Logo size={40} />
          <span style={{ fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>Circle</span>
        </div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 56, lineHeight: 0.95, margin: '0 0 18px', letterSpacing: -1.8 }}>
          Group savings,<br />built on trust.
        </h1>
        <p className="muted" style={{ fontSize: 20, lineHeight: 1.5, margin: '0 auto 32px', maxWidth: 520 }}>
          A modern take on Ajo. Create a circle, invite people you trust, contribute on schedule, and watch the pot rotate.
        </p>
        <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
          <Link to="/login" className="btn" style={{ padding: '16px 32px', fontSize: 17 }}>
            Enter app
          </Link>
          <a href="https://github.com/Jasowills/circle" target="_blank" rel="noreferrer" className="btn ghost" style={{ padding: '16px 32px', fontSize: 17 }}>
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
