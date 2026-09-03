import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, type CircleSummary } from '../api';
import { s } from '../theme';

export function CirclesScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['circles'],
    queryFn: () => api.get<CircleSummary[]>('/circles'),
  });

  if (isLoading) return <View style={s.screen}><Text style={s.muted}>Loading circles…</Text></View>;
  if (error) return <View style={s.screen}><Text style={s.error}>{(error as Error).message}</Text></View>;

  return (
    <View style={s.screen}>
      <FlatList
        data={data ?? []}
        keyExtractor={(c) => c.id}
        refreshing={isLoading}
        onRefresh={() => refetch()}
        ListEmptyComponent={<Text style={s.muted}>No circles yet. Create one on web, or ask for an invite.</Text>}
        renderItem={({ item: c }) => (
          <TouchableOpacity style={s.card} onPress={() => onOpen(c.id)}>
            <View style={s.row}>
              <Text style={s.h3}>{c.name}</Text>
              <Text style={s.pill}>{c.status.replace('_', ' ')}</Text>
            </View>
            <View style={s.bar}>
              <View style={[s.barFill, { width: `${Math.round(c.progress * 100)}%` }]} />
            </View>
            <Text style={s.muted}>
              {Number(c.balance).toLocaleString()} of {Number(c.goalAmount).toLocaleString()} {c.currency} · {c.activeMemberCount} active
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
