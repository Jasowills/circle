import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api, getAccessToken, getRefreshToken } from '../api';
import { useAuth } from '../auth';
import { useTheme } from '../theme';
import { Logo } from '../Logo';

export function SetupScreen() {
  const { user, signIn, completeSetup } = useAuth();
  const { s, palette } = useTheme();
  const [name, setName] = useState(user?.name ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      await api.patch('/me', { name });
      const token = await getAccessToken();
      const rt = await getRefreshToken();
      if (token && rt) await signIn(token, rt, false);
      else completeSetup();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView style={s.screen} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
      <View style={s.card}>
        <View style={[s.row, { justifyContent: 'flex-start', gap: 10, marginBottom: 4 }]}>
          <Logo size={30} />
          <Text style={[s.h2, { marginBottom: 0 }]}>You're in.</Text>
        </View>
        <Text style={s.muted}>One last thing. What should your circles call you?</Text>
        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={{ width: 64, height: 64, borderRadius: 32, marginTop: 12 }} />
        ) : null}
        {err ? (
          <View style={s.error}>
            <Text style={s.errorText}>{err}</Text>
          </View>
        ) : null}
        <Text style={s.label}>Display name</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ada" placeholderTextColor={palette.placeholder} />
        <TouchableOpacity style={s.btn} onPress={save} disabled={saving}>
          <Text style={s.btnText}>{saving ? 'Saving…' : 'Start saving'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
