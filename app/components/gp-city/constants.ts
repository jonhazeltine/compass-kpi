/**
 * GP City — growth tiers, colors, decay, micro-step types.
 */

// ── Growth tiers ─────────────────────────────────────────────────────────────

export const GP_TIERS = [
  // Tier 0 — Empty Lot: dirt road, lone lamppost, construction sign, fence
  { min: 0,    label: 'Empty Lot',       buildingCount: 0,  maxFloors: 0,  windowDensity: 0,
    hasRoads: true, hasStreetlights: true, hasCranes: false, hasTraffic: false,
    hasChimneySmoke: false, hasOpenSign: false,
    hasScaffolding: false, hasWaterTower: false, hasPigeons: false,
    hasHelicopter: false, hasBillboard: false, hasSteamVents: false,
    hasMonorail: false, hasSearchlights: false, hasRooftopPools: false,
    hasFlyingSaucers: false, hasHoloBillboards: false, hasEnergyDome: false,
    hasOrbitalRing: false, hasFloatingPlatforms: false, hasNeonRain: false,
    hasAmbientGlow: false, hasDynamicLighting: false },
  // Tier 1 — Small Town: chimneys smoking, flickering OPEN signs
  { min: 25,   label: 'Small Town',      buildingCount: 4,  maxFloors: 3,  windowDensity: 0.3,
    hasRoads: true, hasStreetlights: true, hasCranes: false, hasTraffic: false,
    hasChimneySmoke: true, hasOpenSign: true,
    hasScaffolding: false, hasWaterTower: false, hasPigeons: false,
    hasHelicopter: false, hasBillboard: false, hasSteamVents: false,
    hasMonorail: false, hasSearchlights: false, hasRooftopPools: false,
    hasFlyingSaucers: false, hasHoloBillboards: false, hasEnergyDome: false,
    hasOrbitalRing: false, hasFloatingPlatforms: false, hasNeonRain: false,
    hasAmbientGlow: false, hasDynamicLighting: false },
  // Tier 2 — Growing District: scaffolding, water tower, pigeons
  { min: 100,  label: 'Growing District', buildingCount: 7,  maxFloors: 6,  windowDensity: 0.5,
    hasRoads: true, hasStreetlights: true, hasCranes: true, hasTraffic: false,
    hasChimneySmoke: true, hasOpenSign: true,
    hasScaffolding: true, hasWaterTower: true, hasPigeons: true,
    hasHelicopter: false, hasBillboard: false, hasSteamVents: false,
    hasMonorail: false, hasSearchlights: false, hasRooftopPools: false,
    hasFlyingSaucers: false, hasHoloBillboards: false, hasEnergyDome: false,
    hasOrbitalRing: false, hasFloatingPlatforms: false, hasNeonRain: false,
    hasAmbientGlow: false, hasDynamicLighting: false },
  // Tier 3 — Urban Core: helicopter, billboard, steam vents
  { min: 250,  label: 'Urban Core',      buildingCount: 10, maxFloors: 10, windowDensity: 0.7,
    hasRoads: true, hasStreetlights: true, hasCranes: true, hasTraffic: true,
    hasChimneySmoke: true, hasOpenSign: true,
    hasScaffolding: true, hasWaterTower: true, hasPigeons: true,
    hasHelicopter: true, hasBillboard: true, hasSteamVents: true,
    hasMonorail: false, hasSearchlights: false, hasRooftopPools: false,
    hasFlyingSaucers: false, hasHoloBillboards: false, hasEnergyDome: false,
    hasOrbitalRing: false, hasFloatingPlatforms: false, hasNeonRain: false,
    hasAmbientGlow: false, hasDynamicLighting: false },
  // Tier 4 — Full Skyline: monorail, searchlights, rooftop pools
  { min: 500,  label: 'Full Skyline',    buildingCount: 13, maxFloors: 16, windowDensity: 0.85,
    hasRoads: true, hasStreetlights: true, hasCranes: true, hasTraffic: true,
    hasChimneySmoke: true, hasOpenSign: true,
    hasScaffolding: true, hasWaterTower: true, hasPigeons: true,
    hasHelicopter: true, hasBillboard: true, hasSteamVents: true,
    hasMonorail: true, hasSearchlights: true, hasRooftopPools: true,
    hasFlyingSaucers: false, hasHoloBillboards: false, hasEnergyDome: false,
    hasOrbitalRing: false, hasFloatingPlatforms: false, hasNeonRain: false,
    hasAmbientGlow: true, hasDynamicLighting: false },
  // Tier 5 — Future City: flying saucers, holo-billboards, energy dome, orbital ring, floating platforms, neon rain
  { min: 1000, label: 'Future City',     buildingCount: 16, maxFloors: 22, windowDensity: 1.0,
    hasRoads: true, hasStreetlights: true, hasCranes: true, hasTraffic: true,
    hasChimneySmoke: true, hasOpenSign: true,
    hasScaffolding: true, hasWaterTower: true, hasPigeons: true,
    hasHelicopter: true, hasBillboard: true, hasSteamVents: true,
    hasMonorail: true, hasSearchlights: true, hasRooftopPools: true,
    hasFlyingSaucers: true, hasHoloBillboards: true, hasEnergyDome: true,
    hasOrbitalRing: true, hasFloatingPlatforms: true, hasNeonRain: true,
    hasAmbientGlow: true, hasDynamicLighting: true },
] as const;

export type CityTier = 0 | 1 | 2 | 3 | 4 | 5;

export function getTier(gpTotal: number): CityTier {
  for (let i = GP_TIERS.length - 1; i >= 0; i--) {
    if (gpTotal >= GP_TIERS[i].min) return i as CityTier;
  }
  return 0;
}

