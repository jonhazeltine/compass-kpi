export type ChallengeGoalScopeTemplate = "team" | "individual";

export type ChallengeTemplateDefaultRow = {
  id: string;
  title: string;
  description: string;
  suggested_duration_days: number;
  duration_weeks: number | null;
  phase_count: number;
  default_challenge_name: string | null;
  kpi_defaults: Array<{
    kpi_id: string;
    label: string;
    goal_scope_default: ChallengeGoalScopeTemplate;
    suggested_target: number | null;
    display_order: number;
  }>;
};

type KpiLite = { id: string; name: string; type: string };

function sortSelectableKpis(kpis: KpiLite[]): KpiLite[] {
  return [...kpis].sort((a, b) => {
    const typeOrder = (value: string) => {
      const normalized = value.toUpperCase();
      if (normalized === "PC") return 0;
      if (normalized === "GP") return 1;
      if (normalized === "VP") return 2;
      return 3;
    };
    const byType = typeOrder(a.type) - typeOrder(b.type);
    if (byType !== 0) return byType;
    const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return String(a.id).localeCompare(String(b.id), undefined, { sensitivity: "base" });
  });
}

export function buildDefaultChallengeTemplatesFromKpis(kpis: KpiLite[]): ChallengeTemplateDefaultRow[] {
  const ordered = sortSelectableKpis((kpis ?? []).filter((kpi) => kpi.type === "PC" || kpi.type === "GP" || kpi.type === "VP"));
  const toDefault = (source: KpiLite[], fallbackScope: ChallengeGoalScopeTemplate) =>
    source.slice(0, 3).map((kpi, idx) => ({
      kpi_id: String(kpi.id),
      label: String(kpi.name),
      goal_scope_default: fallbackScope,
      suggested_target: null,
      display_order: idx,
    }));
  const pc = ordered.filter((kpi) => kpi.type === "PC");
  const gp = ordered.filter((kpi) => kpi.type === "GP");
  const vp = ordered.filter((kpi) => kpi.type === "VP");

  return [
    {
      id: "template-team-sprint",
      title: "Team Sprint Template",
      description: "Balanced team sprint combining projection, growth, and vitality KPIs.",
      suggested_duration_days: 21,
      duration_weeks: 3,
      phase_count: 0,
      default_challenge_name: null,
      kpi_defaults: [
        ...toDefault(pc, "team").slice(0, 2),
        ...toDefault(gp, "individual").slice(0, 1),
        ...toDefault(vp, "individual").slice(0, 1),
      ].map((row, idx) => ({ ...row, display_order: idx })),
    },
    {
      id: "template-mini-focus",
      title: "Mini Focus Template",
      description: "Small challenge format for 1-3 invitees with focused KPI outcomes.",
      suggested_duration_days: 14,
      duration_weeks: 2,
      phase_count: 0,
      default_challenge_name: null,
      kpi_defaults: [
        ...toDefault(pc, "individual").slice(0, 1),
        ...toDefault(gp, "individual").slice(0, 1),
        ...toDefault(vp, "individual").slice(0, 1),
      ].map((row, idx) => ({ ...row, display_order: idx })),
    },
  ];
}
