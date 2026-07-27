import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

/** Line icons matching the production design's empty-state action rows. */
export function ScanIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 8 V6 a2 2 0 0 1 2-2 h2 M16 4 h2 a2 2 0 0 1 2 2 v2 M20 16 v2 a2 2 0 0 1-2 2 h-2 M8 20 H6 a2 2 0 0 1-2-2 v-2"
        stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <Rect x="9" y="9" width="6" height="6" rx="1.5" fill={color} />
    </Svg>
  );
}

export function ChatIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 4 C7 4 3.5 7.2 3.5 11.2 C3.5 13.4 4.6 15.4 6.4 16.7 L5.5 20 L9.2 18.1 C10.1 18.3 11 18.4 12 18.4 C17 18.4 20.5 15.2 20.5 11.2 C20.5 7.2 17 4 12 4 Z"
        stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
      <Circle cx="8.8" cy="11.2" r="1.1" fill={color} />
      <Circle cx="12" cy="11.2" r="1.1" fill={color} />
      <Circle cx="15.2" cy="11.2" r="1.1" fill={color} />
    </Svg>
  );
}

export function FlameIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3 C12 3 6.5 8 6.5 13 C6.5 16.6 9 19.5 12 19.5 C15 19.5 17.5 16.6 17.5 13 C17.5 10.8 16.3 8.6 15 7 C14.7 8.3 14 9.2 13 9.6 C13.2 7.5 12.8 4.9 12 3 Z"
        stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
    </Svg>
  );
}
