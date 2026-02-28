import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type KpiType = 'PC' | 'GP' | 'VP' | 'Actual' | 'Pipeline_Anchor' | 'Custom';

type LoggableKpi = {
  id: string;
  name: string;
  slug?: string;
  type: KpiType;
  requires_direct_value_input: boolean;
  pc_weight?: number;
  gp_value?: number | null;
  vp_value?: number | null;
};

type RecentLog = {
  id: string;
  kpi_id: string;
  kpi_name?: string;
  event_timestamp: string;
  pc_generated: number;
  actual_gci_delta: number;
  points_generated: number;
};

type ChartMonth = { month_start: string; value: number };

type DashPayload = {
  projection: {
    pc_90d: number;
    pc_next_365?: number;
    projected_gci_ytd?: number;
    confidence: {
      score: number;
      band: 'green' | 'yellow' | 'red';
      components?: {
        historical_accuracy_score: number;
        pipeline_health_score: number;
        inactivity_score: number;
        total_actual_gci_last_12m?: number;
      };
    };
  };
  actuals: {
    actual_gci: number;
    actual_gci_last_365?: number;
    actual_gci_ytd?: number;
    deals_closed: number;
  };
  points: { gp: number; vp: number };
  activity: { total_logs: number; active_days: number };
  loggable_kpis: LoggableKpi[];
  recent_logs?: RecentLog[];
  chart?: {
    past_actual_6m: ChartMonth[];
    future_projected_12m: ChartMonth[];
    confidence_band_by_month?: Array<'green' | 'yellow' | 'red'>;
    boundary_index?: number;
  };
};

type ChallengeRow = {
  id: string;
  name: string;
  is_active?: boolean | null;
  start_at?: string | null;
  end_at?: string | null;
  my_participation?: {
    progress_percent?: number | null;
    joined_at?: string | null;
  } | null;
  leaderboard_top?: Array<{
    user_id: string;
    activity_count: number;
    progress_percent: number;
    rank?: number | null;
    display_name?: string | null;
  }> | null;
};

