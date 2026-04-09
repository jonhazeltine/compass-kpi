import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
} from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────────

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
    required_pipeline_anchors?: Array<{
      kpi_id?: string;
      anchor_type: string;
      anchor_value: number;
      updated_at?: string;
    }>;
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

export type QuickReportsProps = {
  payload: DashPayload | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fmtUsd(v: number) {
  const safe = Number.isFinite(v) ? v : 0;
  return `$${safe.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtNum(v: number) {
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function bandColor(band: 'green' | 'yellow' | 'red') {
  return band === 'green' ? '#2f9f56' : band === 'red' ? '#c0392b' : '#d4a017';
}

function kpiTypeAccent(type: KpiType) {
  if (type === 'PC') return '#2f9f56';
  if (type === 'GP') return '#2158d5';
  if (type === 'VP') return '#C9A84C';
  if (type === 'Custom') return '#7a4cc8';
  return '#48505f';
}

function kpiTypeTint(type: KpiType) {
  if (type === 'PC') return '#e4f7ea';
  if (type === 'GP') return '#e5efff';
  if (type === 'VP') return '#fdf3de';
  if (type === 'Custom') return '#f3e8ff';
  return '#eceff3';
}

// ─── Report Data Hooks ──────────────────────────────────────────────────────────

function useWeeklyScorecard(payload: DashPayload | null) {
  return useMemo(() => {
    if (!payload) return null;
    const logs = payload.recent_logs ?? [];
    const kpis = payload.loggable_kpis ?? [];
    const kpiMap = new Map(kpis.map((k) => [k.id, k]));

    const now = Date.now();
    const weekAgo = now - 7 * 86400_000;
    const priorWeekStart = weekAgo - 7 * 86400_000;

    // This week's logs
    const thisWeek = logs.filter((l) => new Date(l.event_timestamp).getTime() >= weekAgo);
    const priorWeek = logs.filter((l) => {
      const t = new Date(l.event_timestamp).getTime();
      return t >= priorWeekStart && t < weekAgo;
    });

    // Logs by category
    const byType: Record<string, number> = { PC: 0, GP: 0, VP: 0 };
    for (const log of thisWeek) {
      const kpi = kpiMap.get(log.kpi_id);
      if (kpi && byType[kpi.type] !== undefined) byType[kpi.type]++;
    }

    // Active days this week
    const activeDaySet = new Set<string>();
    for (const log of thisWeek) {
      activeDaySet.add(new Date(log.event_timestamp).toISOString().slice(0, 10));
    }
    const activeDays = activeDaySet.size;

    // Streak: consecutive days with at least 1 log (going backwards from today)
    const allDaySet = new Set<string>();
    for (const log of logs) {
      allDaySet.add(new Date(log.event_timestamp).toISOString().slice(0, 10));
    }
    let streak = 0;
    const d = new Date();
    // Check today first; if no logs today, check if yesterday had logs (grace)
    const todayStr = d.toISOString().slice(0, 10);
    if (!allDaySet.has(todayStr)) {
      d.setDate(d.getDate() - 1);
    }
    for (let i = 0; i < 365; i++) {
      const ds = d.toISOString().slice(0, 10);
      if (allDaySet.has(ds)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else break;
    }

    // Top 3 KPIs this week
    const countMap = new Map<string, number>();
    for (const log of thisWeek) {
      countMap.set(log.kpi_id, (countMap.get(log.kpi_id) ?? 0) + 1);
    }
    const topKpis = [...countMap.entries()]
      .map(([id, count]) => ({ id, name: kpiMap.get(id)?.name ?? 'KPI', type: kpiMap.get(id)?.type ?? 'PC' as KpiType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Verdict
    const delta = thisWeek.length - priorWeek.length;
    const pct = priorWeek.length > 0 ? ((delta / priorWeek.length) * 100) : (thisWeek.length > 0 ? 100 : 0);
    let verdict: string;
    if (pct > 15) verdict = `Up ${Math.abs(pct).toFixed(0)}% from last week — momentum building`;
    else if (pct < -15) verdict = `Down ${Math.abs(pct).toFixed(0)}% from last week — time to re-engage`;
    else if (thisWeek.length === 0) verdict = 'No activity this week — log something today';
    else verdict = `Holding steady at ${thisWeek.length} logs — consistency wins`;

    return {
      totalLogs: thisWeek.length,
      priorLogs: priorWeek.length,
      delta,
      pct,
      byType,
      activeDays,
      streak,
      topKpis,
      verdict,
    };
  }, [payload]);
}

function usePipelineHealth(payload: DashPayload | null) {
  return useMemo(() => {
    if (!payload) return null;
    const logs = payload.recent_logs ?? [];
    const kpis = payload.loggable_kpis ?? [];
    const kpiMap = new Map(kpis.map((k) => [k.id, k]));

    const pc90 = payload.projection.pc_90d;
    const pc365 = payload.projection.pc_next_365 ?? 0;
    const band = payload.projection.confidence.band;
    const score = payload.projection.confidence.score;
    const components = payload.projection.confidence.components;
    const anchors = payload.projection.required_pipeline_anchors ?? [];

    // Days since last PC log
    const pcLogs = logs
      .filter((l) => kpiMap.get(l.kpi_id)?.type === 'PC')
      .map((l) => new Date(l.event_timestamp).getTime());
    const lastPcLog = pcLogs.length > 0 ? Math.max(...pcLogs) : null;
    const daysSinceLastPc = lastPcLog ? Math.floor((Date.now() - lastPcLog) / 86400_000) : null;

    // PC logs this week
    const weekAgo = Date.now() - 7 * 86400_000;
    const pcLogsThisWeek = logs.filter(
      (l) => kpiMap.get(l.kpi_id)?.type === 'PC' && new Date(l.event_timestamp).getTime() >= weekAgo,
    ).length;

    // PC value generated this week
    const pcValueThisWeek = logs
      .filter((l) => kpiMap.get(l.kpi_id)?.type === 'PC' && new Date(l.event_timestamp).getTime() >= weekAgo)
      .reduce((sum, l) => sum + Number(l.pc_generated ?? 0), 0);

    // Verdict
    let verdict: string;
    if (band === 'green') verdict = `Pipeline is healthy — ${pcLogsThisWeek} PC activities this week`;
    else if (band === 'yellow') verdict = 'Pipeline needs attention — increase prospecting activity';
    else verdict = 'Pipeline is critical — prioritize lead generation now';

    return {
      pc90,
      pc365,
      band,
      score,
      components,
      anchors,
      daysSinceLastPc,
      pcLogsThisWeek,
      pcValueThisWeek,
      verdict,
    };
  }, [payload]);
}

function useKpiRoi(payload: DashPayload | null) {
  return useMemo(() => {
    if (!payload) return null;
    const logs = payload.recent_logs ?? [];
    const kpis = payload.loggable_kpis ?? [];
    const kpiMap = new Map(kpis.map((k) => [k.id, k]));

    // Only PC KPIs — these generate projected revenue
    const pcKpis = kpis.filter((k) => k.type === 'PC');

    // Aggregate per PC KPI: total logs, total pc_generated, total actual_gci_delta
    const roiRows: Array<{
      id: string;
      name: string;
      logCount: number;
      pcGenerated: number;
      gciDelta: number;
      pcPerLog: number;
      gciPerLog: number;
    }> = [];

    for (const kpi of pcKpis) {
      const kpiLogs = logs.filter((l) => l.kpi_id === kpi.id);
      if (kpiLogs.length === 0) continue;
      const totalPc = kpiLogs.reduce((s, l) => s + Number(l.pc_generated ?? 0), 0);
      const totalGci = kpiLogs.reduce((s, l) => s + Number(l.actual_gci_delta ?? 0), 0);
      roiRows.push({
        id: kpi.id,
        name: kpi.name,
        logCount: kpiLogs.length,
        pcGenerated: totalPc,
        gciDelta: totalGci,
        pcPerLog: totalPc / kpiLogs.length,
        gciPerLog: kpiLogs.length > 0 ? totalGci / kpiLogs.length : 0,
      });
    }

    // Sort by PC generated per log (highest ROI first)
    roiRows.sort((a, b) => b.pcPerLog - a.pcPerLog);

    // Also include GP/VP summary
    const gpLogs = logs.filter((l) => kpiMap.get(l.kpi_id)?.type === 'GP');
    const vpLogs = logs.filter((l) => kpiMap.get(l.kpi_id)?.type === 'VP');
    const gpPoints = gpLogs.reduce((s, l) => s + Number(l.points_generated ?? 0), 0);
    const vpPoints = vpLogs.reduce((s, l) => s + Number(l.points_generated ?? 0), 0);

    // Verdict
    let verdict: string;
    if (roiRows.length === 0) {
      verdict = 'No PC activity yet — start logging to see which activities drive the most revenue';
    } else {
      const top = roiRows[0];
      verdict = `"${top.name}" is your highest-ROI activity at ${fmtUsd(top.pcPerLog)} projected per log`;
    }

    return { roiRows, gpLogs: gpLogs.length, vpLogs: vpLogs.length, gpPoints, vpPoints, verdict };
  }, [payload]);
}

// ─── Report Modals ──────────────────────────────────────────────────────────────

function ReportModal({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modalSafe}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.modalClose}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={s.modalScroll} contentContainerStyle={s.modalContent}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function WeeklyScorecardReport({ data }: { data: NonNullable<ReturnType<typeof useWeeklyScorecard>> }) {
  const direction = data.delta > 0 ? 'up' : data.delta < 0 ? 'down' : 'flat';
  const arrowBg = direction === 'up' ? '#eaf7ee' : direction === 'down' ? '#fdf0ef' : '#f2f4f8';
  const arrowColor = direction === 'up' ? '#1a7a3a' : direction === 'down' ? '#b83227' : '#636b78';
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';

  return (
    <>
      {/* Verdict banner */}
      <View style={[s.verdictBanner, { backgroundColor: arrowBg }]}>
        <Text style={[s.verdictArrow, { color: arrowColor }]}>{arrow}</Text>
        <Text style={[s.verdictText, { color: arrowColor }]}>{data.verdict}</Text>
      </View>

      {/* Hero metrics row */}
      <View style={s.metricRow}>
        <View style={s.metricBlock}>
          <Text style={s.metricValue}>{fmtNum(data.totalLogs)}</Text>
          <Text style={s.metricLabel}>This Week</Text>
        </View>
        <View style={s.metricBlock}>
          <Text style={s.metricValue}>{fmtNum(data.priorLogs)}</Text>
          <Text style={s.metricLabel}>Last Week</Text>
        </View>
        <View style={s.metricBlock}>
          <Text style={s.metricValue}>{data.activeDays}/7</Text>
          <Text style={s.metricLabel}>Active Days</Text>
        </View>
        <View style={s.metricBlock}>
          <Text style={[s.metricValue, data.streak >= 7 && { color: '#2f9f56' }]}>{data.streak}d</Text>
          <Text style={s.metricLabel}>Streak</Text>
        </View>
      </View>

      {/* Activity by type */}
      <Text style={s.sectionHeader}>Activity by Category</Text>
      <View style={s.categoryRow}>
        {(['PC', 'GP', 'VP'] as const).map((type) => {
          const count = data.byType[type] ?? 0;
          const total = data.totalLogs || 1;
          const pct = (count / total) * 100;
          return (
            <View key={type} style={[s.categoryCard, { backgroundColor: kpiTypeTint(type as KpiType) }]}>
              <Text style={[s.categoryType, { color: kpiTypeAccent(type as KpiType) }]}>{type}</Text>
              <Text style={[s.categoryCount, { color: kpiTypeAccent(type as KpiType) }]}>{count}</Text>
              <View style={s.categoryBarBg}>
                <View
                  style={[s.categoryBarFill, { width: `${Math.min(100, pct)}%`, backgroundColor: kpiTypeAccent(type as KpiType) }]}
                />
              </View>
              <Text style={s.categoryPct}>{pct.toFixed(0)}%</Text>
            </View>
          );
        })}
      </View>

      {/* Top KPIs */}
      {data.topKpis.length > 0 && (
        <>
          <Text style={s.sectionHeader}>Top Activities</Text>
          {data.topKpis.map((kpi, i) => (
            <View key={kpi.id} style={s.listRow}>
              <View style={[s.rankBadge, { backgroundColor: kpiTypeTint(kpi.type as KpiType) }]}>
                <Text style={[s.rankText, { color: kpiTypeAccent(kpi.type as KpiType) }]}>#{i + 1}</Text>
              </View>
              <View style={s.listRowInfo}>
                <Text style={s.listRowName}>{kpi.name}</Text>
                <Text style={s.listRowMeta}>{kpi.count} logs this week</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </>
  );
}

function PipelineHealthReport({ data }: { data: NonNullable<ReturnType<typeof usePipelineHealth>> }) {
  const bc = bandColor(data.band);

  return (
    <>
      {/* Verdict */}
      <View style={[s.verdictBanner, { backgroundColor: data.band === 'green' ? '#eaf7ee' : data.band === 'red' ? '#fdf0ef' : '#fdf8e8' }]}>
        <View style={[s.bandDot, { backgroundColor: bc }]} />
        <Text style={[s.verdictText, { color: bc }]}>{data.verdict}</Text>
      </View>

      {/* PC scores */}
      <View style={s.metricRow}>
        <View style={s.metricBlock}>
          <Text style={s.metricValue}>{fmtUsd(data.pc90)}</Text>
          <Text style={s.metricLabel}>PC (90d)</Text>
        </View>
        <View style={s.metricBlock}>
          <Text style={s.metricValue}>{fmtUsd(data.pc365)}</Text>
          <Text style={s.metricLabel}>PC (365d)</Text>
        </View>
        <View style={s.metricBlock}>
          <Text style={[s.metricValue, { color: bc }]}>
            {(data.score * 100).toFixed(0)}%
          </Text>
          <Text style={s.metricLabel}>Confidence</Text>
        </View>
      </View>

      {/* Confidence components */}
      {data.components && (
        <>
          <Text style={s.sectionHeader}>Confidence Breakdown</Text>
          <View style={s.componentGrid}>
            <ConfidenceBar label="Accuracy" value={data.components.historical_accuracy_score} />
            <ConfidenceBar label="Pipeline" value={data.components.pipeline_health_score} />
            <ConfidenceBar label="Activity" value={data.components.inactivity_score} />
          </View>
        </>
      )}

      {/* Activity stats */}
      <Text style={s.sectionHeader}>Pipeline Activity</Text>
      <View style={s.statGrid}>
        <StatRow label="PC logs this week" value={fmtNum(data.pcLogsThisWeek)} />
        <StatRow label="PC value this week" value={fmtUsd(data.pcValueThisWeek)} />
        <StatRow
          label="Days since last PC log"
          value={data.daysSinceLastPc !== null ? `${data.daysSinceLastPc}d` : 'Never'}
          warn={data.daysSinceLastPc !== null && data.daysSinceLastPc > 5}
        />
      </View>

      {/* Pipeline anchors */}
      {data.anchors.length > 0 && (
        <>
          <Text style={s.sectionHeader}>Pipeline Anchors</Text>
          {data.anchors.map((a, i) => (
            <View key={i} style={s.listRow}>
              <View style={s.anchorIcon}>
                <Text style={s.anchorIconText}>{a.anchor_type === 'listings' ? 'L' : 'B'}</Text>
              </View>
              <View style={s.listRowInfo}>
                <Text style={s.listRowName}>{a.anchor_type}</Text>
                <Text style={s.listRowMeta}>Value: {fmtNum(a.anchor_value)}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </>
  );
}

function KpiRoiReport({ data }: { data: NonNullable<ReturnType<typeof useKpiRoi>> }) {
  return (
    <>
      {/* Verdict */}
      <View style={[s.verdictBanner, { backgroundColor: '#e5efff' }]}>
        <Text style={s.verdictIcon}>$</Text>
        <Text style={[s.verdictText, { color: '#2158d5' }]}>{data.verdict}</Text>
      </View>

      {/* PC KPI ROI table */}
      {data.roiRows.length > 0 && (
        <>
          <Text style={s.sectionHeader}>PC Activity ROI — Ranked by Efficiency</Text>
          {data.roiRows.map((row, i) => (
            <View key={row.id} style={[s.roiCard, i === 0 && s.roiCardTop]}>
              <View style={s.roiCardHeader}>
                <Text style={s.roiRank}>#{i + 1}</Text>
                <Text style={s.roiName} numberOfLines={1}>{row.name}</Text>
              </View>
              <View style={s.roiMetricRow}>
                <View style={s.roiMetric}>
                  <Text style={s.roiMetricValue}>{fmtNum(row.logCount)}</Text>
                  <Text style={s.roiMetricLabel}>Logs</Text>
                </View>
                <View style={s.roiMetric}>
                  <Text style={s.roiMetricValue}>{fmtUsd(row.pcGenerated)}</Text>
                  <Text style={s.roiMetricLabel}>Total PC</Text>
                </View>
                <View style={s.roiMetric}>
                  <Text style={[s.roiMetricValue, { color: '#2f9f56' }]}>{fmtUsd(row.pcPerLog)}</Text>
                  <Text style={s.roiMetricLabel}>PC / Log</Text>
                </View>
              </View>
              {row.gciDelta > 0 && (
                <View style={s.roiGciRow}>
                  <Text style={s.roiGciLabel}>Actual GCI attributed</Text>
                  <Text style={s.roiGciValue}>{fmtUsd(row.gciDelta)}</Text>
                </View>
              )}
            </View>
          ))}
        </>
      )}

      {/* GP / VP summary */}
      <Text style={s.sectionHeader}>Points Activity</Text>
      <View style={s.metricRow}>
        <View style={s.metricBlock}>
          <Text style={[s.metricValue, { color: '#2158d5' }]}>{fmtNum(data.gpLogs)}</Text>
          <Text style={s.metricLabel}>GP Logs</Text>
        </View>
        <View style={s.metricBlock}>
          <Text style={[s.metricValue, { color: '#2158d5' }]}>{fmtNum(data.gpPoints)}</Text>
          <Text style={s.metricLabel}>GP Earned</Text>
        </View>
        <View style={s.metricBlock}>
          <Text style={[s.metricValue, { color: '#e38a1f' }]}>{fmtNum(data.vpLogs)}</Text>
          <Text style={s.metricLabel}>VP Logs</Text>
        </View>
        <View style={s.metricBlock}>
          <Text style={[s.metricValue, { color: '#e38a1f' }]}>{fmtNum(data.vpPoints)}</Text>
          <Text style={s.metricLabel}>VP Earned</Text>
        </View>
      </View>
    </>
  );
}

// ─── Shared Sub-Components ──────────────────────────────────────────────────────

function ConfidenceBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? '#2f9f56' : pct >= 40 ? '#d4a017' : '#c0392b';
  return (
    <View style={s.confBarWrap}>
      <View style={s.confBarLabelRow}>
        <Text style={s.confBarLabel}>{label}</Text>
        <Text style={[s.confBarPct, { color }]}>{pct}%</Text>
      </View>
      <View style={s.confBarBg}>
        <View style={[s.confBarFill, { width: `${Math.min(100, pct)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function StatRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={s.statRow}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, warn && { color: '#c0392b' }]}>{value}</Text>
    </View>
  );
}

