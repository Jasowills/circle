import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, TouchableOpacity, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './src/auth';
import { LoginScreen } from './src/screens/Login';
import { CirclesScreen } from './src/screens/Circles';
import { CircleDetailScreen } from './src/screens/CircleDetail';
import { s } from './src/theme';

const qc = new QueryClient();

function Root() {
  const { user, ready, signOut } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);

  if (!ready) return <View style={s.screen}><Text style={s.muted}>Loading…</Text></View>;
  if (!user) return <LoginScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: '#0f1419' }}>
      <View style={[s.row, { padding: 16, paddingTop: 56 }]}>
        <TouchableOpacity onPress={() => setOpenId(null)}>
          <Text style={[s.h1, { fontSize: 20 }]}>Circle{openId ? ' ‹' : '.'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={signOut}>
          <Text style={s.muted}>{user.name} · Logout</Text>
        </TouchableOpacity>
      </View>
      {openId ? (
        <CircleDetailScreen circleId={openId} />
      ) : (
        <CirclesScreen onOpen={setOpenId} />
      )}
      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </QueryClientProvider>
  );
}
