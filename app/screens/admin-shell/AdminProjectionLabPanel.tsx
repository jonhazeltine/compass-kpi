import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path, Line as SvgLine, Text as SvgText, Circle } from 'react-native-svg';
import {
  generateScenarioFromProfile,
  generateScenarioFromVolume,
  SCENARIO_PROFILES,
  BUILTIN_AGENT_PROFILES,
  executeRun,
  compareRuns,
  computeCalibrationMetrics,
  computePerKpiSeries,
  buildActualBaselineSeries,
  computeRollingAverage,
  generateRealisticClosings,
  rebuildLogStreamFromVolumes,
  registerGoldenScenario,
  getGoldenScenarios,
  runRegressionSuite,
  captureGoldenSnapshot,
  removeGoldenScenario,
} from '../../lib/projectionLab';
import { adminKpiToLabDef } from '../../lib/projectionLab/scenarioGenerator';
import type {
  LabScenario,
  LabView,
  LabLogEntry,
  LabKpiDefinition,
  RunBundle,
  RegressionReport,
  RunComparison,
  CalibrationMetrics,
  ScenarioProfile,
  KpiMonthlySeries,
  MonthlySeriesPoint,
  AgentProfile,
  KpiVolumeSpec,
  ScenarioVolumeInput,
} from '../../lib/projectionLab';
import type { AdminKpiRow } from '../../lib/adminCatalogApi';

