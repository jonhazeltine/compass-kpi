/**
 * AnimationGalleryScreen — Journey player for VP Tree and GP City.
 *
 * One "Advance" button walks through the entire S0→S5 progression.
 * Each step shows a meaningful visual change — a creature entrance,
 * a new effect, a building appearing. Progress bar shows journey position.
 */
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VPTreeInline } from '../components/vp-tree/VPTreeInline';
import { GPCityInline } from '../components/gp-city/GPCityInline';
import { radii } from '../theme/tokens';

// ── Journey step definition ──────────────────────────────────────────────────

interface JourneyStep {
  vpTotal: number;
  label: string;
  description: string;
  stage: number;
  pulse: boolean;
}

// ── VP Tree journey — each step is a meaningful visual change ────────────────

const TREE_JOURNEY: JourneyStep[] = [
  // Stage 0 — Dormant Sprout
  { vpTotal: 0, label: 'Bare Stick', description: 'A single dormant sprout. Nothing alive yet.', stage: 0, pulse: false },
  { vpTotal: 5, label: 'First Pulse', description: 'Energy orb travels up the trunk — the tree responds to investment.', stage: 0, pulse: true },

  // Stage 1 — Young Sapling (25 VP)
  { vpTotal: 25, label: '🌱 TIER 1: Young Sapling', description: 'First leaves appear! Soil sparkles shimmer at the base.', stage: 1, pulse: true },
  { vpTotal: 30, label: 'Squirrel Arrives', description: 'A squirrel scurries up from below and perches on a branch. Tail wags.', stage: 1, pulse: true },
  { vpTotal: 40, label: 'Leaf Unfurl', description: 'A new leaf unfurls at a branch tip — bright green, spring-loaded.', stage: 1, pulse: true },
  { vpTotal: 50, label: 'Flower Bud', description: 'A small flower bud blooms on a branch, then fades.', stage: 1, pulse: true },
  { vpTotal: 60, label: 'Canopy Rustle', description: 'Wind shakes the canopy — leaves sway side to side.', stage: 1, pulse: true },
  { vpTotal: 75, label: 'Sparkles Intensify', description: 'Gold sparkles at the base grow brighter with each log.', stage: 1, pulse: true },
  { vpTotal: 90, label: 'Trunk Glow', description: 'Golden energy pulses up through the trunk bark.', stage: 1, pulse: true },

  // Stage 2 — Growing Tree (100 VP)
  { vpTotal: 100, label: '🌳 TIER 2: Growing Tree', description: 'More branches, thicker trunk. Fireflies appear!', stage: 2, pulse: true },
  { vpTotal: 110, label: 'Bird Nest Built', description: 'A bird nest materializes in a branch fork — 3 eggs rock gently.', stage: 2, pulse: true },
  { vpTotal: 130, label: 'Fireflies Drift', description: '4 fireflies glow and drift around the canopy.', stage: 2, pulse: true },
  { vpTotal: 150, label: 'Butterfly Pass', description: 'A butterfly crosses the scene in a graceful arc.', stage: 2, pulse: true },
  { vpTotal: 180, label: 'Branch Extend', description: 'Trunk glows + branches sway upward — the tree is reaching.', stage: 2, pulse: true },
  { vpTotal: 220, label: 'Canopy Fills', description: 'Leaf density increases. The canopy is becoming full.', stage: 2, pulse: true },

  // Stage 3 — Full Canopy (250 VP)
  { vpTotal: 250, label: '🌲 TIER 3: Full Canopy', description: 'Roots emerge underground. Leaves occasionally fall and drift.', stage: 3, pulse: true },
  { vpTotal: 270, label: 'Owl Lands', description: 'An owl flies down from above and perches on an upper branch. Eyes blink.', stage: 3, pulse: true },
  { vpTotal: 300, label: 'Roots Spread', description: 'Gnarly roots visible below the soil line, branching outward.', stage: 3, pulse: true },
  { vpTotal: 350, label: 'Falling Leaf', description: 'A leaf detaches and floats down with gentle rotation.', stage: 3, pulse: true },
  { vpTotal: 400, label: 'Tree Widens', description: 'Branches spread more horizontally — growing into an oak shape.', stage: 3, pulse: true },
  { vpTotal: 450, label: 'Full Ecosystem', description: 'Squirrel, nest, and owl all active. The tree is alive.', stage: 3, pulse: true },

  // Stage 4 — Mature Tree (500 VP)
  { vpTotal: 500, label: '🏔️ TIER 4: Mature Tree', description: 'Sun rays pierce the canopy. Mushrooms and flowers at the base.', stage: 4, pulse: true },
  { vpTotal: 520, label: 'Deer Walks In', description: 'A deer walks in from the left and settles at the tree base. Antlers visible.', stage: 4, pulse: true },
  { vpTotal: 560, label: 'Sun Rays', description: 'Crepuscular light shafts angle through the branches.', stage: 4, pulse: true },
  { vpTotal: 600, label: 'Ground Flora', description: 'Mushrooms and wildflowers appear at the base of the trunk.', stage: 4, pulse: true },
  { vpTotal: 700, label: 'Massive Canopy', description: 'The widest spread yet — thick limbs reaching horizontally.', stage: 4, pulse: true },
  { vpTotal: 850, label: 'Ancient Feel', description: 'Bark is thick, roots are deep, creatures are settled. Approaching legend.', stage: 4, pulse: true },

  // Stage 5 — Ancient Bloom (1000 VP)
  { vpTotal: 1000, label: '✨ TIER 5: Ancient Bloom', description: 'Aurora bands, floating blossoms, crown halo, glowing rune veins, stars.', stage: 5, pulse: true },
  { vpTotal: 1010, label: 'Golden Wisps', description: '5 golden power orbs float through the canopy, pulsing with energy.', stage: 5, pulse: true },
  { vpTotal: 1030, label: 'Phoenix Appears', description: 'A flame-colored phoenix orbits the canopy, trailing fire particles.', stage: 5, pulse: true },
  { vpTotal: 1050, label: 'Aurora Bands', description: 'Ethereal aurora bands shimmer across the sky, slowly breathing.', stage: 5, pulse: true },
  { vpTotal: 1080, label: 'Floating Blossoms', description: 'Cherry-blossom petals drift upward from the canopy.', stage: 5, pulse: true },
  { vpTotal: 1100, label: 'Crown Halo', description: 'A golden ring of light pulses above the canopy peak.', stage: 5, pulse: true },
  { vpTotal: 1130, label: 'Butterflies Orbit', description: '2 butterflies circle the tree in figure-8 patterns.', stage: 5, pulse: true },
  { vpTotal: 1160, label: 'Rune Veins', description: 'Bioluminescent teal veins pulse along the trunk and main branches.', stage: 5, pulse: true },
  { vpTotal: 1200, label: 'Stars Appear', description: 'Stars twinkle in the sky even during day — magical realm.', stage: 5, pulse: true },
  { vpTotal: 1300, label: 'Full Ancient Bloom', description: 'Every effect active. This is the maximum expression of vitality.', stage: 5, pulse: true },
];

