import { Image, Text, View } from 'react-native';
import { useTheme } from './theme';

/** Photo when available, initials on a monochrome disc otherwise. */
export function Avatar({ name, avatarUrl, size = 34 }: { name: string; avatarUrl?: string | null; size?: number }) {
  const { s } = useTheme();
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  const initials = name.split(' ').map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

export function Greeting({ name, style }: { name: string; style?: object }) {
  const { s } = useTheme();
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const first = name.split(' ')[0] || name;
  return <Text style={[s.h1, { fontSize: 26 }, style]}>Good {part}, {first}</Text>;
}
