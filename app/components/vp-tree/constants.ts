/**
 * VP Tree — growth stages, colors, decay, micro-step types.
 */

// ── Growth stages ──────────────────────────────────────────────────────────────

export const VP_STAGES = [
  // Stage 0 — Dormant Sprout: bare stick, no leaves, no creatures
  { min: 0,    label: 'Dormant Sprout', maxDepth: 1, leafDensity: 0,    trunkScale: 0.6, spreadScale: 0.5, horizontalBias: 0,
    hasSparkles: false, hasFireflies: false, hasRoots: false, hasFallingLeaves: false,
    hasSunRays: false, hasGroundFlora: false, hasWildlife: false,
    hasAurora: false, hasBlossoms: false, hasCrown: false, hasButterflies: false, hasRuneVeins: false, hasStars: false, hasBloom: false,
    hasSquirrel: false, hasNest: false, hasOwl: false, hasDeer: false, hasWisps: false, hasPhoenix: false },
  // Stage 1 — Young Sapling: first leaves + soil sparkles + squirrel
  { min: 25,   label: 'Young Sapling',  maxDepth: 2, leafDensity: 0.3,  trunkScale: 0.75, spreadScale: 0.65, horizontalBias: 0.05,
    hasSparkles: true, hasFireflies: false, hasRoots: false, hasFallingLeaves: false,
    hasSunRays: false, hasGroundFlora: false, hasWildlife: false,
    hasAurora: false, hasBlossoms: false, hasCrown: false, hasButterflies: false, hasRuneVeins: false, hasStars: false, hasBloom: false,
    hasSquirrel: true, hasNest: false, hasOwl: false, hasDeer: false, hasWisps: false, hasPhoenix: false },
  // Stage 2 — Growing Tree: fireflies + bird nest with eggs
  { min: 100,  label: 'Growing Tree',   maxDepth: 3, leafDensity: 0.6,  trunkScale: 0.85, spreadScale: 0.8, horizontalBias: 0.1,
    hasSparkles: true, hasFireflies: true, hasRoots: false, hasFallingLeaves: false,
    hasSunRays: false, hasGroundFlora: false, hasWildlife: false,
    hasAurora: false, hasBlossoms: false, hasCrown: false, hasButterflies: false, hasRuneVeins: false, hasStars: false, hasBloom: false,
    hasSquirrel: true, hasNest: true, hasOwl: false, hasDeer: false, hasWisps: false, hasPhoenix: false },
  // Stage 3 — Full Canopy: roots + falling leaves + owl
  { min: 250,  label: 'Full Canopy',    maxDepth: 4, leafDensity: 0.85, trunkScale: 1.0, spreadScale: 1.0, horizontalBias: 0.18,
    hasSparkles: true, hasFireflies: true, hasRoots: true, hasFallingLeaves: true,
    hasSunRays: false, hasGroundFlora: false, hasWildlife: false,
    hasAurora: false, hasBlossoms: false, hasCrown: false, hasButterflies: false, hasRuneVeins: false, hasStars: false, hasBloom: false,
    hasSquirrel: true, hasNest: true, hasOwl: true, hasDeer: false, hasWisps: false, hasPhoenix: false },
  // Stage 4 — Mature Tree: sun rays, ground flora, deer at base
  { min: 500,  label: 'Mature Tree',    maxDepth: 5, leafDensity: 1.0,  trunkScale: 1.4, spreadScale: 1.3, horizontalBias: 0.45,
    hasSparkles: true, hasFireflies: true, hasRoots: true, hasFallingLeaves: true,
    hasSunRays: true, hasGroundFlora: true, hasWildlife: true,
    hasAurora: false, hasBlossoms: false, hasCrown: false, hasButterflies: false, hasRuneVeins: false, hasStars: false, hasBloom: false,
    hasSquirrel: true, hasNest: true, hasOwl: true, hasDeer: true, hasWisps: false, hasPhoenix: false },
  // Stage 5 — Ancient Bloom: everything + wisps + phoenix
  { min: 1000, label: 'Ancient Bloom',  maxDepth: 5, leafDensity: 1.0,  trunkScale: 1.8, spreadScale: 1.6, horizontalBias: 0.65,
    hasSparkles: true, hasFireflies: true, hasRoots: true, hasFallingLeaves: true,
    hasSunRays: true, hasGroundFlora: true, hasWildlife: true,
    hasAurora: true, hasBlossoms: true, hasCrown: true, hasButterflies: true, hasRuneVeins: true, hasStars: true, hasBloom: true,
    hasSquirrel: true, hasNest: true, hasOwl: true, hasDeer: true, hasWisps: true, hasPhoenix: true },
] as const;

