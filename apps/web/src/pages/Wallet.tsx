import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type WalletOverview } from '../api';

function txLabel(type: string): string {
  switch (type) {
    case 'demo_fund': return 'Starter credit';
    case 'fund': return 'Top-up';
    case 'circle_contribution': return 'Circle contribution';
    case 'circle_payout': return 'Payout received';
    default: return type.replace('_', ' ');
  }
}

export function WalletPage() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('100000');
  const [msg, setMsg] = useState<string | null>(null);

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get<WalletOverview>('/wallet'),
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

  const d = wallet.data;
  if (wallet.isLoading) return <p className="muted">Loading wallet…</p>;
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
          </div>

          <div className="card">
            <h3 className="serif" style={{ fontSize: 22 }}>Top up (demo)</h3>
            <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>Instant test credit. Real payments plug in here later.</p>
            <form
              className="inline"
              onSubmit={(e) => {
                e.preventDefault();
                fund.mutate(Number(amount));
              }}
            >
              <div>
                <label>Amount (₦)</label>
                <input type="number" min={100} value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div style={{ flex: '0 0 auto' }}>
                <button type="submit" className="money" disabled={fund.isPending}>{fund.isPending ? 'Funding…' : 'Fund wallet'}</button>
              </div>
            </form>
            {msg && <p className="muted" style={{ fontSize: 13 }}>{msg}</p>}
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
