/** User-facing formatting. Statuses read as titles, never raw enum slugs. */
export function statusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Whole days until a date. Negative means overdue. */
export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function countdownText(iso: string): string | null {
  const d = daysUntil(iso);
  if (d > 3) return null;
  if (d <= 0) return 'Payout due';
  return `Next payout in ${d}d`;
}
