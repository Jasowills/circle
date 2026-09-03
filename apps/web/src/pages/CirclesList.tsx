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

  return (
    <>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Start a new circle</h3>
        {formErr && <div className="error">{formErr}</div>}
        <form
          className="inline"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div>
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mortgage deposit" required maxLength={80} />
          </div>
          <div>
            <label>Goal (₦)</label>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} type="number" min={1} required />
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <button type="submit" disabled={create.isPending}>Create</button>
          </div>
        </form>
      </div>

      <div className="grid">
        {(circles ?? []).map((c) => (
          <Link key={c.id} to={`/circles/${c.id}`} className="card circle-card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{c.name}</strong>
              <span className={`pill ${c.status}`}>{c.status.replace('_', ' ')}</span>
            </div>
            <div className="progress">
              <div style={{ width: `${Math.round(c.progress * 100)}%` }} />
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              ₦{Number(c.balance).toLocaleString()} of ₦{Number(c.goalAmount).toLocaleString()} · {c.activeMemberCount} active
            </div>
          </Link>
        ))}
      </div>
      {circles?.length === 0 && <p className="muted">No circles yet — create one above, or ask a member to invite you.</p>}
    </>
  );
}
