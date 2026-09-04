import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { api } from '../api';
import { useAuth } from '../auth';
import { s } from '../theme';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google sign-in through expo-auth-session. The client IDs come from Google
 * Cloud Console; without them only dev sign-in works.
 */
export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  // Native Google sign-in only works in a dev/production build. Inside Expo Go
  // the redirect goes somewhere Google never approved, so the button would
  // just land on an "access blocked" page. Dev sign-in below covers Go.
  const inExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = (response.params as { id_token?: string }).id_token;
      if (!idToken) {
        setErr('Google did not return an ID token');
        return;
      }
      api
        .postPublic<{ accessToken: string; refreshToken: string }>('/auth/google/id-token', { idToken })
        .then((t) => signIn(t.accessToken, t.refreshToken))
        .catch((e: Error) => setErr(e.message));
    } else if (response?.type === 'error') {
      setErr('Google sign-in failed');
    }
  }, [response, signIn]);

  const devLogin = async () => {
    setErr(null);
    try {
      const t = await api.postPublic<{ accessToken: string; refreshToken: string }>('/auth/dev-login', {
        email,
        name: name || undefined,
      });
      await signIn(t.accessToken, t.refreshToken);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Login failed');
    }
  };

  return (
    <ScrollView style={s.screen}>
      <View style={[s.card, { marginTop: 48 }]}>
        <Text style={s.h1}>Circle.</Text>
        <Text style={s.muted}>Save together toward one goal. Every contribution is on record for good.</Text>
        {inExpoGo ? (
          <Text style={s.muted}>Google sign-in needs a dev build. Use dev sign-in below while running in Expo Go.</Text>
        ) : (
          <TouchableOpacity
            style={s.btn}
            disabled={!request}
            onPress={() => promptAsync().catch((e: Error) => setErr(e.message))}
          >
            <Text style={s.btnText}>Continue with Google</Text>
          </TouchableOpacity>
        )}
        {err ? <Text style={s.error}>{err}</Text> : null}
        <Text style={s.label}>Email</Text>
        <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="ada@example.com" placeholderTextColor="#667" autoCapitalize="none" keyboardType="email-address" />
        <Text style={s.label}>Name (optional)</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ada" placeholderTextColor="#667" />
        <TouchableOpacity style={s.btnGhost} onPress={devLogin}>
          <Text style={s.btnGhostText}>Dev sign-in</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
