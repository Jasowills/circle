import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api, type CircleSummary } from '../api';
import { useTheme } from '../theme';

const FREQS = [
  { label: 'Weekly', value: 1 },
  { label: '2× / week', value: 2 },
  { label: '3× / week', value: 3 },
  { label: 'Daily', value: 7 },
];

export function CreateScreen({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const { s, palette } = useTheme();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'ajo' | 'goal'>('ajo');
  const [goal, setGoal] = useState('');
  const [daily, setDaily] = useState('');
  const [members, setMembers] = useState('');
  const [freq, setFreq] = useState(2);
  const [length, setLength] = useState(7);
  const [err, setErr] = useState<string | null>(null);

  const valid = mode === 'goal'
    ? name.trim() && Number(goal) > 0
    : name.trim() && Number(daily) > 0 && Number(members) >= 2;

  const create = useMutation({
    mutationFn: () =>
      api.post<CircleSummary>('/circles', {
        name: name.trim(),
        ...(mode === 'ajo'
          ? { contributionAmount: Number(daily), targetMembers: Number(members), contributionsPerWeek: freq, cycleLengthDays: length }
          : { goalAmount: Number(goal) }),
      }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['circles'] });
      onCreated(c.id);
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView style={s.screen} contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <View style={s.card}>
        <View style={[s.row, { marginBottom: 4 }]}>
          <Text style={s.h2}>New circle</Text>
          <TouchableOpacity onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={8}>
            <Ionicons name="close-outline" size={24} color={palette.text} />
          </TouchableOpacity>
        </View>
        <View style={[s.row, { gap: 12, marginVertical: 8 }]}>
          <TouchableOpacity style={[mode === 'ajo' ? s.btn : s.btnGhost, { flex: 1, marginTop: 0, padding: 13 }]} onPress={() => setMode('ajo')}>
            <Text style={mode === 'ajo' ? s.btnText : s.btnGhostText}>Ajo rotation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[mode === 'goal' ? s.btn : s.btnGhost, { flex: 1, marginTop: 0, padding: 13 }]} onPress={() => setMode('goal')}>
            <Text style={mode === 'goal' ? s.btnText : s.btnGhostText}>Simple goal</Text>
          </TouchableOpacity>
        </View>
        {err ? (
          <View style={s.error}>
            <Text style={s.errorText}>{err}</Text>
          </View>
        ) : null}
        <Text style={s.label}>Circle name</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Saturday Thrift" placeholderTextColor={palette.placeholder} maxLength={80} />
        {mode === 'ajo' ? (
          <>
            <Text style={s.label}>Daily contribution per member (₦)</Text>
            <TextInput style={s.input} value={daily} onChangeText={setDaily} placeholder="20000" placeholderTextColor={palette.placeholder} keyboardType="numeric" />
            <Text style={s.label}>Members (cycles)</Text>
            <TextInput style={s.input} value={members} onChangeText={setMembers} placeholder="5" placeholderTextColor={palette.placeholder} keyboardType="numeric" />
            <Text style={s.label}>How often may members pay?</Text>
            <View style={[s.row, { gap: 8 }]}>
              {FREQS.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  style={[freq === f.value ? s.btn : s.btnGhost, { flex: 1, marginTop: 0, paddingVertical: 10 }]}
                  onPress={() => setFreq(f.value)}
                >
                  <Text style={[freq === f.value ? s.btnText : s.btnGhostText, { fontSize: 12 }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.muted, { marginTop: 8 }]}>
              Weekly pot: ₦{(Number(daily || 0) * 7 * Number(members || 0)).toLocaleString()}. Order is drawn once the circle fills.
            </Text>
            <Text style={s.label}>Cycle length</Text>
            <View style={[s.row, { gap: 8 }]}>
              {[7, 14, 30].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[length === d ? s.btn : s.btnGhost, { flex: 1, marginTop: 0, paddingVertical: 10 }]}
                  onPress={() => setLength(d)}
                >
                  <Text style={[length === d ? s.btnText : s.btnGhostText, { fontSize: 12 }]}>{d}d</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={s.label}>Goal amount (₦)</Text>
            <TextInput style={s.input} value={goal} onChangeText={setGoal} placeholder="500000" placeholderTextColor={palette.placeholder} keyboardType="numeric" />
          </>
        )}
        <TouchableOpacity
          style={s.btn}
          disabled={create.isPending || !valid}
          onPress={() => create.mutate()}
        >
          <Text style={s.btnText}>{create.isPending ? 'Creating…' : 'Create circle'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