type ReportsTabV2Props = {
  payload: DashPayload | null;
  challengeApiRows: ChallengeRow[] | null;
  runtimeMeUserId: string | null;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

type TimeRange = '7d' | '30d' | '90d';
const TIME_RANGES: TimeRange[] = ['7d', '30d', '90d'];
const RANGE_LABEL: Record<TimeRange, string> = { '7d': '7 Days', '30d': '30 Days', '90d': '90 Days' };
const RANGE_DAYS: Record<TimeRange, number> = { '7d': 7, '30d': 30, '90d': 90 };

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtUsd(v: number) {
  const safe = Number.isFinite(v) ? v : 0;
  return `$${safe.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtNum(v: number) {
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtPct(v: number) {
  const safe = Number.isFinite(v) ? v : 0;
  return `${safe >= 0 ? '+' : ''}${safe.toFixed(1)}%`;
}
function kpiTypeTint(type: KpiType) {
  if (type === 'PC') return '#e4f7ea';
  if (type === 'GP') return '#e5efff';
  if (type === 'VP') return '#fff0e2';
  if (type === 'Custom') return '#f3e8ff';
  return '#eceff3';
}
function kpiTypeAccent(type: KpiType) {
  if (type === 'PC') return '#2f9f56';
  if (type === 'GP') return '#2158d5';
  if (type === 'VP') return '#e38a1f';
  if (type === 'Custom') return '#7a4cc8';
  return '#48505f';
}


// ─── Data Derivation Hooks ─────────────────────────────────────────────────────

function useLoggingTrend(payload: DashPayload | null, range: TimeRange) {
  return useMemo(() => {
    const logs = payload?.recent_logs ?? [];
    if (logs.length === 0) return { current: 0, prior: 0, delta: 0, deltaPct: 0, direction: 'flat' as const };
    const now = Date.now();
    const days = RANGE_DAYS[range];
    const cutoff = now - days * 86400_000;
    const priorCutoff = cutoff - days * 86400_000;
    const current = logs.filter((l) => new Date(l.event_timestamp).getTime() >= cutoff).length;
    const prior = logs.filter((l) => {
      const t = new Date(l.event_timestamp).getTime();
      return t >= priorCutoff && t < cutoff;
    }).length;
    const delta = current - prior;
    const deltaPct = prior > 0 ? ((current - prior) / prior) * 100 : current > 0 ? 100 : 0;
    const direction = delta > 0 ? ('up' as const) : delta < 0 ? ('down' as const) : ('flat' as const);
    return { current, prior, delta, deltaPct, direction };
  }, [payload?.recent_logs, range]);
}

function useTopKpis(payload: DashPayload | null, range: TimeRange) {
  return useMemo(() => {
    const logs = payload?.recent_logs ?? [];
    const kpis = payload?.loggable_kpis ?? [];
    const kpiMap = new Map(kpis.map((k) => [k.id, k]));
    const now = Date.now();
    const days = RANGE_DAYS[range];
    const cutoff = now - days * 86400_000;
    const priorCutoff = cutoff - days * 86400_000;
    const countsCurrent = new Map<string, number>();
    const countsPrior = new Map<string, number>();
    for (const log of logs) {
      const t = new Date(log.event_timestamp).getTime();
      const id = log.kpi_id;
      if (t >= cutoff) countsCurrent.set(id, (countsCurrent.get(id) ?? 0) + 1);
      else if (t >= priorCutoff) countsPrior.set(id, (countsPrior.get(id) ?? 0) + 1);
    }
    const totalCurrent = [...countsCurrent.values()].reduce((a, b) => a + b, 0);
    const ranked = [...countsCurrent.entries()]
      .map(([id, count]) => {
        const kpi = kpiMap.get(id);
        const priorCount = countsPrior.get(id) ?? 0;
        const trendDelta = count - priorCount;
        return {
          id,
          name: kpi?.name ?? 'KPI',
          type: (kpi?.type ?? 'PC') as KpiType,
          count,
          share: totalCurrent > 0 ? (count / totalCurrent) * 100 : 0,
          trend: trendDelta > 0 ? ('up' as const) : trendDelta < 0 ? ('down' as const) : ('flat' as const),
          trendDelta,
        };
      })
      .sort((a, b) => b.count - a.count);
    return ranked.slice(0, 6);
  }, [payload?.recent_logs, payload?.loggable_kpis, range]);
}

function useGciDirection(payload: DashPayload | null) {
  return useMemo(() => {
    const pastRows = payload?.chart?.past_actual_6m ?? [];
    const futureRows = payload?.chart?.future_projected_12m ?? [];
    const actualYtd = Number(payload?.actuals.actual_gci_ytd ?? payload?.actuals.actual_gci ?? 0);
    const actualLast365 = Number(
      payload?.actuals.actual_gci_last_365 ??
        payload?.projection.confidence.components?.total_actual_gci_last_12m ??
        payload?.actuals.actual_gci ??
        0,
    );
    const projected90 =
      futureRows.slice(0, 3).reduce((sum, r) => sum + Number(r.value ?? 0), 0) ||
      Number(payload?.projection.pc_90d ?? 0);
    const projected365 =
      Number(payload?.projection.pc_next_365 ?? 0) ||
      futureRows.reduce((sum, r) => sum + Number(r.value ?? 0), 0) ||
      projected90 * 4;

    // period-over-period for actuals: compare last 3 months vs prior 3
    const pastValues = pastRows.map((r) => Number(r.value ?? 0));
    const recentHalf = pastValues.slice(-3);
    const olderHalf = pastValues.slice(0, 3);
    const recentActualSum = recentHalf.reduce((a, b) => a + b, 0);
    const olderActualSum = olderHalf.reduce((a, b) => a + b, 0);
    const actualDelta =
      olderActualSum > 0 ? ((recentActualSum - olderActualSum) / olderActualSum) * 100 : 0;
    const actualDirection: 'up' | 'down' | 'flat' =
      actualDelta > 2 ? 'up' : actualDelta < -2 ? 'down' : 'flat';

    // projection slope
    const futureValues = futureRows.map((r) => Number(r.value ?? 0));
    const earlyFuture = futureValues.slice(0, 3).reduce((a, b) => a + b, 0);
    const lateFuture = futureValues.slice(3, 6).reduce((a, b) => a + b, 0);
    const projectedDelta = earlyFuture > 0 ? ((lateFuture - earlyFuture) / earlyFuture) * 100 : 0;
    const projectedDirection: 'up' | 'down' | 'flat' =
      projectedDelta > 2 ? 'up' : projectedDelta < -2 ? 'down' : 'flat';

    const confidenceBand = payload?.projection.confidence.band ?? 'yellow';
    const confidenceScore = payload?.projection.confidence.score ?? 0;

    return {
      actualYtd,
      actualLast365,
      projected90,
      projected365,
      actualDelta,
      actualDirection,
      projectedDelta,
      projectedDirection,
      confidenceBand,
      confidenceScore,
      pastValues,
    };
  }, [payload]);
}

function useChallengeSummary(challengeApiRows: ChallengeRow[] | null, runtimeMeUserId: string | null) {
  return useMemo(() => {
    const rows = challengeApiRows ?? [];
    const now = new Date();
    const active = rows.filter((c) => c.is_active);
    const joined = rows.filter((c) => c.my_participation);
    const completedCount = rows.filter((c) => {
      const end = c.end_at ? new Date(c.end_at) : null;
      return end && end < now;
    }).length;

    // find my best rank across all challenges
    let bestRank: number | null = null;
    let bestPct: number | null = null;
    for (const ch of rows) {
      const lb = ch.leaderboard_top ?? [];
      const me = lb.find((e) => e.user_id === runtimeMeUserId);
      if (me) {
        const rank = me.rank ?? lb.indexOf(me) + 1;
        if (bestRank === null || rank < bestRank) {
          bestRank = rank;
          bestPct = me.progress_percent;
        }
      }
    }

    const avgProgress =
      joined.length > 0
        ? joined.reduce((s, c) => s + Number(c.my_participation?.progress_percent ?? 0), 0) / joined.length
        : 0;

    return {
      activeCount: active.length,
      joinedCount: joined.length,
      completedCount,
      bestRank,
      bestPct,
      avgProgress,
      totalChallenges: rows.length,
    };
  }, [challengeApiRows, runtimeMeUserId]);
}

function usePreferredKpiSpotlight(payload: DashPayload | null, range: TimeRange) {
  return useMemo(() => {
    const logs = payload?.recent_logs ?? [];
    const kpis = payload?.loggable_kpis ?? [];
    const kpiMap = new Map(kpis.map((k) => [k.id, k]));
    const now = Date.now();
    const days = RANGE_DAYS[range];
    const cutoff = now - days * 86400_000;

    const countsByType = new Map<KpiType, Map<string, number>>();
    for (const log of logs) {
      const t = new Date(log.event_timestamp).getTime();
      if (t < cutoff) continue;
      const kpi = kpiMap.get(log.kpi_id);
      if (!kpi) continue;
      const type = kpi.type;
      if (!countsByType.has(type)) countsByType.set(type, new Map());
      const typeMap = countsByType.get(type)!;
      typeMap.set(kpi.id, (typeMap.get(kpi.id) ?? 0) + 1);
    }

    const spotlight: Array<{
      type: KpiType;
      kpi: LoggableKpi;
      count: number;
      pcGenerated: number;
    }> = [];

    for (const t of ['PC', 'GP', 'VP'] as KpiType[]) {
      const typeMap = countsByType.get(t);
      if (!typeMap || typeMap.size === 0) {
        // fallback: pick first available KPI of this type
        const fallback = kpis.find((k) => k.type === t);
        if (fallback) spotlight.push({ type: t, kpi: fallback, count: 0, pcGenerated: 0 });
        continue;
      }
      const topId = [...typeMap.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const topKpi = kpiMap.get(topId);
      if (!topKpi) continue;
      const pcGen = logs
        .filter((l) => l.kpi_id === topId && new Date(l.event_timestamp).getTime() >= cutoff)
        .reduce((s, l) => s + Number(l.pc_generated ?? 0), 0);
      spotlight.push({ type: t, kpi: topKpi, count: typeMap.get(topId) ?? 0, pcGenerated: pcGen });
    }

    return spotlight;
  }, [payload?.recent_logs, payload?.loggable_kpis, range]);
}

function useAiObservations(
  payload: DashPayload | null,
  topKpis: ReturnType<typeof useTopKpis>,
  gci: ReturnType<typeof useGciDirection>,
  challengeSummary: ReturnType<typeof useChallengeSummary>,
  loggingTrend: ReturnType<typeof useLoggingTrend>,
) {
  return useMemo(() => {
    const observations: string[] = [];
    const recommendations: string[] = [];

    // Logging trend observation
    if (loggingTrend.direction === 'up') {
      observations.push(
        `Your logging activity is trending upward with ${fmtNum(loggingTrend.current)} entries in the selected period — a ${Math.abs(loggingTrend.deltaPct).toFixed(0)}% increase.`,
      );
    } else if (loggingTrend.direction === 'down') {
      observations.push(
        `Logging activity has decreased by ${Math.abs(loggingTrend.deltaPct).toFixed(0)}% compared to the prior period. Consistency drives projection accuracy.`,
      );
      recommendations.push('Aim to log at least one activity daily to maintain projection accuracy.');
    } else {
      observations.push(`Logging activity is steady with ${fmtNum(loggingTrend.current)} entries this period.`);
    }

    // Top KPI observation
    if (topKpis.length > 0) {
      const top = topKpis[0];
      observations.push(
        `"${top.name}" is your most logged KPI at ${top.share.toFixed(0)}% of all activity (${fmtNum(top.count)} logs).`,
      );
      if (topKpis.length >= 3 && topKpis[2].share < 10) {
        recommendations.push(
          `Consider diversifying across KPI types. "${topKpis[2].name}" accounts for only ${topKpis[2].share.toFixed(0)}% of activity.`,
        );
      }
    }

    // GCI observation
    if (gci.actualDirection === 'up') {
      observations.push(`Actual GCI is trending positively — recent months show a ${gci.actualDelta.toFixed(0)}% improvement.`);
    } else if (gci.actualDirection === 'down') {
      observations.push(`Actual GCI has dipped ${Math.abs(gci.actualDelta).toFixed(0)}% over recent months.`);
      recommendations.push('Focus on high-conversion activities to reverse the GCI dip.');
    }

    // Projection confidence
    if (gci.confidenceBand === 'green') {
      observations.push(`Projection confidence is strong (${(gci.confidenceScore * 100).toFixed(0)}%) — keep up the consistent activity.`);
    } else if (gci.confidenceBand === 'red') {
      recommendations.push('Projection confidence is low. Increase logging frequency and pipeline activity to improve accuracy.');
    }

    // Challenge observation
    if (challengeSummary.joinedCount > 0) {
      observations.push(
        `You're participating in ${challengeSummary.joinedCount} challenge${challengeSummary.joinedCount > 1 ? 's' : ''} with an average progress of ${challengeSummary.avgProgress.toFixed(0)}%.`,
      );
      if (challengeSummary.bestRank !== null && challengeSummary.bestRank <= 3) {
        observations.push(`You're ranked #${challengeSummary.bestRank} on a leaderboard — great position!`);
      }
    } else if (challengeSummary.activeCount > 0) {
      recommendations.push(`There ${challengeSummary.activeCount === 1 ? 'is' : 'are'} ${challengeSummary.activeCount} active challenge${challengeSummary.activeCount > 1 ? 's' : ''}. Consider joining to boost engagement.`);
    }

    return { observations, recommendations };
  }, [loggingTrend, topKpis, gci, challengeSummary]);
}

