import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Text, View } from 'react-native';
import { useTheme } from './theme';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  const { s, palette } = useTheme();
  return (
    <View style={[s.screen, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
      <ActivityIndicator size="large" color={palette.text} />
      <Text style={s.muted}>{label}</Text>
    </View>
  );
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: object }) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    const t = Animated.timing(v, { toValue: 1, duration: 450, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    t.start();
    return () => t.stop();
  }, [v, delay, reduce]);
  if (reduce) return <View style={style}>{children}</View>;
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

export function AnimatedBar({ progress, height = 12 }: { progress: number; height?: number }) {
  const { s } = useTheme();
  const reduce = useReducedMotion();
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      w.setValue(Math.max(0, Math.min(1, progress)));
      return;
    }
    Animated.timing(w, { toValue: Math.max(0, Math.min(1, progress)), duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, w, reduce]);
  return (
    <View style={[s.bar, { height }]}>
      <Animated.View style={[s.barFill, { width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

export function AnimatedMoneyBar({ progress }: { progress: number }) {
  const { s, palette } = useTheme();
  const reduce = useReducedMotion();
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      w.setValue(Math.max(0, Math.min(1, progress)));
      return;
    }
    Animated.timing(w, { toValue: Math.max(0, Math.min(1, progress)), duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, w, reduce]);
  return (
    <View style={s.bar}>
      <Animated.View style={[s.barFill, { backgroundColor: palette.money, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

export function PulseDot({ size = 8 }: { size?: number }) {
  const { palette } = useTheme();
  const reduce = useReducedMotion();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(p, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [p, reduce]);
  if (reduce) {
    return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.money, marginRight: 6 }} />;
  }
  return (
    <Animated.View
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: palette.money, marginRight: 6,
        opacity: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
      }}
    />
  );
}