export default function AdminProjectionLabPanel({
  adminUser,
  catalogKpis,
}: {
  adminUser: string;
  catalogKpis: AdminKpiRow[];
}) {
  const [labView, setLabView] = useState<LabView>('scenario_list');
  const [scenarios, setScenarios] = useState<LabScenario[]>([]);
  const [runs, setRuns] = useState<RunBundle[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<LabScenario | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunBundle | null>(null);
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [calibrationMetrics, setCalibrationMetrics] = useState<CalibrationMetrics | null>(null);
  const [regressionReport, setRegressionReport] = useState<RegressionReport | null>(null);

  const [runStatus, setRunStatus] = useState<string | null>(null);

  // Chart state
  const [chartRuns, setChartRuns] = useState<(RunBundle & { scenarioName: string })[]>([]);
  const [kpiDropdownRunId, setKpiDropdownRunId] = useState<string>('');
  const [kpiDropdownOpen, setKpiDropdownOpen] = useState(false);
  const [selectedKpiName, setSelectedKpiName] = useState<string>('');
  const [perKpiData, setPerKpiData] = useState<KpiMonthlySeries[]>([]);

  // Chart visibility per-scenario toggles
  type ChartLineVisibility = { projection: boolean; actual: boolean; rollingAvg: boolean };
  const [chartVisibility, setChartVisibility] = useState<Record<string, ChartLineVisibility>>({});

  useEffect(() => {
    setChartVisibility((prev) => {
      const next = { ...prev };
      for (const run of chartRuns) {
        if (!next[run.run_id]) {
          const scenario = scenarios.find((s) => s.scenario_id === run.scenario_id);
          const hasActuals = (scenario?.actual_closings.length ?? 0) > 0;
          next[run.run_id] = { projection: true, actual: hasActuals, rollingAvg: false };
        }
      }
      const runIds = new Set(chartRuns.map((r) => r.run_id));
      for (const key of Object.keys(next)) {
        if (!runIds.has(key)) delete next[key];
      }
      return next;
    });
  }, [chartRuns, scenarios]);

  const toggleChartLine = (runId: string, line: keyof ChartLineVisibility) => {
    setChartVisibility((prev) => ({
      ...prev,
      [runId]: { ...prev[runId], [line]: !prev[runId]?.[line] },
    }));
  };

  // Auto-generate all profile scenarios and run them on first mount
  useEffect(() => {
    const initial = SCENARIO_PROFILES.map((profile) =>
      generateScenarioFromProfile({ profile, adminUser, catalogKpis })
    );
    setScenarios(initial);
    const initialRuns = initial.map((scenario) => executeRun({ scenario, adminUser }));
    setRuns(initialRuns);
    setChartRuns(
      initialRuns.map((r, i) => ({ ...r, scenarioName: initial[i].name }))
    );
    setRunStatus(`${initial.length} scenarios generated and run`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compare selection
  const [compareRunAId, setCompareRunAId] = useState('');
  const [compareRunBId, setCompareRunBId] = useState('');

  // Golden tolerance
  const [goldenTolerance, setGoldenTolerance] = useState('5');

  // Event detail expansion
  const [expandedEvents, setExpandedEvents] = useState(false);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPricePoint, setEditPricePoint] = useState('');
  const [editCommission, setEditCommission] = useState('');
  const [editLogStream, setEditLogStream] = useState<LabLogEntry[]>([]);
  const [editKpiDefs, setEditKpiDefs] = useState<LabKpiDefinition[]>([]);
  const [editAddKpiOpen, setEditAddKpiOpen] = useState(false);
  const [editClosedDeals, setEditClosedDeals] = useState('');
  const [editKpiMonthlyVolume, setEditKpiMonthlyVolume] = useState<Record<string, string>>({});
  const [editTimeSpan, setEditTimeSpan] = useState('6');

  // Profile state
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>(() => [...BUILTIN_AGENT_PROFILES]);
  const [selectedProfile, setSelectedProfile] = useState<AgentProfile | null>(null);
  const [profileFormName, setProfileFormName] = useState('');
  const [profileFormAgent, setProfileFormAgent] = useState('');
  const [profileFormPrice, setProfileFormPrice] = useState('');
  const [profileFormCommission, setProfileFormCommission] = useState('');
  const [profileFormKpis, setProfileFormKpis] = useState<string[]>([]);
  const [profileFormGpKpis, setProfileFormGpKpis] = useState<string[]>([]);
  const [profileFormVpKpis, setProfileFormVpKpis] = useState<string[]>([]);
  const [profileFormActuals, setProfileFormActuals] = useState(false);
  const [profileFormDesc, setProfileFormDesc] = useState('');

  // Volume-based scenario create state
  const [createProfileId, setCreateProfileId] = useState('');
  const [createVolumeSpecs, setCreateVolumeSpecs] = useState<KpiVolumeSpec[]>([]);
  const [createTimeSpan, setCreateTimeSpan] = useState('6');
  const [createActuals, setCreateActuals] = useState(false);
  const [createStep, setCreateStep] = useState<'pick_profile' | 'volume_spec'>('pick_profile');

  // ── Live catalog groups ──
  const { pcTemplates, gpTemplates, vpTemplates, allTemplates } = useMemo(() => {
    const active = catalogKpis.filter((k) => k.is_active);
    return {
      pcTemplates: active.filter((k) => k.type === 'PC'),
      gpTemplates: active.filter((k) => k.type === 'GP'),
      vpTemplates: active.filter((k) => k.type === 'VP'),
      allTemplates: active,
    };
  }, [catalogKpis]);

  // Derive LabKpiDefinition arrays from live catalog for use in scenario edit
  const pcTemplateDefs = useMemo(() => pcTemplates.map(adminKpiToLabDef), [pcTemplates]);
  const gpTemplateDefs = useMemo(() => gpTemplates.map(adminKpiToLabDef), [gpTemplates]);
  const vpTemplateDefs = useMemo(() => vpTemplates.map(adminKpiToLabDef), [vpTemplates]);
  const allTemplateDefs = useMemo(() => allTemplates.map(adminKpiToLabDef), [allTemplates]);

  // Chart colors
  const CHART_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316'];

  // ── Edit handlers ──

  const handleStartEdit = (scenario: LabScenario) => {
    setEditName(scenario.name);
    setEditDisplayName(scenario.user_profile.display_name);
    setEditPricePoint(scenario.user_profile.average_price_point.toString());
    setEditCommission((scenario.user_profile.commission_rate * 100).toFixed(2));
    setEditLogStream([...scenario.log_stream]);
    setEditKpiDefs([...scenario.kpi_definitions]);
    setEditAddKpiOpen(false);
    setEditClosedDeals(scenario.closed_deals_override?.toString() ?? '');
    // Load time span from volume input or default to 6
    setEditTimeSpan((scenario.volume_input?.time_span_months ?? 6).toString());
    // Initialize per-KPI monthly volume from scenario or derive from log_stream
    const kpiVolMap: Record<string, string> = {};
    if (scenario.kpi_monthly_volume) {
      for (const [kId, v] of Object.entries(scenario.kpi_monthly_volume)) {
        kpiVolMap[kId] = v.toString();
      }
    } else {
      // Derive: count events per KPI in the log stream, convert to per-month
      const timeSpan = scenario.volume_input?.time_span_months ?? 6;
      const kpiCounts = new Map<string, number>();
      for (const log of scenario.log_stream) {
        kpiCounts.set(log.kpi_id, (kpiCounts.get(log.kpi_id) ?? 0) + log.quantity);
      }
      for (const [kId, count] of kpiCounts) {
        const perMonth = count / timeSpan;
        // Show clean decimals: 10 → "10", 0.5 → "0.5", 0.333 → "0.33"
        kpiVolMap[kId] = perMonth === Math.round(perMonth) ? perMonth.toString() : perMonth.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
      }
    }
    setEditKpiMonthlyVolume(kpiVolMap);
    setLabView('scenario_edit');
  };

  const handleSaveEdit = () => {
    if (!selectedScenario) return;
    const pricePoint = parseFloat(editPricePoint) || selectedScenario.user_profile.average_price_point;
    const commRate = (parseFloat(editCommission) || selectedScenario.user_profile.commission_rate * 100) / 100;
    const userProfile = {
      ...selectedScenario.user_profile,
      display_name: editDisplayName,
      average_price_point: pricePoint,
      commission_rate: commRate,
    };

    // Parse per-KPI monthly volumes (decimal-safe)
    const kpiMonthlyVolume: Record<string, number> = {};
    let hasVolumeOverrides = false;
    for (const [kId, v] of Object.entries(editKpiMonthlyVolume)) {
      const n = parseFloat(v) || 0;
      if (n > 0) {
        kpiMonthlyVolume[kId] = n;
        hasVolumeOverrides = true;
      }
    }

    const timeSpanMonths = parseInt(editTimeSpan) || 6;

    // Rebuild log stream from KPI volumes if overrides present
    const logStream = hasVolumeOverrides
      ? rebuildLogStreamFromVolumes({
          kpiMonthlyVolume,
          kpiDefinitions: editKpiDefs,
          userProfile,
          timeSpanMonths,
        })
      : editLogStream;

    // Parse closed deals override
    const closedDealsOverride = editClosedDeals ? parseInt(editClosedDeals) || undefined : undefined;

    // Regenerate actual closings when closed_deals_override changes
    const baseDateIso = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
    let varCounter = 0;
    const actualClosings = closedDealsOverride != null
      ? generateRealisticClosings({
          baseDateIso,
          avgPricePoint: pricePoint,
          commissionRate: commRate,
          daysSpan: 365,
          idGen: () => {
            varCounter++;
            return `edit-${Date.now().toString(36)}-${varCounter}`;
          },
          rngVariance: () => {
            varCounter++;
            return (Math.sin(varCounter * 2.654) + 1) / 2;
          },
          overrideAnnualDeals: closedDealsOverride,
        })
      : selectedScenario.actual_closings;

    const updated: LabScenario = {
      ...selectedScenario,
      name: editName,
      user_profile: userProfile,
      kpi_definitions: editKpiDefs,
      log_stream: logStream,
      actual_closings: actualClosings,
      closed_deals_override: closedDealsOverride,
      kpi_monthly_volume: hasVolumeOverrides ? kpiMonthlyVolume : undefined,
      volume_input: selectedScenario.volume_input
        ? { ...selectedScenario.volume_input, time_span_months: timeSpanMonths }
        : { profile_id: selectedScenario.source_profile_id ?? '', volume_specs: [], time_span_months: timeSpanMonths, include_actuals: selectedScenario.actual_closings.length > 0 },
    };
    setScenarios((prev) => prev.map((s) => (s.scenario_id === updated.scenario_id ? updated : s)));
    setSelectedScenario(updated);
    // Re-run the scenario and update chart
    const run = executeRun({ scenario: updated, adminUser });
    setRuns((prev) => [run, ...prev.filter((r) => r.scenario_id !== updated.scenario_id)]);
    setChartRuns((prev) => {
      const withoutOld = prev.filter((r) => r.scenario_id !== updated.scenario_id);
      return [...withoutOld, { ...run, scenarioName: updated.name }];
    });
    setSelectedRun(run);
    setLabView('scenario_list');
    setRunStatus(`"${updated.name}" updated and re-run — PC@eval: $${run.pc_at_eval_date.toLocaleString()}`);
  };

  const handleAddLogEntry = () => {
    if (!selectedScenario || editKpiDefs.length === 0) return;
    const newEntry: LabLogEntry = {
      log_id: `log-edit-${Date.now().toString(36)}`,
      kpi_id: editKpiDefs[0].kpi_id,
      event_date_iso: new Date().toISOString().split('T')[0] + 'T00:00:00.000Z',
      quantity: 1,
    };
    setEditLogStream((prev) => [...prev, newEntry]);
  };

  const handleRemoveLogEntry = (logId: string) => {
    setEditLogStream((prev) => prev.filter((l) => l.log_id !== logId));
  };

  const handleUpdateLogEntry = (logId: string, field: keyof LabLogEntry, value: string) => {
    setEditLogStream((prev) =>
      prev.map((l) => {
        if (l.log_id !== logId) return l;
        if (field === 'kpi_id') return { ...l, kpi_id: value };
        if (field === 'event_date_iso') return { ...l, event_date_iso: value.includes('T') ? value : value + 'T00:00:00.000Z' };
        if (field === 'quantity') return { ...l, quantity: parseInt(value) || 1 };
        return l;
      })
    );
  };

  const handleAddKpiToEdit = (template: Omit<LabKpiDefinition, 'kpi_id'>) => {
    const newKpi: LabKpiDefinition = {
      ...template,
      kpi_id: `kpi-edit-${Date.now().toString(36)}`,
    };
    setEditKpiDefs((prev) => [...prev, newKpi]);
    setEditAddKpiOpen(false);
  };

  const handleRemoveKpiFromEdit = (kpiId: string) => {
    setEditKpiDefs((prev) => prev.filter((k) => k.kpi_id !== kpiId));
    // Also remove any log entries for this KPI
    setEditLogStream((prev) => prev.filter((l) => l.kpi_id !== kpiId));
  };

  // ── Profile handlers ──

  const handleProfileFormReset = () => {
    setProfileFormName('');
    setProfileFormAgent('');
    setProfileFormPrice('350000');
    setProfileFormCommission('2.75');
    setProfileFormKpis([]);
    setProfileFormGpKpis([]);
    setProfileFormVpKpis([]);
    setProfileFormActuals(false);
    setProfileFormDesc('');
  };

  const handleProfileFormStartEdit = (profile: AgentProfile) => {
    setSelectedProfile(profile);
    setProfileFormName(profile.name);
    setProfileFormAgent(profile.agent_name);
    setProfileFormPrice(profile.avg_price_point.toString());
    setProfileFormCommission((profile.commission_rate * 100).toFixed(2));
    setProfileFormKpis([...profile.kpi_names]);
    setProfileFormGpKpis([...(profile.gp_kpi_names ?? [])]);
    setProfileFormVpKpis([...(profile.vp_kpi_names ?? [])]);
    setProfileFormActuals(profile.include_actuals);
    setProfileFormDesc(profile.description);
    setLabView('profile_edit');
  };

  const handleSaveProfile = (isNew: boolean) => {
    const profile: AgentProfile = {
      profile_id: isNew ? `custom-${Date.now().toString(36)}` : selectedProfile!.profile_id,
      name: profileFormName || 'Untitled Profile',
      description: profileFormDesc,
      agent_name: profileFormAgent || 'Agent',
      avg_price_point: parseFloat(profileFormPrice) || 350000,
      commission_rate: (parseFloat(profileFormCommission) || 2.75) / 100,
      kpi_names: profileFormKpis,
      gp_kpi_names: profileFormGpKpis,
      vp_kpi_names: profileFormVpKpis,
      include_actuals: profileFormActuals,
      is_builtin: isNew ? false : selectedProfile!.is_builtin,
      created_at: isNew ? new Date().toISOString() : selectedProfile!.created_at,
    };
    if (isNew) {
      setAgentProfiles((prev) => [...prev, profile]);
    } else {
      setAgentProfiles((prev) => prev.map((p) => p.profile_id === profile.profile_id ? profile : p));
    }
    setSelectedProfile(profile);
    setLabView('profile_list');
    setRunStatus(`Profile "${profile.name}" ${isNew ? 'created' : 'updated'}`);
  };

  const handleDeleteProfile = (profileId: string) => {
    setAgentProfiles((prev) => prev.filter((p) => p.profile_id !== profileId));
    setSelectedProfile(null);
    setLabView('profile_list');
    setRunStatus('Profile deleted');
  };

  const handleDuplicateProfile = (profile: AgentProfile) => {
    const dup: AgentProfile = {
      ...profile,
      profile_id: `custom-${Date.now().toString(36)}`,
      name: `${profile.name} (Copy)`,
      is_builtin: false,
      created_at: new Date().toISOString(),
    };
    setAgentProfiles((prev) => [...prev, dup]);
    setRunStatus(`Duplicated "${profile.name}" as custom profile`);
  };

  // ── Volume-based scenario create handlers ──

  const handleStartVolumeCreate = (profile: AgentProfile) => {
    setCreateProfileId(profile.profile_id);
    const allKpiNames = [...profile.kpi_names, ...(profile.gp_kpi_names ?? []), ...(profile.vp_kpi_names ?? [])];
    setCreateVolumeSpecs(
      allKpiNames.map((name) => ({ kpi_name: name, events_per_month: 10 }))
    );
    setCreateTimeSpan('6');
    setCreateActuals(profile.include_actuals);
    setCreateStep('volume_spec');
    setLabView('scenario_create');
  };

  const handleGenerateFromVolume = () => {
    const profile = agentProfiles.find((p) => p.profile_id === createProfileId);
    if (!profile) return;
    const volumeInput: ScenarioVolumeInput = {
      profile_id: profile.profile_id,
      volume_specs: createVolumeSpecs.filter((v) => v.events_per_month > 0),
      time_span_months: parseInt(createTimeSpan) || 6,
      include_actuals: createActuals,
    };
    const scenario = generateScenarioFromVolume({ profile, volumeInput, adminUser, catalogKpis });
    setScenarios((prev) => [scenario, ...prev]);
    const run = executeRun({ scenario, adminUser });
    setRuns((prev) => [run, ...prev]);
    setChartRuns((prev) => [...prev, { ...run, scenarioName: scenario.name }]);
    setSelectedScenario(scenario);
    setSelectedRun(run);
    setLabView('scenario_list');
    setRunStatus(`"${scenario.name}" generated from volume specs — PC@eval: $${run.pc_at_eval_date.toLocaleString()}`);
  };

  const handleCreateFromProfile = (profile: ScenarioProfile) => {
    const scenario = generateScenarioFromProfile({ profile, adminUser, catalogKpis });
    setScenarios((prev) => [scenario, ...prev]);
    // Auto-run and add to chart
    const run = executeRun({ scenario, adminUser });
    setRuns((prev) => [run, ...prev]);
    setChartRuns((prev) => [...prev, { ...run, scenarioName: scenario.name }]);
    setSelectedScenario(scenario);
    setSelectedRun(run);
    setLabView('scenario_list');
    setRunStatus(`"${scenario.name}" created and run — PC@eval: $${run.pc_at_eval_date.toLocaleString()}`);
  };

  const handleDeleteScenario = (scenarioId: string) => {
    setScenarios((prev) => prev.filter((s) => s.scenario_id !== scenarioId));
    setRuns((prev) => prev.filter((r) => r.scenario_id !== scenarioId));
    setChartRuns((prev) => prev.filter((r) => r.scenario_id !== scenarioId));
    if (selectedScenario?.scenario_id === scenarioId) {
      setSelectedScenario(null);
      setLabView('scenario_list');
    }
    setRunStatus('Scenario deleted');
  };

  const handleRunScenario = (scenario: LabScenario) => {
    const run = executeRun({ scenario, adminUser });
    setRuns((prev) => [run, ...prev]);
    // Replace or add this scenario's line on the chart
    setChartRuns((prev) => {
      const withoutOld = prev.filter((r) => r.scenario_id !== scenario.scenario_id);
      return [...withoutOld, { ...run, scenarioName: scenario.name }];
    });
    setSelectedRun(run);
    setLabView('run_detail');
    setRunStatus(`Run ${run.run_id.slice(0, 12)} completed — PC@eval: $${run.pc_at_eval_date.toLocaleString()}`);

    // Auto-compute calibration if actuals exist
    if (scenario.actual_closings.length > 0) {
      setCalibrationMetrics(computeCalibrationMetrics(scenario, run));
    }
  };

  const handleCompare = () => {
    const runA = runs.find((r) => r.run_id === compareRunAId);
    const runB = runs.find((r) => r.run_id === compareRunBId);
    if (runA && runB) {
      setComparison(compareRuns(runA, runB));
    }
  };

  const handleMarkGolden = (scenario: LabScenario, run: RunBundle) => {
    const tol = parseFloat(goldenTolerance) || 5;
    const expected = captureGoldenSnapshot(run, tol);
    registerGoldenScenario(scenario, expected);
    setScenarios((prev) =>
      prev.map((s) => (s.scenario_id === scenario.scenario_id ? { ...s, is_golden: true } : s))
    );
    setRunStatus(`Scenario "${scenario.name}" registered as golden (±${tol}% tolerance)`);
  };

  const handleRunRegression = () => {
    const report = runRegressionSuite(adminUser);
    setRegressionReport(report);
    setLabView('golden');
    setRunStatus(
      `Regression: ${report.passed}/${report.total_scenarios} passed, ${report.failed} failed`
    );
  };

  const handleExportJson = (data: unknown, filename: string) => {
    if (Platform.OS !== 'web') return;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── KPI drill-down handler ──

  const handleKpiDropdownSelect = (runId: string) => {
    setKpiDropdownRunId(runId);
    setSelectedKpiName('');
    setKpiDropdownOpen(true);
    const run = chartRuns.find((r) => r.run_id === runId);
    if (run) {
      const scenario = scenarios.find((s) => s.scenario_id === run.scenario_id);
      if (scenario) {
        setPerKpiData(computePerKpiSeries(scenario, new Date(run.eval_date_iso), run.gp_vp.total_bump_percent));
      }
    }
  };

  // ── Sub-view: Projection Chart ──

  const renderProjectionChart = () => {
    if (chartRuns.length === 0) return null;

    const CHART_W = 720;
    const CHART_H = 280;
    const PAD = { top: 20, right: 20, bottom: 50, left: 72 };
    const plotW = CHART_W - PAD.left - PAD.right;
    const plotH = CHART_H - PAD.top - PAD.bottom;

    // Chart shows 6 months (numeric tables still use full 12m data)
    const CHART_MONTHS = 6;
    const monthLabels = (chartRuns[0]?.future_projected_12m ?? [])
      .slice(0, CHART_MONTHS)
      .map((p) => p.month_start.slice(0, 7));
    const monthCount = monthLabels.length || 1;

    // Build actual baseline + rolling avg series per run
    type ChartLineDef = {
      runId: string;
      type: 'projection' | 'projectionGhost' | 'actual' | 'rollingAvg' | 'preBoost';
      d: string;
      color: string;
      strokeWidth: number;
      opacity: number;
      dash?: string;
    };

    // Build per-scenario series: projected income, actual baseline, rolling avg
    // All series sliced to CHART_MONTHS for the chart (full 12m data still used by tables)
    const projIncomeMap: Record<string, MonthlySeriesPoint[]> = {};
    const rawDecayMap: Record<string, MonthlySeriesPoint[]> = {};
    const ghostStartMap: Record<string, number> = {}; // index where ghost kicks in
    const actualSeriesMap: Record<string, MonthlySeriesPoint[]> = {};
    const rollingSeriesMap: Record<string, MonthlySeriesPoint[]> = {};
    const preBoostMap: Record<string, MonthlySeriesPoint[]> = {};
    for (const run of chartRuns) {
      const scenario = scenarios.find((s) => s.scenario_id === run.scenario_id);
      // Use cadence-projected values (sustained) with fallback to raw PC (decaying)
      projIncomeMap[run.run_id] = (run.cadence_projected_12m ?? run.future_projected_12m).slice(0, CHART_MONTHS);
      rawDecayMap[run.run_id] = run.future_projected_12m.slice(0, CHART_MONTHS);

      // Find ghost crossover: where raw decay drops below 50% of cadence value
      // That's where synthetic events become the dominant contributor
      if (run.cadence_projected_12m) {
        const raw = run.future_projected_12m;
        const cad = run.cadence_projected_12m;
        let crossover = CHART_MONTHS; // default: no ghost (all solid)
        for (let i = 0; i < CHART_MONTHS && i < raw.length && i < cad.length; i++) {
          if (cad[i].value > 0 && raw[i].value < cad[i].value * 0.5) {
            crossover = i;
            break;
          }
        }
        ghostStartMap[run.run_id] = crossover;
      } else {
        ghostStartMap[run.run_id] = CHART_MONTHS; // no cadence data = all solid
      }

      // Actual baseline — cumulative closing GCI
      if (scenario && scenario.actual_closings.length > 0) {
        const actual = buildActualBaselineSeries(scenario.actual_closings, run.future_projected_12m).slice(0, CHART_MONTHS);
        actualSeriesMap[run.run_id] = actual;
        rollingSeriesMap[run.run_id] = computeRollingAverage(actual, 2).slice(0, CHART_MONTHS);
      }

      // Pre-boost reference: divide out the GP/VP bump factor to show raw projection
      if (run.gp_vp.total_bump_percent > 0) {
        const factor = 1 + run.gp_vp.total_bump_percent;
        preBoostMap[run.run_id] = projIncomeMap[run.run_id].map((p) => ({
          month_start: p.month_start,
          value: Number((p.value / factor).toFixed(2)),
        }));
      }
    }

    // Find max value across all visible lines
    let maxVal = 0;
    for (const run of chartRuns) {
      const vis = chartVisibility[run.run_id];
      if (vis?.projection !== false && projIncomeMap[run.run_id]) {
        for (const pt of projIncomeMap[run.run_id]) {
          if (pt.value > maxVal) maxVal = pt.value;
        }
      }
      if (vis?.actual && actualSeriesMap[run.run_id]) {
        for (const pt of actualSeriesMap[run.run_id]) {
          if (pt.value > maxVal) maxVal = pt.value;
        }
      }
      if (vis?.rollingAvg && rollingSeriesMap[run.run_id]) {
        for (const pt of rollingSeriesMap[run.run_id]) {
          if (pt.value > maxVal) maxVal = pt.value;
        }
      }
    }
    maxVal = maxVal > 0 ? maxVal * 1.1 : 1000; // 10% headroom

    // Y-axis ticks
    const yTickCount = 5;
    const yStep = maxVal / yTickCount;
    const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => i * yStep);

    // Helper: series → SVG path (full series or a slice by index range)
    const seriesToPath = (series: MonthlySeriesPoint[], startIdx?: number, endIdx?: number): string => {
      const from = startIdx ?? 0;
      const to = endIdx ?? series.length;
      const slice = series.slice(from, to);
      if (slice.length === 0) return '';
      const pts = slice.map((pt, si) => {
        const i = from + si; // original index for x positioning
        const x = PAD.left + (i / (monthCount - 1)) * plotW;
        const y = PAD.top + plotH - (pt.value / maxVal) * plotH;
        return `${x},${y}`;
      });
      return 'M' + pts.join(' L');
    };

    // Build ChartLineDef[] array — up to 3 per scenario
    const chartLines: ChartLineDef[] = [];
    chartRuns.forEach((run, runIdx) => {
      const color = CHART_COLORS[runIdx % CHART_COLORS.length];
      const vis = chartVisibility[run.run_id] ?? { projection: true, actual: false, rollingAvg: false };

      // Pre-boost reference (render first = furthest behind)
      if (vis.projection && preBoostMap[run.run_id]) {
        chartLines.push({
          runId: run.run_id, type: 'preBoost',
          d: seriesToPath(preBoostMap[run.run_id]),
          color, strokeWidth: 1.5, opacity: 0.2, dash: '3,3',
        });
      }
      // Rolling avg (render behind main lines)
      if (vis.rollingAvg && rollingSeriesMap[run.run_id]) {
        chartLines.push({
          runId: run.run_id, type: 'rollingAvg',
          d: seriesToPath(rollingSeriesMap[run.run_id]),
          color, strokeWidth: 3.5, opacity: 0.35,
        });
      }
      // Actual baseline (dashed)
      if (vis.actual && actualSeriesMap[run.run_id]) {
        chartLines.push({
          runId: run.run_id, type: 'actual',
          d: seriesToPath(actualSeriesMap[run.run_id]),
          color, strokeWidth: 2, opacity: 0.6, dash: '6,4',
        });
      }
      // Projection — split into solid (real events) + ghost (synthetic sustain)
      if (vis.projection && projIncomeMap[run.run_id]) {
        const series = projIncomeMap[run.run_id];
        const ghostAt = ghostStartMap[run.run_id] ?? series.length;

        if (ghostAt > 0) {
          // Solid segment: months 0 through ghostAt (inclusive end point for connection)
          const solidEnd = Math.min(ghostAt + 1, series.length);
          const solidD = seriesToPath(series, 0, solidEnd);
          if (solidD) {
            chartLines.push({
              runId: run.run_id, type: 'projection',
              d: solidD,
              color, strokeWidth: 2.5, opacity: 1.0,
            });
          }
        }

        if (ghostAt < series.length) {
          // Ghost segment: from ghostAt onward (overlaps 1 point for seamless join)
          const ghostD = seriesToPath(series, ghostAt);
          if (ghostD) {
            chartLines.push({
              runId: run.run_id, type: 'projectionGhost',
              d: ghostD,
              color, strokeWidth: 2.5, opacity: 0.35,
            });
          }
        }
      }
    });

    const fmtDollar = (v: number) => {
      if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
      if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
      return `$${v.toFixed(0)}`;
    };

    return (
      <View style={{ marginBottom: 20, backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 12 }}>
          Monthly Income — Projected vs Prior-Year Baseline
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Svg width={CHART_W} height={CHART_H}>
            {/* Grid lines */}
            {yTicks.map((tick, i) => {
              const y = PAD.top + plotH - (tick / maxVal) * plotH;
              return (
                <SvgLine key={`grid-${i}`} x1={PAD.left} y1={y} x2={PAD.left + plotW} y2={y} stroke="#F1F5F9" strokeWidth={1} />
              );
            })}
            {/* Y-axis labels */}
            {yTicks.map((tick, i) => {
              const y = PAD.top + plotH - (tick / maxVal) * plotH;
              return (
                <SvgText key={`y-${i}`} x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#94A3B8">
                  {fmtDollar(tick)}
                </SvgText>
              );
            })}
            {/* X-axis labels */}
            {monthLabels.map((label, i) => {
              const x = PAD.left + (i / (monthCount - 1)) * plotW;
              return (
                <SvgText key={`x-${i}`} x={x} y={CHART_H - PAD.bottom + 18} textAnchor="middle" fontSize={9} fill="#94A3B8">
                  {label.slice(5)}
                </SvgText>
              );
            })}
            {/* Y-axis line */}
            <SvgLine x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH} stroke="#E2E8F0" strokeWidth={1} />
            {/* X-axis line */}
            <SvgLine x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH} stroke="#E2E8F0" strokeWidth={1} />
            {/* Data lines — all types */}
            {chartLines.map((line, li) => (
              <Path
                key={`${line.runId}-${line.type}-${li}`}
                d={line.d}
                stroke={line.color}
                strokeWidth={line.strokeWidth}
                strokeOpacity={line.opacity}
                strokeDasharray={line.dash}
                fill="none"
              />
            ))}
            {/* End-point dots (projection lines only) */}
            {chartRuns.map((run, runIdx) => {
              const vis = chartVisibility[run.run_id];
              if (!vis?.projection) return null;
              const projSeries = projIncomeMap[run.run_id];
              const lastPt = projSeries?.[projSeries.length - 1];
              if (!lastPt) return null;
              const x = PAD.left + ((monthCount - 1) / (monthCount - 1)) * plotW;
              const y = PAD.top + plotH - (lastPt.value / maxVal) * plotH;
              const isGhostEnd = (ghostStartMap[run.run_id] ?? projSeries.length) < projSeries.length;
              return (
                <Circle key={`dot-${run.run_id}`} cx={x} cy={y} r={4} fill={CHART_COLORS[runIdx % CHART_COLORS.length]} fillOpacity={isGhostEnd ? 0.4 : 1} />
              );
            })}
          </Svg>
        </ScrollView>

        {/* Chart Key */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10, paddingVertical: 6, borderTopWidth: 1, borderColor: '#F1F5F9', flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 24, height: 2.5, backgroundColor: '#64748B', borderRadius: 1 }} />
            <Text style={{ fontSize: 10, color: '#64748B' }}>Projection</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 24, height: 2.5, backgroundColor: '#64748B', borderRadius: 1, opacity: 0.35 }} />
            <Text style={{ fontSize: 10, color: '#64748B' }}>Cadence (projected)</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 24, height: 0, borderTopWidth: 2, borderColor: '#64748B', borderStyle: 'dashed' }} />
            <Text style={{ fontSize: 10, color: '#64748B' }}>Actuals</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 24, height: 3.5, backgroundColor: '#64748B', borderRadius: 2, opacity: 0.35 }} />
            <Text style={{ fontSize: 10, color: '#64748B' }}>Rolling Avg</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 24, height: 0, borderTopWidth: 1.5, borderColor: '#64748B', borderStyle: 'dashed', opacity: 0.2 }} />
            <Text style={{ fontSize: 10, color: '#64748B' }}>Pre-boost</Text>
          </View>
        </View>

        {/* Scenario rows — name, projection vs actuals values, toggles */}
        <View style={{ marginTop: 10, gap: 2 }}>
          {chartRuns.map((run, runIdx) => {
            const color = CHART_COLORS[runIdx % CHART_COLORS.length];
            const vis = chartVisibility[run.run_id] ?? { projection: true, actual: false, rollingAvg: false };
            const hasActuals = !!actualSeriesMap[run.run_id];
            const toggleBtn = (label: string, key: 'projection' | 'actual' | 'rollingAvg', enabled: boolean) => {
              const active = vis[key];
              return (
                <Pressable
                  key={key}
                  onPress={() => enabled && toggleChartLine(run.run_id, key)}
                  style={{
                    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4,
                    backgroundColor: !enabled ? '#F1F5F9' : active ? color : '#F1F5F9',
                    opacity: enabled ? 1 : 0.4,
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: '600', color: !enabled ? '#94A3B8' : active ? '#FFF' : '#64748B' }}>
                    {label}
                  </Text>
                </Pressable>
              );
            };
            const fmtShort = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`;

            // Quarterly income: sum months 0-2, 3-5, 6-8, 9-11 from chart series
            const projSeries = projIncomeMap[run.run_id] ?? [];
            const actSeries = actualSeriesMap[run.run_id] ?? [];
            const qSum = (series: MonthlySeriesPoint[], qIdx: number) =>
              series.slice(qIdx * 3, qIdx * 3 + 3).reduce((s, p) => s + p.value, 0);
            const totalSum = (series: MonthlySeriesPoint[]) =>
              series.reduce((s, p) => s + p.value, 0);

            return (
              <Pressable
                key={run.run_id}
                onPress={() => handleKpiDropdownSelect(run.run_id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6,
                  backgroundColor: kpiDropdownRunId === run.run_id ? '#F8FAFC' : 'transparent',
                  borderLeftWidth: 3, borderLeftColor: color,
                }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, alignSelf: 'flex-start', marginTop: 6 }} />
                <View style={{ width: 140, flexShrink: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: '#1E293B' }}>
                    {run.scenarioName}
                  </Text>
                  {/* Boost badge */}
                  {run.gp_vp.total_bump_percent > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                      <View style={{ backgroundColor: '#F0FDF4', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: '#BBF7D0' }}>
                        <Text style={{ fontSize: 8, fontWeight: '700', color: '#166534' }}>
                          GP T{run.gp_vp.gp_tier} · VP T{run.gp_vp.vp_tier} → +{(run.gp_vp.total_bump_percent * 100).toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                      <View style={{ backgroundColor: '#F8FAFC', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Text style={{ fontSize: 8, fontWeight: '600', color: '#94A3B8' }}>
                          T1 / T1 · no boost
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  {/* Column headers */}
                  <View style={{ flexDirection: 'row', gap: 4, marginBottom: 2 }}>
                    <Text style={{ fontSize: 8, color: '#94A3B8', width: 26 }} />
                    <Text style={{ fontSize: 8, color: '#94A3B8', fontWeight: '700', width: 52, textAlign: 'right' }}>Q1</Text>
                    <Text style={{ fontSize: 8, color: '#94A3B8', fontWeight: '700', width: 52, textAlign: 'right' }}>Q2</Text>
                    <Text style={{ fontSize: 8, color: '#94A3B8', fontWeight: '700', width: 52, textAlign: 'right' }}>Q3</Text>
                    <Text style={{ fontSize: 8, color: '#94A3B8', fontWeight: '700', width: 52, textAlign: 'right' }}>Q4</Text>
                    <Text style={{ fontSize: 8, color: '#94A3B8', fontWeight: '700', width: 58, textAlign: 'right' }}>Year</Text>
                  </View>
                  {/* Projection row */}
                  <View style={{ flexDirection: 'row', gap: 4, marginBottom: 1 }}>
                    <Text style={{ fontSize: 9, color: '#3B82F6', fontWeight: '700', width: 26 }}>Proj</Text>
                    <Text style={{ fontSize: 10, color: '#334155', width: 52, textAlign: 'right' }}>{fmtShort(qSum(projSeries, 0))}</Text>
                    <Text style={{ fontSize: 10, color: '#334155', width: 52, textAlign: 'right' }}>{fmtShort(qSum(projSeries, 1))}</Text>
                    <Text style={{ fontSize: 10, color: '#334155', width: 52, textAlign: 'right' }}>{fmtShort(qSum(projSeries, 2))}</Text>
                    <Text style={{ fontSize: 10, color: '#334155', width: 52, textAlign: 'right' }}>{fmtShort(qSum(projSeries, 3))}</Text>
                    <Text style={{ fontSize: 10, color: '#1E293B', fontWeight: '700', width: 58, textAlign: 'right' }}>{fmtShort(totalSum(projSeries))}</Text>
                  </View>
                  {/* Actuals row */}
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <Text style={{ fontSize: 9, color: '#F59E0B', fontWeight: '700', width: 26 }}>Act</Text>
                    <Text style={{ fontSize: 10, color: '#64748B', width: 52, textAlign: 'right' }}>{fmtShort(qSum(actSeries, 0))}</Text>
                    <Text style={{ fontSize: 10, color: '#64748B', width: 52, textAlign: 'right' }}>{fmtShort(qSum(actSeries, 1))}</Text>
                    <Text style={{ fontSize: 10, color: '#64748B', width: 52, textAlign: 'right' }}>{fmtShort(qSum(actSeries, 2))}</Text>
                    <Text style={{ fontSize: 10, color: '#64748B', width: 52, textAlign: 'right' }}>{fmtShort(qSum(actSeries, 3))}</Text>
                    <Text style={{ fontSize: 10, color: '#475569', fontWeight: '700', width: 58, textAlign: 'right' }}>{fmtShort(totalSum(actSeries))}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 3, alignSelf: 'flex-start', marginTop: 4 }}>
                  {toggleBtn('Proj', 'projection', true)}
                  {toggleBtn('Act', 'actual', hasActuals)}
                  {toggleBtn('Avg', 'rollingAvg', hasActuals)}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* KPI Drill-Down */}
        {kpiDropdownOpen && perKpiData.length > 0 ? (
          <View style={{ marginTop: 16, borderTopWidth: 1, borderColor: '#E2E8F0', paddingTop: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 8 }}>
              KPI Revenue Breakdown — {chartRuns.find((r) => r.run_id === kpiDropdownRunId)?.scenarioName}
            </Text>

            {/* KPI selector pills */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              <Pressable
                onPress={() => setSelectedKpiName('')}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: selectedKpiName === '' ? '#3B82F6' : '#F1F5F9' }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: selectedKpiName === '' ? '#FFF' : '#475569' }}>All KPIs</Text>
              </Pressable>
              {perKpiData.map((kpi) => (
                <Pressable
                  key={kpi.kpi_id}
                  onPress={() => setSelectedKpiName(kpi.kpi_name)}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: selectedKpiName === kpi.kpi_name ? '#3B82F6' : '#F1F5F9' }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: selectedKpiName === kpi.kpi_name ? '#FFF' : '#475569' }}>{kpi.kpi_name}</Text>
                </Pressable>
              ))}
            </View>

            {/* Monthly revenue table */}
            {selectedKpiName === '' ? (
              // Summary: all KPIs totals
              <View>
                {perKpiData.sort((a, b) => b.total - a.total).map((kpi) => (
                  <View key={kpi.kpi_id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 12, color: '#475569', flex: 1 }}>{kpi.kpi_name}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E293B', width: 100, textAlign: 'right' }}>
                      ${kpi.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, marginTop: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B' }}>Total (12mo)</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B', width: 100, textAlign: 'right' }}>
                    ${perKpiData.reduce((s, k) => s + k.total, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              </View>
            ) : (
              // Selected KPI: monthly breakdown
              <View>
                {perKpiData
                  .filter((k) => k.kpi_name === selectedKpiName)
                  .map((kpi) => (
                    <View key={kpi.kpi_id}>
                      {kpi.series.map((pt) => (
                        <View key={pt.month_start} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>{pt.month_start.slice(0, 7)}</Text>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E293B' }}>
                            ${pt.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </Text>
                        </View>
                      ))}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, marginTop: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B' }}>Total (12mo)</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B' }}>
                          ${kpi.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </Text>
                      </View>
                    </View>
                  ))}
              </View>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  // ── Sub-view: Nav pills ──

  const navPills: { key: LabView; label: string }[] = [
    { key: 'profile_list', label: 'Profiles' },
    { key: 'scenario_list', label: 'Scenarios' },
    { key: 'compare', label: 'Compare' },
    { key: 'golden', label: 'Golden Tests' },
    { key: 'settings', label: 'Settings' },
  ];

  const renderNavPills = () => (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
      {navPills.map((pill) => (
        <Pressable
          key={pill.key}
          onPress={() => setLabView(pill.key)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 8,
            backgroundColor: labView === pill.key ? '#3B82F6' : '#F1F5F9',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: labView === pill.key ? '#FFF' : '#475569' }}>
            {pill.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  // ── Sub-view: Scenario List ──

  const renderScenarioList = () => (
    <View>
      {/* Projection Chart */}
      {renderProjectionChart()}

      {/* Inline create button */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B' }}>{scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''}</Text>
        <Pressable
          onPress={() => { setCreateStep('pick_profile'); setLabView('scenario_create'); }}
          style={{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#3B82F6', borderRadius: 8 }}
        >
          <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>+ New Scenario</Text>
        </Pressable>
      </View>

      {scenarios.length === 0 ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <Text style={{ fontSize: 15, color: '#94A3B8', marginBottom: 8 }}>No scenarios yet</Text>
          <Pressable onPress={() => { setCreateStep('pick_profile'); setLabView('scenario_create'); }} style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#3B82F6', borderRadius: 8 }}>
            <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>Create First Scenario</Text>
          </Pressable>
        </View>
      ) : (
        scenarios.map((s) => (
          <View
            key={s.scenario_id}
            style={{
              padding: 14,
              borderBottomWidth: 1,
              borderColor: '#E2E8F0',
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Pressable
              onPress={() => { setSelectedScenario(s); setLabView('scenario_detail'); }}
              style={{ flex: 1 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E293B' }}>
                {s.name} {s.is_golden ? '⭐' : ''}
              </Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                {s.user_profile.display_name} · {s.log_stream.length} events · {s.kpi_definitions.length} KPIs
                {s.actual_closings.length > 0 ? ` · ${s.actual_closings.length} actuals` : ''}
              </Text>
            </Pressable>
            <Text style={{ fontSize: 11, color: '#94A3B8', marginRight: 10 }}>{new Date(s.created_at).toLocaleDateString()}</Text>
            <Pressable
              onPress={() => handleDeleteScenario(s.scenario_id)}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#FEF2F2' }}
            >
              <Text style={{ fontSize: 12, color: '#DC2626', fontWeight: '600' }}>Delete</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );

  // ── Sub-view: Scenario Create ──

  const renderScenarioCreate = () => {
    if (createStep === 'volume_spec') {
      const profile = agentProfiles.find((p) => p.profile_id === createProfileId);
      if (!profile) return <Text style={{ color: '#94A3B8' }}>Profile not found</Text>;
      return (
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>Volume Specification</Text>
            <Pressable onPress={() => setCreateStep('pick_profile')} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F1F5F9' }}>
              <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>← Change Profile</Text>
            </Pressable>
          </View>

          {/* Profile summary */}
          <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>{profile.name}</Text>
            <Text style={{ fontSize: 12, color: '#3B82F6', marginTop: 2 }}>{profile.agent_name} · ${profile.avg_price_point.toLocaleString()} avg · {(profile.commission_rate * 100).toFixed(2)}%</Text>
          </View>

          {/* Per-KPI volume inputs */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569' }}>Events per month by KPI:</Text>
          {createVolumeSpecs.map((spec, idx) => (
            <View key={spec.kpi_name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ flex: 1, fontSize: 12, color: '#1E293B' }}>{spec.kpi_name}</Text>
              <TextInput
                value={spec.events_per_month.toString()}
                onChangeText={(v) => {
                  const val = parseFloat(v) || 0;
                  setCreateVolumeSpecs((prev) => prev.map((s, i) => i === idx ? { ...s, events_per_month: val } : s));
                }}
                keyboardType="decimal-pad"
                style={{ width: 70, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, textAlign: 'center', backgroundColor: '#FFF' }}
              />
              <Text style={{ fontSize: 11, color: '#94A3B8' }}>/mo</Text>
            </View>
          ))}

          {/* Time span */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569' }}>Time span:</Text>
            <TextInput
              value={createTimeSpan}
              onChangeText={setCreateTimeSpan}
              keyboardType="numeric"
              style={{ width: 50, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, textAlign: 'center' }}
            />
            <Text style={{ fontSize: 13, color: '#475569' }}>months</Text>
          </View>

          {/* Include actuals toggle */}
          <Pressable onPress={() => setCreateActuals(!createActuals)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: createActuals ? '#3B82F6' : '#CBD5E1', backgroundColor: createActuals ? '#3B82F6' : '#FFF', alignItems: 'center', justifyContent: 'center' }}>
              {createActuals ? <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>✓</Text> : null}
            </View>
            <Text style={{ fontSize: 13, color: '#475569' }}>Include actual closings</Text>
          </Pressable>

          {/* Generate button */}
          <Pressable
            onPress={handleGenerateFromVolume}
            style={{ backgroundColor: '#3B82F6', borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Generate Scenario</Text>
          </Pressable>
        </View>
      );
    }

    // Step 1: Pick profile
    return (
      <View style={{ gap: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>Create Scenario — Pick a Profile</Text>
        <Text style={{ fontSize: 13, color: '#64748B', marginTop: -8 }}>
          Choose an agent profile, then configure per-KPI volume and frequency. Or use "Quick Generate" for a random scenario.
        </Text>
        {agentProfiles.map((profile) => (
          <View
            key={profile.profile_id}
            style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 16 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B' }}>{profile.name}</Text>
                <Text style={{ fontSize: 12, color: '#3B82F6', marginTop: 2 }}>{profile.agent_name}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View style={{ backgroundColor: profile.is_builtin ? '#FEF3C7' : '#E0E7FF', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: profile.is_builtin ? '#92400E' : '#4338CA' }}>{profile.is_builtin ? 'BUILT-IN' : 'CUSTOM'}</Text>
                </View>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 18, marginBottom: 8 }}>{profile.description}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {profile.kpi_names.map((kpi) => (
                <View key={kpi} style={{ backgroundColor: '#F1F5F9', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, color: '#475569' }}>{kpi}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => handleStartVolumeCreate(profile)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: '#3B82F6', alignItems: 'center' }}
              >
                <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 12 }}>Configure Volume →</Text>
              </Pressable>
              {/* Quick Generate uses the legacy random path if a matching ScenarioProfile exists */}
              {(() => {
                const legacyProfile = SCENARIO_PROFILES.find((sp) => `builtin-${sp.id}` === profile.profile_id);
                if (!legacyProfile) return null;
                return (
                  <Pressable
                    onPress={() => handleCreateFromProfile(legacyProfile)}
                    style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#F1F5F9', alignItems: 'center' }}
                  >
                    <Text style={{ color: '#475569', fontWeight: '600', fontSize: 12 }}>Quick Generate (random)</Text>
                  </Pressable>
                );
              })()}
            </View>
          </View>
        ))}
      </View>
    );
  };

  // ── Sub-view: Profile List ──

  const renderProfileList = () => (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>Agent Profiles</Text>
        <Pressable
          onPress={() => { handleProfileFormReset(); setLabView('profile_create'); }}
          style={{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#3B82F6', borderRadius: 8 }}
        >
          <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>+ Create Profile</Text>
        </Pressable>
      </View>
      <Text style={{ fontSize: 13, color: '#64748B' }}>
        Agent profiles define WHO the agent is and WHICH KPIs they track. Use profiles to create scenarios.
      </Text>
      {agentProfiles.map((profile) => (
        <Pressable
          key={profile.profile_id}
          onPress={() => {
            handleProfileFormStartEdit(profile);
          }}
          style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 14 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B' }}>{profile.name}</Text>
              <Text style={{ fontSize: 12, color: '#3B82F6', marginTop: 1 }}>{profile.agent_name} · ${profile.avg_price_point.toLocaleString()} · {(profile.commission_rate * 100).toFixed(2)}%</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <View style={{ backgroundColor: profile.is_builtin ? '#FEF3C7' : '#E0E7FF', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: profile.is_builtin ? '#92400E' : '#4338CA' }}>{profile.is_builtin ? 'BUILT-IN' : 'CUSTOM'}</Text>
              </View>
              <View style={{ backgroundColor: '#F1F5F9', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 10, color: '#475569' }}>{profile.kpi_names.length} KPIs</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {profile.kpi_names.slice(0, 6).map((kpi) => (
              <View key={kpi} style={{ backgroundColor: '#F1F5F9', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Text style={{ fontSize: 10, color: '#475569' }}>{kpi}</Text>
              </View>
            ))}
            {profile.kpi_names.length > 6 ? (
              <Text style={{ fontSize: 10, color: '#94A3B8' }}>+{profile.kpi_names.length - 6} more</Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); handleStartVolumeCreate(profile); }}
              style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#EFF6FF' }}
            >
              <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '600' }}>→ Create Scenario</Text>
            </Pressable>
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); handleProfileFormStartEdit(profile); }}
              style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#F1F5F9' }}
            >
              <Text style={{ fontSize: 11, color: '#475569', fontWeight: '600' }}>Edit</Text>
            </Pressable>
            {profile.is_builtin ? (
              <Pressable
                onPress={(e) => { e.stopPropagation?.(); handleDuplicateProfile(profile); }}
                style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#F1F5F9' }}
              >
                <Text style={{ fontSize: 11, color: '#475569', fontWeight: '600' }}>Duplicate</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );

  // ── Sub-view: Profile Create / Edit ──

  const renderProfileForm = (isNew: boolean) => (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>
        {isNew ? 'Create Agent Profile' : `Edit: ${profileFormName}`}
      </Text>

      {/* Name */}
      <View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Profile Name</Text>
        <TextInput
          value={profileFormName}
          onChangeText={setProfileFormName}
          placeholder="e.g. Luxury Listing Agent"
          style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, backgroundColor: '#FFF' }}
        />
      </View>

      {/* Agent name */}
      <View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Agent Name</Text>
        <TextInput
          value={profileFormAgent}
          onChangeText={setProfileFormAgent}
          placeholder="e.g. Sarah Mitchell"
          style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, backgroundColor: '#FFF' }}
        />
      </View>

      {/* Price point + Commission row */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Avg Price Point ($)</Text>
          <TextInput
            value={profileFormPrice}
            onChangeText={setProfileFormPrice}
            keyboardType="numeric"
            style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, backgroundColor: '#FFF' }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Commission (%)</Text>
          <TextInput
            value={profileFormCommission}
            onChangeText={setProfileFormCommission}
            keyboardType="numeric"
            style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, backgroundColor: '#FFF' }}
          />
        </View>
      </View>

      {/* Description */}
      <View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Description</Text>
        <TextInput
          value={profileFormDesc}
          onChangeText={setProfileFormDesc}
          placeholder="Describe this agent archetype..."
          multiline
          numberOfLines={3}
          style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, backgroundColor: '#FFF', minHeight: 60 }}
        />
      </View>

      {/* Include actuals toggle */}
      <Pressable onPress={() => setProfileFormActuals(!profileFormActuals)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: profileFormActuals ? '#3B82F6' : '#CBD5E1', backgroundColor: profileFormActuals ? '#3B82F6' : '#FFF', alignItems: 'center', justifyContent: 'center' }}>
          {profileFormActuals ? <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>✓</Text> : null}
        </View>
        <Text style={{ fontSize: 13, color: '#475569' }}>Include actual closings by default</Text>
      </Pressable>

      {/* Pipeline Contribution (PC) KPI picker */}
      <View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6 }}>Pipeline Contribution KPIs ({profileFormKpis.length})</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {pcTemplates.map((t) => {
            const selected = profileFormKpis.includes(t.name);
            return (
              <Pressable
                key={t.name}
                onPress={() => {
                  setProfileFormKpis((prev) =>
                    selected ? prev.filter((n) => n !== t.name) : [...prev, t.name]
                  );
                }}
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1,
                  borderColor: selected ? '#3B82F6' : '#CBD5E1',
                  backgroundColor: selected ? '#EFF6FF' : '#FFF',
                }}
              >
                <Text style={{ fontSize: 11, color: selected ? '#2563EB' : '#64748B', fontWeight: selected ? '600' : '400' }}>{t.name}</Text>
              </Pressable>
            );
          })}
          {pcTemplates.length === 0 ? <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>No PC KPIs in catalog</Text> : null}
        </View>
      </View>

      {/* Growth (GP) KPI picker */}
      <View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#166534', marginBottom: 6 }}>Growth Point KPIs ({profileFormGpKpis.length})</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {gpTemplates.map((t) => {
            const selected = profileFormGpKpis.includes(t.name);
            return (
              <Pressable
                key={t.name}
                onPress={() => {
                  setProfileFormGpKpis((prev) =>
                    selected ? prev.filter((n) => n !== t.name) : [...prev, t.name]
                  );
                }}
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1,
                  borderColor: selected ? '#16A34A' : '#D1FAE5',
                  backgroundColor: selected ? '#F0FDF4' : '#FFF',
                }}
              >
                <Text style={{ fontSize: 11, color: selected ? '#166534' : '#64748B', fontWeight: selected ? '600' : '400' }}>{t.name}</Text>
              </Pressable>
            );
          })}
          {gpTemplates.length === 0 ? <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>No GP KPIs in catalog</Text> : null}
        </View>
      </View>

      {/* Vitality (VP) KPI picker */}
      <View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B21A8', marginBottom: 6 }}>Vitality Point KPIs ({profileFormVpKpis.length})</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {vpTemplates.map((t) => {
            const selected = profileFormVpKpis.includes(t.name);
            return (
              <Pressable
                key={t.name}
                onPress={() => {
                  setProfileFormVpKpis((prev) =>
                    selected ? prev.filter((n) => n !== t.name) : [...prev, t.name]
                  );
                }}
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1,
                  borderColor: selected ? '#9333EA' : '#F3E8FF',
                  backgroundColor: selected ? '#FAF5FF' : '#FFF',
                }}
              >
                <Text style={{ fontSize: 11, color: selected ? '#6B21A8' : '#64748B', fontWeight: selected ? '600' : '400' }}>{t.name}</Text>
              </Pressable>
            );
          })}
          {vpTemplates.length === 0 ? <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>No VP KPIs in catalog</Text> : null}
        </View>
      </View>

      {/* Save / Delete row */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <Pressable
          onPress={() => handleSaveProfile(isNew)}
          style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#3B82F6', alignItems: 'center' }}
        >
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>{isNew ? 'Create Profile' : 'Save Changes'}</Text>
        </Pressable>
        {!isNew ? (
          <Pressable
            onPress={() => handleDeleteProfile(selectedProfile!.profile_id)}
            style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center' }}
          >
            <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 14 }}>Delete</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  // ── Helper: single KPI row for scenario edit view ──

  const renderEditKpiRow = (k: LabKpiDefinition) => {
    const isGp = k.gp_value > 0;
    const isVp = k.vp_value > 0;
    const typeLabel = isGp ? `GP: ${k.gp_value} pts` : isVp ? `VP: ${k.vp_value} pts` : `Weight: ${k.weight_percent}%`;
    const borderColor = isGp ? '#D1FAE5' : isVp ? '#F3E8FF' : '#E2E8F0';
    return (
      <View key={k.kpi_id} style={{ backgroundColor: '#FFF', borderRadius: 6, padding: 10, borderWidth: 1, borderColor, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E293B' }}>{k.name}</Text>
            <Text style={{ fontSize: 10, color: '#64748B' }}>
              {typeLabel}{!isGp && !isVp ? ` · TTC: ${k.ttc_definition ?? 'none'} · Delay: ${k.delay_days ?? 0}d · Hold: ${k.hold_days ?? 0}d` : ''}
            </Text>
          </View>
          <Pressable onPress={() => handleRemoveKpiFromEdit(k.kpi_id)} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#FEF2F2', borderRadius: 4 }}>
            <Text style={{ fontSize: 10, color: '#DC2626', fontWeight: '600' }}>✕</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4 }}>
          <Text style={{ fontSize: 11, color: '#64748B' }}>Events/mo:</Text>
          <TextInput
            value={editKpiMonthlyVolume[k.kpi_id] ?? ''}
            onChangeText={(v) => setEditKpiMonthlyVolume((prev) => ({ ...prev, [k.kpi_id]: v }))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#CBD5E1"
            style={{ width: 70, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, textAlign: 'center', color: '#1E293B' }}
          />
          <Text style={{ fontSize: 10, color: '#94A3B8' }}>/mo</Text>
          {(() => {
            const monthlyVol = parseFloat(editKpiMonthlyVolume[k.kpi_id] ?? '0') || 0;
            if (monthlyVol <= 0) return null;
            const months = parseInt(editTimeSpan) || 6;
            const totalEvents = monthlyVol * months;
            if (isGp) return <Text style={{ fontSize: 10, color: '#16A34A' }}>→ {(k.gp_value * totalEvents).toFixed(0)} GP/{months}mo</Text>;
            if (isVp) return <Text style={{ fontSize: 10, color: '#9333EA' }}>→ {(k.vp_value * totalEvents).toFixed(0)} VP/{months}mo</Text>;
            const pp = parseFloat(editPricePoint) || 0;
            const cr = (parseFloat(editCommission) || 0) / 100;
            const pcPerEvent = pp * cr * (k.weight_percent / 100);
            return <Text style={{ fontSize: 10, color: '#94A3B8' }}>→ PC: ${(pcPerEvent * totalEvents).toLocaleString(undefined, { maximumFractionDigits: 0 })}/{months}mo</Text>;
          })()}
        </View>
      </View>
    );
  };

  // ── Sub-view: Scenario Edit ──

  const renderScenarioEdit = () => {
    if (!selectedScenario) return <Text style={{ color: '#94A3B8' }}>No scenario selected</Text>;
    const kpiNameMap = new Map(editKpiDefs.map((k) => [k.kpi_id, k.name]));
    const availableTemplates = allTemplateDefs.filter(
      (t) => !editKpiDefs.some((k) => k.name === t.name)
    );
    // Group available templates by type for the Add KPI dropdown
    const availablePC = availableTemplates.filter((t) => t.weight_percent > 0 && t.gp_value === 0 && t.vp_value === 0);
    const availableGP = availableTemplates.filter((t) => t.gp_value > 0);
    const availableVP = availableTemplates.filter((t) => t.vp_value > 0);
    // Group current KPIs by type
    const editPcKpis = editKpiDefs.filter((k) => k.weight_percent > 0 && k.gp_value === 0 && k.vp_value === 0);
    const editGpKpis = editKpiDefs.filter((k) => k.gp_value > 0);
    const editVpKpis = editKpiDefs.filter((k) => k.vp_value > 0);

    return (
      <View style={{ gap: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1E293B' }}>Edit Scenario</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => setLabView('scenario_detail')} style={{ backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: '#475569', fontWeight: '600', fontSize: 13 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSaveEdit} style={{ backgroundColor: '#3B82F6', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>Save & Re-Run</Text>
            </Pressable>
          </View>
        </View>

        {/* Scenario Name */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14, gap: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155' }}>Scenario Name</Text>
          <TextInput
            value={editName}
            onChangeText={setEditName}
            style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, padding: 10, fontSize: 14, color: '#1E293B' }}
          />
        </View>

        {/* Agent Profile */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14, gap: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155' }}>Agent Profile</Text>
          <View style={{ gap: 8 }}>
            <View>
              <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Agent Name</Text>
              <TextInput
                value={editDisplayName}
                onChangeText={setEditDisplayName}
                style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, padding: 10, fontSize: 13, color: '#1E293B' }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Avg Price Point ($)</Text>
                <TextInput
                  value={editPricePoint}
                  onChangeText={setEditPricePoint}
                  keyboardType="numeric"
                  style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, padding: 10, fontSize: 13, color: '#1E293B' }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>Commission (%)</Text>
                <TextInput
                  value={editCommission}
                  onChangeText={setEditCommission}
                  keyboardType="numeric"
                  style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, padding: 10, fontSize: 13, color: '#1E293B' }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Closed Deals Per Year (actuals) */}
        <View style={{ backgroundColor: '#F0FDF4', borderRadius: 8, padding: 14, gap: 10, borderWidth: 1, borderColor: '#BBF7D0' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155' }}>Actuals — Closed Deals / Year</Text>
          <Text style={{ fontSize: 11, color: '#64748B' }}>
            How many deals this agent closes per year. Evenly distributed across 12 months for the actuals line.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput
              value={editClosedDeals}
              onChangeText={setEditClosedDeals}
              keyboardType="numeric"
              placeholder={`Auto (${Math.max(6, Math.min(20, Math.round(150000 / ((parseFloat(editPricePoint) || 400000) * ((parseFloat(editCommission) || 3) / 100)))))})`}
              placeholderTextColor="#94A3B8"
              style={{ flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 6, padding: 10, fontSize: 14, color: '#1E293B' }}
            />
            <Text style={{ fontSize: 12, color: '#64748B' }}>deals/year</Text>
          </View>
        </View>

        {/* Time Span */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14, gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155' }}>Time Span</Text>
          <Text style={{ fontSize: 11, color: '#64748B' }}>
            How many months of KPI activity to simulate. Events are distributed evenly across this window.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput
              value={editTimeSpan}
              onChangeText={setEditTimeSpan}
              keyboardType="numeric"
              style={{ width: 60, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, textAlign: 'center', color: '#1E293B' }}
            />
            <Text style={{ fontSize: 13, color: '#475569' }}>months</Text>
          </View>
        </View>

        {/* KPI Definitions + Monthly Volume */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155' }}>KPIs ({editKpiDefs.length})</Text>
            <Pressable onPress={() => setEditAddKpiOpen(!editAddKpiOpen)} style={{ backgroundColor: '#3B82F6', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>{editAddKpiOpen ? 'Close' : '+ Add KPI'}</Text>
            </Pressable>
          </View>

          {/* Add KPI dropdown — grouped by type */}
          {editAddKpiOpen && availableTemplates.length > 0 ? (
            <View style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, maxHeight: 280, overflow: 'hidden' }}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 280 }}>
                {availablePC.length > 0 ? <Text style={{ fontSize: 10, fontWeight: '700', color: '#3B82F6', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 2 }}>Pipeline Contribution</Text> : null}
                {availablePC.map((t) => (
                  <Pressable key={t.name} onPress={() => handleAddKpiToEdit(t)} style={{ padding: 10, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E293B' }}>{t.name}</Text>
                    <Text style={{ fontSize: 10, color: '#64748B' }}>Weight: {t.weight_percent}% · TTC: {t.ttc_definition ?? 'none'} · Delay: {t.delay_days ?? 0}d</Text>
                  </Pressable>
                ))}
                {availableGP.length > 0 ? <Text style={{ fontSize: 10, fontWeight: '700', color: '#16A34A', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 2 }}>Growth Points</Text> : null}
                {availableGP.map((t) => (
                  <Pressable key={t.name} onPress={() => handleAddKpiToEdit(t)} style={{ padding: 10, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E293B' }}>{t.name}</Text>
                    <Text style={{ fontSize: 10, color: '#166534' }}>GP: {t.gp_value} pts/event</Text>
                  </Pressable>
                ))}
                {availableVP.length > 0 ? <Text style={{ fontSize: 10, fontWeight: '700', color: '#9333EA', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 2 }}>Vitality Points</Text> : null}
                {availableVP.map((t) => (
                  <Pressable key={t.name} onPress={() => handleAddKpiToEdit(t)} style={{ padding: 10, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E293B' }}>{t.name}</Text>
                    <Text style={{ fontSize: 10, color: '#6B21A8' }}>VP: {t.vp_value} pts/event</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : editAddKpiOpen && availableTemplates.length === 0 ? (
            <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>All available KPI templates already added</Text>
          ) : null}

          {/* Current KPIs grouped by type */}
          {editPcKpis.length > 0 ? (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#3B82F6' }}>Pipeline Contribution ({editPcKpis.length})</Text>
              {editPcKpis.map((k) => renderEditKpiRow(k))}
            </View>
          ) : null}
          {editGpKpis.length > 0 ? (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#16A34A' }}>Growth Points ({editGpKpis.length})</Text>
              {editGpKpis.map((k) => renderEditKpiRow(k))}
            </View>
          ) : null}
          {editVpKpis.length > 0 ? (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#9333EA' }}>Vitality Points ({editVpKpis.length})</Text>
              {editVpKpis.map((k) => renderEditKpiRow(k))}
            </View>
          ) : null}
        </View>

        {/* Event Stream (Log Entries) */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155' }}>Events ({editLogStream.length})</Text>
            <Pressable onPress={handleAddLogEntry} style={{ backgroundColor: '#3B82F6', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>+ Add Event</Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 11, color: '#94A3B8' }}>
            Each event generates projected commission (PC) based on the KPI weight, your price point, and commission rate.
          </Text>

          {editLogStream.length === 0 ? (
            <Text style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 }}>
              No events. Tap "+ Add Event" to create one.
            </Text>
          ) : (
            editLogStream.map((log, idx) => (
              <View key={log.log_id} style={{ backgroundColor: '#FFF', borderRadius: 6, padding: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8' }}>Event #{idx + 1}</Text>
                  <Pressable onPress={() => handleRemoveLogEntry(log.log_id)} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#FEF2F2', borderRadius: 4 }}>
                    <Text style={{ fontSize: 10, color: '#DC2626', fontWeight: '600' }}>Remove</Text>
                  </Pressable>
                </View>
                <View style={{ gap: 6 }}>
                  {/* KPI selector */}
                  <View>
                    <Text style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>KPI</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {editKpiDefs.map((k) => (
                        <Pressable
                          key={k.kpi_id}
                          onPress={() => handleUpdateLogEntry(log.log_id, 'kpi_id', k.kpi_id)}
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 4,
                            backgroundColor: log.kpi_id === k.kpi_id ? '#3B82F6' : '#F1F5F9',
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '600', color: log.kpi_id === k.kpi_id ? '#FFF' : '#475569' }}>
                            {k.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 2 }}>
                      <Text style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>Date (YYYY-MM-DD)</Text>
                      <TextInput
                        value={log.event_date_iso.split('T')[0]}
                        onChangeText={(v) => handleUpdateLogEntry(log.log_id, 'event_date_iso', v)}
                        style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 4, padding: 8, fontSize: 12, color: '#1E293B' }}
                        placeholder="2025-01-15"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>Qty</Text>
                      <TextInput
                        value={log.quantity.toString()}
                        onChangeText={(v) => handleUpdateLogEntry(log.log_id, 'quantity', v)}
                        keyboardType="numeric"
                        style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 4, padding: 8, fontSize: 12, color: '#1E293B' }}
                      />
                    </View>
                  </View>
                  {/* Computed PC preview */}
                  <Text style={{ fontSize: 10, color: '#94A3B8' }}>
                    KPI: {kpiNameMap.get(log.kpi_id) ?? 'Unknown'}
                    {(() => {
                      const kpi = editKpiDefs.find((k) => k.kpi_id === log.kpi_id);
                      if (!kpi) return '';
                      const pp = parseFloat(editPricePoint) || 0;
                      const cr = (parseFloat(editCommission) || 0) / 100;
                      const pc = pp * cr * (kpi.weight_percent / 100) * log.quantity;
                      return ` → Initial PC: $${pc.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                    })()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    );
  };

  // ── Sub-view: Scenario Detail ──

  const renderScenarioDetail = () => {
    if (!selectedScenario) return <Text style={{ color: '#94A3B8' }}>No scenario selected</Text>;
    const s = selectedScenario;
    const scenarioRuns = runs.filter((r) => r.scenario_id === s.scenario_id);

    return (
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1E293B' }}>{s.name}</Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{s.user_profile.display_name} · {s.algorithm_version}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => handleStartEdit(s)} style={{ backgroundColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>Edit</Text>
            </Pressable>
            {(() => {
              const hasRun = chartRuns.some((r) => r.scenario_id === s.scenario_id);
              return (
                <Pressable
                  onPress={() => !hasRun && handleRunScenario(s)}
                  style={{ backgroundColor: hasRun ? '#E2E8F0' : '#3B82F6', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, opacity: hasRun ? 0.5 : 1 }}
                >
                  <Text style={{ color: hasRun ? '#94A3B8' : '#FFF', fontWeight: '600', fontSize: 13 }}>
                    {hasRun ? 'Up to date' : 'Run'}
                  </Text>
                </Pressable>
              );
            })()}
            <Pressable onPress={() => handleExportJson(s, `scenario-${s.scenario_id.slice(0, 12)}.json`)} style={{ backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: '#475569', fontWeight: '600', fontSize: 13 }}>Export</Text>
            </Pressable>
          </View>
        </View>

        {/* User Profile */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 }}>User Profile</Text>
          <Text style={{ fontSize: 12, color: '#64748B' }}>
            {s.user_profile.display_name} · Avg Price: ${s.user_profile.average_price_point.toLocaleString()} · Commission: {(s.user_profile.commission_rate * 100).toFixed(2)}%
          </Text>
        </View>

        {/* Actuals / Volume Summary */}
        {(s.closed_deals_override || s.kpi_monthly_volume) ? (
          <View style={{ backgroundColor: '#F0FDF4', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#BBF7D0' }}>
            {s.closed_deals_override ? (
              <Text style={{ fontSize: 12, color: '#16A34A', fontWeight: '600', marginBottom: 4 }}>
                Closed Deals: {s.closed_deals_override}/yr · {s.actual_closings.length} closings generated
              </Text>
            ) : null}
            {s.volume_input ? (
              <Text style={{ fontSize: 11, color: '#475569', fontWeight: '600', marginBottom: 4 }}>Time span: {s.volume_input.time_span_months} months</Text>
            ) : null}
            {s.kpi_monthly_volume ? (
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155' }}>KPI Volumes (per month):</Text>
                {Object.entries(s.kpi_monthly_volume).map(([kId, vol]) => {
                  const kpi = s.kpi_definitions.find((k) => k.kpi_id === kId);
                  return (
                    <Text key={kId} style={{ fontSize: 11, color: '#64748B' }}>
                      {kpi?.name ?? kId}: {vol}/mo
                    </Text>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* KPI Definitions */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 }}>KPI Definitions ({s.kpi_definitions.length})</Text>
          {s.kpi_definitions.map((k) => (
            <Text key={k.kpi_id} style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>
              {k.name} — Weight: {k.weight_percent}% · TTC: {k.ttc_definition ?? 'none'} · GP: {k.gp_value} · VP: {k.vp_value}
            </Text>
          ))}
        </View>

        {/* Event Stream */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14 }}>
          <Pressable
            onPress={() => setExpandedEvents(!expandedEvents)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>
              Event Stream: {s.log_stream.length} events
              {s.actual_closings.length > 0 ? ` · ${s.actual_closings.length} actual closings` : ''}
            </Text>
            <Text style={{ fontSize: 12, color: '#3B82F6' }}>{expandedEvents ? '▼ Hide' : '▶ Show'}</Text>
          </Pressable>
          {expandedEvents ? (
            <View style={{ marginTop: 10, gap: 6 }}>
              {s.log_stream.map((log, idx) => {
                const kpi = s.kpi_definitions.find((k) => k.kpi_id === log.kpi_id);
                const pc = s.user_profile.average_price_point * s.user_profile.commission_rate * ((kpi?.weight_percent ?? 0) / 100) * log.quantity;
                return (
                  <View key={log.log_id} style={{ backgroundColor: '#FFF', borderRadius: 6, padding: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E293B' }}>
                        {kpi?.name ?? 'Unknown'} × {log.quantity}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>{log.event_date_iso.split('T')[0]}</Text>
                    </View>
                    <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                      Initial PC: ${pc.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      {log.initial_pc_override ? ` (override: $${log.initial_pc_override.toLocaleString()})` : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Runs for this scenario */}
        {scenarioRuns.length > 0 ? (
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 }}>Runs ({scenarioRuns.length})</Text>
            {scenarioRuns.map((r) => (
              <Pressable
                key={r.run_id}
                onPress={() => { setSelectedRun(r); setLabView('run_detail'); }}
                style={{ padding: 10, borderBottomWidth: 1, borderColor: '#E2E8F0' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B' }}>
                  PC@eval: ${r.pc_at_eval_date.toLocaleString()} · 90d: ${r.pc_90d.toLocaleString()}
                </Text>
                <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                  {r.run_id.slice(0, 16)} · {new Date(r.created_at).toLocaleTimeString()}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  // ── Sub-view: Run Detail ──

  const renderRunDetail = () => {
    if (!selectedRun) return <Text style={{ color: '#94A3B8' }}>No run selected</Text>;
    const r = selectedRun;
    const scenario = scenarios.find((s) => s.scenario_id === r.scenario_id);

    return (
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>Run Detail</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {scenario ? (
              <Pressable onPress={() => handleMarkGolden(scenario, r)} style={{ backgroundColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 12 }}>Mark Golden</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => handleExportJson(r, `run-${r.run_id.slice(0, 8)}.json`)} style={{ backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: '#475569', fontWeight: '600', fontSize: 12 }}>Export</Text>
            </Pressable>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'PC @ Eval', value: `$${r.pc_at_eval_date.toLocaleString()}` },
            { label: '30-Day', value: `$${r.pc_30d.toLocaleString()}` },
            { label: '90-Day', value: `$${r.pc_90d.toLocaleString()}` },
            { label: '180-Day', value: `$${r.pc_180d.toLocaleString()}` },
          ].map((card) => (
            <View key={card.label} style={{ backgroundColor: '#F0F9FF', borderRadius: 8, padding: 14, minWidth: 130, flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>{card.label}</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1E293B' }}>{card.value}</Text>
            </View>
          ))}
        </View>

        {/* Raw vs Modified */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 }}>Raw vs Modifier-Applied</Text>
          <Text style={{ fontSize: 12, color: '#64748B' }}>
            Raw PC: ${r.raw_pc_at_eval.toLocaleString()} → Bump ({(r.gp_vp.total_bump_percent * 100).toFixed(1)}%): ${r.bump_applied_pc_at_eval.toLocaleString()} → Cal (×{r.calibration_multiplier}): ${r.pc_at_eval_date.toLocaleString()}
          </Text>
        </View>

        {/* GP/VP State */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 }}>GP/VP State</Text>
          <Text style={{ fontSize: 12, color: '#64748B' }}>
            GP: {r.gp_vp.gp_current.toFixed(0)} (T{r.gp_vp.gp_tier}, +{(r.gp_vp.gp_bump_percent * 100).toFixed(1)}%) · VP: {r.gp_vp.vp_current.toFixed(0)} (T{r.gp_vp.vp_tier}, +{(r.gp_vp.vp_bump_percent * 100).toFixed(1)}%)
          </Text>
        </View>

        {/* Confidence */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 }}>
            Confidence: {r.confidence.composite.toFixed(1)} ({r.confidence.band.toUpperCase()})
          </Text>
          <Text style={{ fontSize: 12, color: '#64748B' }}>
            Historical Accuracy: {r.confidence.historicalAccuracy.toFixed(1)} · Pipeline Health: {r.confidence.pipelineHealth.toFixed(1)} · Inactivity: {r.confidence.inactivity.toFixed(1)}
          </Text>
        </View>

        {/* Calibration Metrics */}
        {calibrationMetrics ? (
          <View style={{ backgroundColor: '#FFFBEB', borderRadius: 8, padding: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400E', marginBottom: 8 }}>Calibration Sandbox</Text>
            <Text style={{ fontSize: 12, color: '#78350F' }}>
              Actual: ${calibrationMetrics.actual_total.toLocaleString()} vs Projected: ${calibrationMetrics.projected_total.toLocaleString()}
            </Text>
            <Text style={{ fontSize: 12, color: '#78350F' }}>
              Error Ratio: {calibrationMetrics.error_ratio.toFixed(4)} · Abs Error: ${calibrationMetrics.absolute_error.toLocaleString()}
            </Text>
            <Text style={{ fontSize: 12, color: '#78350F' }}>
              Current Multiplier: ×{calibrationMetrics.current_multiplier} → Adjusted: ×{calibrationMetrics.adjusted_multiplier}
            </Text>
          </View>
        ) : null}

        {/* Event Contributions */}
        <View>
          <Pressable
            onPress={() => setExpandedEvents((v) => !v)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>
              Event Contributions ({r.event_contributions.length})
            </Text>
            <Text style={{ fontSize: 14, color: '#94A3B8' }}>{expandedEvents ? '▼' : '▶'}</Text>
          </Pressable>
          {expandedEvents ? (
            <View style={{ gap: 6 }}>
              {r.event_contributions.map((e) => (
                <View key={e.log_id} style={{ backgroundColor: '#F8FAFC', borderRadius: 6, padding: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E293B' }}>
                    {e.kpi_name} — ${e.current_value.toLocaleString()} ({e.phase_at_eval})
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    Initial: ${e.initial_pc.toLocaleString()} · Delay: {e.delay_days}d · Hold: {e.hold_days}d · Decay: {e.decay_days}d
                  </Text>
                  <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                    Event: {e.event_date_iso.slice(0, 10)} · Payoff: {e.payoff_start_iso.slice(0, 10)} · Decay Start: {e.decay_start_iso.slice(0, 10)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* 12m Series */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 }}>Future Projected 12m Series</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {r.future_projected_12m.map((p) => (
              <View key={p.month_start} style={{ minWidth: 80 }}>
                <Text style={{ fontSize: 10, color: '#94A3B8' }}>{p.month_start.slice(0, 7)}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B' }}>${p.value.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Audit */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 }}>Audit</Text>
          <Text style={{ fontSize: 11, color: '#64748B' }}>
            Run: {r.run_id} · Admin: {r.admin_user} · Checksum: {r.checksum} · Prod Writes: {String(r.production_writes_enabled)}
          </Text>
        </View>
      </View>
    );
  };

  // ── Sub-view: Compare ──

  const renderCompare = () => (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>Compare Runs</Text>
      {runs.length < 2 ? (
        <Text style={{ fontSize: 13, color: '#94A3B8' }}>Need at least 2 runs to compare. Create and run scenarios first.</Text>
      ) : (
        <>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>Run A</Text>
          <View style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFF' }}>
            {runs.map((r) => (
              <Pressable
                key={r.run_id}
                onPress={() => setCompareRunAId(r.run_id)}
                style={{ padding: 10, borderBottomWidth: 1, borderColor: '#F1F5F9', backgroundColor: compareRunAId === r.run_id ? '#EFF6FF' : '#FFF' }}
              >
                <Text style={{ fontSize: 12, color: compareRunAId === r.run_id ? '#2563EB' : '#475569' }}>
                  {r.run_id.slice(0, 16)} · PC: ${r.pc_at_eval_date.toLocaleString()}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>Run B</Text>
          <View style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFF' }}>
            {runs.map((r) => (
              <Pressable
                key={r.run_id}
                onPress={() => setCompareRunBId(r.run_id)}
                style={{ padding: 10, borderBottomWidth: 1, borderColor: '#F1F5F9', backgroundColor: compareRunBId === r.run_id ? '#EFF6FF' : '#FFF' }}
              >
                <Text style={{ fontSize: 12, color: compareRunBId === r.run_id ? '#2563EB' : '#475569' }}>
                  {r.run_id.slice(0, 16)} · PC: ${r.pc_at_eval_date.toLocaleString()}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={handleCompare}
            style={{ backgroundColor: compareRunAId && compareRunBId ? '#3B82F6' : '#CBD5E1', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 4 }}
          >
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Compare</Text>
          </Pressable>

          {comparison ? (
            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14, marginTop: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 10 }}>Top Change Drivers</Text>
              {comparison.top_drivers.map((d) => (
                <View key={d.field} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 12, color: '#475569', flex: 1 }}>{d.field}</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', width: 80, textAlign: 'right' }}>A: {typeof d.run_a_value === 'number' ? d.run_a_value.toLocaleString() : d.run_a_value}</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', width: 80, textAlign: 'right' }}>B: {typeof d.run_b_value === 'number' ? d.run_b_value.toLocaleString() : d.run_b_value}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: d.delta_percent > 0 ? '#16A34A' : d.delta_percent < 0 ? '#DC2626' : '#64748B', width: 70, textAlign: 'right' }}>
                    {d.delta_percent > 0 ? '+' : ''}{d.delta_percent.toFixed(1)}%
                  </Text>
                </View>
              ))}
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B', marginTop: 16, marginBottom: 10 }}>All Deltas</Text>
              {comparison.summary_deltas.map((d) => (
                <View key={d.field} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, color: '#64748B', flex: 1 }}>{d.field}</Text>
                  <Text style={{ fontSize: 11, color: d.delta_percent > 0 ? '#16A34A' : d.delta_percent < 0 ? '#DC2626' : '#94A3B8', width: 70, textAlign: 'right' }}>
                    {d.delta_percent > 0 ? '+' : ''}{d.delta_percent.toFixed(1)}%
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );

  // ── Sub-view: Golden Tests ──

  const renderGolden = () => {
    const goldenEntries = getGoldenScenarios();
    return (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>Golden Tests & Regression</Text>
          <Pressable
            onPress={handleRunRegression}
            style={{ backgroundColor: goldenEntries.length > 0 ? '#3B82F6' : '#CBD5E1', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>Run Regression</Text>
          </Pressable>
        </View>

        {goldenEntries.length === 0 ? (
          <Text style={{ fontSize: 13, color: '#94A3B8' }}>
            No golden scenarios registered. Run a scenario, then click "Mark Golden" to create a baseline.
          </Text>
        ) : (
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 }}>
              Registered Golden Scenarios ({goldenEntries.length})
            </Text>
            {goldenEntries.map((entry) => (
              <View key={entry.scenario.scenario_id} style={{ padding: 10, borderBottomWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B' }}>{entry.scenario.name}</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    Expected 30d: ${entry.expected.pc_30d.toLocaleString()} · 90d: ${entry.expected.pc_90d.toLocaleString()} · 180d: ${entry.expected.pc_180d.toLocaleString()} · ±{entry.expected.tolerance_percent}%
                  </Text>
                </View>
                <Pressable onPress={() => removeGoldenScenario(entry.scenario.scenario_id)}>
                  <Text style={{ fontSize: 12, color: '#DC2626' }}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Tolerance setting */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>Default Tolerance %:</Text>
          <TextInput
            value={goldenTolerance}
            onChangeText={setGoldenTolerance}
            style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, padding: 6, width: 60, fontSize: 13, textAlign: 'center', backgroundColor: '#FFF' }}
          />
        </View>

        {/* Regression Report */}
        {regressionReport ? (
          <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14, marginTop: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 8 }}>
              Regression Report — {regressionReport.passed}/{regressionReport.total_scenarios} passed
            </Text>
            {regressionReport.results.map((res) => (
              <View key={res.scenario_id} style={{ padding: 10, marginBottom: 6, borderRadius: 6, backgroundColor: res.passed ? '#F0FDF4' : '#FEF2F2' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: res.passed ? '#16A34A' : '#DC2626' }}>
                  {res.passed ? '✓' : '✗'} {res.scenario_name}
                </Text>
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  30d: {res.deltas.pc_30d_pct.toFixed(1)}% · 90d: {res.deltas.pc_90d_pct.toFixed(1)}% · 180d: {res.deltas.pc_180d_pct.toFixed(1)}%
                </Text>
              </View>
            ))}
            <Pressable
              onPress={() => handleExportJson(regressionReport, `regression-${regressionReport.report_id}.json`)}
              style={{ marginTop: 8, backgroundColor: '#F1F5F9', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#475569', fontWeight: '600', fontSize: 12 }}>Export Report</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  // ── Sub-view: Settings ──

  const renderSettings = () => (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>Projection Lab Settings</Text>
      <View style={{ backgroundColor: '#FEF2F2', borderRadius: 8, padding: 14 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#991B1B', marginBottom: 4 }}>Safety Controls</Text>
        <Text style={{ fontSize: 12, color: '#7F1D1D' }}>Production KPI-log writes: DISABLED (hard default)</Text>
        <Text style={{ fontSize: 12, color: '#7F1D1D' }}>Mode: In-memory injection (Mode 1)</Text>
        <Text style={{ fontSize: 12, color: '#7F1D1D' }}>Environment: {__DEV__ ? 'DEVELOPMENT' : 'PRODUCTION'}</Text>
      </View>
      <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 4 }}>Algorithm Version</Text>
        <Text style={{ fontSize: 12, color: '#64748B' }}>Engine: 1.0.0-lab (mirrors backend canonical engine)</Text>
        <Text style={{ fontSize: 12, color: '#64748B' }}>Decay default: 180 days</Text>
        <Text style={{ fontSize: 12, color: '#64748B' }}>Calibration range: ×0.5 – ×1.5</Text>
      </View>
      <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 14 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 4 }}>Session State</Text>
        <Text style={{ fontSize: 12, color: '#64748B' }}>Scenarios: {scenarios.length} · Runs: {runs.length} · Golden: {getGoldenScenarios().length}</Text>
        <Text style={{ fontSize: 12, color: '#64748B' }}>Admin: {adminUser}</Text>
      </View>
    </View>
  );

  // ── Main Render ──

  const renderContent = () => {
    switch (labView) {
      case 'profile_list': return renderProfileList();
      case 'profile_create': return renderProfileForm(true);
      case 'profile_edit': return renderProfileForm(false);
      case 'scenario_list': return renderScenarioList();
      case 'scenario_create': return renderScenarioCreate();
      case 'scenario_detail': return renderScenarioDetail();
      case 'scenario_edit': return renderScenarioEdit();
      case 'run_detail': return renderRunDetail();
      case 'compare': return renderCompare();
      case 'golden': return renderGolden();
      case 'settings': return renderSettings();
      default: return renderScenarioList();
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#1E293B' }}>Projection Lab</Text>
        <View style={{ backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#92400E' }}>ADMIN ONLY · NO PROD WRITES</Text>
        </View>
      </View>

      {/* Status bar */}
      {runStatus ? (
        <View style={{ backgroundColor: '#F0F9FF', borderRadius: 6, padding: 10, marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: '#1E40AF' }}>{runStatus}</Text>
        </View>
      ) : null}

      {/* Navigation */}
      {renderNavPills()}

      {/* Back button for detail/edit views */}
      {(['scenario_detail', 'run_detail', 'scenario_edit', 'scenario_create', 'profile_create', 'profile_edit'] as LabView[]).includes(labView) ? (
        <Pressable
          onPress={() => setLabView(
            labView === 'run_detail' && selectedRun ? 'scenario_detail'
            : labView === 'scenario_edit' ? 'scenario_detail'
            : labView === 'scenario_create' ? 'scenario_list'
            : labView === 'profile_create' ? 'profile_list'
            : labView === 'profile_edit' ? 'profile_list'
            : 'scenario_list'
          )}
          style={{ marginBottom: 12 }}
        >
          <Text style={{ fontSize: 13, color: '#3B82F6', fontWeight: '600' }}>← Back</Text>
        </Pressable>
      ) : null}

      {/* Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {renderContent()}
      </ScrollView>
    </View>
  );
}