// ── GP City journey ──────────────────────────────────────────────────────────

const CITY_JOURNEY: JourneyStep[] = [
  // Tier 0 — Empty Lot
  { vpTotal: 0, label: 'Empty Lot', description: 'Dirt road, a fence, and a construction sign. Everything starts here.', stage: 0, pulse: false },
  { vpTotal: 5, label: 'First Pulse', description: 'Golden construction pulse — the lot responds to investment.', stage: 0, pulse: true },

  // Tier 1 — Small Town (25 GP)
  { vpTotal: 25, label: '🏘️ TIER 1: Small Town', description: '4 small buildings rise. Streetlights flicker on. Roads appear.', stage: 1, pulse: true },
  { vpTotal: 35, label: 'Chimney Smoke', description: 'Smoke puffs rise from chimneys — signs of life inside.', stage: 1, pulse: true },
  { vpTotal: 50, label: 'OPEN Signs', description: 'Flickering red neon OPEN signs on storefront facades.', stage: 1, pulse: true },
  { vpTotal: 75, label: 'Windows Light Up', description: 'More windows glow warm amber as occupancy grows.', stage: 1, pulse: true },

  // Tier 2 — Growing District (100 GP)
  { vpTotal: 100, label: '🏗️ TIER 2: Growing District', description: '7 buildings, mid-rise. Cranes appear on the skyline.', stage: 2, pulse: true },
  { vpTotal: 115, label: 'Scaffolding', description: 'Construction scaffolding appears on the newest building.', stage: 2, pulse: true },
  { vpTotal: 130, label: 'Water Tower', description: 'A water tower rises on the tallest rooftop.', stage: 2, pulse: true },
  { vpTotal: 150, label: 'Pigeons', description: 'Pigeons hover near the rooftops.', stage: 2, pulse: true },
  { vpTotal: 175, label: 'Cranes Swing', description: 'Construction cranes slowly swing their arms — active building.', stage: 2, pulse: true },
  { vpTotal: 220, label: 'District Grows', description: 'More lit windows, taller buildings. Momentum building.', stage: 2, pulse: true },

  // Tier 3 — Urban Core (250 GP)
  { vpTotal: 250, label: '🏙️ TIER 3: Urban Core', description: '10 buildings, dense. Helicopter patrol, traffic on the roads.', stage: 3, pulse: true },
  { vpTotal: 270, label: 'Helicopter', description: 'A helicopter patrols across the skyline with blinking red light.', stage: 3, pulse: true },
  { vpTotal: 300, label: 'Billboard', description: 'An illuminated billboard appears at street level.', stage: 3, pulse: true },
  { vpTotal: 330, label: 'Steam Vents', description: 'Steam rises from street grates — urban infrastructure.', stage: 3, pulse: true },
  { vpTotal: 370, label: 'Traffic Flows', description: 'Cars with headlights and taillights move along the road.', stage: 3, pulse: true },
  { vpTotal: 430, label: 'Dense Core', description: 'The skyline is filling in. Construction everywhere.', stage: 3, pulse: true },

  // Tier 4 — Full Skyline (500 GP)
  { vpTotal: 500, label: '🌃 TIER 4: Full Skyline', description: '13 buildings, ambient glow. Monorail glides. Searchlights sweep.', stage: 4, pulse: true },
  { vpTotal: 520, label: 'Monorail', description: 'A blue monorail glides along an elevated track across the city.', stage: 4, pulse: true },
  { vpTotal: 560, label: 'Searchlights', description: 'Searchlight beams sweep from the tallest rooftops.', stage: 4, pulse: true },
  { vpTotal: 600, label: 'Rooftop Pools', description: 'Glowing cyan pools appear on high-rise rooftops.', stage: 4, pulse: true },
  { vpTotal: 650, label: 'Skyline Glow', description: 'Warm ambient glow radiates from the skyline — the city is alive.', stage: 4, pulse: true },
  { vpTotal: 800, label: 'Full Night City', description: 'Every window lit, traffic flowing, searchlights sweeping.', stage: 4, pulse: true },

  // Tier 5 — Future City (1000 GP)
  { vpTotal: 1000, label: '🚀 TIER 5: Future City', description: 'Flying saucers, holo-billboards, energy dome, neon rain. THE FUTURE.', stage: 5, pulse: true },
  { vpTotal: 1020, label: 'Flying Saucers', description: '3 flying saucers orbit the city with glowing tractor beams.', stage: 5, pulse: true },
  { vpTotal: 1050, label: 'Holo-Billboards', description: 'Holographic billboards with scanlines project from building facades.', stage: 5, pulse: true },
  { vpTotal: 1080, label: 'Energy Dome', description: 'A translucent energy dome pulses over the entire city.', stage: 5, pulse: true },
  { vpTotal: 1110, label: 'Orbital Ring', description: 'A golden orbital ring with a tracking dot circles above.', stage: 5, pulse: true },
  { vpTotal: 1140, label: 'Floating Platforms', description: '3 hovering platforms with beacon lights float above the skyline.', stage: 5, pulse: true },
  { vpTotal: 1170, label: 'Neon Rain', description: 'Glowing cyan rain streaks fall across the scene.', stage: 5, pulse: true },
  { vpTotal: 1200, label: 'Dynamic Neon', description: 'Pink, blue, and purple neon bands pulse across the sky.', stage: 5, pulse: true },
  { vpTotal: 1300, label: 'Full Future City', description: 'Every effect active. Maximum expression of growth.', stage: 5, pulse: true },
];

