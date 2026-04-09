/**
 * ProjectionBarChart3D — Animated isometric 3D bar chart with Skia.
 *
 * Features:
 * - 3D rectangular prism bars (front, top, side faces with lighting)
 * - Dark checkered grid floor
 * - Optional line chart overlay for projection trend
 * - Staggered bar entrance animation (grow from floor)
 * - Line overlay draws itself in with trailing glow
 * - Past bars: green, future bars: blue, confidence band coloring
 * - Current month split bar (actual + projected)
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  LinearGradient,
  vec,
  Group,
  Rect,
  Circle,
  BlurMask,
} from '@shopify/react-native-skia';
import type { BarChartSeries } from './ProjectionBarChart';

// ── Config ──────────────────────────────────────────────────────────
const CHART_HEIGHT = 280;
const FLOOR_HEIGHT = 24;
const LABEL_AREA = 28;
const TOTAL_HEIGHT = CHART_HEIGHT + FLOOR_HEIGHT + LABEL_AREA;
const Y_AXIS_WIDTH = 40;
const ISO_DX = 8;
const ISO_DY = 6;
const BAR_RADIUS = 4;
const Y_TICK_COUNT = 5;

// Animation
const STAGGER_DELAY = 60;  // ms between each bar
const BAR_GROW_DURATION = 500;
const LINE_DRAW_DURATION = 800;
const LINE_DRAW_DELAY = 300; // starts after bars begin

const COLORS = {
  pastBar: '#34c759',
  pastBarLight: '#4ade80',
  pastBarSide: '#22a347',
  currentActual: '#34c759',
  currentProjected: '#7dd3fc',
  futureGreen: '#60a5fa',
  futureGreenLight: '#93c5fd',
  futureGreenSide: '#3b82f6',
  futureYellow: '#fbbf24',
  futureYellowLight: '#fcd34d',
  futureYellowSide: '#d97706',
  futureRed: '#f87171',
  futureRedLight: '#fca5a5',
  futureRedSide: '#dc2626',
  gridDark: '#0D0F14',
  gridLight: '#151821',
  gridLine: 'rgba(255,255,255,0.06)',
  labelText: '#7B8099',
  labelBoundary: '#60a5fa',
  yAxisText: '#7B8099',
  boundaryLine: '#2f9f56',
  lineOverlay: '#2f9f56',
  lineOverlayGlow: 'rgba(47,159,86,0.3)',
  lineDot: '#5bc47e',
  floorReflection: 'rgba(255,255,255,0.02)',
} as const;

function bandColors(band: 'green' | 'yellow' | 'red') {
  if (band === 'green') return { front: COLORS.futureGreen, top: COLORS.futureGreenLight, side: COLORS.futureGreenSide };
  if (band === 'red') return { front: COLORS.futureRed, top: COLORS.futureRedLight, side: COLORS.futureRedSide };
  return { front: COLORS.futureYellow, top: COLORS.futureYellowLight, side: COLORS.futureYellowSide };
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatYTick(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(Math.round(value));
}

function niceYTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [0];
  const range = max - min;
  const rough = range / Math.max(1, count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / magnitude;
  let nice: number;
  if (residual <= 1.5) nice = 1 * magnitude;
  else if (residual <= 3) nice = 2 * magnitude;
  else if (residual <= 7) nice = 5 * magnitude;
  else nice = 10 * magnitude;

  const niceMin = Math.floor(min / nice) * nice;
  const ticks: number[] = [];
  for (let v = niceMin; v <= max + nice * 0.01; v += nice) {
    ticks.push(v);
  }
  return ticks;
}

// ── 3D Bar Path Builders ────────────────────────────────────────────

function buildFrontFace(x: number, y: number, w: number, h: number, r: number): string {
  const top = y;
  const bottom = y + h;
  const left = x;
  const right = x + w;
  const cr = Math.min(r, w / 2, h / 2);
  return `M ${left} ${bottom} L ${left} ${top + cr} Q ${left} ${top} ${left + cr} ${top} L ${right - cr} ${top} Q ${right} ${top} ${right} ${top + cr} L ${right} ${bottom} Z`;
}

function buildTopFace(x: number, y: number, w: number, dx: number, dy: number, r: number): string {
  const cr = Math.min(r, w / 4);
  return `M ${x + cr} ${y} L ${x + dx + cr} ${y - dy} L ${x + w + dx} ${y - dy} L ${x + w} ${y} Z`;
}

function buildSideFace(x: number, y: number, w: number, h: number, dx: number, dy: number): string {
  const right = x + w;
  return `M ${right} ${y} L ${right + dx} ${y - dy} L ${right + dx} ${y + h - dy} L ${right} ${y + h} Z`;
}

// ── Animated Single Bar ─────────────────────────────────────────────

interface AnimatedBarProps {
  index: number;
  x: number;
  fullHeight: number;
  barWidth: number;
  chartBottom: number;
  frontColor: string;
  topColor: string;
  sideColor: string;
  splitFraction?: number;
  splitActualColor?: string;
  splitTopColor?: string;
  splitSideColor?: string;
  progress: Animated.Value;
}

function AnimatedBar({
  index,
  x,
  fullHeight,
  barWidth,
  chartBottom,
  frontColor,
  topColor,
  sideColor,
  splitFraction,
  splitActualColor,
  splitTopColor,
  splitSideColor,
  progress,
}: AnimatedBarProps) {
  // We'll use a listener to re-render the bar as progress changes
  const [currentProgress, setCurrentProgress] = React.useState(0);

  useEffect(() => {
    const id = progress.addListener(({ value }) => setCurrentProgress(value));
    return () => progress.removeListener(id);
  }, [progress]);

  const h = fullHeight * currentProgress;
  if (h < 1) return null;

  const y = chartBottom - h;
  const hasSplit = splitFraction != null && splitFraction > 0 && splitFraction < 1;

  if (hasSplit) {
    const actualH = h * splitFraction!;
    const projH = h - actualH;
    const paths: React.ReactNode[] = [];

    if (actualH > 0) {
      const fp = Skia.Path.MakeFromSVGString(buildFrontFace(x, y + projH, barWidth, actualH, 0));
      const sp = Skia.Path.MakeFromSVGString(buildSideFace(x, y + projH, barWidth, actualH, ISO_DX, ISO_DY));
      if (fp) paths.push(<Path key="af" path={fp} color={splitActualColor ?? frontColor} />);
      if (sp) paths.push(<Path key="as" path={sp} color={splitSideColor ?? sideColor} />);
    }
    if (projH > 0) {
      const fp = Skia.Path.MakeFromSVGString(buildFrontFace(x, y, barWidth, projH, BAR_RADIUS));
      const tp = Skia.Path.MakeFromSVGString(buildTopFace(x, y, barWidth, ISO_DX, ISO_DY, BAR_RADIUS));
      const sp = Skia.Path.MakeFromSVGString(buildSideFace(x, y, barWidth, projH, ISO_DX, ISO_DY));
      if (fp) paths.push(<Path key="pf" path={fp} color={frontColor} />);
      if (sp) paths.push(<Path key="ps" path={sp} color={sideColor} />);
      if (tp) paths.push(<Path key="pt" path={tp} color={splitTopColor ?? topColor} />);
    }
    return <Group>{paths}</Group>;
  }

  const fp = Skia.Path.MakeFromSVGString(buildFrontFace(x, y, barWidth, h, BAR_RADIUS));
  const tp = Skia.Path.MakeFromSVGString(buildTopFace(x, y, barWidth, ISO_DX, ISO_DY, BAR_RADIUS));
  const sp = Skia.Path.MakeFromSVGString(buildSideFace(x, y, barWidth, h, ISO_DX, ISO_DY));

  return (
    <Group>
      {sp && <Path path={sp} color={sideColor} />}
      {fp && <Path path={fp} color={frontColor} />}
      {tp && <Path path={tp} color={topColor} />}
    </Group>
  );
}

// ── Animated Line Overlay ───────────────────────────────────────────

function AnimatedLineOverlay({
  dots,
  progress,
}: {
  dots: Array<{ x: number; y: number }>;
  progress: Animated.Value;
}) {
  const [currentProgress, setCurrentProgress] = React.useState(0);

  useEffect(() => {
    const id = progress.addListener(({ value }) => setCurrentProgress(value));
    return () => progress.removeListener(id);
  }, [progress]);

  if (dots.length < 2 || currentProgress <= 0) return null;

  // How many segments to draw
  const totalSegments = dots.length - 1;
  const segmentsToShow = currentProgress * totalSegments;
  const fullSegments = Math.floor(segmentsToShow);
  const partialFraction = segmentsToShow - fullSegments;

  const path = Skia.Path.Make();
  path.moveTo(dots[0].x, dots[0].y);

  const visibleDots: Array<{ x: number; y: number }> = [dots[0]];

  for (let i = 0; i < Math.min(fullSegments, totalSegments); i++) {
    path.lineTo(dots[i + 1].x, dots[i + 1].y);
    visibleDots.push(dots[i + 1]);
  }

  // Partial segment
  if (fullSegments < totalSegments && partialFraction > 0) {
    const from = dots[fullSegments];
    const to = dots[fullSegments + 1];
    const px = from.x + (to.x - from.x) * partialFraction;
    const py = from.y + (to.y - from.y) * partialFraction;
    path.lineTo(px, py);
    visibleDots.push({ x: px, y: py });
  }

  return (
    <Group>
      {/* Glow */}
      <Group opacity={0.4}>
        <Path
          path={path}
          color={COLORS.lineOverlayGlow}
          style="stroke"
          strokeWidth={6}
          strokeCap="round"
          strokeJoin="round"
        >
          <BlurMask blur={4} style="normal" />
        </Path>
      </Group>
      {/* Line */}
      <Path
        path={path}
        color={COLORS.lineOverlay}
        style="stroke"
        strokeWidth={2}
        strokeCap="round"
        strokeJoin="round"
      />
      {/* Dots */}
      {visibleDots.map((dot, i) => (
        <React.Fragment key={`dot-${i}`}>
          <Circle cx={dot.x} cy={dot.y} r={4} color={COLORS.lineDot} />
          <Circle cx={dot.x} cy={dot.y} r={2} color="#fff" />
        </React.Fragment>
      ))}
    </Group>
  );
}

