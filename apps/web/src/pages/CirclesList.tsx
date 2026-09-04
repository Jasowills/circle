import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CircleSummary } from '../api';
import { statusLabel } from '../format';

export function CirclesList() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [q, setQ] = useState('');
  const { data: circles, isLoading, error } = useQuery({
    queryKey: ['circles'],
    queryFn: () => api.get<CircleSummary[]>('/circles'),
  });
  const found = useQuery({
    queryKey: ['discover', q],
    queryFn: () => api.get<CircleSummary[]>(`/circles/discover?q=${encodeURIComponent(q)}`),
    enabled: tab === 'discover',
  });
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'goal' | 'ajo'>('ajo');
  const [goal, setGoal] = useState('500000');
  const [daily, setDaily] = useState('20000');
  const [members, setMembers] = useState('5');
  const [formErr, setFormErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.post<CircleSummary>('/circles', {
        name,
        ...(mode === 'ajo'
          ? { contributionAmount: Number(daily), targetMembers: Number(members) }
          : { goalAmount: Number(goal) }),
      }),
    onSuccess: (c) => {
      setName('');
      setFormErr(null);
      qc.invalidateQueries({ queryKey: ['circles'] });
      nav(`/circles/${c.id}`);
    },
    onError: (e: Error) => setFormErr(e.message),
  });

  const join = useMutation({
    mutationFn: (id: string) => api.post<CircleSummary & { id: string }>(`/circles/${id}/join`),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['circles'] });
      qc.invalidateQueries({ queryKey: ['discover'] });
      nav(`/circles/${c.id}`);
    },
  });

  if (isLoading) return <p className="muted">Loading circles…</p>;
  if (error) return <div className="error">{(error as Error).message}</div>;
  const list = tab === 'mine' ? (circles ?? []) : (found.data ?? []);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Circles</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Rotating savings, not just pots. Members contribute daily; one member takes the pot each cycle.
          </p>
        </div>
        <div className="row">
          <button className={tab === 'mine' ? '' : 'ghost'} onClick={() => setTab('mine')}>My circles</button>
          <button className={tab === 'discover' ? '' : 'ghost'} onClick={() => setTab('discover')}>Discover</button>
        </div>
      </div>

      <div className="cols">
        <div className="card" style={{ padding: 8 }}>
          {tab === 'discover' && (
            <div style={{ padding: '8px 12px 0' }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search open circles" />
            </div>
          )}
          <table className="table">
            <thead>
              <tr><th>Circle</th><th>Status</th><th>Members</th><th className="num">Balance</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <div className="progress thin" style={{ maxWidth: 220 }}>
                      <div style={{ width: `${Math.round(c.progress * 100)}%` }} />
                    </div>
                  </td>
                  <td><span className={`pill ${c.status}`}>{statusLabel(c.status)}</span></td>
                  <td className="num">{c.activeMemberCount}</td>
                  <td className="num">₦{Number(c.balance).toLocaleString()}<div className="muted" style={{ fontSize: 12 }}>of ₦{Number(c.goalAmount).toLocaleString()}</div></td>
                  <td>
                    {tab === 'mine' ? (
                      <Link className="btn ghost" to={`/circles/${c.id}`} style={{ padding: '8px 14px' }}>Open</Link>
                    ) : (
                      <button className="ghost" style={{ padding: '8px 14px' }} disabled={join.isPending} onClick={() => join.mutate(c.id)}>Join</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && (
            <p className="muted" style={{ padding: '8px 12px' }}>
              {tab === 'mine' ? 'Nothing here yet. Start an Ajo on the right.' : 'No open circles right now.'}
            </p>
          )}
        </div>

        <div className="card">
          <h3 className="serif" style={{ fontSize: 22 }}>Start a new circle</h3>
          <div className="row" style={{ marginBottom: 4 }}>
            <button className={mode === 'ajo' ? '' : 'ghost'} onClick={() => setMode('ajo')} style={{ flex: 1 }}>Ajo rotation</button>
            <button className={mode === 'goal' ? '' : 'ghost'} onClick={() => setMode('goal')} style={{ flex: 1 }}>Simple goal</button>
          </div>
          {formErr && <div className="error">{formErr}</div>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <label>Circle name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Saturday Thrift" required maxLength={80} />
            {mode === 'ajo' ? (
              <>
                <label>Daily contribution per member (₦)</label>
                <input value={daily} onChange={(e) => setDaily(e.target.value)} type="number" min={1} required />
                <label>Members (cycles)</label>
                <input value={members} onChange={(e) => setMembers(e.target.value)} type="number" min={2} max={50} required />
                <p className="muted" style={{ fontSize: 12 }}>
                  Weekly pot: ₦{(Number(daily || 0) * 7 * Number(members || 0)).toLocaleString()}. Order is drawn once the circle fills.
                </p>
              </>
            ) : (
              <>
                <label>Goal amount (₦)</label>
                <input value={goal} onChange={(e) => setGoal(e.target.value)} type="number" min={1} required />
              </>
            )}
            <div style={{ marginTop: 14 }}>
              <button type="submit" disabled={create.isPending} style={{ width: '100%' }}>
                {create.isPending ? 'Creating…' : 'Create circle'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
