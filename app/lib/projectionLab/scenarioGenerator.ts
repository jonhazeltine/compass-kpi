/**
 * Projection Lab — Seeded Scenario Generator
 *
 * Produces deterministic synthetic scenarios from a numeric seed.
 * Same seed always produces the same scenario for reproducibility.
 *
 * KPI definitions mirror the canonical catalog from
 * backend/sql/017_sprint16_kpi_catalog_canonical_v2_alignment.sql
 */

import type {
  LabScenario,
  LabUserProfile,
  LabKpiDefinition,
  LabLogEntry,
  LabActualClosing,
  AgentProfile,
  ScenarioVolumeInput,
} from './types';
import type { AdminKpiRow } from '../adminCatalogApi';

// ── Live Catalog Mapper ──────────────────────────────

/** Convert a live AdminKpiRow from the DB catalog to a LabKpiDefinition. */
export function adminKpiToLabDef(row: AdminKpiRow): LabKpiDefinition {
  return {
    kpi_id: row.id,
    name: row.name,
    unit: 'count',
    weight_percent: row.pc_weight ?? 0,
    ttc_definition: row.ttc_definition ?? null,
    delay_days: row.delay_days ?? null,
    hold_days: row.hold_days ?? null,
    decay_days: row.decay_days ?? null,
    gp_value: row.gp_value ?? 0,
    vp_value: row.vp_value ?? 0,
    direction: 'higher_is_better',
  };
}

// ── Seeded PRNG (Mulberry32) ──────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function seededInt(rng: () => number, min: number, max: number): number {
  return Math.floor(seededRange(rng, min, max + 1));
}

function seededId(rng: () => number): string {
  return Math.floor(rng() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');
}

function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(baseIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0] + 'T00:00:00.000Z';
}

// ── Actual-Closings Generator ─────────────────────────
//
// Produces a 12-month closing pattern distributed evenly across
// all months. This is still a *projection* — "if this year
// looks like last year."  Even weighting is used because the
// tool serves all markets (e.g. Florida has no winter slowdown).

export function generateRealisticClosings(opts: {
  baseDateIso: string;
  avgPricePoint: number;
  commissionRate: number;
  daysSpan: number; // only used to estimate annual deal count scaling
  idGen: () => string;
  rngVariance: () => number; // 0-1 used for GCI jitter
  overrideAnnualDeals?: number; // explicit deal count when provided by user
}): LabActualClosing[] {
  const { baseDateIso, avgPricePoint, commissionRate, idGen, rngVariance, overrideAnnualDeals } = opts;
  const gciPerDeal = avgPricePoint * commissionRate;

  // Deal count: use override if provided, otherwise estimate from GCI
  const targetAnnualGci = 150_000;
  const annualDeals = overrideAnnualDeals != null
    ? Math.max(1, overrideAnnualDeals)
    : Math.max(6, Math.min(20, Math.round(targetAnnualGci / gciPerDeal)));

  // Always generate exactly 12 months of closings starting from NEXT month
  // (aligns with future_projected_12m which starts at addMonths(now, 1))
  const MONTHS = 12;
  const baseDate = new Date(baseDateIso);

  // Scatter deals randomly across months using the RNG.
  // No partial deals — each deal is a whole closing that lands in one month.
  // Some months get 0, some get 1, a busy month might get 2+.
  // This produces the realistic spiky income pattern agents actually see.
  const perMonth: number[] = new Array(MONTHS).fill(0);
  for (let d = 0; d < annualDeals; d++) {
    const monthIdx = Math.floor(rngVariance() * MONTHS) % MONTHS;
    perMonth[monthIdx]++;
  }

  // Generate closing events using proper calendar months
  const closings: LabActualClosing[] = [];
  for (let m = 0; m < MONTHS; m++) {
    const count = perMonth[m];
    if (count === 0) continue;
    // Build the first-of-month date for this projection month
    const monthDate = new Date(Date.UTC(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth() + 1 + m, // +1 = next month
      1
    ));
    // Days in this calendar month
    const daysInMonth = new Date(
      Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)
    ).getUTCDate();

    for (let c = 0; c < count; c++) {
      // Spread closings within the month
      const day = count > 1
        ? Math.max(1, Math.min(daysInMonth, Math.round(((c + 0.5) / count) * daysInMonth)))
        : Math.max(1, Math.min(daysInMonth, Math.round(rngVariance() * daysInMonth)));
      const closingDate = new Date(Date.UTC(
        monthDate.getUTCFullYear(), monthDate.getUTCMonth(), day
      ));

      // GCI ±30% variance around average deal
      const variance = 0.7 + rngVariance() * 0.6;
      closings.push({
        closing_id: `lab-closing-${idGen()}`,
        event_date_iso: closingDate.toISOString().split('T')[0] + 'T00:00:00.000Z',
        actual_gci_delta: Number((gciPerDeal * variance).toFixed(2)),
      });
    }
  }
  closings.sort((a, b) => a.event_date_iso.localeCompare(b.event_date_iso));
  return closings;
}

