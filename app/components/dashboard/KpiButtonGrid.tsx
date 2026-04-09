import React from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import KpiButtonCard from './KpiButtonCard';
import type { HomePanelTile } from '../../screens/kpi-dashboard/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KpiButtonGridProps = {
  tiles: HomePanelTile[];
  todayCounts: Record<string, number>;
  confirmedIds: Record<string, true>;
  getScale: (kpiId: string) => Animated.Value;
  attachTileRef?: (kpiId: string, node: View | null) => void;
  onPressIn: (kpi: HomePanelTile['kpi'], e: GestureResponderEvent) => void;
  onPressOut: (kpiId: string) => void;
  style?: ViewStyle;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function KpiButtonGrid({
  tiles,
  todayCounts,
  confirmedIds,
  getScale,
  attachTileRef,
  onPressIn,
  onPressOut,
  style,
}: KpiButtonGridProps) {
  return (
    <View style={[styles.grid, style]}>
      {tiles.slice(0, 4).map(({ kpi, context }, index) => (
        <View
          key={kpi.id}
          ref={attachTileRef ? (node) => attachTileRef(kpi.id, node) : undefined}
          style={styles.cell}
        >
          <KpiButtonCard
            kpi={kpi}
            todayCount={todayCounts[kpi.id] ?? 0}
            confirmed={!!confirmedIds[kpi.id]}
            isRequired={context.isRequired}
            scale={getScale(kpi.id)}
            index={index}
            onPressIn={(e) => onPressIn(kpi, e)}
            onPressOut={() => onPressOut(kpi.id)}
          />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 6,
    marginTop: 15,
  },
  cell: {
    flex: 1,
  },
});
