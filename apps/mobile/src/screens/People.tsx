import { useEffect, useState } from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useQuery } from '@tanstack/react-query';
import { api, type Person } from '../api';
import { useTheme } from '../theme';
import { Avatar } from '../Avatar';

const RECENT_KEY = 'circle.recentSearches';

async function loadRecents(): Promise<Person[]> {
  try {
    const raw = await SecureStore.getItemAsync(RECENT_KEY);
    return raw ? (JSON.parse(raw) as Person[]) : [];
  } catch {
    return [];
  }
}

export function PeopleScreen({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { s, palette } = useTheme();
  const [q, setQ] = useState('');
  const [recents, setRecents] = useState<Person[]>([]);

  useEffect(() => {
    loadRecents().then(setRecents);
  }, []);

  const open = (p: Person) => {
    setRecents((prev) => {
      const next = [p, ...prev.filter((r) => r.id !== p.id)].slice(0, 5);
      SecureStore.setItemAsync(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    onOpenProfile(p.id);
  };

  const { data, isFetching } = useQuery({
    queryKey: ['people', q],
    queryFn: () => api.get<Person[]>(`/users/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });

  return (
    <View style={s.screen}>
      <Text style={[s.h1, { fontSize: 26, marginBottom: 4 }]}>People</Text>
      <Text style={[s.muted, { marginBottom: 12 }]}>Anyone on Circle. Open a profile to invite them.</Text>
      <View style={[s.row, { gap: 8, backgroundColor: palette.panel2, borderRadius: 4, paddingHorizontal: 12, borderWidth: 1, borderColor: palette.border }]}>
        <Ionicons name="search-outline" size={18} color={palette.muted} />
        <TextInput
          style={[{ flex: 1, color: palette.text, paddingVertical: 12, fontSize: 15 }]}
          value={q}
          onChangeText={setQ}
          placeholder="Search name or email (min 2 letters)"
          placeholderTextColor={palette.placeholder}
          autoCapitalize="none"
        />
        {q.length > 0 ? (
          <TouchableOpacity onPress={() => setQ('')} hitSlop={8}>
            <Ionicons name="close-circle-outline" size={18} color={palette.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={q.trim().length >= 2 ? (data ?? []) : []}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        style={{ marginTop: 12 }}
        ListEmptyComponent={
          q.trim().length >= 2 && !isFetching ? (
            <Text style={[s.muted, { marginTop: 16 }]}>Nobody matches "{q}". Try another spelling.</Text>
          ) : q.trim().length < 2 ? (
            <View>
              <Text style={[s.muted, { marginTop: 16 }]}>Type at least 2 letters to search the platform.</Text>
              {recents.length > 0 && (
                <>
                  <Text style={[s.h3, { marginTop: 16 }]}>Recent</Text>
                  {recents.map((p) => (
                    <TouchableOpacity key={p.id} style={[s.card, { marginBottom: 8 }]} onPress={() => open(p)}>
                      <View style={[s.row, { justifyContent: 'flex-start', gap: 12 }]}>
                        <Ionicons name="time-outline" size={16} color={palette.faint} />
                        <Avatar name={p.name} avatarUrl={p.avatarUrl} size={30} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.text}>{p.name}</Text>
                          <Text style={s.muted}>{p.email}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
          ) : null
        }
        renderItem={({ item: p }) => (
          <TouchableOpacity style={[s.card, { marginBottom: 8 }]} onPress={() => open(p)}>
            <View style={[s.row, { justifyContent: 'flex-start', gap: 12 }]}>
              <Avatar name={p.name} avatarUrl={p.avatarUrl} />
              <View style={{ flex: 1 }}>
                <Text style={s.text}>{p.name}</Text>
                <Text style={s.muted}>{p.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.faint} />
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
