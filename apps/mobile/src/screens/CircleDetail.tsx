import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import * as Crypto from 'expo-crypto';
import { API_URL, api, getAccessToken, type CircleDetail, type Cycle, type WalletOverview } from '../api';
import { useTheme } from '../theme';
import { useAuth } from '../auth';
import { AnimatedBar, AnimatedMoneyBar, FadeIn } from '../anim';
import { Avatar } from '../Avatar';
import { countdownText, statusLabel } from '../format';

export function CircleDetailScreen({ circleId }: { circleId: string }) {
  const qc = useQueryClient();
  const { s, palette } = useTheme();
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ['circle', circleId],
    queryFn: () => api.get<CircleDetail>(`/circles/${circleId}`),
  });
  const cycles = useQuery({
    queryKey: ['cycles', circleId],
    queryFn: () => api.get<Cycle[]>(`/circles/${circleId}/cycles`),
    enabled: !!detail.data?.contributionAmount,
  });
  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get<WalletOverview>('/wallet'),
  });

  // Live room keeps every number on this screen fresh. There is no feed UI
  // on purpose: updates land directly in balances, pots and schedules.
  useEffect(() => {
    let socket: ReturnType<typeof io> | null = null;
    let alive = true;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['circle', circleId] });
      qc.invalidateQueries({ queryKey: ['cycles', circleId] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    };
    getAccessToken().then((token) => {
      if (!alive || !token) return;
      socket = io(API_URL, { transports: ['websocket'] });
      socket.on('connect', () => socket?.emit('join', { circleId, token }));
      socket.on('contribution.created', refresh);
      socket.on('member.joined', refresh);
      socket.on('circle.status_changed', refresh);
      socket.on('payout.completed', refresh);
      socket.on('cycle.advanced', refresh);
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
      qc.invalidateQueries({ queryKey: ['wallet'] });
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
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 32 }}>
      <FadeIn>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.h2}>{d.name}</Text>
          <Text style={[s.pill, (d.status === 'active') && s.pillSolid, (d.status === 'goal_reached' || d.status === 'completed') && s.pillMoney]}>
            {statusLabel(d.status)}
          </Text>
        </View>
        <AnimatedBar progress={d.progress} />
        <Text style={s.text}>
          {Number(d.balance).toLocaleString()} <Text style={s.muted}>of {Number(d.goalAmount).toLocaleString()} {d.currency}</Text>
        </Text>
        <Text style={s.muted}>Your share: {Number(d.myBalance).toLocaleString()}</Text>
      </View>
      </FadeIn>

      {(d.status === 'completed' || d.status === 'goal_reached') && (
        <View style={s.card}>
          <Text style={s.h3}>Rotation complete</Text>
          <Text style={s.muted}>Every cycle paid out. This circle is done collecting.</Text>
        </View>
      )}

      {d.currentCycle ? (
        <FadeIn delay={120}>
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.h3}>Cycle {d.currentCycle.cycleNumber} of {d.currentCycle.totalCycles}</Text>
            <Text style={[s.pill, s.pillSolid]}>collecting</Text>
          </View>
          <Text style={s.text}>
            {d.currentCycle.recipient.id === user?.id ? (
              <>Your turn <Text style={{ color: palette.money, fontWeight: '700' }}>· pot comes to you</Text></>
            ) : (
              <>{d.currentCycle.recipient.name} collects this cycle</>
            )}
          </Text>
          <AnimatedMoneyBar progress={d.currentCycle.collected / d.currentCycle.targetPot} />
          <Text style={s.muted}>
            {Number(d.currentCycle.collected).toLocaleString()} of {Number(d.currentCycle.targetPot).toLocaleString()} {d.currency} pot
            {countdownText(d.currentCycle.endsAt) ? ` · ${countdownText(d.currentCycle.endsAt)}` : ''}
          </Text>
        </View>
        </FadeIn>
      ) : null}

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
        <View style={s.row}>
          <Text style={s.h3}>Contribute</Text>
          <Text style={s.muted}>Wallet ₦{Number(wallet.data?.balance ?? 0).toLocaleString()}</Text>
        </View>
        {d.contributionAmount ? (
          <Text style={[s.h2, { marginTop: 8 }]}>₦{Number(d.contributionAmount).toLocaleString()}</Text>
        ) : null}
        {d.contributionAmount ? (
          <Text style={[s.muted, { marginBottom: 4 }]}>Fixed step. This circle takes exactly this amount per tap.</Text>
        ) : (
          <TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="1000" placeholderTextColor={palette.placeholder} />
        )}
        <TouchableOpacity
          style={s.btn}
          disabled={contribute.isPending || d.myMembership.status !== 'active'}
          onPress={() => contribute.mutate(d.contributionAmount ?? Number(amount))}
        >
          <Text style={s.btnText}>{contribute.isPending ? 'Sending…' : d.contributionAmount ? `Contribute ₦${Number(d.contributionAmount).toLocaleString()}` : 'Contribute'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.h3}>Members</Text>
        {d.members.map((m) => (
          <TouchableOpacity key={m.userId} style={[s.row, { paddingVertical: 6, justifyContent: 'flex-start', gap: 10 }]}>
            <Avatar name={m.user.name} avatarUrl={m.user.avatarUrl} />
            <View style={{ flex: 1 }}>
              <Text style={s.text}>{m.user.name} <Text style={s.muted}>· {m.role} · {statusLabel(m.status)}</Text></Text>
            </View>
            <Text style={s.text}>{Number(m.balance).toLocaleString()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.h3}>Circle facts</Text>
        {[
          ['Daily step', d.contributionAmount ? `₦${Number(d.contributionAmount).toLocaleString()}` : 'Free amount'],
          ['Cycle length', `${d.cycleLengthDays} days`],
          ['Seats', d.targetMembers ? `${d.members.filter((m) => m.status === 'active').length} of ${d.targetMembers} filled` : `${d.members.length} members`],
          ['Started', new Date(d.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })],
          ['Your role', `${d.myMembership.role} · ${statusLabel(d.myMembership.status)}`],
        ].map(([k, v]) => (
          <View key={k} style={[s.row, { paddingVertical: 4 }]}>
            <Text style={s.muted}>{k}</Text>
            <Text style={s.text}>{v}</Text>
          </View>
        ))}
      </View>

      {(cycles.data ?? []).length > 0 && (
        <View style={s.card}>
          <Text style={s.h3}>Rotation schedule</Text>
          {(cycles.data ?? []).map((c) => (
            <View key={c.id} style={[s.row, { paddingVertical: 6 }]}>
              <Avatar name={c.recipient.name} size={28} />
              <View style={{ flex: 1 }}>
                <Text style={s.text}>Cycle {c.cycleNumber} · {c.recipient.name}</Text>
                <Text style={s.muted}>
                  {c.status === 'payout_completed' ? 'paid out' : c.status === 'collecting'
                    ? `${Number(c.collected).toLocaleString()} / ${Number(c.targetPot).toLocaleString()}`
                    : 'upcoming'}
                </Text>
              </View>
              <Text style={[s.pill, c.status === 'collecting' && s.pillSolid, c.status === 'payout_completed' && s.pillMoney]}>{statusLabel(c.status)}</Text>
            </View>
          ))}
        </View>
      )}

    </ScrollView>
  );
}
