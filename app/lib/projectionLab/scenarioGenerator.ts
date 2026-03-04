/**
 * Projection Lab — Seeded Scenario Generator
 *
 * Produces deterministic synthetic scenarios from a numeric seed.
 * Same seed always produces the same scenario for reproducibility.
 */

import type {
  LabScenario,
  LabUserProfile,
  LabKpiDefinition,
  LabLogEntry,
  LabActualClosing,
} from './types';

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

function seededChoice<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
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

// ── Preset KPI templates ──────────────────────────────

const KPI_TEMPLATES: Omit<LabKpiDefinition, 'kpi_id'>[] = [
  {
    name: 'Listings Taken',
    unit: 'count',
    weight_percent: 30,
    ttc_definition: '30-60',
    delay_days: null,
    hold_days: null,
    decay_days: null,
    gp_value: 50,
    vp_value: 10,
    direction: 'higher_is_better',
  },
  {
    name: 'Buyer Presentations',
    unit: 'count',
    weight_percent: 20,
    ttc_definition: '14-30',
    delay_days: null,
    hold_days: null,
    decay_days: null,
    gp_value: 30,
    vp_value: 8,
    direction: 'higher_is_better',
  },
  {
    name: 'Open Houses',
    unit: 'count',
    weight_percent: 15,
    ttc_definition: '7',
    delay_days: null,
    hold_days: null,
    decay_days: null,
    gp_value: 20,
    vp_value: 5,
    direction: 'higher_is_better',
  },
  {
    name: 'Contacts Made',
    unit: 'count',
    weight_percent: 10,
    ttc_definition: '60-90',
    delay_days: null,
    hold_days: null,
    decay_days: null,
    gp_value: 10,
    vp_value: 3,
    direction: 'higher_is_better',
  },
  {
    name: 'Marketing Actions',
    unit: 'count',
    weight_percent: 10,
    ttc_definition: '30',
    delay_days: null,
    hold_days: null,
    decay_days: null,
    gp_value: 15,
    vp_value: 4,
    direction: 'higher_is_better',
  },
  {
    name: 'Follow-Ups',
    unit: 'count',
    weight_percent: 15,
    ttc_definition: '14-45',
    delay_days: null,
    hold_days: null,
    decay_days: null,
    gp_value: 12,
    vp_value: 6,
    direction: 'higher_is_better',
  },
];

// ── Generator ─────────────────────────────────────────

export const ALGORITHM_VERSION = '1.0.0-lab';

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

  // User profile
  const userProfile: LabUserProfile = {
    user_id: `lab-user-${seededId(rng)}`,
    display_name: `Lab Agent ${seed}`,
    average_price_point: Number(seededRange(rng, 200000, 800000).toFixed(0)),
    commission_rate: Number(seededRange(rng, 0.02, 0.035).toFixed(4)),
  };

  // Pick KPI subset
  const shuffled = [...KPI_TEMPLATES].sort(() => rng() - 0.5);
  const selectedCount = Math.min(kpiCount, shuffled.length);
  const kpiDefinitions: LabKpiDefinition[] = shuffled
    .slice(0, selectedCount)
    .map((tmpl) => ({
      ...tmpl,
      kpi_id: `lab-kpi-${seededId(rng)}`,
    }));

  // Normalize weights to sum to 100
  const totalWeight = kpiDefinitions.reduce((s, k) => s + k.weight_percent, 0);
  if (totalWeight > 0) {
    kpiDefinitions.forEach((k) => {
      k.weight_percent = Number(((k.weight_percent / totalWeight) * 100).toFixed(1));
    });
  }

  // Generate log stream
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

  // Sort by date
  logStream.sort((a, b) => a.event_date_iso.localeCompare(b.event_date_iso));

  // Optional actual closings
  const actualClosings: LabActualClosing[] = [];
  if (includeActuals) {
    const closingCount = seededInt(rng, 2, 6);
    for (let i = 0; i < closingCount; i++) {
      const dayOffset = seededInt(rng, 30, logDaysSpan);
      actualClosings.push({
        closing_id: `lab-closing-${seededId(rng)}`,
        event_date_iso: addDaysIso(baseDateIso, dayOffset),
        actual_gci_delta: Number(seededRange(rng, 5000, 30000).toFixed(2)),
      });
    }
    actualClosings.sort((a, b) => a.event_date_iso.localeCompare(b.event_date_iso));
  }

  return {
    scenario_id: `lab-scenario-${seededId(rng)}`,
    seed,
    name: name || `Scenario #${seed}`,
    description: description || `Auto-generated scenario from seed ${seed}`,
    created_by_admin: adminUser,
    created_at: new Date().toISOString(),
    algorithm_version: ALGORITHM_VERSION,
    user_profile: userProfile,
    kpi_definitions: kpiDefinitions,
    log_stream: logStream,
    actual_closings: actualClosings,
    is_golden: false,
    tags: [],
  };
}
