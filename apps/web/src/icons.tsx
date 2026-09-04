/** Monochrome stroke icons. currentColor throughout; no fills, no hues. */
function base(props: { size?: number; children: React.ReactNode }) {
  const s = props.size ?? 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {props.children}
    </svg>
  );
}

export const I = {
  home: (p: { size?: number }) => base({ ...p, children: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /></> }),
  grid: (p: { size?: number }) => base({ ...p, children: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></> }),
  wallet: (p: { size?: number }) => base({ ...p, children: <><rect x="3" y="6.5" width="18" height="13" rx="2" /><path d="M3 10.5h18" /><circle cx="17" cy="15" r="1.2" fill="currentColor" /></> }),
  users: (p: { size?: number }) => base({ ...p, children: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" /><circle cx="16.5" cy="9.5" r="2.4" /><path d="M16 14.6c2.3.2 3.9 1.6 4.4 4" /></> }),
  trophy: (p: { size?: number }) => base({ ...p, children: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4z" /><path d="M8 5H4.5a3.5 3.5 0 0 0 3.6 3.9M16 5h3.5a3.5 3.5 0 0 1-3.6 3.9" /><path d="M12 13v3" /><path d="M8.5 20h7M9.5 16.5h5L15.5 20H8.5z" /></> }),
  plus: (p: { size?: number }) => base({ ...p, children: <><path d="M12 5v14M5 12h14" /></> }),
  search: (p: { size?: number }) => base({ ...p, children: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></> }),
  chart: (p: { size?: number }) => base({ ...p, children: <><path d="M4 4v15.5h16" /><path d="M7.5 14.5v-4M12 14.5V8M16.5 14.5v-6.5" /></> }),
  bell: (p: { size?: number }) => base({ ...p, children: <><path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10" /><path d="M10 19.5a2.2 2.2 0 0 0 4 0" /></> }),
  logout: (p: { size?: number }) => base({ ...p, children: <><path d="M14 4H6v16h8" /><path d="m10 12 7-3.5M17 8.5V4.8M17 8.5l3.5-.4" /><path d="M10 12h11" /></> }),
  sun: (p: { size?: number }) => base({ ...p, children: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" /></> }),
  moon: (p: { size?: number }) => base({ ...p, children: <><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></> }),
  gear: (p: { size?: number }) => base({ ...p, children: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3H9.8l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4.4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></> }),
  chevron: (p: { size?: number }) => base({ ...p, children: <><path d="m9 5 7 7-7 7" /></> }),
  arrowUp: (p: { size?: number }) => base({ ...p, children: <><path d="M12 19V5M6 11l6-6 6 6" /></> }),
  arrowDown: (p: { size?: number }) => base({ ...p, children: <><path d="M12 5v14M6 13l6 6 6-6" /></> }),
  gift: (p: { size?: number }) => base({ ...p, children: <><rect x="4" y="9" width="16" height="11" rx="1.5" /><path d="M12 9v11M4 12.5h16" /><path d="M12 9S8 9 6.8 7.6A1.9 1.9 0 0 1 9.7 5C11 5 12 9 12 9zm0 0s4 0 5.2-1.4a1.9 1.9 0 0 0-2.9-2.6C13 5 12 9 12 9z" /></> }),
};
