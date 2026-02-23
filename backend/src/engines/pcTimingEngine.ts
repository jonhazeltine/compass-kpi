export type PcTimingInput = {
  ttc_days?: number | null;
  delay_days?: number | null;
  hold_days?: number | null;
  ttc_definition?: string | null;
};

export type ResolvedPcTiming = {
  delayDays: number;
  holdDays: number;
  totalTtcDays: number;
};

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function toWholeNonNegative(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  return Math.max(0, Math.round(parsed));
}

export function parseTtcDefinition(ttcDefinition: unknown): ResolvedPcTiming | null {
  if (typeof ttcDefinition !== "string") return null;
  const raw = ttcDefinition.trim();
  if (!raw) return null;

  const rangeMatch = raw.match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (rangeMatch) {
    const start = toWholeNonNegative(rangeMatch[1]) ?? 0;
    const end = toWholeNonNegative(rangeMatch[2]) ?? 0;
    const orderedStart = Math.min(start, end);
    const orderedEnd = Math.max(start, end);
    return {
      delayDays: orderedStart,
      holdDays: Math.max(0, orderedEnd - orderedStart),
      totalTtcDays: orderedEnd,
    };
  }

  const singleMatch = raw.match(/(\d+)/);
  if (singleMatch) {
    const total = toWholeNonNegative(singleMatch[1]) ?? 0;
    return {
      delayDays: 0,
      holdDays: total,
      totalTtcDays: total,
    };
  }

  return null;
}

export function resolvePcTiming(input: PcTimingInput): ResolvedPcTiming {
  const parsedFromDefinition = parseTtcDefinition(input.ttc_definition ?? null);

  const delayDays =
    toWholeNonNegative(input.delay_days) ??
    parsedFromDefinition?.delayDays ??
    0;

  const holdDays =
    toWholeNonNegative(input.hold_days) ??
    parsedFromDefinition?.holdDays ??
    (() => {
      const fallbackTtc = toWholeNonNegative(input.ttc_days) ?? 0;
      return Math.max(0, fallbackTtc - delayDays);
    })();

  const totalTtcDays =
    toWholeNonNegative(input.ttc_days) ??
    parsedFromDefinition?.totalTtcDays ??
    (delayDays + holdDays);

  return {
    delayDays,
    holdDays,
    totalTtcDays: Math.max(totalTtcDays, delayDays + holdDays),
  };
}

