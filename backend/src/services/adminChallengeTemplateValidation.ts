export type AdminChallengeTemplatePhaseKpiGoal = {
  kpi_id: string;
  target_value: number;
  goal_scope: "individual" | "team";
};

export type AdminChallengeTemplatePhase = {
  phase_order: number;
  phase_name: string;
  starts_at_week: number;
  kpi_goals: AdminChallengeTemplatePhaseKpiGoal[];
};

export type AdminChallengeTemplatePayload = {
  name: string;
  description?: string;
  default_challenge_name?: string | null;
  duration_weeks?: number;
  suggested_duration_days?: number;
  template_payload?: Record<string, unknown>;
  is_active?: boolean;
};

export type AdminChallengeTemplatePayloadValidationResult =
  | { ok: true; payload: AdminChallengeTemplatePayload }
  | { ok: false; status: number; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validatePhaseKpiGoals(
  goals: unknown[]
): { ok: true; parsed: AdminChallengeTemplatePhaseKpiGoal[] } | { ok: false; error: string } {
  if (goals.length === 0) return { ok: false, error: "every phase must contain at least one KPI goal" };
  if (goals.length > 12) return { ok: false, error: "max 12 KPI goals per phase" };
  const parsed: AdminChallengeTemplatePhaseKpiGoal[] = [];
  for (let i = 0; i < goals.length; i++) {
    const g = goals[i];
    if (!isRecord(g)) return { ok: false, error: `kpi_goals[${i}] must be an object` };
    const kpiId = typeof g.kpi_id === "string" ? g.kpi_id.trim() : "";
    if (!kpiId) return { ok: false, error: `kpi_goals[${i}].kpi_id is required` };
    const targetValue = g.target_value;
    if (typeof targetValue !== "number" || !Number.isFinite(targetValue) || targetValue <= 0) {
      return { ok: false, error: `kpi_goals[${i}].target_value must be a positive number` };
    }
    const scopeRaw = typeof g.goal_scope === "string" ? g.goal_scope.trim().toLowerCase() : "";
    if (scopeRaw !== "individual" && scopeRaw !== "team") {
      return { ok: false, error: `kpi_goals[${i}].goal_scope must be "individual" or "team"` };
    }
    parsed.push({ kpi_id: kpiId, target_value: Number(targetValue.toFixed(2)), goal_scope: scopeRaw });
  }
  return { ok: true, parsed };
}

function validateTemplatePhases(
  phases: unknown[],
  durationDays: number
): { ok: true; parsed: AdminChallengeTemplatePhase[] } | { ok: false; error: string } {
  if (phases.length > 8) return { ok: false, error: "max 8 phases allowed" };
  const parsed: AdminChallengeTemplatePhase[] = [];
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    if (!isRecord(p)) return { ok: false, error: `phases[${i}] must be an object` };
    const phaseOrder = typeof p.phase_order === "number" ? p.phase_order : i + 1;
    const phaseName = typeof p.phase_name === "string" ? p.phase_name.trim() : `Phase ${phaseOrder}`;
    if (!phaseName) return { ok: false, error: `phases[${i}].phase_name is required` };
    const startsAtWeek = p.starts_at_week;
    if (typeof startsAtWeek !== "number" || !Number.isInteger(startsAtWeek) || startsAtWeek < 1) {
      return { ok: false, error: `phases[${i}].starts_at_week must be a positive integer` };
    }
    if (startsAtWeek > durationDays) {
      return { ok: false, error: `phases[${i}].starts_at_week (${startsAtWeek}) exceeds total duration (${durationDays} days)` };
    }
    if (!Array.isArray(p.kpi_goals)) {
      return { ok: false, error: `phases[${i}].kpi_goals must be an array` };
    }
    const goalsResult = validatePhaseKpiGoals(p.kpi_goals as unknown[]);
    if (!goalsResult.ok) return { ok: false, error: `phases[${i}]: ${goalsResult.error}` };
    parsed.push({ phase_order: phaseOrder, phase_name: phaseName, starts_at_week: startsAtWeek, kpi_goals: goalsResult.parsed });
  }
  parsed.sort((a, b) => a.starts_at_week - b.starts_at_week);
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].starts_at_week <= parsed[i - 1].starts_at_week) {
      return { ok: false, error: "phase windows must not overlap (duplicate starts_at_week)" };
    }
  }
  for (let i = 0; i < parsed.length; i++) {
    parsed[i].phase_order = i + 1;
  }
  return { ok: true, parsed };
}

