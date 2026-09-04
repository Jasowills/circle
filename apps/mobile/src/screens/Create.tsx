import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api, type CircleSummary } from '../api';
import { useTheme } from '../theme';

export function CreateScreen({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const { s, palette } = useTheme();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post<CircleSummary>('/circles', { name: name.trim(), goalAmount: Number(goal) }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['circles'] });
      onCreated(c.id);
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <View style={s.screen}>
      <View style={s.card}>
        <View style={[s.row, { marginBottom: 4 }]}>
          <Text style={s.h2}>New circle</Text>
          <TouchableOpacity onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={8}>
            <Ionicons name="close-outline" size={24} color={palette.text} />
          </TouchableOpacity>
        </View>
        <Text style={s.muted}>Name the goal. Invite people after — they join by email.</Text>
        {err ? (
          <View style={s.error}>
            <Text style={s.errorText}>{err}</Text>
          </View>
        ) : null}
        <Text style={s.label}>Circle name</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Mortgage deposit" placeholderTextColor={palette.placeholder} maxLength={80} />
        <Text style={s.label}>Goal amount (₦)</Text>
        <TextInput style={s.input} value={goal} onChangeText={setGoal} placeholder="500000" placeholderTextColor={palette.placeholder} keyboardType="numeric" />
        <TouchableOpacity
          style={s.btn}
          disabled={create.isPending || !name.trim() || !(Number(goal) > 0)}
          onPress={() => create.mutate()}
        >
          <Text style={s.btnText}>{create.isPending ? 'Creating…' : 'Create circle'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
