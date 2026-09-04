import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getToken } from '../api';
import { useAuth } from '../auth';
import { Logo } from '../Logo';

/** First-run profile setup for brand-new accounts (server reports isNew on login). */
export function Setup() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await api.patch('/me', { name });
      const token = getToken();
      if (token) await signIn(token);
      nav('/');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save');
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 480, margin: '48px auto' }}>
      <div className="row" style={{ alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Logo size={30} />
        <h2 style={{ margin: 0 }}>You're in.</h2>
      </div>
      <p className="muted">One last thing. What should your circles call you?</p>
      {user?.avatarUrl && (
        <img src={user.avatarUrl} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
      )}
      {err && <div className="error">{err}</div>}
      <form onSubmit={save}>
        <label>Display name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Start saving'}</button>
        </div>
      </form>
    </div>
  );
}
