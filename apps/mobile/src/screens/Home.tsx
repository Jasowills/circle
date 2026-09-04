import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api, type CircleSummary, type LedgerEntry } from '../api';
import { useAuth } from '../auth';
import { useTheme } from '../theme';
import { Greeting } from '../Avatar';

const HERO = 'https://images.pexels.com/photos/3830752/pexels-photo-3830752.jpeg?auto=compress&cs=tinysrgb&w=1260';

interface ActivityItem extends LedgerEntry {
  circleName: string;
}

export function HomeScreen({ onOpenCircle, onOpenPeople }: { onOpenCircle: (id: string) => void; onOpenPeople: () => void }) {
  const { s, palette } = useTheme();
  const { user } = useAuth();
  const { data: circles } = useQuery({
    queryKey: ['circles'],
    queryFn: () => api.get<CircleSummary[]>('/circles'),
  });

  const list = circles ?? [];
  const saved = list.reduce((sum, c) => sum + Number(c.balance), 0);
  const top = [...list].sort((a, b) => b.progress - a.progress)[0];

  const activity = useQuery({
    queryKey: ['home-activity', list.map((c) => c.id).join(',')],
    queryFn: async (): Promise<ActivityItem[]> => {
      const pages = await Promise.all(
        list.slice(0, 4).map(async (c) => {
          const page = await api.get<{ data: LedgerEntry[] }>(`/circles/${c.id}/ledger?limit=3`);
          return page.data.map((e) => ({ ...e, circleName: c.name }));
        }),
      );
      return pages.flat().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6);
    },
    enabled: list.length > 0,
  });

  return (
    <ScrollView style={s.screen}>
      {user ? <Greeting name={user.name} /> : null}
      <Text style={[s.muted, { marginTop: 4, marginBottom: 12 }]}>
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </Text>

      <View style={[s.hero, { height: 200 }]}>
        <Image source={{ uri: HERO }} style={s.heroImage} />
        <View style={s.heroCaption}>
          <Text style={s.heroTitle}>₦{saved.toLocaleString()}</Text>
          <Text style={s.heroBody}>saved together across {list.length} circle{list.length === 1 ? '' : 's'}</Text>
        </View>
      </View>

      <View style={[s.row, { gap: 12, marginBottom: 12 }]}>
        <View style={[s.card, { flex: 1, marginBottom: 0, alignItems: 'center' }]}>
          <Ionicons name="people-outline" size={22} color={palette.text} />
          <Text style={[s.h2, { marginTop: 6, marginBottom: 0 }]}>{list.reduce((n, c) => n + c.activeMemberCount, 0)}</Text>
          <Text style={s.muted}>members</Text>
        </View>
        <View style={[s.card, { flex: 1, marginBottom: 0, alignItems: 'center' }]}>
          <Ionicons name="trophy-outline" size={22} color={palette.text} />
          <Text style={[s.h2, { marginTop: 6, marginBottom: 0 }]}>{list.filter((c) => c.status === 'goal_reached').length}</Text>
          <Text style={s.muted}>goals hit</Text>
        </View>
      </View>

      {top ? (
        <TouchableOpacity style={s.card} onPress={() => onOpenCircle(top.id)}>
          <View style={s.row}>
            <Text style={s.muted}>Closest to goal</Text>
            <Ionicons name="chevron-forward" size={16} color={palette.faint} />
          </View>
          <Text style={[s.h3, { marginTop: 6 }]}>{top.name}</Text>
          <View style={s.bar}>
            <View style={[s.barFill, { width: `${Math.round(top.progress * 100)}%` }]} />
          </View>
          <Text style={s.muted}>{Math.round(top.progress * 100)}% of {Number(top.goalAmount).toLocaleString()} {top.currency}</Text>
        </TouchableOpacity>
      ) : null}

      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.h3}>Latest activity</Text>
          <TouchableOpacity onPress={onOpenPeople}>
            <Text style={s.muted}>Find people →</Text>
          </TouchableOpacity>
        </View>
        {(activity.data ?? []).map((e) => (
          <View key={e.id} style={[s.row, { paddingVertical: 6 }]}>
            <Text style={s.text}>{e.user.name} <Text style={s.muted}>· {e.circleName}</Text></Text>
            <Text style={s.text}>+{Number(e.amount).toLocaleString()}</Text>
          </View>
        ))}
        {(!activity.data || activity.data.length === 0) && (
          <Text style={s.muted}>Nothing yet. Contributions from your circles land here.</Text>
        )}
      </View>
    </ScrollView>
  );
}
