import { currentPcValueForEventAtDate, type PcEvent } from "./pcTimelineEngine";

export type AttributionInputLog = {
  kpi_id: string;
  event_timestamp: string;
  pc_generated: number;
  delay_days_applied?: number | null;
  hold_days_applied?: number | null;
  decay_days_applied?: number | null;
};

export type AttributionResult = {
  predictedGciWindow: number;
  shareByKpiId: Record<string, number>;
  contributionByKpiId: Record<string, number>;
};

function toNumberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildDealCloseAttribution(input: {
  closeTimestampIso: string;
  pcLogs: AttributionInputLog[];
}): AttributionResult {
  const closeDate = new Date(input.closeTimestampIso);
  if (Number.isNaN(closeDate.getTime()) || input.pcLogs.length === 0) {
    return { predictedGciWindow: 0, shareByKpiId: {}, contributionByKpiId: {} };
  }

  const contributionByKpiId: Record<string, number> = {};
  for (const row of input.pcLogs) {
    const event: PcEvent = {
      eventTimestampIso: row.event_timestamp,
      initialPcGenerated: toNumberOrZero(row.pc_generated),
      delayBeforePayoffStartsDays: toNumberOrZero(row.delay_days_applied),
      holdDurationDays: toNumberOrZero(row.hold_days_applied),
      decayDurationDays: toNumberOrZero(row.decay_days_applied) || 180,
    };
    const contribution = currentPcValueForEventAtDate(event, closeDate);
    if (contribution <= 0) continue;
    const kpiId = String(row.kpi_id);
    contributionByKpiId[kpiId] = Number(((contributionByKpiId[kpiId] ?? 0) + contribution).toFixed(6));
  }

  const predictedGciWindow = Number(
    Object.values(contributionByKpiId).reduce((sum, v) => sum + toNumberOrZero(v), 0).toFixed(6)
  );
  if (predictedGciWindow <= 0) {
    return { predictedGciWindow: 0, shareByKpiId: {}, contributionByKpiId };
  }

  const shareByKpiId = Object.fromEntries(
    Object.entries(contributionByKpiId).map(([kpiId, value]) => [
      kpiId,
      Number((toNumberOrZero(value) / predictedGciWindow).toFixed(6)),
    ])
  );

  return { predictedGciWindow, shareByKpiId, contributionByKpiId };
}
