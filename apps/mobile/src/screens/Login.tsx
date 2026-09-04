import { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { api } from '../api';
import { useAuth } from '../auth';
import { useTheme } from '../theme';
import { Logo } from '../Logo';

WebBrowser.maybeCompleteAuthSession();

const SLIDES = [
  {
    img: 'https://images.pexels.com/photos/3830752/pexels-photo-3830752.jpeg?auto=compress&cs=tinysrgb&w=1260',
    title: 'Save together.',
    body: 'Form a trusted circle and chip toward one shared goal, side by side.',
  },
  {
    img: 'https://images.pexels.com/photos/34134899/pexels-photo-34134899.jpeg?auto=compress&cs=tinysrgb&w=1260',
    title: 'One goal, every eye on it.',
    body: 'Mortgage deposit, rent, fees. The balance is always visible to the group.',
  },
  {
    img: 'https://images.pexels.com/photos/4630669/pexels-photo-4630669.jpeg?auto=compress&cs=tinysrgb&w=1260',
    title: 'Every tap counts.',
    body: 'Contribute in seconds. Retries never charge you twice.',
  },
];

export function LoginScreen() {
  const { signIn } = useAuth();
  const { s, palette } = useTheme();
  const [slide, setSlide] = useState(0);
  const [mode, setMode] = useState<'join' | 'signin'>('join');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  // In Expo Go there is no Google button, so the dev form is the sign-in.
  // Everywhere else it stays tucked behind "Trouble signing in?".
  const [showDev, setShowDev] = useState(Constants.appOwnership === 'expo');
  const [err, setErr] = useState<string | null>(null);
  const pager = useRef<ScrollView>(null);
  const width = Dimensions.get('window').width - 32;
  const last = slide === SLIDES.length - 1;

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  // Native Google sign-in only works in a dev/production build. Inside Expo Go
  // the redirect goes somewhere Google never approved, so dev sign-in covers Go.
  const inExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = (response.params as { id_token?: string }).id_token;
      if (!idToken) {
        setErr('Google did not return an ID token');
        return;
      }
      api
        .postPublic<{ accessToken: string; refreshToken: string; isNew: boolean }>('/auth/google/id-token', { idToken })
        .then((t) => signIn(t.accessToken, t.refreshToken, t.isNew))
        .catch((e: Error) => setErr(e.message));
    } else if (response?.type === 'error') {
      setErr('Google sign-in failed');
    }
  }, [response, signIn]);

  const devLogin = async () => {
    setErr(null);
    try {
      const t = await api.postPublic<{ accessToken: string; refreshToken: string; isNew: boolean }>('/auth/dev-login', {
        email,
        name: name || undefined,
      });
      await signIn(t.accessToken, t.refreshToken, t.isNew);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Login failed');
    }
  };

  const goTo = (i: number) => {
    setSlide(i);
    pager.current?.scrollTo({ x: i * width, animated: true });
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ flexGrow: 1, paddingTop: 32, paddingBottom: 16 }}>
      <View style={{ flex: 1, minHeight: 24 }} />
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {SLIDES.map((item, i) => (
          <View key={item.title} style={[s.hero, { width, height: 400 }]}>
            <Image source={{ uri: item.img }} style={s.heroImage} />
            <View style={s.heroTop}>
              <View style={s.heroBrand}>
                <Logo size={22} color="#ffffff" />
                <Text style={s.heroBrandText}>Circle</Text>
              </View>
              <Text style={s.heroCount}>{i + 1} / {SLIDES.length}</Text>
            </View>
            <View style={s.heroCaption}>
              <Text style={s.heroTitle}>{item.title}</Text>
              <Text style={s.heroBody}>{item.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={s.dots}>
        {SLIDES.map((item, i) => (
          <View key={item.title} style={[s.dot, i === slide && s.dotOn]} />
        ))}
      </View>

      {!last ? (
        <View style={[s.row, { marginTop: 4, gap: 12 }]}>
          <TouchableOpacity style={[s.btnGhost, { flex: 1, marginTop: 0, padding: 13 }]} onPress={() => goTo(SLIDES.length - 1)}>
            <Text style={s.btnGhostText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, { flex: 1, marginTop: 0 }]} onPress={() => goTo(slide + 1)}>
            <Text style={s.btnText}>Next</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.card}>
          <View style={[s.row, { justifyContent: 'flex-start', gap: 10, marginBottom: 12 }]}>
            <Logo size={30} />
            <Text style={[s.h2, { marginBottom: 0 }]}>Circle</Text>
          </View>
          <View style={[s.row, { gap: 12, marginBottom: 4 }]}>
            <TouchableOpacity style={[mode === 'join' ? s.btn : s.btnGhost, { flex: 1, marginTop: 0 }]} onPress={() => setMode('join')}>
              <Text style={mode === 'join' ? s.btnText : s.btnGhostText}>Join</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[mode === 'signin' ? s.btn : s.btnGhost, { flex: 1, marginTop: 0 }]} onPress={() => setMode('signin')}>
              <Text style={mode === 'signin' ? s.btnText : s.btnGhostText}>Sign in</Text>
            </TouchableOpacity>
          </View>
          <Text style={[s.muted, { marginBottom: 4 }]}>
            {mode === 'join' ? 'New here? Create your account with Google in seconds.' : 'Welcome back. Use the Google account you joined with.'}
          </Text>
          {inExpoGo ? (
            <Text style={s.muted}>Running in Expo Go, so sign in below. Google needs a dev build.</Text>
          ) : (
            <TouchableOpacity
              style={s.btn}
              disabled={!request}
              onPress={() => promptAsync().catch((e: Error) => setErr(e.message))}
            >
              <Text style={s.btnText}>Continue with Google</Text>
            </TouchableOpacity>
          )}
          {!inExpoGo && (
            <TouchableOpacity style={s.btnGhost} onPress={() => setShowDev(!showDev)}>
              <Text style={s.btnGhostText}>Trouble signing in?</Text>
            </TouchableOpacity>
          )}
          {showDev && (
            <View>
              <Text style={s.muted}>No Google credentials handy? Use dev sign-in below.</Text>
              {err ? (
                <View style={s.error}>
                  <Text style={s.errorText}>{err}</Text>
                </View>
              ) : null}
              <Text style={s.label}>Email</Text>
              <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="ada@example.com" placeholderTextColor={palette.placeholder} autoCapitalize="none" keyboardType="email-address" />
              <Text style={s.label}>Name (optional)</Text>
              <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ada" placeholderTextColor={palette.placeholder} />
              <TouchableOpacity style={s.btn} onPress={devLogin}>
                <Text style={s.btnText}>Dev sign-in</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      <Text style={[s.faint, { textAlign: 'center', marginVertical: 12 }]}>Photos: Pexels</Text>
      <View style={{ flex: 2, minHeight: 16 }} />
    </ScrollView>
  );
}
