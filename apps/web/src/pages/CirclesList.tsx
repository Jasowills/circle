import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CircleSummary } from '../api';

export function CirclesList() {
  const qc = useQueryClient();
  const { data: circles, isLoading, error } = useQuery({
    queryKey: ['circles'],
    queryFn: () => api.get<CircleSummary[]>('/circles'),
  });
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('500000');
  const [formErr, setFormErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post<CircleSummary>('/circles', { name, goalAmount: Number(goal) }),
    onSuccess: () => {
      setName('');
      setFormErr(null);
      qc.invalidateQueries({ queryKey: ['circles'] });
    },
    onError: (e: Error) => setFormErr(e.message),
  });

  if (isLoading) return <p className="muted">Loading circles…</p>;
  if (error) return <div className="error">{(error as Error).message}</div>;
  const list = circles ?? [];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Circles</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {list.length === 0 ? 'Start your first savings circle.' : `${list.length} circle${list.length === 1 ? '' : 's'} and counting.`}
          </p>
        </div>
      </div>

      <div className="cols">
        <div className="card" style={{ padding: 8 }}>
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
                  <td><span className={`pill ${c.status}`}>{c.status.replace('_', ' ')}</span></td>
                  <td className="num">{c.activeMemberCount}</td>
                  <td className="num">₦{Number(c.balance).toLocaleString()}<div className="muted" style={{ fontSize: 12 }}>of ₦{Number(c.goalAmount).toLocaleString()}</div></td>
                  <td><Link className="btn ghost" to={`/circles/${c.id}`} style={{ padding: '8px 14px' }}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="muted" style={{ padding: '8px 12px' }}>Nothing here yet. Name your goal on the right to begin.</p>}
        </div>

        <div className="card">
          <h3 className="serif" style={{ fontSize: 22 }}>Start a new circle</h3>
          <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>Name the goal. Invite people after — they join by email.</p>
          {formErr && <div className="error">{formErr}</div>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <label>Circle name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mortgage deposit" required maxLength={80} />
            <label>Goal amount (₦)</label>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} type="number" min={1} required />
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
