import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { api, type WalletOverview } from '../api';
import { useTheme } from '../theme';

const QUICK = [50000, 100000, 250000];

function txLabel(type: string): string {
  switch (type) {
    case 'demo_fund': return 'Starter credit';
    case 'fund': return 'Top-up';
    case 'circle_contribution': return 'Circle contribution';
    case 'circle_payout': return 'Payout received';
    default: return type.replace('_', ' ');
  }
}

export function WalletScreen() {
  const { s, palette } = useTheme();
  const qc = useQueryClient();
  const [amount, setAmount] = useState('100000');
  const [msg, setMsg] = useState<string | null>(null);

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get<WalletOverview>('/wallet'),
  });

  const fund = useMutation({
    mutationFn: (amt: number) =>
      api.post<{ replayed: boolean; balance: number }>('/wallet/fund', { amount: amt, idempotencyKey: Crypto.randomUUID() }),
    onSuccess: (r) => {
      setMsg(r.replayed ? 'That top-up already landed.' : 'Wallet funded.');
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const d = wallet.data;

  return (
    <ScrollView style={s.screen}>
      <Text style={[s.h1, { fontSize: 26, marginBottom: 12 }]}>Wallet</Text>

      <View style={s.card}>
        <Text style={s.muted}>Balance</Text>
        <Text style={[s.h1, { fontSize: 38, color: palette.money }]}>₦{Number(d?.balance ?? 0).toLocaleString()}</Text>
        <Text style={[s.muted, { marginTop: 4 }]}>Fund it first, then contribute. Contributions never overdraw.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.h3}>Top up (demo)</Text>
        <Text style={s.muted}>Instant test credit. Real payments plug in here later.</Text>
        <View style={[s.row, { gap: 8, marginTop: 12 }]}>
          {QUICK.map((q) => (
            <TouchableOpacity
              key={q}
              style={[s.btnGhost, { flex: 1, marginTop: 0 }]}
              onPress={() => { setAmount(String(q)); fund.mutate(q); }}
              disabled={fund.isPending}
            >
              <Text style={s.btnGhostText}>₦{(q / 1000).toString()}k</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={s.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="Custom amount"
          placeholderTextColor={palette.placeholder}
        />
        <TouchableOpacity style={[s.btn, { backgroundColor: palette.money }]} onPress={() => fund.mutate(Number(amount))} disabled={fund.isPending}>
          <Text style={[s.btnText, { color: '#06281a' }]}>{fund.isPending ? 'Funding…' : 'Fund wallet'}</Text>
        </TouchableOpacity>
        {msg ? <Text style={[s.muted, { marginTop: 8 }]}>{msg}</Text> : null}
      </View>

      <View style={s.card}>
        <Text style={s.h3}>Transactions</Text>
        {(d?.data ?? []).map((t) => {
          const out = Number(t.amount) < 0;
          return (
            <View key={t.id} style={[s.row, { paddingVertical: 8 }]}>
              <View style={[s.row, { justifyContent: 'flex-start', gap: 10 }]}>
                <Ionicons
                  name={t.type === 'circle_payout' ? 'arrow-down-circle-outline' : t.type === 'circle_contribution' ? 'arrow-up-circle-outline' : 'add-circle-outline'}
                  size={20}
                  color={t.type === 'circle_payout' ? palette.money : palette.text}
                />
                <View>
                  <Text style={s.text}>{txLabel(t.type)}</Text>
                  <Text style={s.muted}>{new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                </View>
              </View>
              <Text style={[s.text, { color: out ? palette.text : palette.money, fontWeight: '700' }]}>
                {out ? '−' : '+'}₦{Math.abs(Number(t.amount)).toLocaleString()}
              </Text>
            </View>
          );
        })}
        {(!d || d.data.length === 0) && <Text style={s.muted}>No transactions yet.</Text>}
      </View>
    </ScrollView>
  );
}
