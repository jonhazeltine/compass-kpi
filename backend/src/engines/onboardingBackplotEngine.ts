import { resolvePcTiming } from "./pcTimingEngine";

export type BackplotKpiInput = {
  historicalWeeklyAverage: number;
  targetWeeklyCount: number;
};

export type BackplotSyntheticPcEvent = {
  kpiId: string;
  eventTimestampIso: string;
  initialPcGenerated: number;
  delayBeforePayoffStartsDays: number;
  holdDurationDays: number;
  decayDurationDays: number;
};

function toNumberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfUtcWeekMonday(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function buildOnboardingBackplotPcEvents(input: {
  now: Date;
  averagePricePoint: number;
  commissionRateDecimal: number;
  selectedKpiIds: string[];
  kpiWeeklyInputs: Record<string, BackplotKpiInput>;
  kpiPcConfigById: Record<string, {
    pc_weight: number;
    ttc_days?: number;
    delay_days?: number;
    hold_days?: number;
    ttc_definition?: string | null;
    decay_days: number;
  }>;
}): BackplotSyntheticPcEvent[] {
  const {
    now,
    averagePricePoint,
    commissionRateDecimal,
    selectedKpiIds,
    kpiWeeklyInputs,
    kpiPcConfigById,
  } = input;

  const safeAvgPrice = Math.max(0, toNumberOrZero(averagePricePoint));
  const safeCommission = Math.max(0, toNumberOrZero(commissionRateDecimal));

  const recentWeekStart = startOfUtcWeekMonday(now);
  const backplotEnd = new Date(recentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const backplotStart = new Date(backplotEnd.getTime() - 365 * 24 * 60 * 60 * 1000);

  const out: BackplotSyntheticPcEvent[] = [];

  for (let weekStart = startOfUtcWeekMonday(backplotStart); weekStart <= backplotEnd; weekStart = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)) {
    for (const kpiId of selectedKpiIds) {
      const cfg = kpiPcConfigById[kpiId];
      if (!cfg) continue;
      const weekly = kpiWeeklyInputs[kpiId];
      const historicalWeeklyAverage = Math.max(0, toNumberOrZero(weekly?.historicalWeeklyAverage));
      if (historicalWeeklyAverage <= 0) continue;
      const initialPc = safeAvgPrice * safeCommission * Math.max(0, toNumberOrZero(cfg.pc_weight)) * historicalWeeklyAverage;
      const timing = resolvePcTiming({
        ttc_days: cfg.ttc_days,
        delay_days: cfg.delay_days,
        hold_days: cfg.hold_days,
        ttc_definition: cfg.ttc_definition,
      });
      out.push({
        kpiId,
        eventTimestampIso: weekStart.toISOString(),
        initialPcGenerated: Number(initialPc.toFixed(2)),
        delayBeforePayoffStartsDays: timing.delayDays,
        holdDurationDays: timing.holdDays,
        decayDurationDays: Math.max(1, toNumberOrZero(cfg.decay_days)),
      });
    }
  }

  return out;
}
