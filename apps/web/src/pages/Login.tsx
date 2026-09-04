import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, api } from '../api';
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
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [showDev, setShowDev] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const last = slide === SLIDES.length - 1;

  const devLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api.post<{ accessToken: string }>('/auth/dev-login', { email, name: name || undefined });
      await signIn(r.accessToken);
      nav('/');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Login failed');
    }
  };

  return (
    <div className="onboard">
      <div className="slides">
        {SLIDES.map(
          (s, i) =>
            i === slide && (
              <div className="slide" key={s.title}>
                <img src={s.img} alt={s.alt} />
                <div className="slide-caption">
                  <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Logo size={20} />
                    <strong style={{ fontSize: 14, letterSpacing: 1 }}>CIRCLE</strong>
                  </div>
                  <h2>{s.title}</h2>
                  <p>{s.body}</p>
                </div>
              </div>
            ),
        )}
      </div>
      <div className="dots">
        {SLIDES.map((s, i) => (
          <span key={s.title} className={i === slide ? 'on' : ''} />
        ))}
      </div>

      {!last ? (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="ghost" onClick={() => setSlide(SLIDES.length - 1)}>Skip</button>
          <button onClick={() => setSlide(slide + 1)}>Next</button>
        </div>
      ) : (
        <div className="card">
          <div className="row" style={{ alignItems: 'center', marginBottom: 12 }}>
            <Logo size={30} />
            <strong style={{ fontSize: 18 }}>Circle</strong>
          </div>
          <a className="btn" href={googleLoginUrl} style={{ width: '100%', textAlign: 'center' }}>
            Continue with Google
          </a>
          <p className="muted" style={{ fontSize: 13 }}>
            <button className="ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setShowDev(!showDev)}>
              Trouble signing in?
            </button>
          </p>
          {showDev && (
            <>
              <p className="muted" style={{ fontSize: 13 }}>
                No Google credentials handy? Use dev sign-in (needs <code>ALLOW_DEV_LOGIN=true</code> on the API at <code>{API_URL}</code>).
              </p>
              {err && <div className="error">{err}</div>}
              <form onSubmit={devLogin}>
                <label>Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ada@example.com" required />
                <label>Name (optional)</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada" />
                <div style={{ marginTop: 12 }}>
                  <button type="submit">Dev sign-in</button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
      <p className="photo-credit">Photos: Pexels</p>
    </div>
  );
}

export function AuthCallback() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('accessToken');
    if (!t) {
      setErr('Sign-in did not return a token. Please try again.');
      return;
    }
    signIn(t).then(() => nav('/')).catch((e: Error) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (err) return <div className="error">{err}</div>;
  return <p className="muted">Signing you in…</p>;
}
