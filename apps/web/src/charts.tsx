/** Hand-rolled SVG charts. Monochrome + money accent, no dependencies. */

export interface Point {
  t: number;
  v: number;
}

/** Cumulative area chart with min/max labels. */
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

/** Donut of shares. Largest slice goes emerald, rest fade through mono. */
export function Donut({ slices }: { slices: { label: string; value: number }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (!total) return <p className="muted" style={{ fontSize: 13 }}>No contributions yet.</p>;
  const R = 54;
  const C = 2 * Math.PI * R;
  const ordered = [...slices].sort((a, b) => b.value - a.value);
  let acc = 0;
  return (
    <div className="row" style={{ alignItems: 'center', gap: 20, flexWrap: 'nowrap' }}>
      <svg width={140} height={140} viewBox="0 0 140 140" role="img" aria-label="Contribution mix">
        <circle cx={70} cy={70} r={R} fill="none" strokeWidth={16} className="chart-track" />
        {ordered.map((s, i) => {
          const frac = s.value / total;
          const el = (
            <circle
              key={s.label}
              cx={70}
              cy={70}
              r={R}
              fill="none"
              strokeWidth={16}
              strokeDasharray={`${(frac * C).toFixed(1)} ${C.toFixed(1)}`}
              strokeDashoffset={(-acc * C).toFixed(1)}
              transform="rotate(-90 70 70)"
              className={i === 0 ? 'chart-dot' : 'chart-ink'}
              opacity={i === 0 ? 1 : Math.max(0.25, 0.7 - i * 0.15)}
            />
          );
          acc += frac;
          return el;
        })}
      </svg>
      <ul className="feed" style={{ flex: 1 }}>
        {ordered.slice(0, 5).map((s) => (
          <li key={s.label}>
            {s.label} <span className="muted">· {Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rotation stepper: paid / collecting / upcoming. */
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
