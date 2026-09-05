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
  const { data, isLoading } = useQuery({
    queryKey: ['people', q],
    queryFn: () => api.get<Person[]>(`/users/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>People</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>Anyone on Circle. Open a profile to invite them to your circles.</p>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
          <I.search size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email (min 2 letters)"
            style={{ border: 'none', paddingLeft: 0 }}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 8 }}>
        <ul className="feed">
          {(data ?? []).map((p) => (
            <li
              key={p.id}
              onClick={() => nav(`/users/${p.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && nav(`/users/${p.id}`)}
              tabIndex={0}
              role="button"
              style={{ cursor: 'pointer', padding: '12px' }}
            >
              <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
                {p.avatarUrl ? (
                  <img className="avatar" src={p.avatarUrl} alt="" />
                ) : (
                  <span className="avatar-fallback">{p.name.charAt(0).toUpperCase()}</span>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{p.email}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {q.trim().length >= 2 && !isLoading && (data ?? []).length === 0 && (
          <p className="muted" style={{ padding: 12 }}>Nobody matches. Try another spelling.</p>
        )}
        {q.trim().length < 2 && (
          <p className="muted" style={{ padding: 12 }}>Type at least 2 letters to search the platform.</p>
        )}
      </div>
    </>
  );
}
