import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type CircleSummary, type LedgerEntry } from '../api';
import { useAuth } from '../auth';
import { useTheme } from '../theme';
import { AnimatedMoneyBar, FadeIn } from '../anim';
import { Avatar, Greeting } from '../Avatar';
import { Logo } from '../Logo';
import { daysUntil } from '../format';
import type { Notice } from './Notifications';

const HERO = 'https://images.pexels.com/photos/3931607/pexels-photo-3931607.jpeg?auto=compress&cs=tinysrgb&w=1260';

interface ActivityItem extends LedgerEntry {
  circleName: string;
}

export function HomeScreen({ onOpenCircle, onOpenPeople, onOpenNotifications }: { onOpenCircle: (id: string) => void; onOpenPeople: () => void; onOpenNotifications: () => void }) {
  const { s, palette } = useTheme();
  const { user } = useAuth();
  const { data: circles, error, refetch } = useQuery({
    queryKey: ['circles'],
    queryFn: () => api.get<CircleSummary[]>('/circles'),
  });

  const [imgOk, setImgOk] = useState(true);
  const list = circles ?? [];
  const saved = list.reduce((sum, c) => sum + Number(c.balance), 0);
  const top = [...list].sort((a, b) => b.progress - a.progress)[0];
  const urgent = list
    .filter((c) => c.currentCycle)
    .sort((a, b) => +new Date(a.currentCycle!.endsAt) - +new Date(b.currentCycle!.endsAt))[0];
  const urgentIn = urgent?.currentCycle ? daysUntil(urgent.currentCycle.endsAt) : null;

  const notices = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notice[]>('/notifications'),
  });
  const attention = (notices.data ?? []).filter((n) =>
    ['contribute_due', 'invite_pending', 'payout_countdown', 'collect_soon'].includes(n.kind),
  ).slice(0, 3);

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
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 32 }}>
      {user ? <Greeting name={user.name} /> : null}
      <Text style={[s.muted, { marginTop: 4, marginBottom: 12 }]}>
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </Text>

      {error ? (
        <View style={s.card}>
          <Text style={s.text}>Couldn't load your circles.</Text>
          <Text style={s.muted}>Check your connection and try again.</Text>
          <TouchableOpacity style={s.btn} onPress={() => refetch()}>
            <Text style={s.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FadeIn>
      <TouchableOpacity
        style={[s.hero, { height: 200 }]}
        onPress={() => urgent && onOpenCircle(urgent.id)}
        disabled={!urgent}
        accessibilityRole={urgent ? 'button' : undefined}
        accessibilityLabel={urgent ? `Next payout: ${urgent.currentCycle!.recipient.name}, ${urgent.name}` : undefined}
      >
        <Image source={{ uri: HERO }} style={s.heroImage} onError={() => setImgOk(false)} />
        {imgOk ? null : (
          <View style={[s.heroImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: palette.panel2 }]}>
            <Logo size={56} color={palette.faint} />
          </View>
        )}
        <View style={s.heroCaption}>
          {urgent?.currentCycle ? (
            <>
              <View style={[s.row, { justifyContent: 'flex-start', gap: 8 }]}>
                <Avatar name={urgent.currentCycle.recipient.name} size={30} />
                <Text style={s.heroTitle}>{urgent.currentCycle.recipient.name}</Text>
              </View>
              <Text style={s.heroBody}>
                collects {urgentIn !== null && urgentIn <= 0 ? 'now' : `in ${urgentIn}d`} · {urgent.name} · ₦{saved.toLocaleString()} saved together
              </Text>
            </>
          ) : (
            <>
              <Text style={s.heroTitle}>₦{saved.toLocaleString()}</Text>
              <Text style={s.heroBody}>saved together across {list.length} circle{list.length === 1 ? '' : 's'}</Text>
            </>
          )}
        </View>
      </TouchableOpacity>
      </FadeIn>

      <FadeIn delay={90}>
      <View style={[s.row, { gap: 12, marginBottom: 12 }]}>
        <View style={[s.card, { flex: 1, marginBottom: 0, alignItems: 'center' }]}>
          <Ionicons name="people-outline" size={22} color={palette.text} />
          <Text style={[s.h2, { marginTop: 6, marginBottom: 0 }]}>{list.reduce((n, c) => n + c.activeMemberCount, 0)}</Text>
          <Text style={s.muted}>Members</Text>
        </View>
        <View style={[s.card, { flex: 1, marginBottom: 0, alignItems: 'center' }]}>
          <Ionicons name="trophy-outline" size={22} color={palette.money} />
          <Text style={[s.h2, { marginTop: 6, marginBottom: 0, color: palette.money }]}>{list.filter((c) => c.status === 'goal_reached' || c.status === 'completed').length}</Text>
          <Text style={s.muted}>Goals Hit</Text>
        </View>
      </View>
      </FadeIn>

      {attention.length > 0 && (
        <FadeIn delay={120}>
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.h3}>Needs your attention</Text>
            <TouchableOpacity onPress={onOpenNotifications} hitSlop={8}>
              <Text style={[s.muted, { fontWeight: '700' }]}>View all</Text>
            </TouchableOpacity>
          </View>
          {attention.slice(0, 2).map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[s.row, { paddingVertical: 8, justifyContent: 'flex-start', gap: 10 }]}
              onPress={() => n.circleId && onOpenCircle(n.circleId)}
              disabled={!n.circleId}
              accessibilityRole="button"
              accessibilityLabel={n.title}
            >
              <Ionicons name="ellipse" size={8} color={palette.money} />
              <View style={{ flex: 1 }}>
                <Text style={s.text} numberOfLines={1}>{n.title}</Text>
                <Text style={s.muted} numberOfLines={1}>{n.body}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={palette.faint} />
            </TouchableOpacity>
          ))}
        </View>
        </FadeIn>
      )}

      {top ? (
        <FadeIn delay={180}>
        <TouchableOpacity
          style={s.card}
          onPress={() => onOpenCircle(top.id)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${top.name}, ${Math.round(top.progress * 100)} percent funded`}
        >
          <View style={s.row}>
            <Text style={s.muted}>Closest to goal</Text>
            <Ionicons name="chevron-forward" size={16} color={palette.faint} />
          </View>
          <Text style={[s.h3, { marginTop: 6 }]}>{top.name}</Text>
          <AnimatedMoneyBar progress={top.progress} />
          <Text style={s.muted}>{Math.round(top.progress * 100)}% of {Number(top.goalAmount).toLocaleString()} {top.currency}</Text>
        </TouchableOpacity>
        </FadeIn>
      ) : null}

      {list.filter((c) => c.status === 'completed' || c.status === 'goal_reached').length > 0 && (
        <FadeIn delay={220}>
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.h3}>Hall of fame</Text>
            <Ionicons name="trophy-outline" size={18} color={palette.money} />
          </View>
          {list.filter((c) => c.status === 'completed' || c.status === 'goal_reached').map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[s.row, { paddingVertical: 8 }]}
              onPress={() => onOpenCircle(c.id)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${c.name}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.text}>{c.name}</Text>
                <Text style={s.muted}>Finished at ₦{Number(c.balance).toLocaleString()} · {c.activeMemberCount} members</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={palette.faint} />
            </TouchableOpacity>
          ))}
        </View>
        </FadeIn>
      )}

      <FadeIn delay={260}>
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
            <Text style={[s.text, { color: palette.money, fontWeight: '700' }]}>+{Number(e.amount).toLocaleString()}</Text>
          </View>
        ))}
        {(!activity.data || activity.data.length === 0) && (
          <Text style={s.muted}>Nothing yet. Contributions from your circles land here.</Text>
        )}
      </View>
      </FadeIn>
    </ScrollView>
  );
}
