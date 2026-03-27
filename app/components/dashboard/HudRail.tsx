import React from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ACTUAL_CARD_VIEWS, PROJECTED_CARD_WINDOWS } from '../../screens/kpi-dashboard/constants';
import { fmtUsd } from '../../screens/kpi-dashboard/helpers';

export interface HudRailCardMetrics {
  actualLast365: number;
  actualYtd: number;
  projectedNext30: number;
  projectedNext60: number;
  projectedNext90: number;
  projectedNext180: number;
  projectedNext360: number;
  progressPct: number;
}

export interface HudRailProps {
  cardMetrics: HudRailCardMetrics;
  actualHudCardView: (typeof ACTUAL_CARD_VIEWS)[number];
  projectedCardWindowDays: (typeof PROJECTED_CARD_WINDOWS)[number];
  hudActiveIndex: number;
  projectedHudAccentFlashAnim: Animated.Value;
  projectedHudValuePopAnim: Animated.Value;
  onCycleActualHudCard: () => void;
  onCycleProjectedCardWindow: () => void;
}

export default function HudRail({
  cardMetrics,
  actualHudCardView,
  projectedCardWindowDays,
  hudActiveIndex,
  projectedHudAccentFlashAnim,
  projectedHudValuePopAnim,
  onCycleActualHudCard,
  onCycleProjectedCardWindow,
}: HudRailProps) {
  const projectedCardValueByWindow: Record<(typeof PROJECTED_CARD_WINDOWS)[number], number> = {
    30: cardMetrics.projectedNext30,
    60: cardMetrics.projectedNext60,
    90: cardMetrics.projectedNext90,
    180: cardMetrics.projectedNext180,
    360: cardMetrics.projectedNext360,
  };

  const actualCard: {
    key: string;
    label: string;
    value: string;
    accent: string;
    subValue?: string;
    onPress?: () => void;
    kind?: 'actual' | 'projected';
  } =
    actualHudCardView === 'actual365'
      ? {
          key: 'actual365',
          label: 'Actual GCI (365d)',
          value: fmtUsd(cardMetrics.actualLast365),
          subValue: fmtUsd(cardMetrics.actualYtd),
          accent: '#2f9f56',
          onPress: onCycleActualHudCard,
          kind: 'actual',
        }
      : {
          key: 'progress',
          label: 'Progress YTD',
          value: fmtUsd(cardMetrics.actualYtd),
          subValue: `${Math.round(cardMetrics.progressPct)}%`,
          accent: '#1f5fe2',
          onPress: onCycleActualHudCard,
          kind: 'actual',
        };

  const hudCards: Array<{
    key: string;
    label: string;
    value: string;
    accent: string;
    subValue?: string;
    onPress?: () => void;
    kind?: 'actual' | 'projected';
  }> = [
    actualCard,
    {
      key: 'projCycle',
      label: `Projected (${projectedCardWindowDays}d)`,
      value: fmtUsd(projectedCardValueByWindow[projectedCardWindowDays]),
      subValue: `Next ${projectedCardWindowDays} days`,
      accent: '#2158d5',
      onPress: onCycleProjectedCardWindow,
      kind: 'projected',
    },
  ];

  return (
    <View style={styles.hudRailWrap}>
      <View style={styles.hudRailStaticRow}>
        {hudCards.map((card, idx) => (
          <TouchableOpacity
            key={card.key}
            activeOpacity={card.onPress ? 0.8 : 1}
            disabled={!card.onPress}
            onPress={card.onPress}
            style={[
              styles.hudCard,
              card.onPress && styles.hudCardInteractive,
              card.onPress && styles.hudCardTappableGlow,
              card.kind === 'actual' && styles.hudCardActualInteractive,
              card.kind === 'projected' && styles.hudCardProjectedInteractive,
              styles.hudCardFill,
              idx === hudActiveIndex && styles.hudCardActive,
            ]}
          >
            <View style={styles.hudCardHeaderRow}>
              <Animated.View
                style={[
                  styles.hudCardAccent,
                  { backgroundColor: card.accent },
                  card.key === 'projCycle'
                    ? {
                        opacity: projectedHudAccentFlashAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0.7],
                        }),
                        transform: [
                          {
                            scaleX: projectedHudAccentFlashAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.5],
                            }),
                          },
                        ],
                      }
                    : null,
                ]}
              />
              {card.onPress ? <View style={[styles.hudCardHintDot, { backgroundColor: card.accent }]} /> : null}
            </View>
            <Text style={styles.hudCardLabel}>{card.label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hudCardValueScroll}>
              <Animated.View
                style={
                  card.key === 'projCycle'
                    ? {
                        transform: [
                          {
                            scale: projectedHudValuePopAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.08],
                            }),
                          },
                        ],
                      }
                    : undefined
                }
              >
                <Text style={styles.hudCardValue}>{card.value}</Text>
              </Animated.View>
            </ScrollView>
            {card.subValue ? <Text style={styles.hudCardSub}>{card.subValue}</Text> : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hudRailWrap: {
    marginTop: 2,
    marginBottom: 2,
  },
  hudRailContent: {
    paddingRight: 6,
    gap: 10,
  },
  hudRailStaticRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  hudCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7ebf1',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 76,
    justifyContent: 'space-between',
    shadowColor: '#23304a',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  hudCardFill: {
    flex: 1,
  },
  hudCardInteractive: {
    borderColor: '#dfe7f5',
  },
  hudCardTappableGlow: {
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  hudCardActualInteractive: {
    backgroundColor: '#fbfefc',
  },
  hudCardProjectedInteractive: {
    backgroundColor: '#fbfcff',
  },
  hudCardActive: {
    borderColor: '#d8e3f8',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    transform: [{ scale: 1.015 }],
  },
  hudCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 4,
  },
  hudCardAccent: {
    width: 24,
    height: 3,
    borderRadius: 999,
  },
  hudCardHintDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    opacity: 0.65,
  },
  hudCardLabel: {
    color: '#7a8392',
    fontSize: 11,
    fontWeight: '600',
  },
  hudCardValueScroll: {
    maxHeight: 28,
    marginTop: 2,
  },
  hudCardValueSlotViewport: {
    height: 28,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  hudCardValueSlotTrack: {
    flexDirection: 'column',
  },
  hudCardValue: {
    color: '#2f3442',
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  hudCardSub: {
    color: '#6f7a8a',
    fontSize: 11,
    marginTop: 2,
  },
});
