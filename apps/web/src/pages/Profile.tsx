import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import { statusLabel } from '../format';

interface Profile {
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  isSelf: boolean;
  sharedCircles: { id: string; name: string; status: string }[];
  inviteTargets: { id: string; name: string; status: string }[];
}

export function ProfilePage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['profile', id],
    queryFn: () => api.get<Profile>(`/users/${id}`),
  });

  const invite = useMutation({
    mutationFn: (circleId: string) => api.post(`/circles/${circleId}/invite`, { email: data?.user.email }),
    onSuccess: () => {
      setMsg('Invite sent.');
      qc.invalidateQueries({ queryKey: ['profile', id] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  if (isLoading || !data) return <p className="muted">Loading profile…</p>;
  const { user, isSelf, sharedCircles, inviteTargets } = data;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{user.name}</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>{user.email}{isSelf ? ' · this is you' : ''}</p>
        </div>
      </div>

      <div className="cols">
        <div className="card">
          <h3>Circles together ({sharedCircles.length})</h3>
          <ul className="feed">
            {sharedCircles.map((c) => (
              <li key={c.id} onClick={() => nav(`/circles/${c.id}`)} style={{ cursor: 'pointer' }}>
                {c.name} · <span className="muted">{statusLabel(c.status)}</span>
              </li>
            ))}
          </ul>
          {sharedCircles.length === 0 && <p className="muted">None yet.</p>}
        </div>

        {!isSelf && (
          <div className="card">
            <h3>Invite to your circles</h3>
            {msg && <p className="muted">{msg}</p>}
            {inviteTargets.length === 0 && <p className="muted">No circles of yours they can join right now.</p>}
            <ul className="feed">
              {inviteTargets.map((c) => (
                <li key={c.id}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span>{c.name}</span>
                    <button className="ghost" style={{ padding: '6px 12px' }} disabled={invite.isPending} onClick={() => invite.mutate(c.id)}>
                      Invite
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
