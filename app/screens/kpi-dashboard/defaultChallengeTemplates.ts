export type ChallengeGoalScopeTemplate = "team" | "individual";

export type ChallengeTemplateDefaultRow = {
  id: string;
  title: string;
  description: string;
  suggested_duration_days: number;
  duration_weeks: number | null;
  phase_count: number;
  default_challenge_name: string | null;
  /** Emoji for template gallery card */
  icon?: string;
  kpi_defaults: Array<{
    kpi_id: string;
    label: string;
    goal_scope_default: ChallengeGoalScopeTemplate;
    suggested_target: number | null;
    display_order: number;
  }>;
  /** Optional phases for phased challenge templates */
  phases?: Array<{
    phase_order: number;
    phase_name: string;
    starts_at_week: number;
    kpi_goals: Array<{
      kpi_id: string;
      target_value: number;
      goal_scope: ChallengeGoalScopeTemplate;
    }>;
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
      id: "template-the-hungry-agent",
      title: "The Hungry Agent",
      icon: "🔥",
      description: "All-out production sprint. Stack your pipeline, close deals, and prove you're the hungriest agent in the room.",
      suggested_duration_days: 21,
      duration_weeks: 3,
      phase_count: 3,
      default_challenge_name: "The Hungry Agent",
      kpi_defaults: [
        ...toDefault(pc, "team").slice(0, 3),
        ...toDefault(gp, "individual").slice(0, 1),
      ].map((row, idx) => ({ ...row, display_order: idx })),
      phases: [
        { phase_order: 1, phase_name: "Pipeline Load", starts_at_week: 0, kpi_goals: [] },
        { phase_order: 2, phase_name: "Close Sprint", starts_at_week: 1, kpi_goals: [] },
        { phase_order: 3, phase_name: "Finish Strong", starts_at_week: 2, kpi_goals: [] },
      ],
    },
    {
      id: "template-consistency-streak",
      title: "The Consistency Streak",
      icon: "🎯",
      description: "Show up every day for 2 weeks. Small daily actions that compound into real momentum.",
      suggested_duration_days: 14,
      duration_weeks: 2,
      phase_count: 0,
      default_challenge_name: "Consistency Streak",
      kpi_defaults: [
        ...toDefault(pc, "individual").slice(0, 2),
        ...toDefault(vp, "individual").slice(0, 2),
      ].map((row, idx) => ({ ...row, display_order: idx })),
    },
    {
      id: "template-growth-blitz",
      title: "Growth Blitz",
      icon: "🚀",
      description: "Double down on growth activities. Sphere of influence, appointments, and business development in one focused push.",
      suggested_duration_days: 14,
      duration_weeks: 2,
      phase_count: 0,
      default_challenge_name: "Growth Blitz",
      kpi_defaults: [
        ...toDefault(gp, "individual").slice(0, 2),
        ...toDefault(vp, "individual").slice(0, 1),
        ...toDefault(pc, "team").slice(0, 1),
      ].map((row, idx) => ({ ...row, display_order: idx })),
    },
    {
      id: "template-30-day-listing",
      title: "30-Day Listing Machine",
      icon: "🏠",
      description: "One month, one mission: listings. Track every appointment, presentation, and signed contract.",
      suggested_duration_days: 30,
      duration_weeks: 4,
      phase_count: 2,
      default_challenge_name: "30-Day Listing Machine",
      kpi_defaults: [
        ...toDefault(pc, "team").slice(0, 2),
        ...toDefault(gp, "team").slice(0, 1),
      ].map((row, idx) => ({ ...row, display_order: idx })),
      phases: [
        { phase_order: 1, phase_name: "Build Pipeline", starts_at_week: 0, kpi_goals: [] },
        { phase_order: 2, phase_name: "Convert & Close", starts_at_week: 2, kpi_goals: [] },
      ],
    },
  ];
}
