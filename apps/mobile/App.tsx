import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, TouchableOpacity, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './src/auth';
import { ThemeProvider, useTheme } from './src/theme';
import { Logo } from './src/Logo';
import { LoginScreen } from './src/screens/Login';
import { SetupScreen } from './src/screens/Setup';
import { CirclesScreen } from './src/screens/Circles';
import { CircleDetailScreen } from './src/screens/CircleDetail';

const qc = new QueryClient();

function Root() {
  const { user, ready, setupRequired, signOut } = useAuth();
  const { s, mode, toggle, palette } = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);

  if (!ready) return <View style={s.screen}><Text style={s.muted}>Loading…</Text></View>;
  if (!user) return <LoginScreen />;
  if (setupRequired) return <SetupScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={[s.row, { padding: 16, paddingTop: 56 }]}>
        <TouchableOpacity onPress={() => setOpenId(null)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Logo size={22} />
            <Text style={[s.h1, { fontSize: 20 }]}>Circle</Text>
          </View>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={toggle}>
            <Text style={s.muted}>{mode === 'dark' ? 'Light' : 'Dark'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut}>
            <Text style={s.muted}>{user.name} · Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
      {openId ? (
        <CircleDetailScreen circleId={openId} />
      ) : (
        <CirclesScreen onOpen={setOpenId} />
      )}
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
