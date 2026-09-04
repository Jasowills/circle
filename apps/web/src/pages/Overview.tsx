import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type CircleSummary } from '../api';
import { statusLabel } from '../format';
import { useAuth } from '../auth';

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return `Good ${part}, ${name.split(' ')[0] || name}`;
}

export function Overview() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: circles, isLoading, error } = useQuery({
    queryKey: ['circles'],
    queryFn: () => api.get<CircleSummary[]>('/circles'),
  });

  if (isLoading) return <p className="muted">Loading overview…</p>;
  if (error) return <div className="error">{(error as Error).message}</div>;
  const list = circles ?? [];
  const saved = list.reduce((s, c) => s + Number(c.balance), 0);
  const active = list.filter((c) => c.status === 'active').length;
  const members = list.reduce((s, c) => s + c.memberCount, 0);
  const avg = list.length ? list.reduce((s, c) => s + c.progress, 0) / list.length : 0;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{user ? greeting(user.name) : 'Overview'}</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} — here's where your circles stand.
          </p>
        </div>
        <Link className="btn" to="/circles">New circle</Link>
      </div>

      <div className="stats">
        <div className="stat"><div className="k">Saved together</div><div className="v">₦{saved.toLocaleString()}</div></div>
        <div className="stat"><div className="k">Circles</div><div className="v">{list.length}</div></div>
        <div className="stat"><div className="k">Active now</div><div className="v">{active}</div></div>
        <div className="stat"><div className="k">Avg progress</div><div className="v">{Math.round(avg * 100)}%</div></div>
      </div>

      <div className="card" style={{ padding: 8 }}>
        <table className="table">
          <thead>
            <tr><th>Circle</th><th>Status</th><th>Progress</th><th className="num">Balance</th><th className="num hide-sm">Goal</th></tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} onClick={() => nav(`/circles/${c.id}`)}>
                <td><strong>{c.name}</strong><div className="muted" style={{ fontSize: 12 }}>{c.activeMemberCount} active members</div></td>
                <td><span className={`pill ${c.status}`}>{statusLabel(c.status)}</span></td>
                <td className="bar-cell">
                  <div className="progress thin"><div style={{ width: `${Math.round(c.progress * 100)}%` }} /></div>
                  <span className="muted" style={{ fontSize: 12 }}>{Math.round(c.progress * 100)}%</span>
                </td>
                <td className="num">₦{Number(c.balance).toLocaleString()}</td>
                <td className="num hide-sm muted">₦{Number(c.goalAmount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="muted" style={{ padding: '8px 12px' }}>No circles yet. Create your first one from the Circles page.</p>}
      </div>
    </>
  );
}
