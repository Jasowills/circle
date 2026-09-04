import { useEffect } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useTheme } from '../theme';
import { FadeIn } from '../anim';

export interface Notice {
  id: string;
  kind: string;
  title: string;
  body: string;
  circleId: string | null;
  at: string;
}

export const SEEN_KEY = 'circle.noticesSeenAt';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  payout_received: 'arrow-down-circle-outline',
  goal_hit: 'trophy-outline',
  member_joined: 'person-add-outline',
  contribute_due: 'time-outline',
  collect_soon: 'gift-outline',
  payout_countdown: 'hourglass-outline',
  invite_pending: 'mail-open-outline',
};

export function NotificationsScreen({ onOpenCircle }: { onOpenCircle: (id: string) => void }) {
  const { s, palette } = useTheme();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notice[]>('/notifications'),
  });

  useEffect(() => {
    SecureStore.setItemAsync(SEEN_KEY, new Date().toISOString()).catch(() => {});
  }, []);

  const list = data ?? [];

  return (
    <View style={[s.screen, { flex: 1 }]}>
      <Text style={[s.h1, { fontSize: 26, marginBottom: 12 }]}>Notifications</Text>
      <FlatList
        data={list}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={<Text style={s.muted}>All quiet. Joins, dues, payouts and countdowns land here.</Text>}
        renderItem={({ item: n, index }) => (
          <FadeIn delay={Math.min(index, 5) * 50}>
          <TouchableOpacity
            style={s.card}
            disabled={!n.circleId}
            onPress={() => n.circleId && onOpenCircle(n.circleId)}
          >
            <View style={[s.row, { justifyContent: 'flex-start', gap: 12 }]}>
              <Ionicons
                name={ICONS[n.kind] ?? 'notifications-outline'}
                size={22}
                color={n.kind === 'payout_received' || n.kind === 'goal_hit' ? palette.money : palette.text}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.text}>{n.title}</Text>
                <Text style={s.muted}>{n.body}</Text>
                <Text style={[s.faint, { fontSize: 11, marginTop: 2 }]}>
                  {new Date(n.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          </FadeIn>
        )}
      />
    </View>
  );
}
