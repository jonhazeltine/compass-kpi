/**
 * GPCityScreen — GP City test screen with pre-rendered image visualization.
 * Stage stepper (0-9 images), tier controls, pulse testing.
 */
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { PreRenderedCityCanvas } from '../components/gp-city/PreRenderedCityCanvas';
import {
  getTier,
  getNextTierThreshold,
  getCityDecayProgress,
  GP_TIERS,
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
  const [imageStageOverride, setImageStageOverride] = useState<number | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [lastLoggedAt, setLastLoggedAt] = useState<Date | null>(new Date());

  // Shared values for effects
  const pulseProgress = useSharedValue(0);
  const pulseOpacity = useSharedValue(0);
  const decayProgress = useSharedValue(0);

  const tier = getTier(gpTotal) as CityTier;
  const tierConfig = GP_TIERS[tier];
  const decay = getCityDecayProgress(lastLoggedAt);
  const nextThreshold = getNextTierThreshold(gpTotal);

  // Derived image stage: override or tier-based
  const imageStage = imageStageOverride ?? Math.min(tier * 2, 9);

  const headerHeight = 80;
  const controlsHeight = 170;
  const canvasWidth = screenWidth;
  const canvasHeight = screenHeight - insets.top - headerHeight - controlsHeight - insets.bottom;

  const firePulse = useCallback(() => {
    pulseProgress.value = 0;
    pulseOpacity.value = 1;
    pulseProgress.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
    pulseOpacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 700 }),
    );
  }, []);

  const logGP = useCallback((amount: number) => {
    setGpTotal((t) => t + amount);
    setLastLoggedAt(new Date());
    setImageStageOverride(null); // clear override on real log
    firePulse();
  }, []);

  const setDecayLevel = useCallback((hours: number) => {
    if (hours === 0) {
      setLastLoggedAt(new Date());
      decayProgress.value = withTiming(0, { duration: 600 });
    } else {
      setLastLoggedAt(new Date(Date.now() - hours * 60 * 60 * 1000));
      decayProgress.value = withTiming(Math.min(hours / 192, 1), { duration: 600 });
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
          <StatPill label="Img" value={imageStage} />
          <StatPill label="Next" value={nextThreshold} />
          <StatPill label="Decay" value={`${Math.round(decay * 100)}%`} />
        </ScrollView>
      </View>

      {/* Canvas */}
      <View style={[styles.canvasWrap, { backgroundColor: '#000' }]}>
        <PreRenderedCityCanvas
          width={canvasWidth}
          height={canvasHeight}
          tier={tier}
          imageStage={imageStage}
          useVideoTransition={videoEnabled}
          pulseProgress={pulseProgress}
          pulseOpacity={pulseOpacity}
          decayProgress={decayProgress}
        />
      </View>

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 8 }]}>
        {/* Image stage buttons (0-9) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.btnRow}>
          {Array.from({ length: 10 }, (_, i) => (
            <Btn
              key={i}
              label={`${i}`}
              color={imageStage === i ? '#f59e0b' : '#475569'}
              onPress={() => setImageStageOverride(i)}
            />
          ))}
        </ScrollView>

        {/* Tier quick jump */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.btnRow}>
          {GP_TIERS.map((t, i) => (
            <Btn
              key={i}
              label={`T${i}`}
              color={i === tier ? '#3B82F6' : '#64748b'}
              onPress={() => { setGpTotal(t.min); setImageStageOverride(null); }}
            />
          ))}
          <Btn label="Auto" color={imageStageOverride === null ? '#10B981' : '#64748b'} onPress={() => setImageStageOverride(null)} />
          <Btn label="TRANS" color={videoEnabled ? '#10B981' : '#64748b'} onPress={() => setVideoEnabled(v => !v)} />
        </ScrollView>

        {/* Action row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.btnRow}>
          <Btn label="+10 GP" color="#f59e0b" onPress={() => logGP(10)} />
          <Btn label="+50 GP" color="#2196F3" onPress={() => logGP(50)} />
          <Btn label="Pulse" color="#9C27B0" onPress={firePulse} />
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
  btnRow: { flexDirection: 'row', gap: 6, paddingVertical: 3 },
  testBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.sm },
  testBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
