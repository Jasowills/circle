
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="12.5" cy="16" r="8.5" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="19.5" cy="16" r="8.5" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}
