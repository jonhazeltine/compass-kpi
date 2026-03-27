/**
 * KpiAddDrawer — Extracted from KPIDashboardScreen.
 * Renders the "Priority Settings" KPI selection drawer (addDrawerVisible).
 */

import React from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { KpiIcon } from '../kpi';
import type { CustomKpiRow } from '../../lib/customKpiApi';
import type { DashboardPayload, DrawerFilter } from '../../screens/kpi-dashboard/types';
import { MAX_KPIS_PER_TYPE } from '../../screens/kpi-dashboard/constants';
import { kpiTypeTint, kpiTypeAccent } from '../../screens/kpi-dashboard/helpers';

type KpiItem = DashboardPayload['loggable_kpis'][number];

export interface KpiAddDrawerProps {
  addDrawerVisible: boolean;
  setAddDrawerVisible: (v: boolean) => void;

  drawerFilter: DrawerFilter;
  setDrawerFilter: (f: DrawerFilter) => void;

  drawerCatalogKpis: KpiItem[];
  managedKpiIdSet: Set<string>;
  favoriteKpiIds: string[];
  customKpiById: Map<string, CustomKpiRow>;
  selectedCountsByType: Record<'PC' | 'GP' | 'VP', number>;
  gpUnlocked: boolean;
  vpUnlocked: boolean;
  canCreateCustomKpis: boolean;

  formatDrawerKpiMeta: (kpi: KpiItem) => string;
  toggleManagedKpi: (kpiId: string) => void;
  toggleFavoriteKpi: (kpiId: string) => void;
  openCreateCustomKpiModal: () => void;
  openEditCustomKpiModal: (row: CustomKpiRow) => void;
}

function renderKpiIcon(kpi: KpiItem) {
  return <KpiIcon kpi={kpi} size={76} backgroundColor="transparent" color={kpiTypeAccent(kpi.type)} />;
}

