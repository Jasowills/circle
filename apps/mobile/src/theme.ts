import { StyleSheet } from 'react-native';

export const theme = {
  bg: '#0f1419',
  panel: '#1a2230',
  text: '#eef2f7',
  muted: '#9aa7bd',
  accent: '#4cc38a',
  danger: '#e56b6f',
  border: '#2c3a52',
};

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  card: { backgroundColor: theme.panel, borderColor: theme.border, borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  h1: { color: theme.text, fontSize: 28, fontWeight: '800' },
  h2: { color: theme.text, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  h3: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  text: { color: theme.text, fontSize: 14 },
  muted: { color: theme.muted, fontSize: 13 },
  input: { backgroundColor: '#222d40', borderColor: theme.border, borderWidth: 1, color: theme.text, borderRadius: 8, padding: 10, fontSize: 15, marginTop: 4 },
  label: { color: theme.muted, fontSize: 12, marginTop: 10 },
  btn: { backgroundColor: theme.accent, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#06281a', fontWeight: '700', fontSize: 15 },
  btnGhost: { backgroundColor: 'transparent', borderColor: theme.border, borderWidth: 1, borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 12 },
  btnGhostText: { color: theme.text, fontWeight: '600' },
  error: { backgroundColor: '#402727', borderColor: theme.danger, borderWidth: 1, color: '#ffb3b5', padding: 10, borderRadius: 8, marginTop: 10 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: theme.border, color: theme.muted, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bar: { height: 10, backgroundColor: '#222d40', borderRadius: 999, overflow: 'hidden', marginVertical: 8 },
  barFill: { height: '100%', backgroundColor: theme.accent },
});
