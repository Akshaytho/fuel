import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Theme, type as t } from '@fuel/tokens';

import { ringArc } from './ringMath';
import { useTween } from './motion';
export { ringArc };

export interface RingProps {
  theme: Theme;
  /** 0..1+ — values above 1 render full and switch to the danger color */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** center label, e.g. remaining kcal */
  value?: string;
  caption?: string;
}

export function Ring({
  theme, progress, size = 168, strokeWidth = 14, value, caption,
}: RingProps) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  // Rule 0b: the arc SWEEPS to its value; color reflects the true target.
  const animated = useTween(progress);
  const { dash } = ringArc(animated, c);
  const { over } = ringArc(progress, c);
  const color = over ? theme.danger : theme.ringCalories;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={theme.separator} strokeWidth={strokeWidth} fill="none"
        />
        {dash > 0 && (
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={strokeWidth} fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      {value !== undefined && (
        <Text style={{
          fontSize: t.title2.size, fontWeight: t.title2.weight, color: theme.label,
        }}>{value}</Text>
      )}
      {caption !== undefined && (
        <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>
          {caption}
        </Text>
      )}
    </View>
  );
}
