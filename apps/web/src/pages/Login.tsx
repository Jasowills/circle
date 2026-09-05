import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { api } from '../api';
import { Loading } from '../Loading';
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
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const [slide, setSlide] = useState(0);
  const [mode, setMode] = useState<'join' | 'signin'>('join');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const last = slide === SLIDES.length - 1;
  const s = SLIDES[slide];
  const [paused, setPaused] = useState(false);

  // Auto-advance the visual until the auth slide. Words live on the right;
  // the left is pure imagery.
  useEffect(() => {
    if (paused || last) return;
    const t = setTimeout(() => setSlide(slide + 1), 5000);
    return () => clearTimeout(t);
  }, [slide, paused, last]);

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

  // Already holding a session (e.g. bounced here before auth resolved):
  // go home instead of showing the form.
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="auth-split">
      <div
        className="auth-visual"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <img key={s.img} src={s.img} alt={s.alt} className="crossfade" />
        <div className="auth-veil" />
        <div className="auth-brand">
          <Logo size={24} />
          Circle
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
              <p className="muted" style={{ fontSize: 13, margin: '0 0 4px' }}>
                {slide + 1} of {SLIDES.length}
              </p>
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
              <a className="btn ghost" href={googleLoginUrl} style={{ width: '100%', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.7z" />
                  <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.3 7.5 24 12 24z" />
                  <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.6 0 10.2 0 12s.5 3.4 1.4 4.9l3.8-2.5z" />
                  <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.4 6.9l3.8 2.8c1-2.9 3.7-5 6.8-5z" />
                </svg>
                Continue with Google
              </a>
              <div className="divider">or continue with email</div>
              {err && <div className="error">{err}</div>}
              <form onSubmit={devLogin}>
                <label>Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
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
  return <Loading label="Signing you in…" />;
}
