import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type CircleSummary, type LedgerPage } from '../api';
import { statusLabel } from '../format';
import { useAuth } from '../auth';
import { I } from '../icons';
import { AreaChart, Donut, CycleTimeline } from '../charts';

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return `Good ${part}, ${name.split(' ')[0] || name}`;
}

interface ActivityItem {
  id: string;
  circleId: string;
  circleName: string;
  userName: string;
  amount: number;
  at: string;
}

export function Overview() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: circles, isLoading, error } = useQuery({
    queryKey: ['circles'],
    queryFn: () => api.get<CircleSummary[]>('/circles'),
  });

  const list = circles ?? [];
  const activity = useQuery({
    queryKey: ['overview-activity', list.map((c) => c.id).join(',')],
    queryFn: async (): Promise<ActivityItem[]> => {
      const pages = await Promise.all(
        list.slice(0, 5).map(async (c) => {
          const page = await api.get<LedgerPage>(`/circles/${c.id}/ledger?limit=30`);
          return page.data.map((e) => ({
            id: e.id, circleId: c.id, circleName: c.name,
            userName: e.user.name, amount: Number(e.amount), at: e.createdAt,
          }));
        }),
      );
      return pages.flat().sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 8);
    },
    enabled: list.length > 0,
  });

  if (isLoading) return <p className="muted">Loading overview…</p>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  const saved = list.reduce((s, c) => s + Number(c.balance), 0);
  const active = list.filter((c) => c.status === 'active').length;
  const members = list.reduce((s, c) => s + c.activeMemberCount, 0);
  const avg = list.length ? list.reduce((s, c) => s + c.progress, 0) / list.length : 0;

  // Cumulative savings curve, bucketed by day.
  const byDay = new Map<string, number>();
  for (const a of activity.data ?? []) {
    const day = a.at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + a.amount);
  }
  const days = [...byDay.keys()].sort();
  let run = 0;
  const curve = days.map((d) => ({ t: +new Date(d), v: (run += byDay.get(d) ?? 0) }));

  // Contribution mix across my circles (top contributors first).
  const byWho = new Map<string, number>();
  for (const a of activity.data ?? []) byWho.set(a.userName, (byWho.get(a.userName) ?? 0) + a.amount);
  const mix = [...byWho.entries()].map(([label, value]) => ({ label, value }));

  const top = [...list].sort((a, b) => b.progress - a.progress)[0];

  const stats = [
    { k: 'Saved together', v: `₦${saved.toLocaleString()}`, icon: <I.wallet size={20} /> },
    { k: 'Circles', v: String(list.length), icon: <I.grid size={20} /> },
    { k: 'Active now', v: String(active), icon: <I.chart size={20} /> },
    { k: 'Members', v: String(members), icon: <I.users size={20} /> },
  ];

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
        {stats.map((s) => (
          <div className="stat" key={s.k}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="k" style={{ marginBottom: 0 }}>{s.k}</span>
              {s.icon}
            </div>
            <div className="v">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="cols">
        <div>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>Growth</h3>
              <span className="muted" style={{ fontSize: 12 }}>Avg progress {Math.round(avg * 100)}%</span>
            </div>
            <AreaChart data={curve} />
          </div>

          <div className="card">
            <h3>Latest activity</h3>
            <ul className="feed">
              {(activity.data ?? []).map((a) => (
                <li key={a.id} onClick={() => nav(`/circles/${a.circleId}`)} style={{ cursor: 'pointer' }}>
                  {a.userName} · {a.circleName} · <strong>+₦{a.amount.toLocaleString()}</strong>
                  <span className="muted"> · {new Date(a.at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
            {(!activity.data || activity.data.length === 0) && (
              <p className="muted">Nothing yet. Contributions from your circles land here.</p>
            )}
          </div>
        </div>

        <div>
          {top && (
            <div className="card">
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Closest to goal</div>
              <h3 className="serif" style={{ fontSize: 24, margin: '0 0 4px' }}>{top.name}</h3>
              <div className="progress money">
                <div style={{ width: `${Math.round(top.progress * 100)}%` }} />
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted" style={{ fontSize: 13 }}>
                  {Math.round(top.progress * 100)}% of ₦{Number(top.goalAmount).toLocaleString()}
                </span>
                <Link to={`/circles/${top.id}`} style={{ fontSize: 13, fontWeight: 700 }}>Open →</Link>
              </div>
            </div>
          )}

          <div className="card">
            <h3>Who's carrying</h3>
            <Donut slices={mix} />
          </div>

          <div className="card">
            <h3>Rotation</h3>
            <RotationPreview />
          </div>
        </div>
      </div>
    </>
  );
}

function RotationPreview() {
  const { data: circles } = useQuery({
    queryKey: ['circles'],
    queryFn: () => api.get<CircleSummary[]>('/circles'),
  });
  const first = (circles ?? []).find((c) => c.contributionAmount);
  const cycles = useQuery({
    queryKey: ['cycles-preview', first?.id],
    queryFn: () => api.get<{ cycleNumber: number; recipient: { name: string }; status: string }[]>(`/circles/${first?.id}/cycles`),
    enabled: !!first,
  });
  if (!first) return <p className="muted" style={{ fontSize: 13 }}>No rotation circles yet. Start an Ajo to see the payout order.</p>;
  return (
    <>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{first.name}</p>
      <CycleTimeline cycles={(cycles.data ?? []).map((c) => ({ cycleNumber: c.cycleNumber, recipientName: c.recipient.name, status: c.status }))} />
    </>
  );
}
