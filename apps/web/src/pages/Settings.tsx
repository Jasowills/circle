import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useTheme } from '../theme';
import { I } from '../icons';

export function SettingsPage() {
  const { user, signIn } = useAuth();
  const { theme, toggle } = useTheme();
  const [name, setName] = useState(user?.name ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      await api.patch('/me', { name });
      const t = localStorage.getItem('circle.accessToken');
      if (t) await signIn(t);
      setMsg('Name updated.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Settings</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>Your profile, appearance, and session.</p>
        </div>
      </div>

      <div className="cols">
        <div>
          <div className="card">
            <h3>Profile</h3>
            <div className="row" style={{ marginBottom: 8 }}>
              {user.avatarUrl ? (
                <img className="avatar" src={user.avatarUrl} alt="" style={{ width: 52, height: 52 }} />
              ) : (
                <span className="avatar-fallback" style={{ width: 52, height: 52, fontSize: 20 }}>
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div>
                <div style={{ fontWeight: 700 }}>{user.name}</div>
                <div className="muted" style={{ fontSize: 13 }}>{user.email}</div>
              </div>
            </div>
            {msg && <div className={msg === 'Name updated.' ? 'card' : 'error'}>{msg}</div>}
            <form onSubmit={save}>
              <label>Display name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
              <div style={{ marginTop: 12 }}>
                <button type="submit" disabled={saving || !name.trim() || name.trim() === user.name}>
                  {saving ? 'Saving…' : 'Save name'}
                </button>
              </div>
            </form>
          </div>

          <div className="card">
            <h3>Appearance</h3>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: 14 }}>Theme</span>
              <button className="ghost" onClick={toggle} title="Toggle light / dark" aria-label="Toggle light and dark mode">
                {theme === 'dark' ? <I.sun /> : <I.moon />}
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <h3>About</h3>
            <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
              <span className="muted">Version</span><span>1.0.0</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
              <span className="muted">Ledger</span><span>Append-only</span>
            </div>
          </div>

          <div className="card">
            <h3>Session</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Signed in as {user.email}. Logging out revokes this session everywhere.</p>
            <LogoutButton />
          </div>
        </div>
      </div>
    </>
  );
}

function LogoutButton() {
  const { signOut } = useAuth();
  return (
    <button
      className="ghost"
      style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      onClick={() => signOut().then(() => (window.location.href = '/login'))}
    >
      <I.logout size={16} /> Logout
    </button>
  );
}