export default function KpiAddDrawer({
  addDrawerVisible,
  setAddDrawerVisible,
  drawerFilter,
  setDrawerFilter,
  drawerCatalogKpis,
  managedKpiIdSet,
  favoriteKpiIds,
  customKpiById,
  selectedCountsByType,
  gpUnlocked,
  vpUnlocked,
  canCreateCustomKpis,
  formatDrawerKpiMeta,
  toggleManagedKpi,
  toggleFavoriteKpi,
  openCreateCustomKpiModal,
  openEditCustomKpiModal,
}: KpiAddDrawerProps) {
  return (
    <Modal visible={addDrawerVisible} transparent animationType="fade" onRequestClose={() => setAddDrawerVisible(false)}>
      <View style={styles.drawerBackdrop}>
        <View style={styles.drawerCard}>
          <Text style={styles.drawerTitle}>Priority Settings</Text>
          <Text style={styles.drawerUnlockedHint}>Toggle On/Off and mark up to 6 favorites.</Text>
          <View style={styles.drawerFilterRow}>
            {(['Quick', 'PC', 'GP', 'VP'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.drawerFilterChip, drawerFilter === filter && styles.drawerFilterChipActive]}
                onPress={() => setDrawerFilter(filter)}
              >
                <Text style={[styles.drawerFilterChipText, drawerFilter === filter && styles.drawerFilterChipTextActive]}>
                  {filter === 'Quick' ? 'Priority' : `${filter} ${selectedCountsByType[filter as 'PC' | 'GP' | 'VP']}/${MAX_KPIS_PER_TYPE}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView style={styles.drawerGridScroll} contentContainerStyle={styles.drawerList}>
            {canCreateCustomKpis ? (
              <TouchableOpacity
                style={[styles.drawerListRow, styles.drawerListRowSelected, { marginBottom: 6 }]}
                onPress={openCreateCustomKpiModal}
              >
                <View style={[styles.drawerListIconWrap, { backgroundColor: '#EEF4FF' }]}>
                  <View style={styles.drawerListIconInner}>
                    <KpiIcon
                      kpi={{ icon_source: 'vector_icon', icon_name: 'plus-circle-outline' }}
                      size={44}
                      backgroundColor="transparent"
                      color="#2453D4"
                    />
                  </View>
                </View>
                <View style={styles.drawerListMain}>
                  <View style={styles.drawerListTitleRow}>
                    <Text numberOfLines={1} style={styles.drawerListLabel}>Create Custom KPI</Text>
                    <View style={[styles.drawerTypeBadge, { backgroundColor: '#F3E8FF' }]}>
                      <Text style={[styles.drawerTypeBadgeText, { color: '#7A4CC8' }]}>Custom</Text>
                    </View>
                  </View>
                  <Text numberOfLines={2} style={styles.drawerListMeta}>
                    Add your own KPI with a brand asset or library icon.
                  </Text>
                </View>
                <View style={styles.drawerActionCol}>
                  <View style={[styles.drawerActionPill, styles.drawerActionAdd]}>
                    <Text style={styles.drawerActionText}>New</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : null}
            {drawerCatalogKpis.map((kpi) => {
              const locked = (kpi.type === 'GP' && !gpUnlocked) || (kpi.type === 'VP' && !vpUnlocked);
              const selected = managedKpiIdSet.has(kpi.id);
              const isFavorite = favoriteKpiIds.includes(kpi.id);
              const favoriteRank = favoriteKpiIds.indexOf(kpi.id);
              const editableCustomKpi = customKpiById.get(String(kpi.id));
              const categoryFull =
                (kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP') &&
                selectedCountsByType[kpi.type] >= MAX_KPIS_PER_TYPE &&
                !selected;
              const selectionDisabled = locked || categoryFull;
              return (
                <TouchableOpacity
                  key={kpi.id}
                  style={[
                    styles.drawerListRow,
                    selectionDisabled && styles.disabled,
                    selected && styles.drawerListRowSelected,
                    categoryFull && styles.drawerListRowCapReached,
                  ]}
                  onPress={() => {
                    if (locked) {
                      Alert.alert(
                        'Category Locked',
                        kpi.type === 'GP'
                          ? 'Business Growth unlocks after 3 active days or 20 total KPI logs.'
                          : 'Vitality unlocks after 7 active days or 40 total KPI logs.'
                      );
                      return;
                    }
                    if (categoryFull) {
                      Alert.alert(
                        'Category Full',
                        `You already have ${MAX_KPIS_PER_TYPE} ${kpi.type} KPIs selected. Turn one off first.`
                      );
                      return;
                    }
                    toggleManagedKpi(kpi.id);
                  }}
                >
                  <View style={[styles.drawerListIconWrap, { backgroundColor: kpiTypeTint(kpi.type) }]}>
                    <View style={styles.drawerListIconInner}>
                      {renderKpiIcon(kpi)}
                    </View>
                  </View>
                  <View style={styles.drawerListMain}>
                    <View style={styles.drawerListTitleRow}>
                      <Text numberOfLines={1} style={styles.drawerListLabel}>{kpi.name}</Text>
                      <View style={[styles.drawerTypeBadge, { backgroundColor: kpiTypeTint(kpi.type) }]}>
                        <Text style={[styles.drawerTypeBadgeText, { color: kpiTypeAccent(kpi.type) }]}>{kpi.type}</Text>
                      </View>
                    </View>
                    <Text numberOfLines={1} style={styles.drawerListMeta}>{formatDrawerKpiMeta(kpi)}</Text>
                    <View style={styles.drawerStateRow}>
                      <View style={[styles.drawerStateChip, selected ? styles.drawerStateChipOn : styles.drawerStateChipOff]}>
                        <Text style={styles.drawerStateChipText}>{selected ? 'Selected' : 'Not Selected'}</Text>
                      </View>
                      {categoryFull ? (
                        <View style={[styles.drawerStateChip, styles.drawerStateChipCap]}>
                          <Text style={styles.drawerStateChipText}>Type Full ({MAX_KPIS_PER_TYPE}/{MAX_KPIS_PER_TYPE})</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.drawerActionCol}>
                    <View style={[styles.drawerActionPill, selected ? styles.drawerActionRemove : styles.drawerActionAdd]}>
                      <Text style={styles.drawerActionText}>{selected ? 'On' : 'Off'}</Text>
                    </View>
                    {editableCustomKpi ? (
                      <TouchableOpacity
                        style={[styles.drawerActionPill, styles.drawerActionAdd]}
                        onPress={() => openEditCustomKpiModal(editableCustomKpi)}
                      >
                        <Text style={styles.drawerActionText}>Edit</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.drawerActionPill, isFavorite ? styles.drawerActionFavorite : styles.drawerActionAdd]}
                      disabled={!selected}
                      onPress={() => {
                        if (!selected) return;
                        toggleFavoriteKpi(kpi.id);
                      }}
                    >
                      <Text style={styles.drawerActionText}>{isFavorite ? `★${favoriteRank + 1}` : '☆'}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={styles.drawerClose} onPress={() => setAddDrawerVisible(false)}>
            <Text style={styles.drawerCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(32, 36, 44, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  drawerCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 0,
    padding: 16,
  },
  drawerTitle: {
    fontSize: 24,
    color: '#3e4555',
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  drawerUnlockedHint: {
    marginTop: -4,
    marginBottom: 10,
    textAlign: 'center',
    color: '#6c7688',
    fontSize: 12,
    fontWeight: '600',
  },
  drawerFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  drawerFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#eef2f8',
  },
  drawerFilterChipActive: {
    backgroundColor: '#1f5fe2',
  },
  drawerFilterChipText: {
    fontSize: 12,
    color: '#5b6574',
    fontWeight: '600',
  },
  drawerFilterChipTextActive: {
    color: '#fff',
  },
  drawerList: {
    gap: 8,
    paddingBottom: 4,
  },
  drawerGridScroll: {
    maxHeight: 500,
  },
  drawerListRow: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7ecf4',
    backgroundColor: '#fbfcfe',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  drawerListRowSelected: {
    borderColor: '#d4e2fb',
    backgroundColor: '#f5f9ff',
  },
  drawerListRowCapReached: {
    borderColor: '#efe2be',
    backgroundColor: '#fffaf0',
  },
  drawerListIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  drawerListIconInner: {
    transform: [{ scale: 0.48 }],
  },
  drawerListMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  drawerListTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  drawerListLabel: {
    flex: 1,
    color: '#334055',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '700',
  },
  drawerListMeta: {
    color: '#6d7889',
    fontSize: 11,
    lineHeight: 14,
  },
  drawerTypeBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  drawerTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  drawerStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
    flexWrap: 'wrap',
  },
  drawerStateChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  drawerStateChipOn: {
    backgroundColor: '#dcf4de',
  },
  drawerStateChipOff: {
    backgroundColor: '#eef2f8',
  },
  drawerStateChipCap: {
    backgroundColor: '#fff0cf',
  },
  drawerStateChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#415064',
  },
  drawerActionCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  drawerActionPill: {
    borderRadius: 999,
    minWidth: 42,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  drawerActionAdd: {
    backgroundColor: '#dfeafb',
  },
  drawerActionRemove: {
    backgroundColor: '#fde3e3',
  },
  drawerActionFavorite: {
    backgroundColor: '#ffe9bc',
  },
  drawerActionText: {
    fontSize: 10,
    color: '#2f3a4b',
    fontWeight: '700',
  },
  drawerClose: {
    marginTop: 16,
    alignSelf: 'center',
    borderRadius: 8,
    backgroundColor: '#2f3645',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  drawerCloseText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
