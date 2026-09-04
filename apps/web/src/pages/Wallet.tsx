import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CircleSummary, type WalletOverview, type WalletTx } from '../api';
import { Loading } from '../Loading';

function inOut(txns: WalletTx[], sign: 1 | -1): number {
  return txns.reduce((s, t) => s + (Math.sign(Number(t.amount)) === sign ? Math.abs(Number(t.amount)) : 0), 0);
}

function txLabel(type: string): string {
  switch (type) {
    case 'demo_fund': return 'Starter credit';
    case 'fund': return 'Top-up';
    case 'withdraw': return 'Withdrawal';
    case 'circle_contribution': return 'Circle contribution';
    case 'circle_payout': return 'Payout received';
    default: return type.replace('_', ' ');
  }
}

function CircleBreakdown({ txns, circles }: { txns: WalletTx[]; circles: CircleSummary[] }) {
  const byName = new Map(circles.map((c) => [c.id, c.name]));
  const per = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== 'circle_contribution' || !t.relatedCircleId) continue;
    per.set(t.relatedCircleId, (per.get(t.relatedCircleId) ?? 0) + Math.abs(Number(t.amount)));
  }
  const rows = [...per.entries()].sort((a, b) => b[1] - a[1]);
  if (!rows.length) return <p className="muted">No circle spending yet. Contributions group here by circle.</p>;
  const max = rows[0][1];
  return (
    <ul className="feed">
      {rows.map(([id, total]) => (
        <li key={id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>{byName.get(id) ?? 'A circle'}</span>
            <strong>₦{total.toLocaleString()}</strong>
          </div>
          <div className="progress thin">
            <div style={{ width: `${Math.round((total / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function WalletPage() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('100000');
  const [msg, setMsg] = useState<string | null>(null);

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get<WalletOverview>('/wallet'),
  });
  const circles = useQuery({
    queryKey: ['circles'],
    queryFn: () => api.get<CircleSummary[]>('/circles'),
  });

  const fund = useMutation({
    mutationFn: (amt: number) =>
      api.post<{ replayed: boolean; balance: number }>('/wallet/fund', { amount: amt, idempotencyKey: crypto.randomUUID() }),
    onSuccess: (r) => {
      setMsg(r.replayed ? 'That top-up already landed.' : 'Wallet funded.');
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const withdraw = useMutation({
    mutationFn: (amt: number) =>
      api.post<{ replayed: boolean; balance: number }>('/wallet/withdraw', { amount: amt, idempotencyKey: crypto.randomUUID() }),
    onSuccess: (r) => {
      setMsg(r.replayed ? 'That withdrawal already went through.' : 'Withdrawn. Demo money goes nowhere real.');
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const d = wallet.data;
  if (wallet.isLoading) return <Loading label="Loading wallet…" />;
  if (wallet.error) return <div className="error">{(wallet.error as Error).message}</div>;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Wallet</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>Fund it first. Contributions debit from here and never overdraw.</p>
        </div>
      </div>

      <div className="cols">
        <div>
          <div className="card hero">
            <div className="muted" style={{ fontSize: 13 }}>Balance</div>
            <div className="hero-big" style={{ color: 'var(--money)' }}>₦{Number(d?.balance ?? 0).toLocaleString()}</div>
            <div className="row" style={{ gap: 24, marginTop: 8 }}>
              <span><strong style={{ color: 'var(--money)' }}>+₦{inOut(d?.data ?? [], 1).toLocaleString()}</strong> <span className="muted">in</span></span>
              <span><strong>−₦{inOut(d?.data ?? [], -1).toLocaleString()}</strong> <span className="muted">out</span></span>
            </div>
          </div>

          <div className="card">
            <h3 className="serif" style={{ fontSize: 22 }}>Move money</h3>
            <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>Top up instantly, or withdraw back out. Both are idempotent.</p>
            <form
              className="inline"
              onSubmit={(e) => {
                e.preventDefault();
                (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-act') === 'out'
                  ? withdraw.mutate(Number(amount))
                  : fund.mutate(Number(amount));
              }}
            >
              <div>
                <label>Amount (₦)</label>
                <input type="number" min={100} value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div style={{ flex: '0 0 auto', display: 'flex', gap: 8 }}>
                <button type="submit" data-act="in" className="money" disabled={fund.isPending}>{fund.isPending ? 'Funding…' : 'Fund'}</button>
                <button type="submit" data-act="out" className="ghost" disabled={withdraw.isPending}>{withdraw.isPending ? 'Sending…' : 'Withdraw'}</button>
              </div>
            </form>
            {msg && <p className="muted" style={{ fontSize: 13 }}>{msg}</p>}
          </div>

          <div className="card">
            <h3>Where your money went</h3>
            <CircleBreakdown txns={d?.data ?? []} circles={circles.data ?? []} />
          </div>

          <div className="card">
            <h3>How funding works</h3>
            <ul className="feed">
              <li><strong>Demo credit only.</strong> <span className="muted">No real bank rail is connected in this build.</span></li>
              <li><strong>Contributions debit here.</strong> <span className="muted">A circle tap moves money wallet → pot, atomically.</span></li>
              <li><strong>Payouts land here.</strong> <span className="muted">Won pots credit automatically, or wait for your tap.</span></li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3>Transactions</h3>
          <ul className="feed">
            {(d?.data ?? []).map((t) => (
              <li key={t.id}>
                {txLabel(t.type)} ·{' '}
                <strong style={Number(t.amount) >= 0 ? { color: 'var(--money)' } : undefined}>
                  {Number(t.amount) < 0 ? '−' : '+'}₦{Math.abs(Number(t.amount)).toLocaleString()}
                </strong>
                <span className="muted"> · {new Date(t.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          {(!d || d.data.length === 0) && <p className="muted">No transactions yet.</p>}
        </div>
      </div>
    </>
  );
}
