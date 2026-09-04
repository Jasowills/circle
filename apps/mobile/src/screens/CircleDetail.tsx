import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import * as Crypto from 'expo-crypto';
import { API_URL, api, getAccessToken, type CircleDetail } from '../api';
import { useTheme } from '../theme';

interface FeedItem {
  id: string;
  text: string;
}

export function CircleDetailScreen({ circleId }: { circleId: string }) {
  const qc = useQueryClient();
  const { s, palette } = useTheme();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [amount, setAmount] = useState('1000');
  const [msg, setMsg] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ['circle', circleId],
    queryFn: () => api.get<CircleDetail>(`/circles/${circleId}`),
  });

  const push = (text: string) =>
    setFeed((f) => [{ id: `${Date.now()}-${Math.random()}`, text }, ...f].slice(0, 30));

  useEffect(() => {
    let socket: ReturnType<typeof io> | null = null;
    let alive = true;
    getAccessToken().then((token) => {
      if (!alive || !token) return;
      socket = io(API_URL, { transports: ['websocket'] });
      socket.on('connect', () => socket?.emit('join', { circleId, token }));
      socket.on('contribution.created', (p: { amount: string }) => {
        push(`New contribution of ${p.amount}`);
        qc.invalidateQueries({ queryKey: ['circle', circleId] });
      });
      socket.on('member.joined', () => {
        push('A member joined');
        qc.invalidateQueries({ queryKey: ['circle', circleId] });
      });
      socket.on('circle.status_changed', (p: { from: string; to: string }) => {
        push(`Circle is now ${p.to.replace('_', ' ')}`);
        qc.invalidateQueries({ queryKey: ['circle', circleId] });
      });
    });
    return () => {
      alive = false;
      socket?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId]);

  const contribute = useMutation({
    mutationFn: async (amt: number) =>
      api.post<{ replayed: boolean }>(`/circles/${circleId}/contribute`, {
        amount: amt,
        idempotencyKey: Crypto.randomUUID(),
      }),
    onSuccess: (r) => {
      setMsg(r.replayed ? 'That one already went through. No double charge.' : 'Contribution saved.');
      qc.invalidateQueries({ queryKey: ['circle', circleId] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const accept = useMutation({
    mutationFn: () => api.post(`/circles/${circleId}/accept`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['circle', circleId] }),
    onError: (e: Error) => setMsg(e.message),
  });

  const d = detail.data;
  if (detail.isLoading) return <View style={s.screen}><Text style={s.muted}>Loading…</Text></View>;
  if (detail.error || !d) {
    return (
      <View style={s.screen}>
        <View style={s.error}>
          <Text style={s.errorText}>{(detail.error as Error)?.message ?? 'Not found'}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={s.screen}>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.h2}>{d.name}</Text>
          <Text style={[s.pill, (d.status === 'active' || d.status === 'goal_reached') && s.pillSolid]}>
            {d.status.replace('_', ' ')}
          </Text>
        </View>
        <View style={s.bar}>
          <View style={[s.barFill, { width: `${Math.round(d.progress * 100)}%` }]} />
        </View>
        <Text style={s.text}>
          {Number(d.balance).toLocaleString()} <Text style={s.muted}>of {Number(d.goalAmount).toLocaleString()} {d.currency}</Text>
        </Text>
        <Text style={s.muted}>Your share: {Number(d.myBalance).toLocaleString()}</Text>
      </View>

      {msg ? (
        <View style={s.card}>
          <Text style={s.text}>{msg}</Text>
        </View>
      ) : null}

      {d.myMembership.status === 'invited' && (
        <View style={s.card}>
          <Text style={s.text}>You've been invited to this circle.</Text>
          <TouchableOpacity style={s.btn} onPress={() => accept.mutate()}>
            <Text style={s.btnText}>Accept invite</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.h3}>Contribute</Text>
        <TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="1000" placeholderTextColor={palette.placeholder} />
        <TouchableOpacity
          style={s.btn}
          disabled={contribute.isPending || d.myMembership.status !== 'active'}
          onPress={() => contribute.mutate(Number(amount))}
        >
          <Text style={s.btnText}>{contribute.isPending ? 'Sending…' : 'Contribute'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.h3}>Members</Text>
        {d.members.map((m) => (
          <View key={m.userId} style={[s.row, { paddingVertical: 4 }]}>
            <Text style={s.text}>{m.user.name} <Text style={s.muted}>· {m.role} · {m.status}</Text></Text>
            <Text style={s.text}>{Number(m.balance).toLocaleString()}</Text>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.h3}>● Live feed</Text>
        {feed.length === 0 && <Text style={s.muted}>Live. New contributions show up here.</Text>}
        {feed.map((f) => (
          <Text key={f.id} style={[s.text, { paddingVertical: 3 }]}>{f.text}</Text>
        ))}
      </View>
    </ScrollView>
  );
}
