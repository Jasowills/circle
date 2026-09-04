import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { googleLoginUrl, useAuth } from '../auth';
import { Logo } from '../Logo';

const SLIDES = [
  {
    img: 'https://images.pexels.com/photos/3830752/pexels-photo-3830752.jpeg?auto=compress&cs=tinysrgb&w=1260',
    alt: 'Friends stacking hands together',
    title: 'Save together.',
    body: 'Form a trusted circle and chip toward one shared goal, side by side.',
  },
  {
    img: 'https://images.pexels.com/photos/34134899/pexels-photo-34134899.jpeg?auto=compress&cs=tinysrgb&w=1260',
    alt: 'Buying a first home',
    title: 'One goal, every eye on it.',
    body: 'Mortgage deposit, rent, fees. The balance is always visible to the group.',
  },
  {
    img: 'https://images.pexels.com/photos/4630669/pexels-photo-4630669.jpeg?auto=compress&cs=tinysrgb&w=1260',
    alt: 'Hands reaching up together',
    title: 'Every tap counts.',
    body: 'Contribute in seconds. Retries never charge you twice.',
  },
];

export function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [slide, setSlide] = useState(0);
  const [mode, setMode] = useState<'join' | 'signin'>('join');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showDev, setShowDev] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const last = slide === SLIDES.length - 1;
  const s = SLIDES[slide];

  const devLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const path = mode === 'join' ? '/auth/signup' : '/auth/login';
      const body = mode === 'join'
        ? { email, name: name || undefined, password }
        : { email, password };
      const r = await api.post<{ accessToken: string; isNew: boolean }>(path, body);
      await signIn(r.accessToken);
      nav(r.isNew ? '/setup' : '/');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Login failed');
    }
  };

  return (
    <div className="auth-split">
      <div className="auth-visual">
        <img src={s.img} alt={s.alt} />
        <div className="auth-veil" />
        <div className="auth-brand">
          <Logo size={24} />
          Circle
        </div>
        <div className="auth-caption">
          <h2>{s.title}</h2>
          <p>{s.body}</p>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <div className="dots">
            {SLIDES.map((item, i) => (
              <span key={item.title} className={i === slide ? 'on' : ''} onClick={() => setSlide(i)} />
            ))}
          </div>

          {!last ? (
            <>
              <h2 className="serif" style={{ fontSize: 30, margin: '0 0 8px' }}>{s.title}</h2>
              <p className="muted">{s.body}</p>
              <div className="row" style={{ marginTop: 20 }}>
                <button className="ghost" onClick={() => setSlide(SLIDES.length - 1)}>Skip</button>
                <button onClick={() => setSlide(slide + 1)}>Next</button>
              </div>
            </>
          ) : (
            <>
              <div className="row" style={{ alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Logo size={30} />
                <strong style={{ fontSize: 20 }}>Circle</strong>
              </div>
              <div className="row" style={{ marginBottom: 12 }}>
                <button className={mode === 'join' ? '' : 'ghost'} onClick={() => setMode('join')} style={{ flex: 1 }}>
                  Join
                </button>
                <button className={mode === 'signin' ? '' : 'ghost'} onClick={() => setMode('signin')} style={{ flex: 1 }}>
                  Sign in
                </button>
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                {mode === 'join'
                  ? 'New here? Create your account with Google in seconds.'
                  : 'Welcome back. Sign in with the Google account you joined with.'}
              </p>
              <a className="btn" href={googleLoginUrl} style={{ width: '100%', textAlign: 'center' }}>
                Continue with Google
              </a>
              <p style={{ margin: '14px 0 0' }}>
                <button className="ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setShowDev(!showDev)}>
                  Trouble signing in?
                </button>
              </p>
              {showDev && (
                <>
                  <p className="muted" style={{ fontSize: 13 }}>
                    No Google account handy? Use email + password instead. Try <code>james@circle.com</code> / <code>12345678</code> on a seeded database.
                  </p>
                  {err && <div className="error">{err}</div>}
                  <form onSubmit={devLogin}>
                    <label>Email</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="james@circle.com" required />
                    {mode === 'join' && (
                      <>
                        <label>Name</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="James" />
                      </>
                    )}
                    <label>Password (8+ characters)</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                    <div style={{ marginTop: 12 }}>
                      <button type="submit" style={{ width: '100%' }}>{mode === 'join' ? 'Create account' : 'Sign in'}</button>
                    </div>
                  </form>
                </>
              )}
            </>
          )}
          <p className="photo-credit">Photos: Pexels</p>
        </div>
      </div>
    </div>
  );
}

export function AuthCallback() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('accessToken');
    if (!t) {
      setErr('Sign-in did not return a token. Please try again.');
      return;
    }
    signIn(t).then(() => nav(params.get('isNew') === '1' ? '/setup' : '/')).catch((e: Error) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (err) return <div className="error">{err}</div>;
  return <p className="muted">Signing you in…</p>;
}