export function getNextTierThreshold(gpTotal: number): number {
  for (const t of GP_TIERS) {
    if (t.min > gpTotal) return t.min;
  }
  return gpTotal;
}

// ── Micro-step types ─────────────────────────────────────────────────────────

export const CITY_MICRO_STEPS = [
  'windowLight',
  'floorAdded',
  'streetlightOn',
  'carAppears',
  'scaffolding',
  'craneSwing',
  'facadeBrighten',
  'pedestrian',
  'rooftopDetail',
  'storefrontSign',
] as const;
export type CityMicroStep = (typeof CITY_MICRO_STEPS)[number];

// ── Colors ───────────────────────────────────────────────────────────────────

export const CITY_COLORS = {
  // sky
  skyTop: '#1a1a2e',
  skyMid: '#16213e',
  skyBottom: '#0f3460',
  skyDawn: '#e94560',

  // ground
  ground: '#2d2d2d',
  road: '#3a3a3a',
  roadLine: '#f5c518',
  sidewalk: '#4a4a4a',

  // buildings
  buildingDark: '#1e293b',
  buildingMid: '#334155',
  buildingLight: '#475569',
  buildingHighlight: '#64748b',
  buildingDecay: '#1a1a1a',

  // windows
  windowLit: '#fbbf24',
  windowWarm: '#f59e0b',
  windowCool: '#e2e8f0',
  windowDark: '#0f172a',
  windowDecay: '#111111',

  // streetlights
  lampPost: '#6b7280',
  lampGlow: '#fde68a',
  lampGlowHalo: 'rgba(253, 230, 138, 0.3)',

  // crane
  craneSteel: '#9ca3af',
  craneCable: '#6b7280',

  // traffic
  carBody: '#94a3b8',
  headlight: '#fef3c7',
  taillight: '#ef4444',

  // construction pulse
  pulseGold: '#f59e0b',
  pulseGlow: 'rgba(245, 158, 11, 0.35)',
  particle: '#fbbf24',
  particleGlow: 'rgba(251, 191, 36, 0.3)',

  // tier 1 — chimney smoke
  smoke: 'rgba(148, 163, 184, 0.3)',
  // tier 1 — open sign
  openSign: '#ef4444',
  openSignGlow: 'rgba(239, 68, 68, 0.3)',

  // tier 2 — scaffolding
  scaffold: '#a8a29e',
  // tier 2 — water tower
  waterTower: '#78716c',
  waterTowerLegs: '#57534e',
  // tier 2 — pigeons
  pigeon: '#9ca3af',

  // tier 3 — helicopter
  heliBody: '#64748b',
  heliRotor: '#94a3b8',
  heliLight: '#ef4444',
  // tier 3 — billboard
  billboardFrame: '#475569',
  billboardGlow: 'rgba(251, 191, 36, 0.2)',
  billboardText: '#fbbf24',
  // tier 3 — steam vents
  steam: 'rgba(226, 232, 240, 0.25)',

  // tier 4 — monorail
  monorailTrack: '#64748b',
  monorailCar: '#3b82f6',
  monorailGlow: 'rgba(59, 130, 246, 0.2)',
  // tier 4 — searchlights
  searchlight: 'rgba(253, 230, 138, 0.08)',
  // tier 4 — rooftop pools
  poolWater: 'rgba(56, 189, 248, 0.5)',

  // tier 4+ ambient glow
  ambientGlow: 'rgba(245, 158, 11, 0.08)',
  skylineGlow: 'rgba(251, 191, 36, 0.12)',

  // tier 5 — flying saucers
  saucerBody: '#a78bfa',
  saucerGlow: 'rgba(167, 139, 250, 0.4)',
  saucerBeam: 'rgba(167, 139, 250, 0.12)',
  // tier 5 — holo-billboards
  holoFrame: '#1e293b',
  holoGlow1: 'rgba(34, 211, 238, 0.25)',
  holoGlow2: 'rgba(236, 72, 153, 0.2)',
  holoScanline: 'rgba(34, 211, 238, 0.15)',
  // tier 5 — energy dome
  domeGlow: 'rgba(56, 189, 248, 0.06)',
  domeEdge: 'rgba(56, 189, 248, 0.12)',
  // tier 5 — orbital ring
  orbitalRing: 'rgba(251, 191, 36, 0.15)',
  orbitalDot: '#fbbf24',
  // tier 5 — floating platforms
  platformBase: '#475569',
  platformGlow: 'rgba(59, 130, 246, 0.3)',
  platformBeacon: '#3b82f6',
  // tier 5 — neon rain
  neonRainDrop: 'rgba(34, 211, 238, 0.2)',

  // tier 5 dynamic neon
  neonPink: 'rgba(236, 72, 153, 0.15)',
  neonBlue: 'rgba(59, 130, 246, 0.12)',
  neonPurple: 'rgba(168, 85, 247, 0.10)',

  // decay
  decayOverlay: 'rgba(0, 0, 0, 0.4)',
  vine: '#365314',
  vineLight: '#4d7c0f',
} as const;

// ── Decay ────────────────────────────────────────────────────────────────────

const DECAY_START_HOURS = 48;
const DECAY_FULL_DAYS = 7;

export function getCityDecayProgress(lastLoggedAt: Date | null): number {
  if (!lastLoggedAt) return 1;
  const hoursSince = (Date.now() - lastLoggedAt.getTime()) / (1000 * 60 * 60);
  if (hoursSince < DECAY_START_HOURS) return 0;
  const decayHours = DECAY_FULL_DAYS * 24 - DECAY_START_HOURS;
  return Math.min(1, (hoursSince - DECAY_START_HOURS) / decayHours);
}
