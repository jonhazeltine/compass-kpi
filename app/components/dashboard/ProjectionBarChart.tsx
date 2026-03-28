/**
 * ProjectionBarChart — Monthly bar chart for KPI projections.
 *
 * Past months: green bars (actual GCI).
 * Current month: split bar (actual + projected remainder).
 * Future months: blue bars, tinted by confidence band.
 * Bars animate height when coin impacts land.
 *
 * Uses core RN Animated API (no Reanimated) for native module compatibility.
 */
import React, { useCallback, useMemo } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';

// ── Types ────────────────────────────────────────────────────────
export interface BarChartSeries {
  labels: string[];
  pastActual: number[];
  futureProjected: number[];
  futureBands: Array<'green' | 'yellow' | 'red'>;
  boundaryIndex: number;
  splitOffsetFraction: number;
  min: number;
  max: number;
  yTicks: number[];
}

export interface ProjectionBarChartProps {
  series: BarChartSeries;
  /** Animated.Values for bar height bumps — keyed by month index */
  barBumpByIndex?: Map<number, Animated.Value>;
  /** Callback to measure bar positions for coin targeting */
  onBarLayout?: (index: number, x: number, y: number, width: number, height: number) => void;
  /** Ref to measure the chart container position */
  chartRef?: React.RefObject<View | null>;
}

// ── Constants ────────────────────────────────────────────────────
const BAR_CHART_HEIGHT = 180;
const BAR_WIDTH = 24;
const BAR_GAP = 6;
const BAR_RADIUS = 6;
const LABEL_HEIGHT = 20;
const Y_AXIS_WIDTH = 44;

const COLORS = {
  pastBar: '#34c759',
  pastBarBorder: '#2aad4a',
  currentActual: '#34c759',
  currentProjected: '#7dd3fc',
  futureGreen: '#60a5fa',
  futureYellow: '#fbbf24',
  futureRed: '#f87171',
  futureBorder: '#4a90d9',
  boundaryLine: '#94a3b8',
  gridLine: '#e5e7eb',
  labelText: '#6b7280',
  labelBoundary: '#1e40af',
  yAxisText: '#9ca3af',
  barGlow: 'rgba(96, 165, 250, 0.25)',
} as const;

function bandColor(band: 'green' | 'yellow' | 'red'): string {
  if (band === 'green') return COLORS.futureGreen;
  if (band === 'red') return COLORS.futureRed;
  return COLORS.futureYellow;
}

// ── Single Bar ───────────────────────────────────────────────────
interface BarProps {
  index: number;
  value: number;
  maxValue: number;
  minValue: number;
  color: string;
  borderColor?: string;
  label: string;
  isBoundary: boolean;
  isFuture: boolean;
  bump?: Animated.Value;
  splitFraction?: number;
  splitActualColor?: string;
  onLayout?: (index: number, x: number, y: number, width: number, height: number) => void;
}

