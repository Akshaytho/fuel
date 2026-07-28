import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Theme } from '@fuel/tokens';
import { ringArc } from './ringMath';
import { useTween } from './motion';

/**
 * Production Summary rings (design turn-4): three concentric arcs —
 * outer = calories (green), middle = protein (orange), inner = carbs/fat
 * (purple) — over faint same-color tracks. Center renders children.
 */
export interface TripleRingProps {
  theme: Theme;
  calories: number;  // progress 0..1+ each
  protein: number;
  inner: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}

export function TripleRing({
  theme, calories, protein, inner, size = 180, strokeWidth = 14, children,
}: TripleRingProps) {
  const gap = 5;
  // Rule 0b: arcs sweep to their values (staggered slightly, outer first).
  const aCal = useTween(calories, 700, 120);
  const aPro = useTween(protein, 700, 220);
  const aInn = useTween(inner, 700, 320);
  const rings = [
    { p: aCal, target: calories, color: theme.ringCalories, r: (size - strokeWidth) / 2 },
    { p: aPro, target: protein, color: theme.macroProtein, r: (size - strokeWidth) / 2 - (strokeWidth + gap) },
    { p: aInn, target: inner, color: theme.macroCarbs, r: (size - strokeWidth) / 2 - 2 * (strokeWidth + gap) },
  ];
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {rings.map(({ p, target, color, r }, i) => {
          const c = 2 * Math.PI * r;
          const { dash } = ringArc(p, c);
          const { over } = ringArc(target, c);
          const arcColor = i === 0 && over ? theme.danger : color;
          return (
            <React.Fragment key={i}>
              <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} opacity={0.16}
                strokeWidth={strokeWidth} fill="none" />
              {dash > 0 && (
                <Circle cx={size / 2} cy={size / 2} r={r} stroke={arcColor}
                  strokeWidth={strokeWidth} fill="none" strokeLinecap="round"
                  strokeDasharray={`${dash} ${c}`}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`} />
              )}
            </React.Fragment>
          );
        })}
      </Svg>
      {children}
    </View>
  );
}
