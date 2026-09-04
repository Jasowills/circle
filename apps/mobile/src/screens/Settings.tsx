import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL, api } from '../api';
import { useAuth } from '../auth';
import { useTheme } from '../theme';
import { Avatar } from '../Avatar';

export function SettingsScreen() {
  const { user, reloadUser, signOut } = useAuth();
  const { s, palette, mode, toggle } = useTheme();
  const [name, setName] = useState(user?.name ?? '');
  const [msg, setMsg] = useState<string | null>(null);

  if (!user) return null;

  const saveName = async () => {
    setMsg(null);
    try {
      await api.patch('/me', { name });
      await reloadUser();
      setMsg('Name updated.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not save');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled">
      <Text style={[s.h1, { fontSize: 26, marginBottom: 12 }]}>Settings</Text>

      <View style={[s.card, { alignItems: 'center', paddingVertical: 20 }]}>
        <Avatar name={user.name} avatarUrl={user.avatarUrl} size={64} />
        <Text style={[s.h3, { marginTop: 10, marginBottom: 0 }]}>{user.name}</Text>
        <Text style={[s.muted, { marginTop: 2 }]}>{user.email}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.h3}>Display name</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={palette.placeholder} maxLength={80} />
        <TouchableOpacity style={s.btn} onPress={saveName} disabled={!name.trim() || name.trim() === user.name}>
          <Text style={s.btnText}>Save name</Text>
        </TouchableOpacity>
        {msg ? <Text style={[s.muted, { marginTop: 8 }]}>{msg}</Text> : null}
      </View>

      <View style={s.card}>
        <TouchableOpacity style={[s.row, { paddingVertical: 6 }]} onPress={toggle}>
          <View style={[s.row, { justifyContent: 'flex-start', gap: 12 }]}>
            <Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={20} color={palette.text} />
            <Text style={s.text}>Appearance</Text>
          </View>
          <Text style={s.muted}>{mode === 'dark' ? 'Dark' : 'Light'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.h3}>About</Text>
        <View style={[s.row, { paddingVertical: 4 }]}>
          <Text style={s.muted}>Version</Text>
          <Text style={s.text}>1.0.0</Text>
        </View>
        <View style={[s.row, { paddingVertical: 4 }]}>
          <Text style={s.muted}>Server</Text>
          <Text style={s.text}>{API_URL.replace(/^https?:\/\//, '')}</Text>
        </View>
      </View>

      <TouchableOpacity style={[s.btnGhost, { borderColor: palette.text }]} onPress={signOut}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="log-out-outline" size={18} color={palette.text} />
          <Text style={s.btnGhostText}>Log out {user.name.split(' ')[0]}</Text>
        </View>
      </TouchableOpacity>
      <View style={{ height: 24 }} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
