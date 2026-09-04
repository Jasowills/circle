import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type PersonProfile } from '../api';
import { useTheme } from '../theme';
import { statusLabel } from '../format';
import { Avatar } from '../Avatar';

export function ProfileScreen({ userId, onOpenCircle }: { userId: string; onOpenCircle: (id: string) => void }) {
  const { s, palette } = useTheme();
  const qc = useQueryClient();
  const [invited, setInvited] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => api.get<PersonProfile>(`/users/${userId}`),
  });

  const invite = useMutation({
    mutationFn: (circleId: string) => api.post(`/circles/${circleId}/invite`, { email: data?.user.email }),
    onSuccess: (_d, circleId) => {
      setInvited(circleId);
      setMsg('Invite sent.');
      qc.invalidateQueries({ queryKey: ['profile', userId] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  if (isLoading || !data) {
    return <View style={s.screen}><Text style={s.muted}>Loading profile…</Text></View>;
  }
  const { user, isSelf, sharedCircles, inviteTargets } = data;

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={[s.card, { alignItems: 'center', paddingVertical: 24 }]}>
        <Avatar name={user.name} avatarUrl={user.avatarUrl} size={72} />
        <Text style={[s.h2, { marginTop: 12, marginBottom: 0 }]}>{user.name}</Text>
        <Text style={[s.muted, { marginTop: 4 }]}>{user.email}</Text>
        {isSelf ? <Text style={[s.pill, { marginTop: 10 }]}>This is you</Text> : null}
      </View>

      {msg ? (
        <View style={s.card}>
          <Text style={s.text}>{msg}</Text>
        </View>
      ) : null}

      <View style={s.card}>
        <Text style={s.h3}>Circles together ({sharedCircles.length})</Text>
        {sharedCircles.length === 0 && <Text style={s.muted}>None yet. Invite {isSelf ? 'yourself' : user.name.split(' ')[0]} to one of yours below.</Text>}
        {sharedCircles.map((c) => (
          <TouchableOpacity key={c.id} style={[s.row, { paddingVertical: 8 }]} onPress={() => onOpenCircle(c.id)}>
            <Text style={s.text}>{c.name} <Text style={s.muted}>· {statusLabel(c.status)}</Text></Text>
            <Ionicons name="chevron-forward" size={16} color={palette.faint} />
          </TouchableOpacity>
        ))}
      </View>

      {!isSelf && (
        <View style={s.card}>
          <Text style={s.h3}>Invite to your circles</Text>
          {inviteTargets.length === 0 && <Text style={s.muted}>No circles of yours they can join right now.</Text>}
          {inviteTargets.map((c) => (
            <View key={c.id} style={[s.row, { paddingVertical: 8 }]}>
              <Text style={[s.text, { flex: 1 }]}>{c.name}</Text>
              {invited === c.id ? (
                <Text style={s.muted}>Invited ✓</Text>
              ) : (
                <TouchableOpacity
                  style={[s.btnGhost, { marginTop: 0, paddingVertical: 8 }]}
                  onPress={() => invite.mutate(c.id)}
                  disabled={invite.isPending}
                >
                  <Text style={s.btnGhostText}>Invite</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