function Bar({
  index,
  value,
  maxValue,
  minValue,
  color,
  borderColor,
  label,
  isBoundary,
  isFuture,
  bump,
  splitFraction,
  splitActualColor,
  onLayout,
}: BarProps) {
  const range = Math.max(1, maxValue - minValue);
  const baseRatio = Math.max(0, Math.min(1, (value - minValue) / range));
  const baseHeight = Math.max(3, baseRatio * BAR_CHART_HEIGHT);

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => {
      if (onLayout) {
        const { x, y, width, height } = e.nativeEvent.layout;
        onLayout(index, x, y, width, height);
      }
    },
    [index, onLayout],
  );

  const hasSplit = splitFraction != null && splitFraction > 0 && splitFraction < 1;
  const actualHeight = hasSplit ? baseHeight * splitFraction! : 0;
  const projectedHeight = hasSplit ? baseHeight - actualHeight : 0;

  // If bump exists, add it to height; otherwise static height
  const heightStyle = bump
    ? { height: Animated.add(baseHeight, bump) }
    : { height: baseHeight };

  return (
    <View style={styles.barColumn} onLayout={handleLayout}>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barBody, heightStyle, { backgroundColor: color }]}>
          {borderColor && <View style={[styles.barBorder, { borderColor }]} />}

          {hasSplit && (
            <>
              <View
                style={[
                  styles.barSplitActual,
                  { height: actualHeight, backgroundColor: splitActualColor ?? COLORS.currentActual },
                ]}
              />
              <View
                style={[
                  styles.barSplitProjected,
                  { height: projectedHeight, backgroundColor: color },
                ]}
              />
            </>
          )}

          {isFuture && <View style={styles.barGlow} />}
        </Animated.View>
      </View>

      <Text
        style={[styles.barLabel, isBoundary && styles.barLabelBoundary]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Main Chart ───────────────────────────────────────────────────
export default function ProjectionBarChart({
  series,
  barBumpByIndex,
  onBarLayout,
  chartRef,
}: ProjectionBarChartProps) {
  const { labels, pastActual, futureProjected, futureBands, boundaryIndex, splitOffsetFraction, min, max, yTicks } =
    series;

  const combined = useMemo(() => [...pastActual, ...futureProjected], [pastActual, futureProjected]);
  const firstFutureIndex = pastActual.length;

  return (
    <View ref={chartRef as any} style={styles.chartContainer}>
      <View style={styles.yAxis}>
        {yTicks.map((tick) => (
          <Text key={tick} style={styles.yAxisLabel}>
            {tick >= 1000 ? `${Math.round(tick / 1000)}M` : `${tick}K`}
          </Text>
        ))}
      </View>

      <View style={styles.chartArea}>
        <View style={styles.gridLines}>
          {yTicks.map((tick) => (
            <View key={tick} style={styles.gridLine} />
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.barsContainer}
        >
          {combined.map((value, idx) => {
            const isFuture = idx >= firstFutureIndex;
            const isBoundary = idx === boundaryIndex;
            const isCurrentMonth = idx === boundaryIndex;

            let color: string;
            let border: string | undefined;

            if (isFuture) {
              const futureIdx = idx - firstFutureIndex;
              color = bandColor(futureBands[futureIdx] ?? 'yellow');
              border = COLORS.futureBorder;
            } else {
              color = COLORS.pastBar;
              border = COLORS.pastBarBorder;
            }

            return (
              <Bar
                key={`bar-${idx}`}
                index={idx}
                value={value}
                maxValue={max}
                minValue={min}
                color={isCurrentMonth ? COLORS.currentProjected : color}
                borderColor={border}
                label={labels[idx] ?? ''}
                isBoundary={isBoundary}
                isFuture={isFuture}
                bump={barBumpByIndex?.get(idx)}
                splitFraction={isCurrentMonth ? splitOffsetFraction : undefined}
                splitActualColor={COLORS.currentActual}
                onLayout={onBarLayout}
              />
            );
          })}
        </ScrollView>

        <View
          style={[
            styles.boundaryLine,
            {
              left:
                Y_AXIS_WIDTH +
                boundaryIndex * (BAR_WIDTH + BAR_GAP) +
                BAR_WIDTH * splitOffsetFraction,
            },
          ]}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 4,
  },
  yAxis: {
    width: Y_AXIS_WIDTH,
    height: BAR_CHART_HEIGHT,
    justifyContent: 'space-between',
    paddingRight: 6,
  },
  yAxisLabel: {
    fontSize: 10,
    color: COLORS.yAxisText,
    textAlign: 'right',
    fontWeight: '500',
  },
  chartArea: {
    flex: 1,
    height: BAR_CHART_HEIGHT + LABEL_HEIGHT,
  },
  gridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BAR_CHART_HEIGHT,
    justifyContent: 'space-between',
  },
  gridLine: {
    height: 1,
    backgroundColor: COLORS.gridLine,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: BAR_CHART_HEIGHT,
    paddingHorizontal: 4,
    gap: BAR_GAP,
  },
  barColumn: {
    width: BAR_WIDTH,
    alignItems: 'center',
  },
  barTrack: {
    width: BAR_WIDTH,
    height: BAR_CHART_HEIGHT,
    justifyContent: 'flex-end',
  },
  barBody: {
    width: BAR_WIDTH,
    borderTopLeftRadius: BAR_RADIUS,
    borderTopRightRadius: BAR_RADIUS,
    overflow: 'hidden',
    minHeight: 3,
  },
  barBorder: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: BAR_RADIUS,
    borderTopRightRadius: BAR_RADIUS,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  barGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.barGlow,
    borderTopLeftRadius: BAR_RADIUS,
    borderTopRightRadius: BAR_RADIUS,
  },
  barSplitActual: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  barSplitProjected: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BAR_RADIUS,
    borderTopRightRadius: BAR_RADIUS,
  },
  barLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.labelText,
    marginTop: 4,
    textAlign: 'center',
  },
  barLabelBoundary: {
    color: COLORS.labelBoundary,
    fontWeight: '800',
  },
  boundaryLine: {
    position: 'absolute',
    top: 0,
    width: 1.5,
    height: BAR_CHART_HEIGHT,
    backgroundColor: COLORS.boundaryLine,
    opacity: 0.5,
  },
});
