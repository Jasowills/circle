import { View } from 'react-native';
import { useTheme } from './theme';

export function Logo({ size = 26, color }: { size?: number; color?: string }) {
  const { palette } = useTheme();
  const ring = {
    width: size * 0.68,
    height: size * 0.68,
    borderRadius: size * 0.34,
    borderWidth: Math.max(2, size * 0.09),
    borderColor: color ?? palette.text,
  };
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center' }}>
      <View style={ring} />
      <View style={[ring, { marginLeft: -size * 0.36 }]} />
    </View>
  );
}