// ── Component ───────────────────────────────────────────────────────

export interface ProjectionBarChart3DProps {
  series: BarChartSeries;
  lineOverlay?: number[];
  width?: number;
  onBarLayout?: (index: number, x: number, y: number, width: number, height: number) => void;
  chartRef?: React.RefObject<View | null>;
}

export default function ProjectionBarChart3D({
  series,
  lineOverlay,
  width: widthOverride,
  onBarLayout,
  chartRef,
}: ProjectionBarChart3DProps) {
  const { labels, pastActual, futureProjected, futureBands, boundaryIndex, splitOffsetFraction, min, max } = series;
  const combined = useMemo(() => [...pastActual, ...futureProjected], [pastActual, futureProjected]);
  const barCount = combined.length;
  const firstFutureIndex = pastActual.length;

  const yTicks = useMemo(() => niceYTicks(min, max, Y_TICK_COUNT), [min, max]);
  const yMin = yTicks[0] ?? 0;
  const yMax = yTicks[yTicks.length - 1] ?? max;

  const viewportWidth = widthOverride ?? 360;
  // Fixed comfortable bar size — content scrolls if wider than viewport
  const barWidth = 28;
  const barGap = 8;
  const contentWidth = Y_AXIS_WIDTH + barCount * (barWidth + barGap) + ISO_DX + 8;
  const canvasWidth = Math.max(viewportWidth, contentWidth);
  const plotWidth = canvasWidth - Y_AXIS_WIDTH - ISO_DX - 8;
  const chartTop = 12;
  const chartBottom = CHART_HEIGHT;
  const plotHeight = chartBottom - chartTop;

  function valueToY(value: number): number {
    const range = Math.max(1, yMax - yMin);
    const ratio = Math.max(0, Math.min(1, (value - yMin) / range));
    return chartBottom - ratio * plotHeight;
  }

  function barX(index: number): number {
    return Y_AXIS_WIDTH + index * (barWidth + barGap);
  }

  // ── Animation values ─────────────────────────────────────────────

  const barAnimsRef = useRef<Animated.Value[]>([]);
  const lineAnimRef = useRef(new Animated.Value(0));
  const hasAnimatedRef = useRef(false);

  // Ensure we have enough anim values
  if (barAnimsRef.current.length !== barCount) {
    barAnimsRef.current = Array.from({ length: barCount }, () => new Animated.Value(0));
    hasAnimatedRef.current = false;
  }

  useEffect(() => {
    if (hasAnimatedRef.current || barCount === 0) return;
    hasAnimatedRef.current = true;

    const barAnims = barAnimsRef.current.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: BAR_GROW_DURATION,
        delay: i * STAGGER_DELAY,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: false,
      })
    );

    const lineAnim = Animated.timing(lineAnimRef.current, {
      toValue: 1,
      duration: LINE_DRAW_DURATION,
      delay: LINE_DRAW_DELAY + barCount * STAGGER_DELAY * 0.5,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });

    Animated.parallel([Animated.stagger(STAGGER_DELAY, barAnims), lineAnim]).start();
  }, [barCount]);

  // ── Static elements (floor, grid) ────────────────────────────────

  const { floorPath, gridLinesPath, lineDotsData, boundaryX } = useMemo(() => {
    const gridP = Skia.Path.Make();
    for (const tick of yTicks) {
      const ty = valueToY(tick);
      gridP.moveTo(Y_AXIS_WIDTH, ty);
      gridP.lineTo(canvasWidth - ISO_DX, ty);
    }

    const floorP = Skia.Path.Make();
    const floorY = chartBottom;
    const checkerSize = 16;
    const cols = Math.ceil(plotWidth / checkerSize);
    const rows = Math.ceil(FLOOR_HEIGHT / checkerSize);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          const cx = Y_AXIS_WIDTH + c * checkerSize;
          const cy = floorY + r * checkerSize;
          floorP.addRect(Skia.XYWHRect(cx, cy, checkerSize, checkerSize));
        }
      }
    }

    let dots: Array<{ x: number; y: number }> = [];
    const overlayData = lineOverlay ?? null;
    if (overlayData && overlayData.length > 0) {
      for (let i = 0; i < overlayData.length && i < barCount; i++) {
        const lx = barX(i) + barWidth / 2;
        const ly = valueToY(overlayData[i] ?? 0);
        dots.push({ x: lx, y: ly });
      }
    }

    const bx = barX(boundaryIndex) + barWidth * splitOffsetFraction;

    return { floorPath: floorP, gridLinesPath: gridP, lineDotsData: dots, boundaryX: bx };
  }, [yTicks, canvasWidth, barWidth, barGap, barCount, plotWidth, lineOverlay, boundaryIndex, splitOffsetFraction]);

  // ── Bar data ─────────────────────────────────────────────────────

  const barData = useMemo(() => {
    return combined.map((value, i) => {
      const isFuture = i >= firstFutureIndex;
      const isCurrentMonth = i === boundaryIndex;
      const x = barX(i);
      const y = valueToY(value);
      const h = chartBottom - y;

      let frontColor: string;
      let topColor: string;
      let sideColor: string;

      if (isFuture) {
        const futureIdx = i - firstFutureIndex;
        const bc = bandColors(futureBands[futureIdx] ?? 'green');
        frontColor = bc.front;
        topColor = bc.top;
        sideColor = bc.side;
      } else {
        frontColor = COLORS.pastBar;
        topColor = COLORS.pastBarLight;
        sideColor = COLORS.pastBarSide;
      }

      if (isCurrentMonth) {
        return {
          x, fullHeight: h, frontColor: COLORS.currentProjected, topColor: '#a5d8ff', sideColor: '#4a90d9',
          splitFraction: splitOffsetFraction,
          splitActualColor: COLORS.currentActual,
          splitTopColor: '#a5d8ff',
          splitSideColor: COLORS.pastBarSide,
        };
      }

      return { x, fullHeight: h, frontColor, topColor, sideColor };
    });
  }, [combined, firstFutureIndex, boundaryIndex, splitOffsetFraction, futureBands, barWidth, barGap]);

  // Initial scroll to show boundary (current month) roughly centered
  const initialScrollX = Math.max(0, barX(boundaryIndex) - viewportWidth / 2);

  return (
    <View ref={chartRef as any} style={styles.container}>
      {/* Pinned Y-axis labels */}
      <View style={styles.yAxisOverlay} pointerEvents="none">
        {yTicks.map((tick) => (
          <Text key={`y-${tick}`} style={[styles.yLabel, { top: valueToY(tick) - 6 + 4 }]}>
            {formatYTick(tick)}
          </Text>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: initialScrollX, y: 0 }}
        style={{ width: viewportWidth }}
        contentContainerStyle={{ width: canvasWidth, height: TOTAL_HEIGHT }}
      >
        <Canvas style={{ width: canvasWidth, height: TOTAL_HEIGHT }}>
          {/* Floor checkerboard */}
          <Path path={floorPath} color={COLORS.gridLight} />
          <Rect x={0} y={CHART_HEIGHT} width={canvasWidth} height={FLOOR_HEIGHT}>
            <LinearGradient
              start={vec(0, CHART_HEIGHT)}
              end={vec(0, CHART_HEIGHT + FLOOR_HEIGHT)}
              colors={[COLORS.floorReflection, 'transparent']}
            />
          </Rect>

          {/* Grid lines */}
          <Path path={gridLinesPath} color={COLORS.gridLine} style="stroke" strokeWidth={0.5} />

          {/* Animated bars */}
          {barData.map((bar, i) => (
            <AnimatedBar
              key={`bar-${i}`}
              index={i}
              x={bar.x}
              fullHeight={bar.fullHeight}
              barWidth={barWidth}
              chartBottom={chartBottom}
              frontColor={bar.frontColor}
              topColor={bar.topColor}
              sideColor={bar.sideColor}
              splitFraction={bar.splitFraction}
              splitActualColor={bar.splitActualColor}
              splitTopColor={bar.splitTopColor}
              splitSideColor={bar.splitSideColor}
              progress={barAnimsRef.current[i] ?? new Animated.Value(1)}
            />
          ))}

          {/* Boundary line */}
          <Rect x={boundaryX} y={chartTop} width={1.5} height={plotHeight} color={COLORS.boundaryLine} opacity={0.6} />

          {/* Animated line overlay */}
          {lineDotsData.length > 1 && (
            <AnimatedLineOverlay dots={lineDotsData} progress={lineAnimRef.current} />
          )}
        </Canvas>

        {/* X-axis labels (inside scroll content) */}
        <View style={[styles.xLabels, { top: CHART_HEIGHT + FLOOR_HEIGHT + 2, width: canvasWidth }]}>
          {labels.map((label, i) => (
            <Text
              key={`x-${i}`}
              style={[styles.xLabel, { left: barX(i), width: barWidth + barGap }, i === boundaryIndex && styles.xLabelBoundary]}
              numberOfLines={1}
            >
              {label}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    paddingTop: 4,
  },
  yAxisOverlay: {
    position: 'absolute',
    left: 0,
    top: 4,
    width: Y_AXIS_WIDTH,
    height: TOTAL_HEIGHT,
    zIndex: 2,
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    width: Y_AXIS_WIDTH - 6,
    textAlign: 'right',
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.yAxisText,
  },
  xLabels: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: LABEL_AREA,
  },
  xLabel: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.labelText,
    textAlign: 'center',
  },
  xLabelBoundary: {
    color: COLORS.labelBoundary,
    fontWeight: '800',
  },
});