// ─── KPI Activity Direction Indicator ──────────────────────────────────────────

function ActivityDirectionHero({
  direction,
  deltaPct,
  current,
  prior,
  rangeDays,
}: {
  direction: 'up' | 'down' | 'flat';
  deltaPct: number;
  current: number;
  prior: number;
  rangeDays: number;
}) {
  const bg =
    direction === 'up' ? '#eaf7ee' : direction === 'down' ? '#fdf0ef' : '#f2f4f8';
  const accent =
    direction === 'up' ? '#1a7a3a' : direction === 'down' ? '#b83227' : '#636b78';
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  const label =
    direction === 'up'
      ? 'Trending Up'
      : direction === 'down'
        ? 'Trending Down'
        : 'Maintaining';
  const sub =
    direction === 'flat'
      ? `Steady at ${fmtNum(current)} logs over ${rangeDays}d`
      : `${fmtNum(current)} logs vs ${fmtNum(prior)} prior ${rangeDays}d`;

  return (
    <View style={[sty.directionHeroWrap, { backgroundColor: bg }]}>
      <Text style={[sty.directionArrow, { color: accent }]}>{arrow}</Text>
      <Text style={[sty.directionLabel, { color: accent }]}>{label}</Text>
      <Text style={sty.directionSub}>{sub}</Text>
    </View>
  );
}

