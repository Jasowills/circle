import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, api } from '../api';
import { googleLoginUrl, useAuth } from '../auth';

export function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);

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
    <div className="card" style={{ maxWidth: 480, margin: '48px auto' }}>
      <h1>
        Circle<span style={{ color: 'var(--accent)' }}>.</span>
      </h1>
      <p className="muted">Save together toward one goal. Every contribution is on record for good.</p>
      <a className="btn" href={googleLoginUrl} style={{ width: '100%', textAlign: 'center' }}>
        Continue with Google
      </a>
      <hr style={{ borderColor: 'var(--border)', margin: '20px 0' }} />
      <p className="muted" style={{ fontSize: 13 }}>
        No Google credentials handy? Use the dev login (enabled when <code>ALLOW_DEV_LOGIN=true</code> on the API at <code>{API_URL}</code>).
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
      setErr('Missing access token from Google callback');
      return;
    }
    signIn(t).then(() => nav('/')).catch((e: Error) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (err) return <div className="error">{err}</div>;
  return <p className="muted">Signing you in…</p>;
}
