/**
 * Chart primitives for the Trends screen (spec 0009), per the dataviz skill:
 * 2px lines with round joins; dots r≥4 with a 2px surface ring; bars ≤24px
 * with a 4px rounded DATA end and a square baseline; hairline solid
 * gridlines one step off the surface; all text in text tokens, never the
 * series color; single hue per chart (the token set fails as a categorical
 * palette, so no chart uses two categorical hues).
 */
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { Theme, type as t } from '@fuel/tokens';
import { useTween } from './motion';
import { niceScale, yPos, rampOpacity, roundedTopBar, type Scale } from './chartMath';
export { niceScale, yPos, rampOpacity, roundedTopBar, type Scale } from './chartMath';

/* ---------- shared bits ---------- */

function useWidth(): [number, (e: { nativeEvent: { layout: { width: number } } }) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(e.nativeEvent.layout.width)];
}

function Grid({ theme, width, height, lines = 3 }: { theme: Theme; width: number; height: number; lines?: number }) {
  return (
    <>
      {Array.from({ length: lines }, (_, i) => {
        const y = (height / (lines + 1)) * (i + 1);
        return <Line key={i} x1={0} x2={width} y1={y} y2={y} stroke={theme.separator} strokeWidth={1} />;
      })}
    </>
  );
}

function XLabels({ theme, labels }: { theme: Theme; labels: readonly string[] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
      {labels.map((l, i) => (
        <Text key={`${l}-${i}`} style={{
          fontSize: t.caption.size, fontWeight: '600', letterSpacing: 0.6,
          color: theme.secondaryLabel,
        }}>{l.toUpperCase()}</Text>
      ))}
    </View>
  );
}

/* ---------- weight: raw dots (recessive) + smoothed line (blue) ---------- */

export interface TrendLineChartProps {
  theme: Theme;
  /** raw measurements, oldest→newest */
  raw: readonly { x: number; y: number }[];   // x = 0..1 fraction of width
  /** smoothed series, oldest→newest, same x convention */
  trend: readonly { x: number; y: number }[];
  height?: number;
  xLabels: readonly string[];
  testID?: string;
}

export function TrendLineChart({ theme, raw, trend, height = 150, xLabels, testID }: TrendLineChartProps) {
  const [width, onLayout] = useWidth();
  const scale = niceScale([...raw.map((p) => p.y), ...trend.map((p) => p.y)]);
  const sweep = useTween(1, 800, 150);                    // rule 0b: the line draws in
  const px = (f: number) => 6 + f * Math.max(0, width - 12); // inset so end dots don't clip
  const shown = trend.filter((p) => p.x <= sweep);
  const d = shown.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.x)} ${yPos(p.y, scale, height)}`).join(' ');
  const last = shown[shown.length - 1];
  return (
    <View testID={testID} onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Grid theme={theme} width={width} height={height} />
          {raw.map((p, i) => (
            // de-emphasis dots: tertiary gray, r=3.5, 2px surface ring
            <React.Fragment key={i}>
              <Circle cx={px(p.x)} cy={yPos(p.y, scale, height)} r={5.5} fill={theme.card} />
              <Circle cx={px(p.x)} cy={yPos(p.y, scale, height)} r={3.5} fill={theme.separator} />
            </React.Fragment>
          ))}
          {shown.length > 1 && (
            <Path d={d} stroke={theme.tint} strokeWidth={3} fill="none"
              strokeLinecap="round" strokeLinejoin="round" />
          )}
          {last && (
            <>
              <Circle cx={px(last.x)} cy={yPos(last.y, scale, height)} r={7.5} fill={theme.card} />
              <Circle cx={px(last.x)} cy={yPos(last.y, scale, height)} r={5.5} fill={theme.tint} />
            </>
          )}
        </Svg>
      )}
      <XLabels theme={theme} labels={xLabels} />
    </View>
  );
}

/* ---------- energy: daily bars vs target line, single hue ---------- */

export interface DayBarChartProps {
  theme: Theme;
  values: readonly number[];       // one per day, oldest→newest; 0 = not logged
  target: number;                  // reference line
  height?: number;
  xLabels: readonly string[];
  testID?: string;
}

export function DayBarChart({ theme, values, target, height = 150, xLabels, testID }: DayBarChartProps) {
  const [width, onLayout] = useWidth();
  const grow = useTween(1, 700, 150);
  const scale = niceScale([...values, target], 0.1);
  const s0 = { ...scale, min: 0 };                        // bars grow from a real zero baseline
  const n = values.length;
  const slot = n > 0 ? width / n : 0;
  const barW = Math.min(24, Math.max(4, slot - 2));       // ≤24px thick, 2px surface gap
  const targetY = yPos(target, s0, height);
  return (
    <View testID={testID} onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Grid theme={theme} width={width} height={height} />
          {values.map((v, i) => {
            if (v <= 0) return null;                      // a silent day is an empty slot, not a 0-bar
            const h = Math.max(4, (height - yPos(v, s0, height)) * grow);
            const x = i * slot + (slot - barW) / 2;
            const over = v > target && target > 0;
            return (
              <Path key={i} fill={over ? theme.danger : theme.success}
                d={roundedTopBar(x, height - h, barW, h, 4)} />
            );
          })}
          {target > 0 && (
            <Line x1={0} x2={width} y1={targetY} y2={targetY}
              stroke={theme.secondaryLabel} strokeWidth={1} strokeDasharray="1 0" />
          )}
        </Svg>
      )}
      <XLabels theme={theme} labels={xLabels} />
    </View>
  );
}

/* ---------- consistency: weekly bars, sequential opacity ramp ---------- */

export interface WeekBarChartProps {
  theme: Theme;
  values: readonly number[];       // hit-days per week, oldest→newest
  max: number;                     // 7
  height?: number;
  testID?: string;
}

export function WeekBarChart({ theme, values, max, height = 110, testID }: WeekBarChartProps) {
  const [width, onLayout] = useWidth();
  const grow = useTween(1, 700, 150);
  const n = values.length;
  const slot = n > 0 ? width / n : 0;
  const barW = Math.min(24, Math.max(6, slot - 8));
  return (
    <View testID={testID} onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {values.map((v, i) => {
            const x = i * slot + (slot - barW) / 2;
            if (v <= 0) {
              // an earned-nothing week still shows its SLOT — a faint stub —
              // so "no hits yet" reads as a state, not a broken empty plot
              return (
                <Path key={i} fill={theme.success} opacity={0.1}
                  d={roundedTopBar(x, height - 6, barW, 6, 3)} />
              );
            }
            const h = Math.max(6, (v / Math.max(1, max)) * (height - 8) * grow);
            return (
              <Path key={i} fill={theme.success} opacity={rampOpacity(v, max)}
                d={roundedTopBar(x, height - h, barW, h, 4)} />
            );
          })}
        </Svg>
      )}
    </View>
  );
}