// ─── Stagger Animation Hook ───────────────────────────────────────────────────

function useStaggerFadeIn(count: number) {
  const anims = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 350,
        delay: i * 80,
        useNativeDriver: true,
      }),
    );
    Animated.stagger(80, animations).start();
  }, []);
  return anims;
}

// ─── Section Components ────────────────────────────────────────────────────────

function SectionCard({
  children,
  fadeAnim,
}: {
  children: React.ReactNode;
  fadeAnim?: Animated.Value;
}) {
  const style = fadeAnim
    ? [sty.sectionCard, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]
    : [sty.sectionCard];
  return <Animated.View style={style}>{children}</Animated.View>;
}

function DeltaBadge({ value, direction }: { value: string; direction: 'up' | 'down' | 'flat' }) {
  const bg = direction === 'up' ? '#e4f7ea' : direction === 'down' ? '#fce8e8' : '#f0f2f5';
  const color = direction === 'up' ? '#1a7a3a' : direction === 'down' ? '#c0392b' : '#636b78';
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  return (
    <View style={[sty.deltaBadge, { backgroundColor: bg }]}>
      <Text style={[sty.deltaBadgeText, { color }]}>
        {arrow} {value}
      </Text>
    </View>
  );
}

function TimeChips({
  selected,
  onSelect,
}: {
  selected: TimeRange;
  onSelect: (r: TimeRange) => void;
}) {
  return (
    <View style={sty.timeChipRow}>
      {TIME_RANGES.map((r) => (
        <TouchableOpacity
          key={r}
          style={[sty.timeChip, selected === r && sty.timeChipActive]}
          onPress={() => onSelect(r)}
          activeOpacity={0.7}
        >
          <Text style={[sty.timeChipText, selected === r && sty.timeChipTextActive]}>
            {RANGE_LABEL[r]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ReportsTabV2({ payload, challengeApiRows, runtimeMeUserId }: ReportsTabV2Props) {
  const [range, setRange] = useState<TimeRange>('30d');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const fadeAnims = useStaggerFadeIn(7);

  const loggingTrend = useLoggingTrend(payload, range);
  const topKpis = useTopKpis(payload, range);
  const gci = useGciDirection(payload);
  const challengeSummary = useChallengeSummary(challengeApiRows, runtimeMeUserId);
  const spotlight = usePreferredKpiSpotlight(payload, range);
  const ai = useAiObservations(payload, topKpis, gci, challengeSummary, loggingTrend);

  const toggleCard = useCallback(
    (id: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedCard((prev) => (prev === id ? null : id));
    },
    [],
  );

  const totalLogs = payload?.activity.total_logs ?? 0;
  const activeDays = payload?.activity.active_days ?? 0;
  const gpPoints = payload?.points.gp ?? 0;
  const vpPoints = payload?.points.vp ?? 0;

  // ── No data fallback ──
  if (!payload) {
    return (
      <View style={sty.emptyWrap}>
        <Text style={sty.emptyIcon}>📊</Text>
        <Text style={sty.emptyTitle}>No report data yet</Text>
        <Text style={sty.emptySub}>Log your first KPI activity to see analytics here.</Text>
      </View>
    );
  }

  return (
    <View style={sty.container}>
      {/* ── 1. Hero Performance Canvas ─────────────────────────────── */}
      <SectionCard fadeAnim={fadeAnims[0]}>
        <View style={sty.heroHeader}>
          <Text style={sty.heroEyebrow}>PERFORMANCE OVERVIEW</Text>
          <TimeChips selected={range} onSelect={setRange} />
        </View>
        <View style={sty.heroMetricRow}>
          <View style={sty.heroMetricBlock}>
            <Text style={sty.heroMetricValue}>{fmtNum(loggingTrend.current)}</Text>
            <Text style={sty.heroMetricLabel}>Logs</Text>
          </View>
          <View style={sty.heroMetricBlock}>
            <Text style={sty.heroMetricValue}>{fmtNum(activeDays)}</Text>
            <Text style={sty.heroMetricLabel}>Active Days</Text>
          </View>
          <View style={sty.heroMetricBlock}>
            <DeltaBadge
              value={`${Math.abs(loggingTrend.deltaPct).toFixed(0)}%`}
              direction={loggingTrend.direction}
            />
            <Text style={sty.heroMetricLabel}>vs Prior</Text>
          </View>
        </View>
        {/* Activity direction indicator */}
        <ActivityDirectionHero
          direction={loggingTrend.direction}
          deltaPct={loggingTrend.deltaPct}
          current={loggingTrend.current}
          prior={loggingTrend.prior}
          rangeDays={RANGE_DAYS[range]}
        />
      </SectionCard>

      {/* ── 2. Most Logged KPIs ────────────────────────────────────── */}
      <SectionCard fadeAnim={fadeAnims[1]}>
        <TouchableOpacity style={sty.cardHeaderRow} onPress={() => toggleCard('topKpis')} activeOpacity={0.7}>
          <View>
            <Text style={sty.cardTitle}>Most Logged KPIs</Text>
            <Text style={sty.cardSubtitle}>Ranked by frequency — {RANGE_LABEL[range]}</Text>
          </View>
          <Text style={sty.expandArrow}>{expandedCard === 'topKpis' ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {topKpis.length === 0 ? (
          <Text style={sty.noData}>No KPI activity in this period.</Text>
        ) : (
          topKpis.slice(0, expandedCard === 'topKpis' ? 6 : 3).map((kpi, i) => (
            <View key={kpi.id} style={sty.topKpiRow}>
              <View style={[sty.topKpiRank, { backgroundColor: kpiTypeTint(kpi.type) }]}>
                <Text style={[sty.topKpiRankText, { color: kpiTypeAccent(kpi.type) }]}>#{i + 1}</Text>
              </View>
              <View style={sty.topKpiInfo}>
                <Text style={sty.topKpiName} numberOfLines={1}>{kpi.name}</Text>
                <Text style={sty.topKpiMeta}>
                  {fmtNum(kpi.count)} logs · {kpi.share.toFixed(0)}% share
                </Text>
              </View>
              <View style={sty.topKpiTrend}>
                <Text style={[sty.topKpiTrendIcon, kpi.trend === 'up' && sty.trendUp, kpi.trend === 'down' && sty.trendDown]}>
                  {kpi.trend === 'up' ? '▲' : kpi.trend === 'down' ? '▼' : '—'}
                </Text>
              </View>
            </View>
          ))
        )}
      </SectionCard>

      {/* ── 3. GCI Direction Trend ─────────────────────────────────── */}
      <SectionCard fadeAnim={fadeAnims[2]}>
        <TouchableOpacity style={sty.cardHeaderRow} onPress={() => toggleCard('gci')} activeOpacity={0.7}>
          <View>
            <Text style={sty.cardTitle}>GCI Direction</Text>
            <Text style={sty.cardSubtitle}>Projected vs Actual trend</Text>
          </View>
          <Text style={sty.expandArrow}>{expandedCard === 'gci' ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        <View style={sty.gciGrid}>
          {/* Projected */}
          <View style={[sty.gciCell, { borderRightWidth: 1, borderRightColor: '#eef1f6' }]}>
            <Text style={sty.gciCellEyebrow}>PROJECTED (90d)</Text>
            <Text style={sty.gciCellValue}>{fmtUsd(gci.projected90)}</Text>
            <DeltaBadge
              value={`${Math.abs(gci.projectedDelta).toFixed(0)}%`}
              direction={gci.projectedDirection}
            />
          </View>
          {/* Actual */}
          <View style={sty.gciCell}>
            <Text style={sty.gciCellEyebrow}>ACTUAL (YTD)</Text>
            <Text style={sty.gciCellValue}>{fmtUsd(gci.actualYtd)}</Text>
            <DeltaBadge
              value={`${Math.abs(gci.actualDelta).toFixed(0)}%`}
              direction={gci.actualDirection}
            />
          </View>
        </View>
        {expandedCard === 'gci' ? (
          <View style={sty.gciExpandedBlock}>
            <View style={sty.gciExpandedRow}>
              <Text style={sty.gciExpandedLabel}>Actual (Last 365d)</Text>
              <Text style={sty.gciExpandedValue}>{fmtUsd(gci.actualLast365)}</Text>
            </View>
            <View style={sty.gciExpandedRow}>
              <Text style={sty.gciExpandedLabel}>Projected (365d)</Text>
              <Text style={sty.gciExpandedValue}>{fmtUsd(gci.projected365)}</Text>
            </View>
            <View style={sty.gciExpandedRow}>
              <Text style={sty.gciExpandedLabel}>Confidence</Text>
              <View style={sty.confidencePill}>
                <View
                  style={[
                    sty.confidenceDot,
                    { backgroundColor: gci.confidenceBand === 'green' ? '#2f9f56' : gci.confidenceBand === 'red' ? '#c0392b' : '#d4a017' },
                  ]}
                />
                <Text style={sty.confidenceText}>
                  {gci.confidenceBand.charAt(0).toUpperCase() + gci.confidenceBand.slice(1)} ({(gci.confidenceScore * 100).toFixed(0)}%)
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </SectionCard>

      {/* ── 4. Challenge Participation ─────────────────────────────── */}
      <SectionCard fadeAnim={fadeAnims[3]}>
        <TouchableOpacity style={sty.cardHeaderRow} onPress={() => toggleCard('challenges')} activeOpacity={0.7}>
          <View>
            <Text style={sty.cardTitle}>Challenge Activity</Text>
            <Text style={sty.cardSubtitle}>Participation & leaderboard</Text>
          </View>
          <Text style={sty.expandArrow}>{expandedCard === 'challenges' ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        <View style={sty.challengeStatsRow}>
          <View style={sty.challengeStat}>
            <Text style={sty.challengeStatValue}>{challengeSummary.activeCount}</Text>
            <Text style={sty.challengeStatLabel}>Active</Text>
          </View>
          <View style={sty.challengeStat}>
            <Text style={sty.challengeStatValue}>{challengeSummary.joinedCount}</Text>
            <Text style={sty.challengeStatLabel}>Joined</Text>
          </View>
          <View style={sty.challengeStat}>
            <Text style={sty.challengeStatValue}>{challengeSummary.completedCount}</Text>
            <Text style={sty.challengeStatLabel}>Completed</Text>
          </View>
          <View style={sty.challengeStat}>
            <Text style={[sty.challengeStatValue, challengeSummary.bestRank !== null && challengeSummary.bestRank <= 3 && { color: '#2158d5' }]}>
              {challengeSummary.bestRank !== null ? `#${challengeSummary.bestRank}` : '—'}
            </Text>
            <Text style={sty.challengeStatLabel}>Best Rank</Text>
          </View>
        </View>
        {expandedCard === 'challenges' ? (
          <View style={sty.challengeExpandedBlock}>
            <View style={sty.challengeProgressRow}>
              <Text style={sty.challengeProgressLabel}>Avg. Progress</Text>
              <View style={sty.challengeProgressBarBg}>
                <View style={[sty.challengeProgressBarFill, { width: `${Math.min(100, challengeSummary.avgProgress)}%` }]} />
              </View>
              <Text style={sty.challengeProgressPct}>{challengeSummary.avgProgress.toFixed(0)}%</Text>
            </View>
            {challengeSummary.bestPct !== null && challengeSummary.bestPct !== undefined ? (
              <View style={sty.challengeProgressRow}>
                <Text style={sty.challengeProgressLabel}>Best Challenge</Text>
                <View style={sty.challengeProgressBarBg}>
                  <View
                    style={[sty.challengeProgressBarFill, { width: `${Math.min(100, challengeSummary.bestPct)}%`, backgroundColor: '#2158d5' }]}
                  />
                </View>
                <Text style={sty.challengeProgressPct}>{challengeSummary.bestPct.toFixed(0)}%</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </SectionCard>

      {/* ── 5. Preferred KPI Spotlight ─────────────────────────────── */}
      <SectionCard fadeAnim={fadeAnims[4]}>
        <View style={sty.cardHeaderRow}>
          <View>
            <Text style={sty.cardTitle}>KPI Spotlight</Text>
            <Text style={sty.cardSubtitle}>Top KPI per type — {RANGE_LABEL[range]}</Text>
          </View>
        </View>
        {spotlight.length === 0 ? (
          <Text style={sty.noData}>No KPI data available.</Text>
        ) : (
          <View style={sty.spotlightGrid}>
            {spotlight.map((s) => (
              <View key={s.type} style={[sty.spotlightCard, { backgroundColor: kpiTypeTint(s.type) }]}>
                <View style={[sty.spotlightTypePill, { backgroundColor: kpiTypeAccent(s.type) }]}>
                  <Text style={sty.spotlightTypeText}>{s.type}</Text>
                </View>
                <Text style={sty.spotlightKpiName} numberOfLines={2}>{s.kpi.name}</Text>
                <Text style={[sty.spotlightCount, { color: kpiTypeAccent(s.type) }]}>
                  {s.count > 0 ? `${fmtNum(s.count)} logs` : 'No activity'}
                </Text>
                {s.pcGenerated > 0 ? (
                  <Text style={sty.spotlightPc}>{fmtUsd(s.pcGenerated)} PC</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      {/* ── 6. AI Observations ─────────────────────────────────────── */}
      <SectionCard fadeAnim={fadeAnims[5]}>
        <TouchableOpacity style={sty.cardHeaderRow} onPress={() => toggleCard('ai')} activeOpacity={0.7}>
          <View style={sty.aiHeaderLeft}>
            <Text style={sty.aiIcon}>🤖</Text>
            <View>
              <Text style={sty.cardTitle}>AI Insights</Text>
              <Text style={sty.cardSubtitle}>Based on recent activity</Text>
            </View>
          </View>
          <Text style={sty.expandArrow}>{expandedCard === 'ai' ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {ai.observations.slice(0, expandedCard === 'ai' ? ai.observations.length : 2).map((obs, i) => (
          <View key={`obs-${i}`} style={sty.aiRow}>
            <Text style={sty.aiDot}>●</Text>
            <Text style={sty.aiText}>{obs}</Text>
          </View>
        ))}
        {ai.recommendations.length > 0 && (expandedCard === 'ai' || ai.recommendations.length <= 1) ? (
          <>
            <View style={sty.aiDivider} />
            <Text style={sty.aiRecommendHeader}>Recommendations</Text>
            {ai.recommendations.map((rec, i) => (
              <View key={`rec-${i}`} style={sty.aiRow}>
                <Text style={[sty.aiDot, { color: '#2158d5' }]}>◆</Text>
                <Text style={[sty.aiText, { color: '#1a2540' }]}>{rec}</Text>
              </View>
            ))}
          </>
        ) : null}
        <View style={sty.aiConfidenceNote}>
          <Text style={sty.aiConfidenceText}>
            Based on recent logs and challenge activity. Display-only — not financial advice.
          </Text>
        </View>
      </SectionCard>

      {/* ── Points Summary Footer ──────────────────────────────────── */}
      <SectionCard fadeAnim={fadeAnims[6]}>
        <View style={sty.pointsRow}>
          <View style={sty.pointsBlock}>
            <Text style={sty.pointsIcon}>💎</Text>
            <Text style={sty.pointsValue}>{fmtNum(gpPoints)}</Text>
            <Text style={sty.pointsLabel}>Growth Points</Text>
          </View>
          <View style={[sty.pointsDivider]} />
          <View style={sty.pointsBlock}>
            <Text style={sty.pointsIcon}>⚡</Text>
            <Text style={sty.pointsValue}>{fmtNum(vpPoints)}</Text>
            <Text style={sty.pointsLabel}>Vitality Points</Text>
          </View>
          <View style={[sty.pointsDivider]} />
          <View style={sty.pointsBlock}>
            <Text style={sty.pointsIcon}>📋</Text>
            <Text style={sty.pointsValue}>{fmtNum(totalLogs)}</Text>
            <Text style={sty.pointsLabel}>Total Logs</Text>
          </View>
        </View>
      </SectionCard>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const sty = StyleSheet.create({
  container: {
    gap: 10,
    paddingBottom: 20,
  },

  // ── Empty state ──
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#343c4a' },
  emptySub: { fontSize: 13, color: '#636b78', textAlign: 'center', paddingHorizontal: 40 },

  // ── Section Card ──
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1e6ef',
    overflow: 'hidden',
    shadowColor: '#1f2a4a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  // ── Time Chips ──
  timeChipRow: { flexDirection: 'row', gap: 6 },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#f0f2f5',
    borderWidth: 1,
    borderColor: '#e1e6ef',
  },
  timeChipActive: {
    backgroundColor: '#2158d5',
    borderColor: '#2158d5',
  },
  timeChipText: { fontSize: 11, fontWeight: '700', color: '#636b78' },
  timeChipTextActive: { color: '#fff' },

  // ── Delta Badge ──
  deltaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  deltaBadgeText: { fontSize: 11, fontWeight: '800' },

  // ── Hero Canvas ──
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#636b78',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  heroMetricBlock: { alignItems: 'center', gap: 4 },
  heroMetricValue: { fontSize: 28, fontWeight: '900', color: '#1a2540' },
  heroMetricLabel: { fontSize: 11, fontWeight: '600', color: '#636b78' },

  // ── Card Header ──
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1a2540' },
  cardSubtitle: { fontSize: 11, color: '#7f8795', marginTop: 1 },
  expandArrow: { fontSize: 10, color: '#7f8795', paddingLeft: 12 },

  // ── Top KPIs ──
  topKpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f4f6f9',
  },
  topKpiRank: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topKpiRankText: { fontSize: 12, fontWeight: '900' },
  topKpiInfo: { flex: 1, gap: 1 },
  topKpiName: { fontSize: 13, fontWeight: '600', color: '#1a2540' },
  topKpiMeta: { fontSize: 11, color: '#7f8795' },
  topKpiTrend: { width: 20, alignItems: 'center' },
  topKpiTrendIcon: { fontSize: 10, color: '#7f8795' },
  trendUp: { color: '#1a7a3a' },
  trendDown: { color: '#c0392b' },
  noData: { fontSize: 12, color: '#7f8795', paddingHorizontal: 16, paddingBottom: 14 },

  // ── GCI Direction ──
  gciGrid: {
    flexDirection: 'row',
  },
  gciCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  gciCellEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7f8795',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  gciCellValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1a2540',
  },
  gciExpandedBlock: {
    borderTopWidth: 1,
    borderTopColor: '#f0f2f5',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  gciExpandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gciExpandedLabel: { fontSize: 12, fontWeight: '600', color: '#636b78' },
  gciExpandedValue: { fontSize: 14, fontWeight: '800', color: '#1a2540' },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f4f6f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  confidenceDot: { width: 7, height: 7, borderRadius: 4 },
  confidenceText: { fontSize: 11, fontWeight: '700', color: '#343c4a' },

  // ── Challenge Activity ──
  challengeStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f4f6f9',
  },
  challengeStat: { alignItems: 'center', gap: 3 },
  challengeStatValue: { fontSize: 20, fontWeight: '900', color: '#1a2540' },
  challengeStatLabel: { fontSize: 10, fontWeight: '600', color: '#7f8795', textTransform: 'uppercase' },
  challengeExpandedBlock: {
    borderTopWidth: 1,
    borderTopColor: '#f0f2f5',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  challengeProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  challengeProgressLabel: { fontSize: 11, fontWeight: '600', color: '#636b78', width: 90 },
  challengeProgressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#eef0f5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  challengeProgressBarFill: {
    height: 8,
    backgroundColor: '#2f9f56',
    borderRadius: 4,
  },
  challengeProgressPct: { fontSize: 12, fontWeight: '800', color: '#1a2540', width: 36, textAlign: 'right' },

  // ── KPI Spotlight ──
  spotlightGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  spotlightCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  spotlightTypePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  spotlightTypeText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  spotlightKpiName: { fontSize: 12, fontWeight: '700', color: '#1a2540', lineHeight: 16 },
  spotlightCount: { fontSize: 11, fontWeight: '800' },
  spotlightPc: { fontSize: 10, color: '#636b78' },

  // ── AI Insights ──
  aiHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiIcon: { fontSize: 20 },
  aiRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    alignItems: 'flex-start',
  },
  aiDot: { fontSize: 8, color: '#2f9f56', marginTop: 4 },
  aiText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#343c4a' },
  aiDivider: {
    height: 1,
    backgroundColor: '#eef1f6',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  aiRecommendHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2158d5',
    paddingHorizontal: 16,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiConfidenceNote: {
    backgroundColor: '#f8f9fc',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eef1f6',
  },
  aiConfidenceText: { fontSize: 10, color: '#7f8795', fontStyle: 'italic' },

  // ── Points Footer ──
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  pointsBlock: { flex: 1, alignItems: 'center', gap: 3 },
  pointsIcon: { fontSize: 18 },
  pointsValue: { fontSize: 18, fontWeight: '900', color: '#1a2540' },
  pointsLabel: { fontSize: 10, fontWeight: '600', color: '#7f8795' },
  pointsDivider: { width: 1, height: 36, backgroundColor: '#e8ecf4' },

  // ── Activity Direction Hero ──
  directionHeroWrap: {
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 18,
    borderRadius: 14,
    gap: 4,
  },
  directionArrow: {
    fontSize: 52,
    fontWeight: '900',
    lineHeight: 58,
  },
  directionLabel: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  directionSub: {
    fontSize: 12,
    color: '#636b78',
    marginTop: 2,
  },
});
