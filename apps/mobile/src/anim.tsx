import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTheme } from './theme';

/** Fade-and-rise entrance. Stagger siblings with delay. */
export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: object }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = Animated.timing(v, { toValue: 1, duration: 450, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    t.start();
    return () => t.stop();
  }, [v, delay]);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

/** Progress fill that glides to the target instead of jumping. */
export function AnimatedBar({ progress, height = 12 }: { progress: number; height?: number }) {
  const { s } = useTheme();
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: Math.max(0, Math.min(1, progress)), duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, w]);
  return (
    <View style={[s.bar, { height }]}>
      <Animated.View style={[s.barFill, { width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

/** Money fills glide in green. Same motion as AnimatedBar, emerald fill. */
export function AnimatedMoneyBar({ progress }: { progress: number }) {
  const { s, palette } = useTheme();
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: Math.max(0, Math.min(1, progress)), duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, w]);
  return (
    <View style={s.bar}>
      <Animated.View style={[s.barFill, { backgroundColor: palette.money, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

/** Breathing live dot for "live" headers. */
export function PulseDot({ size = 8 }: { size?: number }) {
  const { palette } = useTheme();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(p, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [p]);
  return (
    <Animated.View
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: palette.money, marginRight: 6,
        opacity: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
      }}
    />
  );
}
