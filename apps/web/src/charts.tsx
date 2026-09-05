

export interface Point {
  t: number;
  v: number;
}

export function AreaChart({ data, height = 220 }: { data: Point[]; height?: number }) {
  const W = 640;
  const H = height;
  const PAD = 8;
  if (data.length < 2) {
    return <p className="muted" style={{ fontSize: 13 }}>Not enough history yet. Contribute and watch this fill.</p>;
  }
  const vs = data.map((d) => d.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const X = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const Y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2 - 18);
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(d.v).toFixed(1)}`).join(' ');
  const area = `${line} L${X(data.length - 1).toFixed(1)},${H} L${X(0).toFixed(1)},${H} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Savings growth chart">
        <path d={area} fill="currentColor" opacity={0.08} className="chart-ink" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" className="chart-ink" />
        <circle cx={X(data.length - 1)} cy={Y(data[data.length - 1].v)} r={4.5} className="chart-dot" />
      </svg>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
        <span className="muted" style={{ fontSize: 12 }}>₦{Math.round(min).toLocaleString()}</span>
        <span className="muted" style={{ fontSize: 12 }}>₦{Math.round(max).toLocaleString()} now</span>
      </div>
    </div>
  );
}

const PIE_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#fb7185', '#a78bfa', '#e7e5e4'];

export function Donut({ slices }: { slices: { label: string; value: number }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (!total) return <p className="muted" style={{ fontSize: 13 }}>No contributions yet.</p>;
  const R = 62;
  const CX = 70;
  const CY = 70;
  const ordered = [...slices].sort((a, b) => b.value - a.value);
  let angle = -Math.PI / 2;
  const wedges = ordered.map((s, i) => {
    const frac = s.value / total;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const large = frac > 0.5 ? 1 : 0;
    const x0 = CX + R * Math.cos(a0);
    const y0 = CY + R * Math.sin(a0);
    const x1 = CX + R * Math.cos(a1);
    const y1 = CY + R * Math.sin(a1);
    return {
      label: s.label,
      frac,
      color: PIE_COLORS[i % PIE_COLORS.length],
      d: `M ${CX} ${CY} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`,
    };
  });
  return (
    <div className="row" style={{ alignItems: 'center', gap: 20, flexWrap: 'nowrap' }}>
      <svg width={150} height={150} viewBox="0 0 140 140" role="img" aria-label="Contribution pie chart">
        {wedges.map((w) => (
          <path key={w.label} d={w.d} fill={w.color} stroke="var(--bg)" strokeWidth={2} />
        ))}
      </svg>
      <ul className="feed" style={{ flex: 1 }}>
        {ordered.slice(0, 6).map((s, i) => (
          <li key={s.label}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], marginRight: 8 }} />
            {s.label} <span className="muted">· {Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CycleTimeline({ cycles }: { cycles: { cycleNumber: number; recipientName: string; status: string }[] }) {
  if (!cycles.length) return null;
  return (
    <div className="timeline">
      {cycles.map((c, i) => (
        <div key={c.cycleNumber} className={`tstep ${c.status === 'payout_completed' ? 'done' : c.status === 'collecting' ? 'now' : ''}`}>
          <span className="tdot" />
          {i < cycles.length - 1 && <span className="tline" />}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Cycle {c.cycleNumber}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {c.status === 'payout_completed' ? `Paid · ${c.recipientName}` : c.status === 'collecting' ? `Collecting · ${c.recipientName}` : c.recipientName}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
