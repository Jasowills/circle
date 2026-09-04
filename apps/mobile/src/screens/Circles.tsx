import { useState } from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CircleSummary } from '../api';
import { useTheme } from '../theme';
import { Logo } from '../Logo';

export function CirclesScreen({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) {
  const { s, palette } = useTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [q, setQ] = useState('');

  const mine = useQuery({
    queryKey: ['circles'],
    queryFn: () => api.get<CircleSummary[]>('/circles'),
  });
  const found = useQuery({
    queryKey: ['discover', q],
    queryFn: () => api.get<CircleSummary[]>(`/circles/discover?q=${encodeURIComponent(q)}`),
    enabled: tab === 'discover',
  });

  const join = useMutation({
    mutationFn: (id: string) => api.post(`/circles/${id}/join`),
    onSuccess: (c: unknown) => {
      qc.invalidateQueries({ queryKey: ['circles'] });
      qc.invalidateQueries({ queryKey: ['discover'] });
      const id = (c as { id: string }).id;
      if (id) onOpen(id);
    },
  });

  const data = tab === 'mine' ? (mine.data ?? []) : (found.data ?? []);

  return (
    <View style={[s.screen, { flex: 1 }]}>
      <View style={[s.row, { gap: 12, marginBottom: 12 }]}>
        <TouchableOpacity style={[tab === 'mine' ? s.btn : s.btnGhost, { flex: 1, marginTop: 0, padding: 13 }]} onPress={() => setTab('mine')}>
          <Text style={tab === 'mine' ? s.btnText : s.btnGhostText}>My circles</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[tab === 'discover' ? s.btn : s.btnGhost, { flex: 1, marginTop: 0, padding: 13 }]} onPress={() => setTab('discover')}>
          <Text style={tab === 'discover' ? s.btnText : s.btnGhostText}>Discover</Text>
        </TouchableOpacity>
      </View>

      {tab === 'discover' && (
        <View style={[s.row, { gap: 8, backgroundColor: palette.panel2, borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: palette.border, marginBottom: 12 }]}>
          <Ionicons name="search-outline" size={18} color={palette.muted} />
          <TextInput
            style={{ flex: 1, color: palette.text, paddingVertical: 12, fontSize: 15 }}
            value={q}
            onChangeText={setQ}
            placeholder="Search open circles"
            placeholderTextColor={palette.placeholder}
          />
        </View>
      )}

      <FlatList
        data={data}
        keyExtractor={(c) => c.id}
        refreshing={mine.isLoading}
        onRefresh={() => { mine.refetch(); found.refetch(); }}
        ListEmptyComponent={
          tab === 'mine' ? (
            <View style={[s.card, { alignItems: 'center', paddingVertical: 32 }]}>
              <Logo size={64} color={palette.faint} />
              <Text style={[s.h3, { marginTop: 16 }]}>No circles yet</Text>
              <Text style={[s.muted, { textAlign: 'center', marginTop: 4 }]}>
                Start your first savings goal, or find one to join.
              </Text>
              <TouchableOpacity style={[s.btn, { paddingHorizontal: 24 }]} onPress={onCreate}>
                <Text style={s.btnText}>Start a circle</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[s.muted, { marginTop: 8 }]}>No open circles{q ? ` matching "${q}"` : ''} right now.</Text>
          )
        }
        renderItem={({ item: c }) => {
          const solid = c.status === 'active' || c.status === 'goal_reached';
          return (
            <TouchableOpacity style={s.card} onPress={() => (tab === 'mine' ? onOpen(c.id) : undefined)}>
              <View style={s.row}>
                <Text style={s.h3}>{c.name}</Text>
                <Text style={[s.pill, solid && s.pillSolid]}>{c.status.replace('_', ' ')}</Text>
              </View>
              <View style={s.bar}>
                <View style={[s.barFill, { width: `${Math.round(c.progress * 100)}%` }]} />
              </View>
              <View style={s.row}>
                <Text style={s.muted}>
                  {Number(c.balance).toLocaleString()} of {Number(c.goalAmount).toLocaleString()} {c.currency} · {c.activeMemberCount} active
                </Text>
                {tab === 'mine' ? (
                  <Ionicons name="chevron-forward" size={16} color={palette.faint} />
                ) : (
                  <TouchableOpacity
                    style={[s.btnGhost, { marginTop: 0, paddingVertical: 8, paddingHorizontal: 14 }]}
                    onPress={() => join.mutate(c.id)}
                    disabled={join.isPending}
                  >
                    <Text style={s.btnGhostText}>Join</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
      {tab === 'mine' && data.length > 0 && (
        <TouchableOpacity
          onPress={onCreate}
          accessibilityRole="button"
          accessibilityLabel="Start a new circle"
          style={{
            position: 'absolute', right: 20, bottom: 24, width: 56, height: 56,
            borderRadius: 28, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="add" size={28} color={palette.accentInk} />
        </TouchableOpacity>
      )}
    </View>
  );
}
