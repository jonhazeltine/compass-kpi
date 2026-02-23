import { ALGO_CONSTANTS } from "./algorithmConstants";

export type PcEvent = {
  eventTimestampIso: string;
  initialPcGenerated: number;
  delayBeforePayoffStartsDays?: number;
  holdDurationDays: number;
  decayDurationDays?: number;
};

export type MonthlySeriesPoint = {
  month_start: string;
  value: number;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function toNumberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function currentPcValueForEventAtDate(event: PcEvent, currentDate: Date): number {
  const eventDate = startOfUtcDay(new Date(event.eventTimestampIso));
  if (Number.isNaN(eventDate.getTime())) return 0;

  const initial = toNumberOrZero(event.initialPcGenerated);
  if (initial <= 0) return 0;

  const delayDays = Math.max(0, toNumberOrZero(event.delayBeforePayoffStartsDays));
  const holdDays = Math.max(0, toNumberOrZero(event.holdDurationDays));
  const decayDays = Math.max(
    1,
    toNumberOrZero(event.decayDurationDays ?? ALGO_CONSTANTS.pc.defaultDecayDays)
  );

  const payoffStart = addDays(eventDate, delayDays);
  const decayStart = addDays(payoffStart, holdDays);
  const nowDay = startOfUtcDay(currentDate);

  if (nowDay.getTime() < payoffStart.getTime()) return 0;
  if (nowDay.getTime() < decayStart.getTime()) return initial;

  const daysIntoDecay = Math.floor((nowDay.getTime() - decayStart.getTime()) / (1000 * 60 * 60 * 24));
  if (daysIntoDecay >= decayDays) return 0;

  const remaining = initial * (1 - daysIntoDecay / decayDays);
  return Math.max(0, remaining);
}

export function aggregateProjectedPcAtDate(events: PcEvent[], currentDate: Date): number {
  return events.reduce((sum, event) => sum + currentPcValueForEventAtDate(event, currentDate), 0);
}

export function buildFutureProjected12mSeries(
  events: PcEvent[],
  now: Date,
  bumpPercent: number
): MonthlySeriesPoint[] {
  const monthStart = startOfUtcMonth(now);
  const safeBump = Math.max(0, toNumberOrZero(bumpPercent));

  return Array.from({ length: 12 }).map((_, i) => {
    const month = addMonths(monthStart, i + 1);
    const pointDate = endOfUtcMonth(month);
    const raw = aggregateProjectedPcAtDate(events, pointDate);
    const bumped = raw * (1 + safeBump);
    return {
      month_start: month.toISOString(),
      value: Number(bumped.toFixed(2)),
    };
  });
}

export function buildPastActual6mSeries(actualLogs: Array<{ event_timestamp: string; actual_gci_delta: number }>, now: Date): MonthlySeriesPoint[] {
  const monthStart = startOfUtcMonth(now);
  const months = Array.from({ length: 6 }).map((_, i) => addMonths(monthStart, i - 5));

  return months.map((month) => {
    const key = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
    const value = actualLogs.reduce((sum, log) => {
      const dt = new Date(log.event_timestamp);
      if (Number.isNaN(dt.getTime())) return sum;
      const logKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
      if (logKey !== key) return sum;
      return sum + toNumberOrZero(log.actual_gci_delta);
    }, 0);
    return {
      month_start: month.toISOString(),
      value: Number(value.toFixed(2)),
    };
  });
}

export function derivePc90dFromFutureSeries(futureProjected12m: MonthlySeriesPoint[]): number {
  const firstThree = futureProjected12m.slice(0, 3).reduce((sum, row) => sum + toNumberOrZero(row.value), 0);
  return Number(firstThree.toFixed(2));
}