// ── Stage colors for progress bar segments ───────────────────────────────────

const STAGE_COLORS = ['#64748b', '#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444'];

// ── Component ────────────────────────────────────────────────────────────────

interface Props { onBack?: () => void; }

export default function AnimationGalleryScreen({ onBack }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'tree' | 'city'>('tree');
  const [stepIdx, setStepIdx] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);

  const journey = tab === 'tree' ? TREE_JOURNEY : CITY_JOURNEY;
  const step = journey[stepIdx];
  const canvasWidth = screenWidth - 32;
  const canvasHeight = 300;
  const progress = journey.length > 1 ? stepIdx / (journey.length - 1) : 0;

  const advance = useCallback(() => {
    if (stepIdx < journey.length - 1) {
      const next = stepIdx + 1;
      setStepIdx(next);
      if (journey[next].pulse) setPulseKey(k => k + 1);
    }
  }, [stepIdx, journey]);

  const goBack = useCallback(() => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }, [stepIdx]);

  const reset = useCallback(() => {
    setStepIdx(0);
    setPulseKey(0);
  }, []);

  const switchTab = useCallback((t: 'tree' | 'city') => {
    setTab(t);
    setStepIdx(0);
    setPulseKey(0);
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {onBack && (
            <Pressable onPress={onBack} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          )}
          <Text style={styles.title}>Journey Player</Text>
          <Pressable onPress={reset} style={styles.resetBtn}>
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        </View>

        {/* Tab toggle */}
        <View style={styles.tabRow}>
          <Pressable style={[styles.tab, tab === 'tree' && styles.tabActive]} onPress={() => switchTab('tree')}>
            <Text style={[styles.tabText, tab === 'tree' && styles.tabTextActive]}>VP Tree</Text>
          </Pressable>
          <Pressable style={[styles.tab, tab === 'city' && styles.tabActive]} onPress={() => switchTab('city')}>
            <Text style={[styles.tabText, tab === 'city' && styles.tabTextActive]}>GP City</Text>
          </Pressable>
        </View>

        {/* Journey progress bar */}
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: `${progress * 100}%`,
              backgroundColor: STAGE_COLORS[step.stage] ?? '#64748b',
            }]} />
          </View>
          {/* Stage markers */}
          <View style={styles.stageMarkers}>
            {[0, 1, 2, 3, 4, 5].map(s => {
              const stageStart = journey.findIndex(j => j.stage === s);
              const pos = stageStart >= 0 ? stageStart / (journey.length - 1) : 0;
              return (
                <View key={s} style={[styles.stageDot, {
                  left: `${pos * 100}%`,
                  backgroundColor: step.stage >= s ? STAGE_COLORS[s] : '#334155',
                }]}>
                  <Text style={styles.stageDotText}>{s}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Canvas */}
      <View style={styles.canvasWrap}>
        {tab === 'tree' ? (
          <VPTreeInline
            width={canvasWidth}
            height={canvasHeight}
            vpTotal={step.vpTotal}
            seed={42}
            pulseKey={pulseKey}
          />
        ) : (
          <GPCityInline
            width={canvasWidth}
            height={canvasHeight}
            gpTotal={step.vpTotal}
            seed={42}
            pulseKey={pulseKey}
          />
        )}
      </View>

      {/* Step info */}
      <View style={styles.stepInfo}>
        <View style={styles.stepHeader}>
          <View style={[styles.stageBadge, { backgroundColor: STAGE_COLORS[step.stage] }]}>
            <Text style={styles.stageBadgeText}>S{step.stage}</Text>
          </View>
          <Text style={styles.stepLabel}>{step.label}</Text>
          <Text style={styles.stepCount}>{stepIdx + 1} / {journey.length}</Text>
        </View>
        <Text style={styles.stepDesc}>{step.description}</Text>
        <Text style={styles.vpText}>{tab === 'tree' ? 'VP' : 'GP'}: {step.vpTotal}</Text>
      </View>

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.navBtn, stepIdx <= 0 && styles.navBtnDisabled]}
          onPress={goBack}
          disabled={stepIdx <= 0}
        >
          <Text style={styles.navBtnText}>◀ Back</Text>
        </Pressable>

        <Pressable
          style={[styles.advanceBtn, stepIdx >= journey.length - 1 && styles.navBtnDisabled]}
          onPress={advance}
          disabled={stepIdx >= journey.length - 1}
        >
          <Text style={styles.advanceBtnText}>
            {stepIdx >= journey.length - 1 ? 'Journey Complete' : 'Advance ▶'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 15, color: '#fbbf24', fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: '#e2e8f0' },
  resetBtn: { paddingVertical: 4, paddingLeft: 8 },
  resetText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: radii.sm, backgroundColor: '#1e293b', alignItems: 'center' },
  tabActive: { backgroundColor: '#f59e0b' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  tabTextActive: { color: '#0f172a' },
  progressWrap: { marginBottom: 6, height: 28 },
  progressTrack: { height: 6, backgroundColor: '#1e293b', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  stageMarkers: { position: 'relative', height: 18, marginTop: 4 },
  stageDot: {
    position: 'absolute', width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', marginLeft: -9, top: 0,
  },
  stageDotText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  canvasWrap: { marginHorizontal: 16, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1e293b' },
  stepInfo: { paddingHorizontal: 20, paddingVertical: 12, flex: 1 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  stageBadge: { width: 28, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  stageBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  stepLabel: { fontSize: 16, fontWeight: '700', color: '#e2e8f0', flex: 1 },
  stepCount: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  stepDesc: { fontSize: 14, color: '#94a3b8', lineHeight: 20, marginBottom: 4 },
  vpText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  controls: {
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, gap: 12,
    borderTopWidth: 1, borderTopColor: '#1e293b',
  },
  navBtn: {
    flex: 1, paddingVertical: 14, borderRadius: radii.sm, backgroundColor: '#334155',
    alignItems: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: 15, fontWeight: '700', color: '#e2e8f0' },
  advanceBtn: {
    flex: 2, paddingVertical: 14, borderRadius: radii.sm, backgroundColor: '#f59e0b',
    alignItems: 'center',
  },
  advanceBtnText: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
});