// ── Canonical KPI Templates (from production catalog) ──

export const PC_KPI_TEMPLATES: Omit<LabKpiDefinition, 'kpi_id'>[] = [
  { name: 'Phone Call Logged', unit: 'count', weight_percent: 0.025, ttc_definition: '90-120', delay_days: 90, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Sphere Call', unit: 'count', weight_percent: 0.04, ttc_definition: '60-90', delay_days: 60, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'FSBO/Expired Call', unit: 'count', weight_percent: 0.05, ttc_definition: '30-60', delay_days: 30, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Door Knock Logged', unit: 'count', weight_percent: 0.03, ttc_definition: '90-150', delay_days: 90, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Appointment Set (Buyer)', unit: 'count', weight_percent: 0.5, ttc_definition: '30-60', delay_days: 30, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Appointment Set (Seller)', unit: 'count', weight_percent: 0.5, ttc_definition: '30-60', delay_days: 30, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Coffee/Lunch with Sphere', unit: 'count', weight_percent: 0.1, ttc_definition: '90-150', delay_days: 90, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Conversations Held', unit: 'count', weight_percent: 0.1, ttc_definition: '90-150', delay_days: 90, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Listing Taken', unit: 'count', weight_percent: 7.0, ttc_definition: '30', delay_days: 0, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Buyer Contract Signed', unit: 'count', weight_percent: 5.0, ttc_definition: '30', delay_days: 0, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'New Client Logged', unit: 'count', weight_percent: 1.25, ttc_definition: '30-90', delay_days: 30, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Text/DM Conversation', unit: 'count', weight_percent: 0.01, ttc_definition: '90-120', delay_days: 90, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Open House Logged', unit: 'count', weight_percent: 0.2, ttc_definition: '60-120', delay_days: 60, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Seasonal Check-In Call', unit: 'count', weight_percent: 0.1, ttc_definition: '90-150', delay_days: 90, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Pop-By Delivered', unit: 'count', weight_percent: 0.08, ttc_definition: '90-150', delay_days: 90, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Holiday Card Sent', unit: 'count', weight_percent: 0.03, ttc_definition: '120-180', delay_days: 120, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Biz Post', unit: 'count', weight_percent: 0.02, ttc_definition: '120-180', delay_days: 120, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
];

// ── Rebuild Log Stream from Annual Volumes ────────────
//
// Given per-KPI annual event counts, generates an evenly-spaced
// log stream across a time span. Used when editing a scenario's
// KPI volumes in the edit view.

export function rebuildLogStreamFromVolumes(opts: {
  kpiMonthlyVolume: Record<string, number>; // kpi_id → events/month (decimals ok, e.g. 0.5)
  kpiDefinitions: LabKpiDefinition[];
  userProfile: LabUserProfile;
  timeSpanMonths: number;
}): LabLogEntry[] {
  const { kpiMonthlyVolume, kpiDefinitions, userProfile, timeSpanMonths } = opts;
  const kpiMap = new Map(kpiDefinitions.map((k) => [k.kpi_id, k]));

  const now = new Date();
  const baseDate = new Date(now);
  baseDate.setUTCMonth(baseDate.getUTCMonth() - timeSpanMonths);
  const baseDateIso = baseDate.toISOString().split('T')[0] + 'T00:00:00.000Z';
  const totalDays = Math.round(
    (now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  let idCounter = Date.now();
  const nextId = () => {
    idCounter++;
    return (idCounter & 0xffffffff).toString(16).padStart(8, '0');
  };

  const logStream: LabLogEntry[] = [];

  for (const [kpiId, monthlyCount] of Object.entries(kpiMonthlyVolume)) {
    const kpi = kpiMap.get(kpiId);
    if (!kpi || monthlyCount <= 0) continue;

    // Total events = monthly rate × time span
    const totalEvents = Math.max(1, Math.round(monthlyCount * timeSpanMonths));
    const intervalDays = totalDays / totalEvents;

    for (let i = 0; i < totalEvents; i++) {
      const dayOffset = Math.round(i * intervalDays);
      const quantity = 1;
      const initialPc =
        userProfile.average_price_point *
        userProfile.commission_rate *
        (kpi.weight_percent / 100) *
        quantity;

      logStream.push({
        log_id: `lab-log-${nextId()}`,
        kpi_id: kpiId,
        event_date_iso: addDaysIso(baseDateIso, Math.min(dayOffset, totalDays)),
        quantity,
        initial_pc_override: Number(initialPc.toFixed(2)),
        gp_points: kpi.gp_value * quantity,
        vp_points: kpi.vp_value * quantity,
      });
    }
  }

  logStream.sort((a, b) => a.event_date_iso.localeCompare(b.event_date_iso));
  return logStream;
}

// ── Pre-Built Scenario Profiles ───────────────────────

export type ScenarioProfile = {
  id: string;
  name: string;
  description: string;
  kpiNames: string[];
  /** Growth-point KPI names from GP catalog */
  gpKpiNames: string[];
  /** Vitality-point KPI names from VP catalog */
  vpKpiNames: string[];
  avgPriceRange: [number, number];
  commissionRange: [number, number];
  logDaysSpan: number;
  eventsPerKpiRange: [number, number];
  /** Event frequency range for GP KPIs (lower cadence than PC) */
  gpEventsPerKpiRange: [number, number];
  /** Event frequency range for VP KPIs (daily habits, higher cadence) */
  vpEventsPerKpiRange: [number, number];
  includeActuals: boolean;
  agentName: string;
};

export const SCENARIO_PROFILES: ScenarioProfile[] = [
  {
    id: 'listing-heavy',
    name: 'Listing-Heavy Agent',
    description: 'Experienced listing agent focused on FSBO/expired prospecting, seller appointments, and sphere nurturing. High price point, strong conversion pipeline.',
    kpiNames: ['FSBO/Expired Call', 'Appointment Set (Seller)', 'Listing Taken', 'Sphere Call', 'Open House Logged', 'Conversations Held'],
    gpKpiNames: ['CMA Created (Practice or Live)', 'Listing Presentation Given', 'Listing Video Created', 'Market Stats Review (Weekly)'],
    vpKpiNames: ['Exercise Session', 'Good Night of Sleep'],
    avgPriceRange: [450000, 750000],
    commissionRange: [0.025, 0.03],
    logDaysSpan: 180,
    eventsPerKpiRange: [8, 20],
    gpEventsPerKpiRange: [3, 8],
    vpEventsPerKpiRange: [12, 20],
    includeActuals: true,
    agentName: 'Sarah Mitchell',
  },
  {
    id: 'buyer-specialist',
    name: 'Buyer Specialist',
    description: 'Agent primarily working with buyers — open houses, buyer appointments, door knocking, and client intake. Moderate price point market.',
    kpiNames: ['Appointment Set (Buyer)', 'Buyer Contract Signed', 'Open House Logged', 'Door Knock Logged', 'New Client Logged', 'Phone Call Logged'],
    gpKpiNames: ['Buyer Consult Held', 'Script Practice Session', 'CRM Tag Applied'],
    vpKpiNames: ['Exercise Session', 'Hydration Goal Met', 'Good Night of Sleep'],
    avgPriceRange: [250000, 450000],
    commissionRange: [0.025, 0.03],
    logDaysSpan: 180,
    eventsPerKpiRange: [10, 25],
    gpEventsPerKpiRange: [3, 8],
    vpEventsPerKpiRange: [10, 20],
    includeActuals: true,
    agentName: 'Marcus Chen',
  },
  {
    id: 'sphere-nurture',
    name: 'Sphere-of-Influence Agent',
    description: 'Relationship-focused agent building business through sphere nurturing — calls, coffee meetings, pop-bys, seasonal outreach. Long TTC, high loyalty.',
    kpiNames: ['Sphere Call', 'Coffee/Lunch with Sphere', 'Pop-By Delivered', 'Seasonal Check-In Call', 'Holiday Card Sent', 'Conversations Held'],
    gpKpiNames: ['Content Batch Created', 'Social Posts Shared', 'Database Segmented / Cleaned'],
    vpKpiNames: ['Gratitude Entry', 'Good Night of Sleep', 'Social Connection (Non-work)'],
    avgPriceRange: [350000, 600000],
    commissionRange: [0.025, 0.035],
    logDaysSpan: 270,
    eventsPerKpiRange: [12, 30],
    gpEventsPerKpiRange: [4, 10],
    vpEventsPerKpiRange: [12, 22],
    includeActuals: true,
    agentName: 'Julie Reynolds',
  },
  {
    id: 'new-agent-ramp',
    name: 'New Agent (Ramp-Up)',
    description: 'Recently licensed agent in the first 90 days. Low volume, heavy on lead gen activities — calls, door knocks, texts. No closings yet.',
    kpiNames: ['Phone Call Logged', 'Door Knock Logged', 'Text/DM Conversation', 'Appointment Set (Buyer)', 'New Client Logged'],
    gpKpiNames: ['Training Module Completed', 'Coaching Session Attended', 'Roleplay Session Completed', 'Script Practice Session', 'Objection Handling Reps Logged'],
    vpKpiNames: ['Exercise Session', 'Good Night of Sleep', 'Gratitude Entry'],
    avgPriceRange: [200000, 350000],
    commissionRange: [0.02, 0.025],
    logDaysSpan: 90,
    eventsPerKpiRange: [3, 10],
    gpEventsPerKpiRange: [4, 12],
    vpEventsPerKpiRange: [10, 18],
    includeActuals: true,
    agentName: 'Tyler Brooks',
  },
  {
    id: 'top-producer',
    name: 'Top Producer (Full Pipeline)',
    description: 'High-volume agent tracking everything — listings, buyers, sphere, open houses, prospecting. Strong across all categories with actuals to calibrate against.',
    kpiNames: ['Listing Taken', 'Buyer Contract Signed', 'Appointment Set (Seller)', 'Appointment Set (Buyer)', 'FSBO/Expired Call', 'Sphere Call', 'Open House Logged', 'New Client Logged'],
    gpKpiNames: ['Coaching Session Attended', 'Weekly Scorecard Review', 'Market Stats Review (Weekly)', 'CMA Created (Practice or Live)', 'Training Module Completed'],
    vpKpiNames: ['Exercise Session', 'Good Night of Sleep', 'Hydration Goal Met', 'Steps Goal Met / Walk Completed'],
    avgPriceRange: [500000, 900000],
    commissionRange: [0.028, 0.035],
    logDaysSpan: 180,
    eventsPerKpiRange: [10, 30],
    gpEventsPerKpiRange: [4, 10],
    vpEventsPerKpiRange: [15, 25],
    includeActuals: true,
    agentName: 'Amanda Reeves',
  },
  {
    id: 'digital-first',
    name: 'Digital-First Agent',
    description: 'Agent focused on online lead gen — texts, DMs, social posting, and conversion to appointments. Lower-touch prospecting, modern workflow.',
    kpiNames: ['Text/DM Conversation', 'Biz Post', 'Phone Call Logged', 'Appointment Set (Buyer)', 'New Client Logged', 'Conversations Held'],
    gpKpiNames: ['Instagram Post Shared', 'Facebook Post Shared', 'Content Batch Created', 'Social Posts Shared', 'Email Subscribers Added'],
    vpKpiNames: ['Exercise Session', 'Good Night of Sleep'],
    avgPriceRange: [300000, 500000],
    commissionRange: [0.025, 0.03],
    logDaysSpan: 120,
    eventsPerKpiRange: [15, 40],
    gpEventsPerKpiRange: [6, 15],
    vpEventsPerKpiRange: [10, 18],
    includeActuals: true,
    agentName: 'Diego Vargas',
  },
  {
    id: 'inactive-agent',
    name: 'Inactive Agent (Decay Test)',
    description: 'Agent who was active 60+ days ago but has stopped logging. Tests GP/VP inactivity decay and confidence decline behavior.',
    kpiNames: ['Phone Call Logged', 'Sphere Call', 'Appointment Set (Buyer)', 'Listing Taken'],
    gpKpiNames: [],
    vpKpiNames: [],
    avgPriceRange: [300000, 500000],
    commissionRange: [0.025, 0.03],
    logDaysSpan: 180,
    eventsPerKpiRange: [4, 8],
    gpEventsPerKpiRange: [0, 0],
    vpEventsPerKpiRange: [0, 0],
    includeActuals: true,
    agentName: 'Kevin Park',
  },
];

// ── Generator ─────────────────────────────────────────

export const ALGORITHM_VERSION = '1.0.0-lab';

export function generateScenarioFromProfile(input: {
  profile: ScenarioProfile;
  adminUser: string;
  seed?: number;
  /** Live catalog from DB — used to resolve KPI names to full definitions */
  catalogKpis?: AdminKpiRow[];
}): LabScenario {
  const { profile, adminUser, seed: overrideSeed, catalogKpis } = input;
  const seed = overrideSeed ?? Math.floor(Math.random() * 99999);
  const rng = mulberry32(seed);

  // User profile
  const userProfile: LabUserProfile = {
    user_id: `lab-user-${seededId(rng)}`,
    display_name: profile.agentName,
    average_price_point: Number(
      seededRange(rng, profile.avgPriceRange[0], profile.avgPriceRange[1]).toFixed(0)
    ),
    commission_rate: Number(
      seededRange(rng, profile.commissionRange[0], profile.commissionRange[1]).toFixed(4)
    ),
  };

  // Match KPIs from canonical catalog (PC + GP + VP)
  const resolveName = (name: string, type: 'PC' | 'GP' | 'VP'): LabKpiDefinition | null => {
    // Try live catalog first if available
    if (catalogKpis?.length) {
      const row = catalogKpis.find((r) => r.name === name && r.type === type && r.is_active);
      if (row) return { ...adminKpiToLabDef(row), kpi_id: `lab-kpi-${seededId(rng)}` };
    }
    // Fallback to hardcoded PC templates
    if (type === 'PC') {
      const tmpl = PC_KPI_TEMPLATES.find((t) => t.name === name);
      if (tmpl) return { ...tmpl, kpi_id: `lab-kpi-${seededId(rng)}` };
    }
    // Fallback: create a minimal GP/VP definition from the name
    if (type === 'GP') {
      return {
        kpi_id: `lab-kpi-${seededId(rng)}`, name, unit: 'count',
        weight_percent: 0, ttc_definition: null, delay_days: null, hold_days: null, decay_days: null,
        gp_value: 1, vp_value: 0, direction: 'higher_is_better',
      };
    }
    if (type === 'VP') {
      return {
        kpi_id: `lab-kpi-${seededId(rng)}`, name, unit: 'count',
        weight_percent: 0, ttc_definition: null, delay_days: null, hold_days: null, decay_days: null,
        gp_value: 0, vp_value: 1, direction: 'higher_is_better',
      };
    }
    return null;
  };

  const pcDefs = profile.kpiNames.map((n) => resolveName(n, 'PC')).filter((k): k is LabKpiDefinition => k !== null);
  const gpDefs = profile.gpKpiNames.map((n) => resolveName(n, 'GP')).filter((k): k is LabKpiDefinition => k !== null);
  const vpDefs = profile.vpKpiNames.map((n) => resolveName(n, 'VP')).filter((k): k is LabKpiDefinition => k !== null);
  const kpiDefinitions: LabKpiDefinition[] = [...pcDefs, ...gpDefs, ...vpDefs];

  // Generate log stream
  const baseDate = new Date();
  baseDate.setUTCDate(baseDate.getUTCDate() - profile.logDaysSpan);
  const baseDateIso = baseDate.toISOString().split('T')[0] + 'T00:00:00.000Z';

  // For inactive agent, cluster events in the first half of the span
  const isInactive = profile.id === 'inactive-agent';
  const effectiveSpan = isInactive
    ? Math.floor(profile.logDaysSpan * 0.4)
    : profile.logDaysSpan;

  // Determine event count range per KPI type
  const getEventsRange = (kpi: LabKpiDefinition): [number, number] => {
    if (kpi.gp_value > 0 && kpi.weight_percent === 0) return profile.gpEventsPerKpiRange;
    if (kpi.vp_value > 0 && kpi.weight_percent === 0) return profile.vpEventsPerKpiRange;
    return profile.eventsPerKpiRange;
  };

  const logStream: LabLogEntry[] = [];
  for (const kpi of kpiDefinitions) {
    const evRange = getEventsRange(kpi);
    if (evRange[0] === 0 && evRange[1] === 0) continue;
    const count = seededInt(rng, evRange[0], evRange[1]);
    for (let j = 0; j < count; j++) {
      const dayOffset = seededInt(rng, 0, effectiveSpan);
      const quantity = seededInt(rng, 1, 3);
      const initialPc =
        userProfile.average_price_point *
        userProfile.commission_rate *
        (kpi.weight_percent / 100) *
        quantity;
      logStream.push({
        log_id: `lab-log-${seededId(rng)}`,
        kpi_id: kpi.kpi_id,
        event_date_iso: addDaysIso(baseDateIso, dayOffset),
        quantity,
        initial_pc_override: Number(initialPc.toFixed(2)),
        gp_points: kpi.gp_value * quantity,
        vp_points: kpi.vp_value * quantity,
      });
    }
  }
  logStream.sort((a, b) => a.event_date_iso.localeCompare(b.event_date_iso));

  // Actual closings — always 365-day span, aligned to chart start (today)
  // The chart grid starts at "next month from today" so baseDateIso
  // for closings must be TODAY, not the log-stream base date.
  const closingsBaseDateIso = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
  const actualClosings: LabActualClosing[] = profile.includeActuals
    ? generateRealisticClosings({
        baseDateIso: closingsBaseDateIso,
        avgPricePoint: userProfile.average_price_point,
        commissionRate: userProfile.commission_rate,
        daysSpan: 365,
        idGen: () => seededId(rng),
        rngVariance: rng,
      })
    : [];

  return {
    scenario_id: `lab-scenario-${seededId(rng)}`,
    seed,
    name: profile.name,
    description: profile.description,
    created_by_admin: adminUser,
    created_at: new Date().toISOString(),
    algorithm_version: ALGORITHM_VERSION,
    user_profile: userProfile,
    kpi_definitions: kpiDefinitions,
    log_stream: logStream,
    actual_closings: actualClosings,
    is_golden: false,
    tags: [profile.id],
  };
}

/** Legacy free-form generator (for custom scenarios) */
export function generateScenario(input: {
  seed: number;
  adminUser: string;
  name?: string;
  description?: string;
  kpiCount?: number;
  logDaysSpan?: number;
  logsPerKpi?: number;
  includeActuals?: boolean;
}): LabScenario {
  const {
    seed,
    adminUser,
    name,
    description,
    kpiCount = 4,
    logDaysSpan = 180,
    logsPerKpi = 12,
    includeActuals = false,
  } = input;

  const rng = mulberry32(seed);

  const userProfile: LabUserProfile = {
    user_id: `lab-user-${seededId(rng)}`,
    display_name: `Lab Agent ${seed}`,
    average_price_point: Number(seededRange(rng, 200000, 800000).toFixed(0)),
    commission_rate: Number(seededRange(rng, 0.02, 0.035).toFixed(4)),
  };

  const shuffled = [...PC_KPI_TEMPLATES].sort(() => rng() - 0.5);
  const selectedCount = Math.min(kpiCount, shuffled.length);
  const kpiDefinitions: LabKpiDefinition[] = shuffled
    .slice(0, selectedCount)
    .map((tmpl) => ({ ...tmpl, kpi_id: `lab-kpi-${seededId(rng)}` }));

  const baseDate = new Date();
  baseDate.setUTCDate(baseDate.getUTCDate() - logDaysSpan);
  const baseDateIso = baseDate.toISOString().split('T')[0] + 'T00:00:00.000Z';

  const logStream: LabLogEntry[] = [];
  for (const kpi of kpiDefinitions) {
    const count = seededInt(rng, Math.max(1, logsPerKpi - 4), logsPerKpi + 4);
    for (let j = 0; j < count; j++) {
      const dayOffset = seededInt(rng, 0, logDaysSpan);
      const quantity = seededInt(rng, 1, 5);
      const initialPc =
        userProfile.average_price_point *
        userProfile.commission_rate *
        (kpi.weight_percent / 100) *
        quantity;
      logStream.push({
        log_id: `lab-log-${seededId(rng)}`,
        kpi_id: kpi.kpi_id,
        event_date_iso: addDaysIso(baseDateIso, dayOffset),
        quantity,
        initial_pc_override: Number(initialPc.toFixed(2)),
        gp_points: kpi.gp_value * quantity,
        vp_points: kpi.vp_value * quantity,
      });
    }
  }
  logStream.sort((a, b) => a.event_date_iso.localeCompare(b.event_date_iso));

  // Actual closings — always 365-day span (full annual pattern)
  const actualClosings: LabActualClosing[] = includeActuals
    ? generateRealisticClosings({
        baseDateIso,
        avgPricePoint: userProfile.average_price_point,
        commissionRate: userProfile.commission_rate,
        daysSpan: 365,
        idGen: () => seededId(rng),
        rngVariance: rng,
      })
    : [];

  return {
    scenario_id: `lab-scenario-${seededId(rng)}`,
    seed,
    name: name || `Custom Scenario #${seed}`,
    description: description || `Custom scenario from seed ${seed}`,
    created_by_admin: adminUser,
    created_at: new Date().toISOString(),
    algorithm_version: ALGORITHM_VERSION,
    user_profile: userProfile,
    kpi_definitions: kpiDefinitions,
    log_stream: logStream,
    actual_closings: actualClosings,
    is_golden: false,
    tags: ['custom'],
  };
}

// ── Profile Converter ─────────────────────────────────

/**
 * Convert a range-based ScenarioProfile to a fixed-value AgentProfile
 * using midpoints of the ranges.
 */
export function convertScenarioProfileToAgentProfile(sp: ScenarioProfile): AgentProfile {
  return {
    profile_id: `builtin-${sp.id}`,
    name: sp.name,
    description: sp.description,
    agent_name: sp.agentName,
    avg_price_point: Math.round((sp.avgPriceRange[0] + sp.avgPriceRange[1]) / 2),
    commission_rate: Number(((sp.commissionRange[0] + sp.commissionRange[1]) / 2).toFixed(4)),
    kpi_names: [...sp.kpiNames],
    gp_kpi_names: [...sp.gpKpiNames],
    vp_kpi_names: [...sp.vpKpiNames],
    include_actuals: sp.includeActuals,
    is_builtin: true,
    created_at: new Date().toISOString(),
  };
}

/** The 7 built-in agent profiles derived from SCENARIO_PROFILES. */
export const BUILTIN_AGENT_PROFILES: AgentProfile[] = SCENARIO_PROFILES.map(
  convertScenarioProfileToAgentProfile,
);

// ── Volume-Based Scenario Generator ───────────────────

/**
 * Generate a scenario deterministically from an AgentProfile + volume specs.
 * Events are distributed evenly across the time span (no randomness).
 */
export function generateScenarioFromVolume(input: {
  profile: AgentProfile;
  volumeInput: ScenarioVolumeInput;
  adminUser: string;
  seed?: number;
  /** Live catalog from DB */
  catalogKpis?: AdminKpiRow[];
}): LabScenario {
  const { profile, volumeInput, adminUser, seed: overrideSeed, catalogKpis } = input;
  const seed = overrideSeed ?? Math.floor(Math.random() * 99999);

  // We use a deterministic counter for IDs (no randomness in event placement)
  let idCounter = seed;
  const nextId = () => {
    idCounter = (idCounter + 1) & 0xffffffff;
    return idCounter.toString(16).padStart(8, '0');
  };

  // User profile — fixed values from the profile
  const userProfile: LabUserProfile = {
    user_id: `lab-user-${nextId()}`,
    display_name: profile.agent_name,
    average_price_point: profile.avg_price_point,
    commission_rate: profile.commission_rate,
  };

  // Resolve a KPI name from live catalog or fallback templates
  const resolveKpiName = (name: string): LabKpiDefinition | null => {
    if (catalogKpis?.length) {
      const row = catalogKpis.find((r) => r.name === name && r.is_active);
      if (row) return { ...adminKpiToLabDef(row), kpi_id: `lab-kpi-${nextId()}` };
    }
    const tmpl = PC_KPI_TEMPLATES.find((t) => t.name === name);
    if (tmpl) return { ...tmpl, kpi_id: `lab-kpi-${nextId()}` };
    return null;
  };

  // Map all kpi_names (PC + GP + VP) → LabKpiDefinition[]
  const allNames = [...profile.kpi_names, ...(profile.gp_kpi_names ?? []), ...(profile.vp_kpi_names ?? [])];
  const kpiDefinitions: LabKpiDefinition[] = allNames
    .map(resolveKpiName)
    .filter((k): k is LabKpiDefinition => k !== null);

  // Build kpi_id lookup by name for volume specs
  const kpiByName = new Map(kpiDefinitions.map((k) => [k.name, k]));

  // Base date: time_span_months ago from today
  const now = new Date();
  const baseDate = new Date(now);
  baseDate.setUTCMonth(baseDate.getUTCMonth() - volumeInput.time_span_months);
  const baseDateIso = baseDate.toISOString().split('T')[0] + 'T00:00:00.000Z';
  const totalDays = Math.round(
    (now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Generate log stream — even distribution
  const logStream: LabLogEntry[] = [];
  for (const spec of volumeInput.volume_specs) {
    const kpi = kpiByName.get(spec.kpi_name);
    if (!kpi || spec.events_per_month <= 0) continue;

    const totalEvents = Math.round(spec.events_per_month * volumeInput.time_span_months);
    if (totalEvents <= 0) continue;

    const intervalDays = totalDays / totalEvents;

    for (let i = 0; i < totalEvents; i++) {
      const dayOffset = Math.round(i * intervalDays);
      const quantity = 1;
      const initialPc =
        userProfile.average_price_point *
        userProfile.commission_rate *
        (kpi.weight_percent / 100) *
        quantity;

      logStream.push({
        log_id: `lab-log-${nextId()}`,
        kpi_id: kpi.kpi_id,
        event_date_iso: addDaysIso(baseDateIso, Math.min(dayOffset, totalDays)),
        quantity,
        initial_pc_override: Number(initialPc.toFixed(2)),
        gp_points: kpi.gp_value * quantity,
        vp_points: kpi.vp_value * quantity,
      });
    }
  }
  logStream.sort((a, b) => a.event_date_iso.localeCompare(b.event_date_iso));

  // Actual closings — always 365-day span, aligned to chart start (today)
  const closingsBaseDateIso = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
  let varCounter = 0;
  const actualClosings: LabActualClosing[] =
    volumeInput.include_actuals
      ? generateRealisticClosings({
          baseDateIso: closingsBaseDateIso,
          avgPricePoint: userProfile.average_price_point,
          commissionRate: userProfile.commission_rate,
          daysSpan: 365,
          idGen: () => nextId(),
          rngVariance: () => {
            varCounter++;
            return (Math.sin(varCounter * 2.654) + 1) / 2; // deterministic 0-1
          },
        })
      : [];

  return {
    scenario_id: `lab-scenario-${nextId()}`,
    seed,
    name: `${profile.name} — Volume Scenario`,
    description: `Generated from profile "${profile.name}" with ${volumeInput.time_span_months}mo span`,
    created_by_admin: adminUser,
    created_at: new Date().toISOString(),
    algorithm_version: ALGORITHM_VERSION,
    user_profile: userProfile,
    kpi_definitions: kpiDefinitions,
    log_stream: logStream,
    actual_closings: actualClosings,
    is_golden: false,
    tags: ['volume-generated'],
    source_profile_id: profile.profile_id,
    volume_input: volumeInput,
    // Store per-month volumes for edit roundtripping (decimals preserved)
    kpi_monthly_volume: Object.fromEntries(
      volumeInput.volume_specs
        .filter((v) => v.events_per_month > 0)
        .map((v) => {
          const kpi = kpiDefinitions.find((k) => k.name === v.kpi_name);
          return [kpi?.kpi_id ?? v.kpi_name, v.events_per_month];
        })
    ),
  };
}
