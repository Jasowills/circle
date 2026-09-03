import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { API_URL, api, getToken, type CircleDetail, type LedgerPage } from '../api';

interface FeedItem {
  id: string;
  text: string;
  at: Date;
}

export function CircleDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [amount, setAmount] = useState('1000');
  const [inviteEmail, setInviteEmail] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const detail = useQuery({
    queryKey: ['circle', id],
    queryFn: () => api.get<CircleDetail>(`/circles/${id}`),
  });
  const ledger = useQuery({
    queryKey: ['ledger', id],
    queryFn: () => api.get<LedgerPage>(`/circles/${id}/ledger?limit=20`),
  });

  const pushFeed = (text: string) =>
    setFeed((f) => [{ id: `${Date.now()}-${Math.random()}`, text, at: new Date() }, ...f].slice(0, 30));

  // Live room: re-join when the circle or token changes.
  useEffect(() => {
    const token = getToken();
    if (!token || !id) return;
    const socket: Socket = io(API_URL, { transports: ['websocket'] });
    socket.on('connect', () => socket.emit('join', { circleId: id, token }));
    socket.on('contribution.created', (p: { userId: string; amount: string }) => {
      pushFeed(`New contribution of ${p.amount}`);
      qc.invalidateQueries({ queryKey: ['circle', id] });
      qc.invalidateQueries({ queryKey: ['ledger', id] });
    });
    socket.on('member.joined', (p: { userId: string; status: string }) => {
      pushFeed(`A member joined (${p.status.replace('_', ' ')})`);
      qc.invalidateQueries({ queryKey: ['circle', id] });
    });
    socket.on('circle.status_changed', (p: { from: string; to: string }) => {
      pushFeed(`Circle is now ${p.to.replace('_', ' ')}`);
      qc.invalidateQueries({ queryKey: ['circle', id] });
    });
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const contribute = useMutation({
    // A fresh UUID per submission: double-taps/retries share the key, so the
    // server turns the second hit into a replay instead of a duplicate.
    mutationFn: (amt: number) =>
      api.post<{ replayed: boolean }>(`/circles/${id}/contribute`, { amount: amt, idempotencyKey: crypto.randomUUID() }),
    onSuccess: (r) => {
      setMsg({ ok: true, text: r.replayed ? 'That one already went through. No double charge.' : 'Contribution saved.' });
      qc.invalidateQueries({ queryKey: ['circle', id] });
      qc.invalidateQueries({ queryKey: ['ledger', id] });
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  });

  const invite = useMutation({
    mutationFn: () => api.post(`/circles/${id}/invite`, { email: inviteEmail }),
    onSuccess: () => {
      setMsg({ ok: true, text: 'Invite sent.' });
      setInviteEmail('');
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  });

  const accept = useMutation({
    mutationFn: () => api.post(`/circles/${id}/accept`),
    onSuccess: () => {
      setMsg({ ok: true, text: 'Invite accepted. You are now active.' });
      qc.invalidateQueries({ queryKey: ['circle', id] });
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  });

  const close = useMutation({
    mutationFn: () => api.post(`/circles/${id}/close`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['circle', id] }),
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  });

  const d = detail.data;
  if (detail.isLoading) return <p className="muted">Loading circle…</p>;
  if (detail.error || !d) return <div className="error">{(detail.error as Error)?.message ?? 'Not found'}</div>;

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>{d.name}</h2>
          <span className={`pill ${d.status}`}>{d.status.replace('_', ' ')}</span>
        </div>
        <div className="progress">
          <div style={{ width: `${Math.round(d.progress * 100)}%` }} />
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span>
            <strong>{Number(d.balance).toLocaleString()} {d.currency}</strong>
            <span className="muted"> of {Number(d.goalAmount).toLocaleString()} ({Math.round(d.progress * 100)}%)</span>
          </span>
          <span className="muted">Your share: {Number(d.myBalance).toLocaleString()}</span>
        </div>
      </div>

      {msg && <div className={msg.ok ? 'card' : 'error'}>{msg.text}</div>}

      {d.myMembership.status === 'invited' && (
        <div className="card">
          <p>You've been invited to this circle.</p>
          <button onClick={() => accept.mutate()} disabled={accept.isPending}>Accept invite</button>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Contribute</h3>
        <form
          className="inline"
          onSubmit={(e) => {
            e.preventDefault();
            contribute.mutate(Number(amount));
          }}
        >
          <div>
            <label>Amount ({d.currency})</label>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <button type="submit" disabled={contribute.isPending || d.myMembership.status !== 'active'}>
              {contribute.isPending ? 'Sending…' : 'Contribute'}
            </button>
          </div>
        </form>
        <p className="muted" style={{ fontSize: 12 }}>Safe to retry. One tap can never charge you twice.</p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Members</h3>
        {d.members.map((m) => (
          <div className="member" key={m.userId}>
            <span>{m.user.name} <span className="muted">· {m.role} · {m.status}</span></span>
            <span>{Number(m.balance).toLocaleString()}</span>
          </div>
        ))}
        <form
          className="inline"
          style={{ marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate();
          }}
        >
          <div>
            <label>Invite by email</label>
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="friend@example.com" required />
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <button type="submit" className="ghost" disabled={invite.isPending}>Invite</button>
          </div>
        </form>
        {d.myMembership.role === 'creator' && (d.status === 'active' || d.status === 'goal_reached') && (
          <div style={{ marginTop: 12 }}>
            <button className="ghost" onClick={() => close.mutate()} disabled={close.isPending}>Close circle</button>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><span className="live-dot" />Live feed</h3>
        {feed.length === 0 && <p className="muted">Live. New contributions and member updates show up here.</p>}
        <ul className="feed">
          {feed.map((f) => (
            <li key={f.id}>{f.text} <span className="muted">· {f.at.toLocaleTimeString()}</span></li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>History</h3>
        <ul className="feed">
          {(ledger.data?.data ?? []).map((e) => (
            <li key={e.id}>
              {e.user.name} · {e.type} · <strong>{Number(e.amount).toLocaleString()}</strong>
              <span className="muted"> · {new Date(e.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
        <p className="muted" style={{ fontSize: 12 }}>{ledger.data?.total ?? 0} entries total. Entries are permanent; fixes show up as new entries.</p>
      </div>
    </>
  );
}