export function validateAdminChallengeTemplatePayload(
  body: unknown,
  requireName: boolean
): AdminChallengeTemplatePayloadValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Record<string, unknown>;
  const payload: AdminChallengeTemplatePayload = {} as AdminChallengeTemplatePayload;

  if (requireName) {
    if (!candidate.name || typeof candidate.name !== "string" || !(candidate.name as string).trim()) {
      return { ok: false, status: 422, error: "name is required" };
    }
  }
  if (candidate.name !== undefined) {
    if (typeof candidate.name !== "string" || !candidate.name.trim()) {
      return { ok: false, status: 422, error: "name must be a non-empty string" };
    }
    payload.name = candidate.name.trim();
  }
  if (candidate.description !== undefined) {
    if (typeof candidate.description !== "string") {
      return { ok: false, status: 422, error: "description must be a string when provided" };
    }
    payload.description = candidate.description;
  }
  if (candidate.default_challenge_name !== undefined) {
    if (candidate.default_challenge_name !== null && typeof candidate.default_challenge_name !== "string") {
      return { ok: false, status: 422, error: "default_challenge_name must be a string or null" };
    }
    payload.default_challenge_name = typeof candidate.default_challenge_name === "string"
      ? candidate.default_challenge_name.trim() || null
      : null;
  }
  if (candidate.suggested_duration_days !== undefined) {
    if (
      typeof candidate.suggested_duration_days !== "number" ||
      !Number.isInteger(candidate.suggested_duration_days) ||
      (candidate.suggested_duration_days as number) <= 0
    ) {
      return { ok: false, status: 422, error: "suggested_duration_days must be a positive integer when provided" };
    }
    payload.suggested_duration_days = candidate.suggested_duration_days as number;
    payload.duration_weeks = Math.max(1, Math.ceil((candidate.suggested_duration_days as number) / 7));
  } else if (candidate.duration_weeks !== undefined) {
    if (
      typeof candidate.duration_weeks !== "number" ||
      !Number.isInteger(candidate.duration_weeks) ||
      candidate.duration_weeks < 1
    ) {
      return { ok: false, status: 422, error: "duration_weeks must be a positive integer >= 1" };
    }
    payload.duration_weeks = candidate.duration_weeks;
    payload.suggested_duration_days = candidate.duration_weeks * 7;
  }

  const phases = candidate.phases;
  if (phases !== undefined) {
    if (!Array.isArray(phases)) {
      return { ok: false, status: 422, error: "phases must be an array when provided" };
    }
    const durationDays = payload.suggested_duration_days ?? (payload.duration_weeks ? payload.duration_weeks * 7 : 0);
    if (phases.length > 0 && durationDays < 1) {
      return { ok: false, status: 422, error: "duration (days) is required when phases are defined" };
    }
    if (phases.length > 0) {
      const phaseResult = validateTemplatePhases(phases as unknown[], durationDays);
      if (!phaseResult.ok) return { ok: false, status: 422, error: phaseResult.error };

      const existingPayload = isRecord(candidate.template_payload) ? { ...candidate.template_payload } : {};
      existingPayload.phases = phaseResult.parsed;

      const allGoals: Array<{ kpi_id: string; goal_scope: string; target_value: number; display_order: number }> = [];
      const seenKpiIds = new Set<string>();
      let displayOrder = 0;
      for (const phase of phaseResult.parsed) {
        for (const goal of phase.kpi_goals) {
          if (!seenKpiIds.has(goal.kpi_id)) {
            seenKpiIds.add(goal.kpi_id);
            allGoals.push({
              kpi_id: goal.kpi_id,
              goal_scope: goal.goal_scope,
              target_value: goal.target_value,
              display_order: displayOrder++,
            });
          }
        }
      }
      if (allGoals.length > 0) {
        existingPayload.kpi_defaults = allGoals.map((g) => ({
          kpi_id: g.kpi_id,
          label: "",
          goal_scope_default: g.goal_scope,
          suggested_target: g.target_value,
          display_order: g.display_order,
        }));
      }

      payload.template_payload = existingPayload;
    } else {
      const existingPayload = isRecord(candidate.template_payload) ? { ...candidate.template_payload } : {};
      delete existingPayload.phases;
      payload.template_payload = existingPayload;
    }
  } else if (candidate.template_payload !== undefined) {
    if (!isRecord(candidate.template_payload)) {
      return { ok: false, status: 422, error: "template_payload must be an object when provided" };
    }
    payload.template_payload = candidate.template_payload as Record<string, unknown>;
  }

  if (candidate.is_active !== undefined) {
    if (typeof candidate.is_active !== "boolean") {
      return { ok: false, status: 422, error: "is_active must be boolean when provided" };
    }
    payload.is_active = candidate.is_active;
  }

  return { ok: true, payload };
}
