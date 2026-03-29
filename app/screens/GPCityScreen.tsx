/**
 * GPCityScreen — Growth Points city visualization.
 * Procedurally generated cityscape driven by GP data.
 * Stage stepper for development + test controls.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GPCityInline } from '../components/gp-city/GPCityInline';
import {
  getTier,
  getNextTierThreshold,
  getCityDecayProgress,
  GP_TIERS,
  CITY_MICRO_STEPS,
  type CityTier,
} from '../components/gp-city/constants';
import { colors, space, radii } from '../theme/tokens';

interface GPCityScreenProps {
  onBack?: () => void;
}

export default function GPCityScreen({ onBack }: GPCityScreenProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [gpTotal, setGpTotal] = useState(0);
  const [gpStreak, setGpStreak] = useState(0);
  const [lastLoggedAt, setLastLoggedAt] = useState<Date | null>(new Date());
  const [seed] = useState(() => Math.floor(Math.random() * 99999));
  const [pulseKey, setPulseKey] = useState(0);

  const tier = getTier(gpTotal) as CityTier;
  const tierConfig = GP_TIERS[tier];
  const decay = getCityDecayProgress(lastLoggedAt);
  const nextThreshold = getNextTierThreshold(gpTotal);

  const headerHeight = 80;
  const controlsHeight = 150;
  const canvasWidth = screenWidth;
  const canvasHeight = screenHeight - insets.top - headerHeight - controlsHeight - insets.bottom;

  const logGP = useCallback((amount: number) => {
    setGpTotal((t) => t + amount);
    setGpStreak((s) => s + 1);
    setLastLoggedAt(new Date());
    setPulseKey((k) => k + 1);
  }, []);

  const setDecayLevel = useCallback((hours: number) => {
    if (hours === 0) {
      setLastLoggedAt(new Date());
    } else {
      setLastLoggedAt(new Date(Date.now() - hours * 60 * 60 * 1000));
    }
  }, []);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 4 }]}>
        <View style={styles.headerRow}>
          {onBack && (
            <Pressable onPress={onBack} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          )}
          <Text style={styles.headerTitle}>GP City</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow}>
          <StatPill label="GP" value={gpTotal} />
          <StatPill label="Tier" value={`${tier} — ${tierConfig.label}`} />
          <StatPill label="Streak" value={`${gpStreak}d`} />
          <StatPill label="Next" value={nextThreshold} />
          <StatPill label="Decay" value={`${Math.round(decay * 100)}%`} />
        </ScrollView>
      </View>

      {/* Canvas */}
      <View style={styles.canvasWrap}>
        <GPCityInline
          width={canvasWidth}
          height={canvasHeight}
          gpTotal={gpTotal}
          gpStreak={gpStreak}
          lastLoggedAt={lastLoggedAt}
          seed={seed}
          pulseKey={pulseKey}
        />
      </View>

      {/* Stage stepper controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 8 }]}>
        {/* Stage nav */}
        <View style={styles.stageNav}>
          <Pressable
            onPress={() => { if (tier > 0) setGpTotal(GP_TIERS[tier - 1].min); }}
            style={[styles.navArrow, tier === 0 && styles.navDisabled]}
            disabled={tier === 0}
          >
            <Text style={styles.navArrowText}>◀</Text>
          </Pressable>
          <View style={styles.stageInfo}>
            <Text style={styles.stageNum}>Tier {tier}</Text>
            <Text style={styles.stageName}>{tierConfig.label}</Text>
            <Text style={styles.stageGp}>{gpTotal} GP (min {tierConfig.min})</Text>
          </View>
          <Pressable
            onPress={() => { if (tier < 5) setGpTotal(GP_TIERS[tier + 1].min); }}
            style={[styles.navArrow, tier >= 5 && styles.navDisabled]}
            disabled={tier >= 5}
          >
            <Text style={styles.navArrowText}>▶</Text>
          </Pressable>
        </View>

        {/* Quick jump row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.btnRow}>
          {GP_TIERS.map((t, i) => (
            <Btn
              key={i}
              label={`T${i}`}
              color={i === tier ? '#f59e0b' : '#90A4AE'}
              onPress={() => setGpTotal(t.min)}
            />
          ))}
        </ScrollView>

        {/* Action row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.btnRow}>
          <Btn label="+10 GP" color="#f59e0b" onPress={() => logGP(10)} />
          <Btn label="+50 GP" color="#2196F3" onPress={() => logGP(50)} />
          <Btn label="Pulse" color="#9C27B0" onPress={() => setPulseKey((k) => k + 1)} />
          <Btn label="No Decay" color="#8BC34A" onPress={() => setDecayLevel(0)} />
          <Btn label="Full Decay" color="#795548" onPress={() => setDecayLevel(192)} />
        </ScrollView>
      </View>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{String(value)}</Text>
    </View>
  );
}

function Btn({
  label, color, onPress, disabled,
}: {
  label: string; color: string; onPress: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.testBtn, { backgroundColor: color, opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={styles.testBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: space.lg },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#e2e8f0' },
  backBtn: { paddingVertical: 4, paddingRight: 8, width: 60 },
  backText: { fontSize: 15, color: '#fbbf24', fontWeight: '600' },
  statsRow: { marginBottom: 4 },
  statPill: {
    backgroundColor: '#1e293b', borderRadius: radii.sm,
    paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, alignItems: 'center',
  },
  statLabel: {
    fontSize: 10, fontWeight: '600', color: '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  statValue: { fontSize: 13, fontWeight: '700', color: '#e2e8f0' },
  canvasWrap: { flex: 1 },
  controls: {
    backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155',
    paddingTop: 8, paddingHorizontal: 8,
  },
  stageNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, paddingHorizontal: 4,
  },
  navArrow: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#f59e0b',
    alignItems: 'center', justifyContent: 'center',
  },
  navDisabled: { backgroundColor: '#475569' },
  navArrowText: { fontSize: 20, color: '#0f172a', fontWeight: '700' },
  stageInfo: { alignItems: 'center', flex: 1 },
  stageNum: { fontSize: 22, fontWeight: '800', color: '#e2e8f0' },
  stageName: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  stageGp: { fontSize: 11, color: '#64748b', marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: 6, paddingVertical: 3 },
  testBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.sm },
  testBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
