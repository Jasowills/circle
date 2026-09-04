import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import { I } from '../icons';

export interface Notice {
  id: string;
  kind: string;
  title: string;
  body: string;
  circleId: string | null;
  at: string;
}

const KIND_ICON: Record<string, keyof typeof I> = {
  payout_received: 'arrowDown',
  payout_waiting: 'gift',
  goal_hit: 'trophy',
  member_joined: 'users',
  contribute_due: 'chart',
  collect_soon: 'gift',
  payout_countdown: 'bell',
  invite_pending: 'search',
};

const SEEN_KEY = 'circle.noticesSeenAt';

export function NotificationsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [seenAt, setSeenAt] = useState(() => localStorage.getItem(SEEN_KEY));
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notice[]>('/notifications'),
  });

  const markAll = () => {
    const now = new Date().toISOString();
    localStorage.setItem(SEEN_KEY, now);
    setSeenAt(now);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const list = data ?? [];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Notifications</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>Joins, dues, payouts and countdowns.</p>
        </div>
        {list.length > 0 && <button className="ghost" onClick={markAll}>Mark all read</button>}
      </div>

      <div className="card" style={{ padding: 8 }}>
        <ul className="feed">
          {list.map((n) => {
            const unread = !seenAt || n.at > seenAt;
            const Icon = I[KIND_ICON[n.kind] ?? 'bell'];
            return (
              <li
                key={n.id}
                onClick={() => n.circleId && nav(`/circles/${n.circleId}`)}
                style={{ cursor: n.circleId ? 'pointer' : 'default', padding: '12px' }}
              >
                <div className="row" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <span style={{ marginTop: 2 }}><Icon size={19} /></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: unread ? 800 : 400 }}>{n.title}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{n.body}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {new Date(n.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      {unread ? ' · new' : ''}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {list.length === 0 && <p className="muted" style={{ padding: 12 }}>All quiet.</p>}
      </div>
    </>
  );
}
