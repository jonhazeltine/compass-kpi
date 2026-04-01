import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import KpiIcon from './KpiIcon';
import { kpiTypeAccent } from '../../screens/kpi-dashboard/helpers';
import type { DashboardPayload } from '../../screens/kpi-dashboard/types';
import type { useKpiLogging } from '../../hooks/useKpiLogging';

type LoggableKpi = DashboardPayload['loggable_kpis'][number];

type KpiLoggingHook = ReturnType<typeof useKpiLogging>;

type Props = {
  kpis: LoggableKpi[];
  logging: KpiLoggingHook;
  /** Dark mode for Unity overlay; light mode for dashboard (default) */
  darkMode?: boolean;
};

export default function KpiTileGrid({ kpis, logging, darkMode = false }: Props) {
  const {
    confirmedKpiTileIds,
    getKpiTileScale,
    getKpiTileSuccessAnim,
    fireQuickLogAtPoint,
    startAutoFire,
    stopAutoFire,
    runKpiTilePressOutFeedback,
  } = logging;

  return (
    <View style={styles.gridWrap}>
      {kpis.map((kpi) => {
        const successAnim = getKpiTileSuccessAnim(kpi.id);
        const successOpacity = successAnim.interpolate({
          inputRange: [0, 0.12, 1],
          outputRange: [0, 1, 0],
        });
        const successTranslateY = successAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -14],
        });
        const successScale = successAnim.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [0.8, 1.02, 0.96],
        });
        const confirmed = confirmedKpiTileIds[kpi.id];

        return (
          <Pressable
            key={kpi.id}
            style={styles.gridItem}
            onPress={() => {}}
            onPressIn={(e) => {
              const sourcePagePoint = {
                x: e.nativeEvent.pageX,
                y: e.nativeEvent.pageY,
              };
              fireQuickLogAtPoint(kpi, sourcePagePoint);
              startAutoFire(kpi, sourcePagePoint);
            }}
            onPressOut={() => {
              stopAutoFire(kpi.id);
              runKpiTilePressOutFeedback(kpi.id);
            }}
          >
            <Animated.View
              style={[
                styles.gridTileAnimatedWrap,
                { transform: [{ scale: getKpiTileScale(kpi.id) }] },
              ]}
            >
              <View style={styles.gridCircleWrap}>
                <View
                  style={[
                    styles.gridCircle,
                    confirmed && styles.gridCircleConfirmed,
                  ]}
                >
                  <KpiIcon
                    kpi={kpi}
                    size={76}
                    backgroundColor="transparent"
                    color={kpiTypeAccent(kpi.type)}
                  />
                </View>
                {/* Success coin badge */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.successBadge,
                    {
                      opacity: successOpacity,
                      transform: [
                        { translateY: successTranslateY },
                        { scale: successScale },
                      ],
                    },
                  ]}
                >
                  <View style={styles.successCoinOuter}>
                    <View style={styles.successCoinInner} />
                    <View style={styles.successCoinHighlight} />
                  </View>
                </Animated.View>
              </View>
              <Text
                style={[
                  darkMode ? styles.gridLabelDark : styles.gridLabel,
                  confirmed && styles.gridLabelConfirmed,
                ]}
                numberOfLines={2}
              >
                {kpi.name}
              </Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 6,
    paddingBottom: 0,
  },
  gridItem: {
    width: '24%',
    alignItems: 'center',
    gap: 2,
  },
  gridTileAnimatedWrap: {
    alignItems: 'center',
    gap: 2,
    width: '100%',
  },
  gridCircleWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCircle: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridCircleConfirmed: {
    borderColor: 'rgba(31, 95, 226, 0.28)',
    backgroundColor: 'rgba(31, 95, 226, 0.045)',
    shadowColor: '#1f5fe2',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  gridLabel: {
    color: '#4a5261',
    fontSize: 11,
    lineHeight: 12,
    textAlign: 'center',
    marginTop: -2,
  },
  gridLabelDark: {
    color: '#9aa0ad',
    fontSize: 11,
    lineHeight: 12,
    textAlign: 'center',
    marginTop: -2,
  },
  gridLabelConfirmed: {
    color: '#1f5fe2',
    fontWeight: '700',
  },
  successBadge: {
    position: 'absolute',
    top: -6,
    right: -2,
    backgroundColor: '#fff2c7',
    borderColor: '#f3d677',
    borderWidth: 1,
    borderRadius: 999,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#c9882e',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  successCoinOuter: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#f1b40f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCoinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffd45a',
  },
  successCoinHighlight: {
    position: 'absolute',
    top: 2,
    left: 3,
    width: 4,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});
