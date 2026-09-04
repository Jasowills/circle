export function statusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function countdownText(iso: string): string | null {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (d > 3) return null;
  if (d <= 0) return 'Payout due';
  return `Next payout in ${d}d`;
}

export function money(n: number, code = '₦'): string {
  return `${code}${Math.round(n).toLocaleString()}`;
}

export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
