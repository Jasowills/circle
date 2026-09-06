import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { I } from '../icons';

interface Person {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export function PeoplePage() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const directory = useQuery({
    queryKey: ['people-all'],
    queryFn: () => api.get<Person[]>('/users'),
    enabled: q.trim().length < 2,
  });
  const found = useQuery({
    queryKey: ['people', q],
    queryFn: () => api.get<Person[]>(`/users/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });

  const searching = q.trim().length >= 2;
  const list = searching ? (found.data ?? []) : (directory.data ?? []);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>People</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {searching ? `${list.length} result${list.length === 1 ? '' : 's'}` : 'Everyone on Circle. Open a profile to invite them to your circles.'}
          </p>
        </div>
      </div>

      <div className="row" style={{ gap: 10, flexWrap: 'nowrap', maxWidth: 480, border: '1px solid var(--border)', borderRadius: 8, padding: '4px 12px', marginBottom: 20 }}>
        <I.search size={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or email"
          style={{ border: 'none', paddingLeft: 0 }}
        />
      </div>

      <div className="people-grid">
        {list.map((p) => (
          <div
            key={p.id}
            className="card person-card"
            style={{ padding: 28 }}
            onClick={() => nav(`/users/${p.id}`)}
            onKeyDown={(e) => e.key === 'Enter' && nav(`/users/${p.id}`)}
            tabIndex={0}
            role="button"
          >
            {p.avatarUrl ? (
              <img className="avatar" src={p.avatarUrl} alt="" style={{ width: 64, height: 64 }} />
            ) : (
              <span className="avatar-fallback" style={{ width: 64, height: 64, fontSize: 24 }}>
                {p.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div style={{ fontWeight: 700, fontSize: 17, marginTop: 16 }}>{p.name}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{p.email}</div>
            <span className="muted" style={{ fontSize: 13, fontWeight: 700, marginTop: 16 }}>View profile →</span>
          </div>
        ))}
      </div>
      {searching && !found.isLoading && list.length === 0 && (
        <p className="muted">Nobody matches. Try another spelling.</p>
      )}
    </>
  );
}
