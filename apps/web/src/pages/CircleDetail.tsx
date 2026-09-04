import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { API_URL, api, getToken, type CircleDetail, type Cycle, type LedgerPage, type WalletOverview } from '../api';
import { countdownText, statusLabel } from '../format';

export function CircleDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
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
  const cycles = useQuery({
    queryKey: ['cycles', id],
    queryFn: () => api.get<Cycle[]>(`/circles/${id}/cycles`),
    enabled: !!detail.data?.contributionAmount,
  });
  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get<WalletOverview>('/wallet'),
  });

  // Live room keeps every number on screen fresh. Updates land directly in
  // balances, pots and schedules; there is deliberately no feed UI.
  useEffect(() => {
    const token = getToken();
    if (!token || !id) return;
    const socket: Socket = io(API_URL, { transports: ['websocket'] });
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['circle', id] });
      qc.invalidateQueries({ queryKey: ['ledger', id] });
      qc.invalidateQueries({ queryKey: ['cycles', id] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    };
    socket.on('connect', () => socket.emit('join', { circleId: id, token }));
    socket.on('contribution.created', refresh);
    socket.on('member.joined', refresh);
    socket.on('circle.status_changed', refresh);
    socket.on('payout.completed', refresh);
    socket.on('cycle.advanced', refresh);
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const contribute = useMutation({
    mutationFn: (amt: number) =>
      api.post<{ replayed: boolean }>(`/circles/${id}/contribute`, { amount: amt, idempotencyKey: crypto.randomUUID() }),
    onSuccess: (r) => {
      setMsg({ ok: true, text: r.replayed ? 'That one already went through. No double charge.' : 'Contribution saved.' });
      qc.invalidateQueries({ queryKey: ['circle', id] });
      qc.invalidateQueries({ queryKey: ['ledger', id] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
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
      <div className="card hero">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className={`pill ${d.status}`}>{statusLabel(d.status)}</span>
          <span className="muted" style={{ fontSize: 13 }}>Your share: {Number(d.myBalance).toLocaleString()} {d.currency}</span>
        </div>
        <h1>{d.name}</h1>
        <div className="hero-big">{Number(d.balance).toLocaleString()} <span className="muted" style={{ fontSize: 18 }}>of {Number(d.goalAmount).toLocaleString()} {d.currency}</span></div>
        <div className="progress">
          <div style={{ width: `${Math.round(d.progress * 100)}%` }} />
        </div>
        <span className="muted">{Math.round(d.progress * 100)}% funded · {d.members.filter((m) => m.status === 'active').length} active members</span>
      </div>

      {msg && <div className={msg.ok ? 'card' : 'error'}>{msg.text}</div>}

      {(d.status === 'completed' || d.status === 'goal_reached') && (
        <div className="card">
          <h3 className="serif" style={{ fontSize: 22, margin: '0 0 6px' }}>Rotation complete</h3>
          <p className="muted" style={{ margin: 0 }}>Every cycle paid out. This circle is done collecting.</p>
        </div>
      )}

      {d.myMembership.status === 'invited' && (
        <div className="card">
          <p style={{ marginTop: 0 }}>You've been invited to this circle. Accept to start contributing.</p>
          <button onClick={() => accept.mutate()} disabled={accept.isPending}>Accept invite</button>
        </div>
      )}

      <div className="cols">
        <div>
          {d.currentCycle && (
            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 className="serif" style={{ fontSize: 22, margin: 0 }}>
                  Cycle {d.currentCycle.cycleNumber} of {d.currentCycle.totalCycles}
                </h3>
                <span className="pill active">collecting</span>
              </div>
              <p style={{ margin: '8px 0 0' }}>
                <strong>{d.currentCycle.recipient.name}</strong> collects this cycle.
              </p>
              <div className="progress money">
                <div style={{ width: `${Math.min(100, Math.round((d.currentCycle.collected / d.currentCycle.targetPot) * 100))}%` }} />
              </div>
              <span className="muted">
                {Number(d.currentCycle.collected).toLocaleString()} of {Number(d.currentCycle.targetPot).toLocaleString()} {d.currency} pot
                {countdownText(d.currentCycle.endsAt) ? ` · ${countdownText(d.currentCycle.endsAt)}` : ''}
              </span>
            </div>
          )}

          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 className="serif" style={{ fontSize: 22, margin: 0 }}>Contribute</h3>
              <span className="muted" style={{ fontSize: 13 }}>Wallet ₦{Number(wallet.data?.balance ?? 0).toLocaleString()}</span>
            </div>
            {d.contributionAmount ? (
              <p style={{ margin: '10px 0 0', fontSize: 20, fontWeight: 700 }}>
                ₦{Number(d.contributionAmount).toLocaleString()}{' '}
                <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>fixed step, one tap</span>
              </p>
            ) : null}
            <form
              className="inline"
              onSubmit={(e) => {
                e.preventDefault();
                contribute.mutate(d.contributionAmount ?? Number(amount));
              }}
            >
              {!d.contributionAmount && (
                <div>
                  <label>Amount ({d.currency})</label>
                  <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
              )}
              <div style={{ flex: '0 0 auto' }}>
                <button type="submit" disabled={contribute.isPending || d.myMembership.status !== 'active'}>
                  {contribute.isPending ? 'Sending…' : d.contributionAmount ? `Contribute ₦${Number(d.contributionAmount).toLocaleString()}` : 'Contribute'}
                </button>
              </div>
            </form>
            <p className="muted" style={{ fontSize: 12 }}>Safe to retry. One tap can never charge you twice.</p>
          </div>

          <div className="card">
            <h3>History</h3>
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
        </div>

        <div>
          {(cycles.data ?? []).length > 0 && (
            <div className="card">
              <h3>Rotation schedule</h3>
              <ul className="feed">
                {(cycles.data ?? []).map((c) => (
                  <li key={c.id}>
                    Cycle {c.cycleNumber} · {c.recipient.name} ·{' '}
                    <span className="muted">
                      {c.status === 'payout_completed' ? 'paid out' : c.status === 'collecting'
                        ? `${Number(c.collected).toLocaleString()} / ${Number(c.targetPot).toLocaleString()}`
                        : 'upcoming'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <h3>Members</h3>
            {d.members.map((m) => (
              <div className="member" key={m.userId}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  {m.user.avatarUrl ? (
                    <img className="avatar" src={m.user.avatarUrl} alt="" />
                  ) : (
                    <span className="avatar-fallback">{m.user.name.charAt(0).toUpperCase()}</span>
                  )}
                  <span>{m.user.name} <span className="muted">· {m.role} · {statusLabel(m.status)}</span></span>
                </span>
                <span>{Number(m.balance).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Invite</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                invite.mutate();
              }}
            >
              <label>Invite by email</label>
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="friend@example.com" required />
              <div style={{ marginTop: 12 }}>
                <button type="submit" className="ghost" disabled={invite.isPending} style={{ width: '100%' }}>Send invite</button>
              </div>
            </form>
          </div>

          {d.myMembership.role === 'creator' && (d.status === 'active' || d.status === 'goal_reached') && (
            <div className="card">
              <h3>Close out</h3>
              <p className="muted" style={{ fontSize: 13 }}>Closing ends contributions for everyone. This cannot be undone.</p>
              <button className="ghost" onClick={() => close.mutate()} disabled={close.isPending} style={{ width: '100%' }}>Close circle</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
