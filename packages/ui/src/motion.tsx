import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native';
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
 *
 * TWO SAFETY RULES, both added after a real failure (2026-09, five-days sim):
 *
 *  1. MOTION MAY NEVER GATE VISIBILITY. Two persona screenshots came back
 *     completely blank. Cause: RN Web's Animated.timing drives itself from
 *     Date.now(); the harness froze the clock, so the tween never advanced
 *     and the FadeSlideIn wrapper holding the ENTIRE screen sat at opacity 0
 *     forever. A frozen or backwards-jumping wall clock is not a test-only
 *     event — NTP corrections, timezone changes and manual clock edits all
 *     do it on real phones, and a stalled JS thread has the same effect.
 *     So every animation here carries a `settle` failsafe: an independent
 *     timer that force-commits the FINAL state. Worst case the user loses
 *     the animation; they never lose the screen.
 *  2. REDUCED MOTION IS HONORED. Users with vestibular disorders turn on
 *     Reduce Motion (iOS: Settings > Accessibility > Motion). For them we
 *     render the destination state instantly — no fade, no rise, no sweep.
 */

const nativeDriver = Platform.OS !== 'web';

/** True when the OS asks us not to animate (iOS/Android Reduce Motion, or
 *  prefers-reduced-motion on web). Live — updates if the user toggles it. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    if (Platform.OS === 'web') {
      const mq = typeof globalThis.matchMedia === 'function'
        ? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
      if (!mq) return;
      setReduced(mq.matches);
      const onChange = (e: { matches: boolean }) => { if (alive) setReduced(e.matches); };
      // Safari < 14 only has the deprecated addListener
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
      else mq.addListener?.(onChange);
      return () => {
        alive = false;
        if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onChange);
        else mq.removeListener?.(onChange);
      };
    }
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (alive) setReduced(!!v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => {
      if (alive) setReduced(!!v);
    });
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduced;
}

/**
 * Failsafe: true once the animation SHOULD have finished, regardless of
 * whether it actually did. Driven by setTimeout, which is independent of the
 * wall clock and of Animated's internal timing, so it still fires when the
 * clock is frozen or the animation driver is wedged.
 */
function useSettled(afterMs: number): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSettled(true), afterMs);
    return () => clearTimeout(id);
  }, [afterMs]);
  return settled;
}

/** Grace period past an animation's nominal end before we force final state. */
const SETTLE_SLACK_MS = 250;

/** Eased 0→target sweep; re-tweens from current value whenever target moves. */
export function useTween(target: number, duration = 700, delay = 120): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  const from = useRef(0);
  const raf = useRef(0);
  // A stuck tween does not just look wrong — it LIES, showing an empty ring
  // for a day that is fully logged. Force the true value if the sweep stalls.
  const settled = useSettled(delay + duration + SETTLE_SLACK_MS);
  useEffect(() => {
    if (reduced) { from.current = target; setValue(target); return; }
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
  }, [target, duration, delay, reduced]);
  if (reduced) return target;
  if (settled && from.current !== target) { from.current = target; return target; }
  return settled ? target : value;
}

/** Mount transition: fade + gentle rise. Key it by stage to animate changes. */
export function FadeSlideIn({ children, duration = 340, offset = 14, style }: {
  children: React.ReactNode; duration?: number; offset?: number;
  style?: object;
}) {
  const reduced = useReducedMotion();
  const a = useRef(new Animated.Value(0)).current;
  // THE blank-screen guard: this wrapper holds an entire screen, so if the
  // fade never completes the app is empty. Never let that be permanent.
  const settled = useSettled(duration + SETTLE_SLACK_MS);
  useEffect(() => {
    if (reduced) { a.setValue(1); return; }
    Animated.timing(a, {
      toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver,
    }).start();
  }, [reduced]);
  const done = reduced || settled;
  return (
    <Animated.View
      testID="fade-slide-in"
      style={[
        done
          ? { flex: 1, opacity: 1, transform: [{ translateY: 0 }] }
          : { flex: 1, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }] },
        style,
      ]}
    >
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
  const reduced = useReducedMotion();
  const a = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  // Spring has no fixed duration; 900ms covers friction 6 / tension 60 settling.
  const settled = useSettled(900 + SETTLE_SLACK_MS);
  useEffect(() => {
    if (reduced) { a.setValue(1); w.setValue(1); return; }
    Animated.spring(a, { toValue: 1, friction: 6, tension: 60, useNativeDriver: nativeDriver }).start();
    Animated.timing(w, { toValue: 1, duration: 420, delay: 280, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [reduced]);
  const done = reduced || settled;
  return (
    <View testID="boot-splash" style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={done
        ? { opacity: 1, transform: [{ scale: 1 }], alignItems: 'center' }
        : {
            opacity: a,
            transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            alignItems: 'center',
          }}>
        <BrandMark theme={theme} size={104} />
      </Animated.View>
      {wordmark !== undefined && (
        <Animated.Text style={done
          ? { marginTop: 18, fontSize: t.largeTitle.size, fontWeight: t.largeTitle.weight, color: theme.label, opacity: 1, transform: [{ translateY: 0 }] }
          : {
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
