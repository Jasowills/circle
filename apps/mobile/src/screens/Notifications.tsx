import { useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
const READ_KEY = 'circle.noticesRead';

async function loadRead(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(READ_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isUnread(n: Notice, seenAt: string | null, read: string[]): boolean {
  if (read.includes(n.id)) return false;
  return !seenAt || n.at > seenAt;
}

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  payout_received: 'arrow-down-circle-outline',
  goal_hit: 'trophy-outline',
  member_joined: 'person-add-outline',
  contribute_due: 'time-outline',
  collect_soon: 'gift-outline',
  payout_waiting: 'gift-outline',
  payout_countdown: 'hourglass-outline',
  invite_pending: 'mail-open-outline',
};

export function NotificationsScreen({ onOpenCircle, onReadChange }: { onOpenCircle: (id: string) => void; onReadChange?: () => void }) {
  const { s, palette } = useTheme();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notice[]>('/notifications'),
  });

  const list = data ?? [];
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [read, setRead] = useState<string[]>([]);

  useEffect(() => {
    SecureStore.getItemAsync(SEEN_KEY).then(setSeenAt).catch(() => setSeenAt(null));
    loadRead().then(setRead);
  }, []);

  const markAllRead = () => {
    const now = new Date().toISOString();
    SecureStore.setItemAsync(SEEN_KEY, now).catch(() => {});
    SecureStore.deleteItemAsync(READ_KEY).catch(() => {});
    setSeenAt(now);
    setRead([]);
    qc.invalidateQueries({ queryKey: ['notifications'] });
    onReadChange?.();
  };

  const open = (n: Notice) => {
    if (!read.includes(n.id)) {
      const next = [...read, n.id];
      setRead(next);
      SecureStore.setItemAsync(READ_KEY, JSON.stringify(next)).catch(() => {});
      onReadChange?.();
    }
    if (n.circleId) onOpenCircle(n.circleId);
  };

  return (
    <View style={[s.screen, { flex: 1 }]}>
      <View style={[s.row, { marginBottom: 12 }]}>
        <Text style={[s.h1, { fontSize: 26 }]}>Notifications</Text>
        {list.length > 0 && (
          <TouchableOpacity onPress={markAllRead} hitSlop={8}>
            <Text style={[s.muted, { fontWeight: '700' }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={list}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={<Text style={s.muted}>All quiet. Joins, dues, payouts and countdowns land here.</Text>}
        renderItem={({ item: n, index }) => {
          const unread = isUnread(n, seenAt, read);
          return (
          <FadeIn delay={Math.min(index, 5) * 50}>
          <TouchableOpacity
            style={[s.card, !unread && { opacity: 0.65 }]}
            disabled={!n.circleId}
            onPress={() => open(n)}
          >
            <View style={[s.row, { justifyContent: 'flex-start', gap: 12 }]}>
              <Ionicons
                name={ICONS[n.kind] ?? 'notifications-outline'}
                size={22}
                color={n.kind === 'payout_received' || n.kind === 'goal_hit' ? palette.money : palette.text}
              />
              <View style={{ flex: 1 }}>
                <Text style={[s.text, unread && { fontWeight: '800' }]}>{n.title}</Text>
                <Text style={s.muted}>{n.body}</Text>
                <Text style={[s.faint, { fontSize: 11, marginTop: 2 }]}>
                  {new Date(n.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {unread ? ' · new' : ''}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          </FadeIn>
          );
        }}
      />
    </View>
  );
}
