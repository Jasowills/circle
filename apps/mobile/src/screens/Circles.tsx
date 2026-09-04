import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api, type CircleSummary } from '../api';
import { useAuth } from '../auth';
import { useTheme } from '../theme';
import { Logo } from '../Logo';

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const first = name.split(' ')[0] || name;
  return `Good ${part}, ${first}`;
}

export function CirclesScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const { s, palette } = useTheme();
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['circles'],
    queryFn: () => api.get<CircleSummary[]>('/circles'),
  });

  if (isLoading) return <View style={s.screen}><Text style={s.muted}>Loading circles…</Text></View>;
  if (error) {
    return (
      <View style={s.screen}>
        <View style={s.error}>
          <Text style={s.errorText}>{(error as Error).message}</Text>
        </View>
      </View>
    );
  }

  const circles = data ?? [];
  const total = circles.reduce((sum, c) => sum + Number(c.balance), 0);

  return (
    <View style={s.screen}>
      <FlatList
        data={circles}
        keyExtractor={(c) => c.id}
        refreshing={isLoading}
        onRefresh={() => refetch()}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={[s.h1, { fontSize: 26 }]}>{user ? greeting(user.name) : 'Your circles'}</Text>
            <Text style={[s.muted, { marginTop: 4 }]}>
              {circles.length === 0
                ? 'Nothing here yet. Your savings live here once you join a circle.'
                : `${circles.length} circle${circles.length === 1 ? '' : 's'} · ${total.toLocaleString()} saved together`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={[s.card, { alignItems: 'center', paddingVertical: 32 }]}>
            <Logo size={64} color={palette.faint} />
            <Text style={[s.h3, { marginTop: 16 }]}>No circles yet</Text>
            <Text style={[s.muted, { textAlign: 'center', marginTop: 4 }]}>
              Circles are created on web. Start one there, or ask a member to invite you by email.
            </Text>
            <View style={[s.row, { justifyContent: 'center', gap: 8, marginTop: 12 }]}>
              <Ionicons name="mail-outline" size={16} color={palette.muted} />
              <Text style={s.muted}>Invites arrive by email</Text>
            </View>
          </View>
        }
        renderItem={({ item: c }) => {
          const solid = c.status === 'active' || c.status === 'goal_reached';
          return (
            <TouchableOpacity style={s.card} onPress={() => onOpen(c.id)} accessibilityRole="button">
              <View style={s.row}>
                <Text style={s.h3}>{c.name}</Text>
                <Text style={[s.pill, solid && s.pillSolid]}>{c.status.replace('_', ' ')}</Text>
              </View>
              <View style={s.bar}>
                <View style={[s.barFill, { width: `${Math.round(c.progress * 100)}%` }]} />
              </View>
              <View style={s.row}>
                <Text style={s.muted}>
                  {Number(c.balance).toLocaleString()} of {Number(c.goalAmount).toLocaleString()} {c.currency}
                </Text>
                <View style={[s.row, { gap: 4 }]}>
                  <Ionicons name="people-outline" size={14} color={palette.muted} />
                  <Text style={s.muted}>{c.activeMemberCount}</Text>
                  <Ionicons name="chevron-forward" size={16} color={palette.faint} />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
