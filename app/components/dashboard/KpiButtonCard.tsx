import React from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import KpiIcon from '../kpi/KpiIcon';
import { kpiTypeAccent } from '../../screens/kpi-dashboard/helpers';
import type { DashboardPayload } from '../../screens/kpi-dashboard/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KpiLike = Pick<
  DashboardPayload['loggable_kpis'][number],
  'id' | 'name' | 'type' | 'icon_source' | 'icon_name' | 'icon_emoji' | 'icon_file'
>;

export type KpiButtonCardProps = {
  kpi: KpiLike;
  todayCount?: number;
  weeklyGoal?: number;
  weeklyCount?: number;
  confirmed?: boolean;
  isRequired?: boolean;
  disabled?: boolean;
  scale?: Animated.Value;
  index?: number; // for stagger (future idle animation)
  onPress?: () => void;
  onLongPress?: () => void;
  /** Delay in ms before onLongPress fires. RN default is 500ms — the picker tray uses ~200ms for snappier drag activation. */
  delayLongPress?: number;
  onPressIn?: (e: GestureResponderEvent) => void;
  onPressOut?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Optional overlays rendered inside the card frame (e.g. favorite badge, lock, full ribbon). */
  overlay?: React.ReactNode;
  /** Hide the name label below the card (used by grids that have their own label layout). */
  hideName?: boolean;
  nameColor?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function KpiButtonCard({
  kpi,
  todayCount = 0,
  weeklyGoal = 0,
  weeklyCount = 0,
  confirmed = false,
  isRequired = false,
  disabled = false,
  scale,
  onPress,
  onLongPress,
  delayLongPress,
  onPressIn,
  onPressOut,
  style,
  overlay,
  hideName = false,
  nameColor,
}: KpiButtonCardProps) {
  const accent = kpiTypeAccent(kpi.type as any);
  const hasLogged = todayCount > 0;
  const countDisplay = hasLogged ? String(todayCount) : '—';
  const goalProgress = weeklyGoal > 0 ? Math.min(1, weeklyCount / weeklyGoal) : 0;
  const showGoalBar = weeklyGoal > 0;

  const cardStyle = [
    styles.card,
    confirmed && styles.cardConfirmed,
    isRequired && !confirmed && styles.cardRequired,
    disabled && styles.cardDisabled,
    style,
  ];

  const inner = (
    <View style={styles.cardOuter}>
      <View style={cardStyle}>
        <KpiIcon
          kpi={kpi}
          size={40}
          backgroundColor="transparent"
          color={accent}
        />
        <Text style={[styles.count, { color: accent }]}>
          {countDisplay}
        </Text>
        {showGoalBar && (
          <View style={styles.goalBarTrack}>
            <View
              style={[
                styles.goalBarFill,
                {
                  width: `${Math.round(goalProgress * 100)}%` as any,
                  backgroundColor: goalProgress >= 1 ? '#E8C97A' : accent,
                },
              ]}
            />
          </View>
        )}
        {overlay}
      </View>
      {!hideName && (
        <Text
          style={[styles.name, nameColor ? { color: nameColor } : null]}
          numberOfLines={2}
        >
          {kpi.name}
        </Text>
      )}
    </View>
  );

  const isInteractive = Boolean(onPress || onLongPress || onPressIn || onPressOut);

  // If interactive (has press handlers), wrap in Pressable + optional scale
  if (isInteractive) {
    const body = scale ? (
      <Animated.View style={{ transform: [{ scale }] }}>{inner}</Animated.View>
    ) : (
      inner
    );
    return (
      <Pressable
        onPress={onPress ?? (() => {})}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled && !onPress && !onLongPress}
        style={styles.pressable}
      >
        {body}
      </Pressable>
    );
  }

  // Static (preview mode)
  return <View style={styles.pressable}>{inner}</View>;
}

export default React.memo(KpiButtonCard);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },

  cardOuter: {
    alignItems: 'center',
    gap: 6,
  },

  card: {
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#1A1D26',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },

  cardConfirmed: {
    borderColor: 'rgba(201,168,76,0.3)',
    backgroundColor: 'rgba(201,168,76,0.06)',
    shadowColor: '#C9A84C',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },

  cardRequired: {
    borderColor: 'rgba(201,136,33,0.35)',
    backgroundColor: 'rgba(255,208,108,0.06)',
  },

  cardDisabled: {
    opacity: 0.4,
  },

  name: {
    color: '#7B8099',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
    maxWidth: '100%',
  },

  count: {
    color: '#7B8099',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
  },

  goalBarTrack: {
    width: '70%',
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },

  goalBarFill: {
    height: '100%',
    borderRadius: 1.5,
  },
});
