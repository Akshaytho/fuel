import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { Theme, type as t } from '@fuel/tokens';
import { BrandMark } from './onboarding';

/*
 * Motion primitives (CLAUDE.md rule 0b: motion is part of done).
 * Two mechanisms, chosen for guaranteed behavior on BOTH Hermes and
 * react-native-web (the verification harness):
 *  - Animated (opacity/transform): native driver on device, JS driver on web.
 *  - useTween: a requestAnimationFrame eased number for SVG ring sweeps,
 *    where Animated↔SVG prop interop is the flakiest part of RN — a plain
 *    re-rendered number is boring and therefore reliable everywhere.
 */

const nativeDriver = Platform.OS !== 'web';

/** Eased 0→target sweep; re-tweens from current value whenever target moves. */
export function useTween(target: number, duration = 700, delay = 120): number {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  const raf = useRef(0);
  useEffect(() => {
    const start = from.current;
    const dist = target - start;
    if (dist === 0) return;
    let t0 = 0;
    const frame = (now: number) => {
      if (!t0) t0 = now;
      const lin = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - lin, 3); // cubic ease-out
      const v = start + dist * eased;
      from.current = v;
      setValue(v);
      if (lin < 1) raf.current = requestAnimationFrame(frame);
    };
    const kick = setTimeout(() => { raf.current = requestAnimationFrame(frame); }, delay);
    return () => { clearTimeout(kick); cancelAnimationFrame(raf.current); };
  }, [target, duration, delay]);
  return value;
}

/** Mount transition: fade + gentle rise. Key it by stage to animate changes. */
export function FadeSlideIn({ children, duration = 340, offset = 14, style }: {
  children: React.ReactNode; duration?: number; offset?: number;
  style?: object;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, {
      toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver,
    }).start();
  }, []);
  return (
    <Animated.View style={[{ flex: 1, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * App-open brand moment: the Fuel mark springs in, holds, and the caller
 * unmounts it (next stage fades in via FadeSlideIn). Pure — no timers of
 * its own beyond the entrance; AppRoot owns how long boot lasts.
 */
export function BootSplash({ theme, wordmark }: { theme: Theme; wordmark?: string | undefined }) {
  const a = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, friction: 6, tension: 60, useNativeDriver: nativeDriver }).start();
    Animated.timing(w, { toValue: 1, duration: 420, delay: 280, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, []);
  return (
    <View testID="boot-splash" style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        opacity: a,
        transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        alignItems: 'center',
      }}>
        <BrandMark theme={theme} size={104} />
      </Animated.View>
      {wordmark !== undefined && (
        <Animated.Text style={{
          marginTop: 18, fontSize: t.largeTitle.size, fontWeight: t.largeTitle.weight, color: theme.label,
          opacity: w,
          transform: [{ translateY: w.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}>{wordmark}</Animated.Text>
      )}
    </View>
  );
}

/** Standard press feedback for any pressable: scale + dim while held. */
export function pressedStyle(pressed: boolean): object {
  return pressed ? { transform: [{ scale: 0.97 }], opacity: 0.82 } : {};
}
