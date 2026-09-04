import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './src/auth';
import { ThemeProvider, useTheme } from './src/theme';
import { Logo } from './src/Logo';
import { LoginScreen } from './src/screens/Login';
import { SetupScreen } from './src/screens/Setup';
import { HomeScreen } from './src/screens/Home';
import { WalletScreen } from './src/screens/Wallet';
import { CreateScreen } from './src/screens/Create';
import { PeopleScreen } from './src/screens/People';
import { ProfileScreen } from './src/screens/Profile';
import { SettingsScreen } from './src/screens/Settings';
import { CirclesScreen } from './src/screens/Circles';
import { CircleDetailScreen } from './src/screens/CircleDetail';

const qc = new QueryClient();

type Tab = 'home' | 'circles' | 'wallet' | 'people' | 'settings';
type Push = { name: 'detail'; id: string } | { name: 'create' } | { name: 'profile'; id: string };

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'circles', label: 'Circles', icon: 'ellipse-outline' },
  { key: 'wallet', label: 'Wallet', icon: 'wallet-outline' },
  { key: 'people', label: 'People', icon: 'search-outline' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline' },
];

function Root() {
  const { user, ready, setupRequired, signOut } = useAuth();
  const { s, mode, toggle, palette } = useTheme();
  const [tab, setTab] = useState<Tab>('home');
  const [stack, setStack] = useState<Push[]>([]);

  if (!ready) return <View style={s.screen}><Text style={s.muted}>Loading…</Text></View>;
  if (!user) return <LoginScreen />;
  if (setupRequired) return <SetupScreen />;

  const top: Push | null = stack[stack.length - 1] ?? null;
  const goTab = (t: Tab) => {
    setTab(t);
    setStack([]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={[s.row, { padding: 16, paddingTop: 56 }]}>
        <TouchableOpacity
          onPress={() => (top ? setStack(stack.slice(0, -1)) : goTab('home'))}
          accessibilityRole="button"
          accessibilityLabel={top ? 'Go back' : 'Home'}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {top ? <Ionicons name="chevron-back" size={22} color={palette.text} /> : <Logo size={22} />}
            <Text style={[s.h1, { fontSize: 20 }]}>Circle</Text>
          </View>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity onPress={toggle} accessibilityRole="button" accessibilityLabel="Toggle light and dark mode" hitSlop={8}>
            <Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={22} color={palette.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut} accessibilityRole="button" accessibilityLabel={`Log out ${user.name}`} hitSlop={8}>
            <Ionicons name="log-out-outline" size={22} color={palette.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {top?.name === 'detail' ? (
          <CircleDetailScreen circleId={top.id} />
        ) : top?.name === 'create' ? (
          <CreateScreen
            onCreated={(id) => setStack([...stack.slice(0, -1), { name: 'detail', id }])}
            onCancel={() => setStack(stack.slice(0, -1))}
          />
        ) : top?.name === 'profile' ? (
          <ProfileScreen userId={top.id} onOpenCircle={(id) => setStack([...stack, { name: 'detail', id }])} />
        ) : tab === 'home' ? (
          <HomeScreen onOpenCircle={(id) => setStack([...stack, { name: 'detail', id }])} onOpenPeople={() => goTab('people')} />
        ) : tab === 'circles' ? (
          <CirclesScreen onOpen={(id) => setStack([...stack, { name: 'detail', id }])} onCreate={() => setStack([...stack, { name: 'create' }])} />
        ) : tab === 'wallet' ? (
          <WalletScreen />
        ) : tab === 'people' ? (
          <PeopleScreen onOpenProfile={(id) => setStack([...stack, { name: 'profile', id }])} />
        ) : (
          <SettingsScreen />
        )}
      </View>

      {!top ? (
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.panel, paddingBottom: 28, paddingTop: 10 }}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => goTab(t.key)}
                accessibilityRole="button"
                accessibilityLabel={t.label}
                style={{ flex: 1, alignItems: 'center', gap: 3 }}
              >
                <Ionicons name={on ? t.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap : t.icon} size={24} color={on ? palette.text : palette.faint} />
                <Text style={{ fontSize: 11, color: on ? palette.text : palette.faint, fontWeight: on ? '700' : '400' }}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
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