// ─── Main QuickReports Component ────────────────────────────────────────────────

type ReportKey = 'weekly' | 'pipeline' | 'roi';

const REPORT_BUTTONS: Array<{ key: ReportKey; icon: string; title: string; subtitle: string }> = [
  { key: 'weekly', icon: '7', title: 'Weekly Scorecard', subtitle: 'Activity snapshot' },
  { key: 'pipeline', icon: 'P', title: 'Pipeline Health', subtitle: 'PC & confidence' },
  { key: 'roi', icon: '$', title: 'KPI ROI', subtitle: 'Best bang for buck' },
];

export default function QuickReports({ payload }: QuickReportsProps) {
  const [activeReport, setActiveReport] = useState<ReportKey | null>(null);

  const weekly = useWeeklyScorecard(payload);
  const pipeline = usePipelineHealth(payload);
  const roi = useKpiRoi(payload);

  const close = useCallback(() => setActiveReport(null), []);

  if (!payload) return null;

  return (
    <>
      <View style={s.buttonGrid}>
        <Text style={s.gridHeader}>QUICK REPORTS</Text>
        <View style={s.gridRow}>
          {REPORT_BUTTONS.map((btn) => (
            <TouchableOpacity
              key={btn.key}
              style={s.reportButton}
              activeOpacity={0.7}
              onPress={() => setActiveReport(btn.key)}
            >
              <View style={s.reportButtonIcon}>
                <Text style={s.reportButtonIconText}>{btn.icon}</Text>
              </View>
              <Text style={s.reportButtonTitle}>{btn.title}</Text>
              <Text style={s.reportButtonSub}>{btn.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Weekly Scorecard Modal */}
      <ReportModal visible={activeReport === 'weekly'} onClose={close} title="Weekly Activity Scorecard">
        {weekly && <WeeklyScorecardReport data={weekly} />}
      </ReportModal>

      {/* Pipeline Health Modal */}
      <ReportModal visible={activeReport === 'pipeline'} onClose={close} title="Pipeline Health Check">
        {pipeline && <PipelineHealthReport data={pipeline} />}
      </ReportModal>

      {/* KPI ROI Modal */}
      <ReportModal visible={activeReport === 'roi'} onClose={close} title="KPI ROI Report">
        {roi && <KpiRoiReport data={roi} />}
      </ReportModal>
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // ── Button Grid ──
  buttonGrid: {
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
    padding: 16,
    gap: 12,
  },
  gridHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#636b78',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  reportButton: {
    flex: 1,
    backgroundColor: '#f6f8fc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8ecf4',
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  reportButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#2158d5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  reportButtonIconText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
  },
  reportButtonTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1a2540',
    textAlign: 'center',
  },
  reportButtonSub: {
    fontSize: 10,
    color: '#7f8795',
    textAlign: 'center',
  },

  // ── Modal ──
  modalSafe: {
    flex: 1,
    backgroundColor: '#f4f6f9',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8ecf4',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a2540',
  },
  modalClose: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2158d5',
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },

  // ── Verdict Banner ──
  verdictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  verdictArrow: {
    fontSize: 28,
    fontWeight: '900',
  },
  verdictIcon: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2158d5',
    width: 32,
    height: 32,
    lineHeight: 32,
    textAlign: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  verdictText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  bandDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },

  // ── Metric Row ──
  metricRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8ecf4',
    overflow: 'hidden',
  },
  metricBlock: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1a2540',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7f8795',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // ── Section Header ──
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#636b78',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },

  // ── Category Row (Weekly) ──
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  categoryType: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  categoryCount: {
    fontSize: 24,
    fontWeight: '900',
  },
  categoryBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: 4,
    borderRadius: 2,
  },
  categoryPct: {
    fontSize: 10,
    fontWeight: '700',
    color: '#636b78',
  },

  // ── List Row ──
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8ecf4',
    padding: 12,
    gap: 12,
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 13,
    fontWeight: '900',
  },
  listRowInfo: {
    flex: 1,
    gap: 2,
  },
  listRowName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a2540',
  },
  listRowMeta: {
    fontSize: 11,
    color: '#7f8795',
  },

  // ── Anchor Icon ──
  anchorIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#e5efff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorIconText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#2158d5',
  },

  // ── Confidence Bars ──
  componentGrid: {
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8ecf4',
    padding: 16,
  },
  confBarWrap: {
    gap: 4,
  },
  confBarLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636b78',
  },
  confBarPct: {
    fontSize: 12,
    fontWeight: '800',
  },
  confBarBg: {
    height: 8,
    backgroundColor: '#eef0f5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  confBarFill: {
    height: 8,
    borderRadius: 4,
  },

  // ── Stat Grid ──
  statGrid: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8ecf4',
    overflow: 'hidden',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f6f9',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636b78',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a2540',
  },

  // ── ROI Cards ──
  roiCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8ecf4',
    overflow: 'hidden',
    padding: 14,
    gap: 10,
  },
  roiCardTop: {
    borderColor: '#2f9f56',
    borderWidth: 2,
  },
  roiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roiRank: {
    fontSize: 12,
    fontWeight: '900',
    color: '#7f8795',
  },
  roiName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1a2540',
  },
  roiMetricRow: {
    flexDirection: 'row',
  },
  roiMetric: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  roiMetricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1a2540',
  },
  roiMetricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7f8795',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  roiGciRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eaf7ee',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roiGciLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a7a3a',
  },
  roiGciValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1a7a3a',
  },
});