export type GrowthStage = 0 | 1 | 2 | 3 | 4 | 5;

export function getStage(vpTotal: number): GrowthStage {
  for (let i = VP_STAGES.length - 1; i >= 0; i--) {
    if (vpTotal >= VP_STAGES[i].min) return i as GrowthStage;
  }
  return 0;
}

export function getNextThreshold(vpTotal: number): number {
  for (const s of VP_STAGES) {
    if (s.min > vpTotal) return s.min;
  }
  return vpTotal; // already at max
}

// ── Micro-step types ───────────────────────────────────────────────────────────

export const MICRO_STEP_TYPES = [
  'leafUnfurl',
  'branchExtend',
  'flowerBud',
  'canopyRustle',
  'trunkGlow',
  'butterfly',
] as const;
export type MicroStepType = (typeof MICRO_STEP_TYPES)[number];

// ── Colors ─────────────────────────────────────────────────────────────────────

export const TREE_COLORS = {
  // sky
  skyTop: '#dce8f5',
  skyBottom: '#b5d4f1',
  skyDecayTop: '#c8c8c8',
  skyDecayBottom: '#a0a0a0',

  // ground
  ground: '#8B7355',
  grass: '#6B8E23',
  grassDecay: '#8B8B6E',

  // trunk & branch
  trunk: '#5D4037',
  trunkLight: '#795548',
  trunkGlow: '#FFB74D',
  trunkDecay: '#78909C',

  // leaves
  leaf: '#4CAF50',
  leafLight: '#81C784',
  leafDark: '#388E3C',
  leafDecay: '#9E9E9E',

  // flora & fauna
  flower: '#F48FB1',
  flowerCenter: '#FFD54F',
  butterfly: '#CE93D8',
  bird: '#5D4037',

  // orb
  orbCore: '#66BB6A',
  orbGold: '#FFD700',
  orbGlow: 'rgba(102, 187, 106, 0.35)',

  // stage 1 — soil sparkles
  sparkle: '#FFD700',
  sparkleGlow: 'rgba(255, 215, 0, 0.3)',

  // stage 2 — fireflies
  fireflyCore: '#FFEE58',
  fireflyGlow: 'rgba(255, 238, 88, 0.4)',

  // stage 3 — roots
  root: '#5D4037',
  rootLight: '#795548',

  // stage 4 — sun rays
  sunRay: 'rgba(255, 236, 179, 0.18)',
  // stage 4 — ground flora
  mushroom: '#D7CCC8',
  mushroomCap: '#A1887F',
  groundFlower: '#F48FB1',
  groundFlowerCenter: '#FFF176',

  // stage 5 — aurora
  auroraTop: 'rgba(129, 212, 250, 0.15)',
  auroraMid: 'rgba(186, 104, 200, 0.12)',
  auroraBottom: 'rgba(129, 199, 132, 0.10)',

  // stage 5 — floating blossoms
  blossomPink: '#F8BBD0',
  blossomWhite: '#FCE4EC',

  // stage 5 — crown / halo
  crownGold: '#FFD54F',
  crownGlow: 'rgba(255, 213, 79, 0.3)',

  // stage 5 — rune veins
  runeVein: '#80CBC4',
  runeGlow: 'rgba(128, 203, 196, 0.35)',

  // stage 5 — stars
  star: '#E1F5FE',
  starBright: '#FFFFFF',

  // bloom (stage 5) — warm golden-pink mystical glow
  bloomGlow: 'rgba(255, 213, 79, 0.2)',
  bloomGlowPink: 'rgba(248, 187, 208, 0.15)',

  // particles
  particle: '#A5D6A7',
} as const;

// ── Decay ──────────────────────────────────────────────────────────────────────

const DECAY_START_HOURS = 48;
const DECAY_FULL_DAYS = 7;

export function getDecayProgress(lastLoggedAt: Date | null): number {
  if (!lastLoggedAt) return 1;
  const hoursSince = (Date.now() - lastLoggedAt.getTime()) / (1000 * 60 * 60);
  if (hoursSince < DECAY_START_HOURS) return 0;
  const decayHours = DECAY_FULL_DAYS * 24 - DECAY_START_HOURS;
  return Math.min(1, (hoursSince - DECAY_START_HOURS) / decayHours);
}
