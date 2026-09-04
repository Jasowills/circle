import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type CircleSummary, type LedgerPage } from '../api';
import { Loading } from '../Loading';
import { money, statusLabel, timeAgo } from '../format';
import { useAuth } from '../auth';
import { I } from '../icons';
import { AreaChart, Donut, CycleTimeline } from '../charts';

interface Notice {
  id: string;
  kind: string;
  title: string;
  body: string;
  circleId: string | null;
  at: string;
}

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
  const notices = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notice[]>('/notifications'),
  });
  const attention = (notices.data ?? []).filter((n) =>
    ['contribute_due', 'invite_pending', 'payout_countdown', 'collect_soon'].includes(n.kind),
  ).slice(0, 4);
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

  if (isLoading) return <Loading label="Loading overview…" />;
  if (error) return <div className="error">{(error as Error).message}</div>;

  const saved = list.reduce((s, c) => s + Number(c.balance), 0);
  const active = list.filter((c) => c.status === 'active').length;
  const members = list.reduce((s, c) => s + c.activeMemberCount, 0);
  const avg = list.length ? list.reduce((s, c) => s + c.progress, 0) / list.length : 0;

  // Cumulative curve over the trailing 14 days (ledgers are sampled per
  // circle, so this is a recent window, not all-time history).
  const cutoff = Date.now() - 14 * 86400000;
  const byDay = new Map<string, number>();
  for (const a of activity.data ?? []) {
    if (+new Date(a.at) < cutoff) continue;
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
              <span className="muted" style={{ fontSize: 12 }}>Last 14 days · avg progress {Math.round(avg * 100)}%</span>
            </div>
            <AreaChart data={curve} />
          </div>

          <div className="card">
            <h3>Latest activity</h3>
            <ul className="feed">
              {(activity.data ?? []).map((a) => (
                <li
                  key={a.id}
                  onClick={() => nav(`/circles/${a.circleId}`)}
                  onKeyDown={(e) => e.key === 'Enter' && nav(`/circles/${a.circleId}`)}
                  tabIndex={0}
                  role="button"
                  style={{ cursor: 'pointer' }}
                >
                  {a.userName} · {a.circleName} · <strong>+{money(a.amount)}</strong>
                  <span className="muted"> · {timeAgo(a.at)}</span>
                </li>
              ))}
            </ul>
            {(!activity.data || activity.data.length === 0) && (
              <p className="muted">Nothing yet. Contributions from your circles land here.</p>
            )}
          </div>
        </div>

        <div>
          <div className="card">
            <h3>Rotation</h3>
            <RotationPreview />
          </div>

          {attention.length > 0 && (
            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3>Needs your attention</h3>
                <I.bell size={17} />
              </div>
              <ul className="feed">
                {attention.slice(0, 2).map((n) => (
                  <li
                    key={n.id}
                    onClick={() => n.circleId && nav(`/circles/${n.circleId}`)}
                    onKeyDown={(e) => e.key === 'Enter' && n.circleId && nav(`/circles/${n.circleId}`)}
                    tabIndex={n.circleId ? 0 : undefined}
                    role={n.circleId ? 'button' : undefined}
                    style={{ cursor: n.circleId ? 'pointer' : 'default' }}
                  >
                    {n.title}
                    <div className="muted" style={{ fontSize: 12 }}>{n.body}</div>
                  </li>
                ))}
              </ul>
              {attention.length > 2 && (
                <Link to="/notifications" style={{ fontSize: 13, fontWeight: 700 }}>
                  View all {attention.length} →
                </Link>
              )}
            </div>
          )}

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
            <h3>Recent contributors</h3>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Last 14 days, across your circles.</p>
            <Donut slices={mix} />
          </div>

          <div className="card">
            <h3>Rotation</h3>
            <RotationPreview />
          </div>

          {list.filter((c) => c.status === 'completed' || c.status === 'goal_reached').length > 0 && (
            <div className="card">
              <h3>Hall of fame</h3>
              <ul className="feed">
                {list.filter((c) => c.status === 'completed' || c.status === 'goal_reached').map((c) => (
                  <li
                    key={c.id}
                    onClick={() => nav(`/circles/${c.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && nav(`/circles/${c.id}`)}
                    tabIndex={0}
                    role="button"
                    style={{ cursor: 'pointer' }}
                  >
                    {c.name}
                    <div className="muted" style={{ fontSize: 12 }}>
                      Finished at {money(Number(c.balance))} · {c.activeMemberCount} members
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function RotationPreview() {
  const nav = useNavigate();
  const { data: circles } = useQuery({
    queryKey: ['circles'],
    queryFn: () => api.get<CircleSummary[]>('/circles'),
  });
  const urgent = (circles ?? [])
    .filter((c) => c.currentCycle)
    .sort((a, b) => +new Date(a.currentCycle!.endsAt) - +new Date(b.currentCycle!.endsAt))[0];
  const cycles = useQuery({
    queryKey: ['cycles-preview', urgent?.id],
    queryFn: () => api.get<{ cycleNumber: number; recipient: { name: string }; status: string }[]>(`/circles/${urgent?.id}/cycles`),
    enabled: !!urgent,
  });
  if (!urgent) return <p className="muted" style={{ fontSize: 13 }}>No rotation circles yet. Start an Ajo to see the payout order.</p>;
  const cc = urgent.currentCycle!;
  const days = Math.ceil((+new Date(cc.endsAt) - Date.now()) / 86400000);
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Next payout: <strong style={{ color: 'var(--text)' }}>{cc.recipient.name}</strong>
          {' '}· {days <= 0 ? 'due now' : `in ${days}d`} · {urgent.name}
        </p>
        <Link to={`/circles/${urgent.id}`} style={{ fontSize: 13, fontWeight: 700 }}>Open →</Link>
      </div>
      <CycleTimeline cycles={(cycles.data ?? []).map((c) => ({ cycleNumber: c.cycleNumber, recipientName: c.recipient.name, status: c.status }))} />
    </>
  );
}
