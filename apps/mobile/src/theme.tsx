import { createContext, useContext, useState } from 'react';
import { StyleSheet } from 'react-native';

export type ThemeMode = 'dark' | 'light';

const dark = {
  bg: '#0a0a0a',
  panel: '#141414',
  panel2: '#1e1e1e',
  text: '#fafafa',
  muted: 'rgba(250,250,250,0.6)',
  faint: 'rgba(250,250,250,0.38)',
  border: 'rgba(250,250,250,0.14)',
  accent: '#fafafa',
  accentInk: '#0a0a0a',
  money: '#34d399',
  placeholder: '#8a8a8a',
};

const light = {
  bg: '#faf9f6',
  panel: '#ffffff',
  panel2: '#efede7',
  text: '#0a0a0a',
  muted: 'rgba(10,10,10,0.62)',
  faint: 'rgba(10,10,10,0.4)',
  border: 'rgba(10,10,10,0.14)',
  accent: '#0a0a0a',
  accentInk: '#fafafa',
  money: '#0e9f6e',
  placeholder: '#8a8a8a',
};

export type Palette = typeof dark;

function makeStyles(t: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg, padding: 16 },
    card: { backgroundColor: t.panel, borderColor: t.border, borderWidth: 1, borderRadius: 4, padding: 16, marginBottom: 12 },
    h1: { color: t.text, fontSize: 28, fontWeight: '800' },
    h2: { color: t.text, fontSize: 20, fontWeight: '700', marginBottom: 4 },
    h3: { color: t.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
    text: { color: t.text, fontSize: 14 },
    muted: { color: t.muted, fontSize: 13 },
    faint: { color: t.faint, fontSize: 12 },
    input: { backgroundColor: t.panel2, borderColor: t.border, borderWidth: 1, color: t.text, borderRadius: 4, padding: 12, fontSize: 15, marginTop: 4 },
    label: { color: t.muted, fontSize: 12, marginTop: 10 },
    btn: { backgroundColor: t.accent, borderRadius: 4, padding: 13, alignItems: 'center', marginTop: 12 },
    btnText: { color: t.accentInk, fontWeight: '700', fontSize: 15 },
    btnGhost: { backgroundColor: 'transparent', borderColor: t.border, borderWidth: 1, borderRadius: 4, padding: 10, alignItems: 'center', marginTop: 12 },
    btnGhostText: { color: t.text, fontWeight: '600' },
    error: { backgroundColor: t.panel2, borderColor: t.text, borderWidth: 1, borderLeftWidth: 4, padding: 10, borderRadius: 4, marginTop: 10 },
    errorText: { color: t.text, fontSize: 14 },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: t.border, color: t.muted, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
    pillSolid: { backgroundColor: t.accent, borderColor: t.accent, color: t.accentInk },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    bar: { height: 12, backgroundColor: t.panel2, borderRadius: 999, overflow: 'hidden', marginVertical: 8 },
    barFill: { height: '100%', backgroundColor: t.accent },
    hero: { height: 400, borderRadius: 4, overflow: 'hidden', marginBottom: 12, backgroundColor: t.panel2 },
    heroImage: { width: '100%', height: '100%' },
    heroTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
    heroBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heroBrandText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
    heroCount: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600' },
    heroCaption: { position: 'absolute', left: 12, right: 12, bottom: 12, padding: 14, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4 },
    heroTitle: { color: '#ffffff', fontSize: 26, fontWeight: '800' },
    heroBody: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 12 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.border },
    dotOn: { backgroundColor: t.accent },
  });
}

export type Styles = ReturnType<typeof makeStyles>;

const Ctx = createContext<{ mode: ThemeMode; toggle: () => void; s: Styles; palette: Palette }>({
  mode: 'dark',
  toggle: () => {},
  s: makeStyles(dark),
  palette: dark,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const palette = mode === 'dark' ? dark : light;
  return (
    <Ctx.Provider value={{ mode, toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')), s: makeStyles(palette), palette }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
