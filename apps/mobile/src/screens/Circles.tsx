import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, type CircleSummary } from '../api';
import { useTheme } from '../theme';

export function CirclesScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const { s } = useTheme();
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

  return (
    <View style={s.screen}>
      <FlatList
        data={data ?? []}
        keyExtractor={(c) => c.id}
        refreshing={isLoading}
        onRefresh={() => refetch()}
        ListEmptyComponent={<Text style={s.muted}>No circles yet. Create one on web, or ask for an invite.</Text>}
        renderItem={({ item: c }) => {
          const solid = c.status === 'active' || c.status === 'goal_reached';
          return (
            <TouchableOpacity style={s.card} onPress={() => onOpen(c.id)}>
              <View style={s.row}>
                <Text style={s.h3}>{c.name}</Text>
                <Text style={[s.pill, solid && s.pillSolid]}>{c.status.replace('_', ' ')}</Text>
              </View>
              <View style={s.bar}>
                <View style={[s.barFill, { width: `${Math.round(c.progress * 100)}%` }]} />
              </View>
              <Text style={s.muted}>
                {Number(c.balance).toLocaleString()} of {Number(c.goalAmount).toLocaleString()} {c.currency} · {c.activeMemberCount} active
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
