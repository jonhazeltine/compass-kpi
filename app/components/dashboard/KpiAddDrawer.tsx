/**
 * KpiAddDrawer — Card-tray KPI picker.
 *
 * Selected KPIs bubble into a "Selected" row at the top of each type group.
 * That row is a horizontal draggable list — long-press + drag reorders the
 * display order on the main log grid. Unselected KPIs live in an "Available"
 * grid below. Tap any available card to add; tap any selected card to remove.
 */

import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import type { CustomKpiRow } from '../../lib/customKpiApi';
import type { DashboardPayload, DrawerFilter } from '../../screens/kpi-dashboard/types';
import {
  HOME_PANEL_LABELS,
  MAX_KPIS_PER_TYPE,
} from '../../screens/kpi-dashboard/constants';
import { kpiSortSlug, kpiTypeAccent } from '../../screens/kpi-dashboard/helpers';
import {
  groupKpisByCategory,
  isRecommendedSlug,
} from '../../screens/kpi-dashboard/kpiCategoryMap';
import KpiButtonCard from './KpiButtonCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KpiItem = DashboardPayload['loggable_kpis'][number];
type KpiType = 'PC' | 'GP' | 'VP';

export interface KpiAddDrawerProps {
  addDrawerVisible: boolean;
  setAddDrawerVisible: (v: boolean) => void;

  drawerFilter: DrawerFilter;
  setDrawerFilter: (f: DrawerFilter) => void;

  /** Sorted-but-unfiltered catalog. The drawer handles its own filtering + sectioning. */
  drawerCatalogKpis: KpiItem[];
  managedKpiIdSet: Set<string>;
  /** Ordered list of selected KPI ids. Used to derive the per-type selected order. */
  managedKpiIdOrder: string[];
  favoriteKpiIds: string[];
  customKpiById: Map<string, CustomKpiRow>;
  selectedCountsByType: Record<KpiType, number>;
  todayCountById: Record<string, number>;
  gpUnlocked: boolean;
  vpUnlocked: boolean;
  canCreateCustomKpis: boolean;

  toggleManagedKpi: (kpiId: string) => void;
  toggleFavoriteKpi: (kpiId: string) => void;
  reorderManagedKpiType: (type: KpiType, newOrder: string[]) => void;
  openCreateCustomKpiModal: () => void;
  openEditCustomKpiModal: (row: CustomKpiRow) => void;
}

// ---------------------------------------------------------------------------
// Design tokens (dark theme — matches main log grid)
// ---------------------------------------------------------------------------

const THEME = {
  backdrop: 'rgba(4, 6, 10, 0.82)',
  sheet: '#0D0F14',
  sheetBorder: 'rgba(255,255,255,0.06)',
  title: '#F0EDE6',
  subtitle: '#7B8099',
  chipIdle: 'rgba(255,255,255,0.04)',
  chipIdleBorder: 'rgba(255,255,255,0.08)',
  chipIdleText: '#9BA1B8',
  chipActive: 'rgba(201,168,76,0.12)',
  chipActiveBorder: 'rgba(201,168,76,0.45)',
  chipActiveText: '#C9A84C',
  sectionHeader: '#C2C7DC',
  sectionCount: '#7B8099',
  gold: '#C9A84C',
  goldDim: 'rgba(201,168,76,0.22)',
  ghostBorder: 'rgba(201,168,76,0.45)',
  ghostBg: 'rgba(201,168,76,0.04)',
  trayBg: 'rgba(201,168,76,0.04)',
  trayBorder: 'rgba(201,168,76,0.14)',
  trayEmptyText: '#5B6278',
  warnBg: 'rgba(201,136,33,0.18)',
  warnText: '#F3C56A',
  lockBg: 'rgba(255,255,255,0.06)',
  doneBg: '#C9A84C',
  doneText: '#0D0F14',
};

const FILTERS: DrawerFilter[] = ['Quick', 'PC', 'GP', 'VP'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Group unselected KPIs for a type into activity-based categories
 * (phone/in-person/social/paperwork for PC, analogous for GP/VP).
 * Delegates to `kpiCategoryMap.ts` which owns the slug↔category assignments.
 */
function groupAvailableByCategory(
  type: KpiType,
  kpis: KpiItem[]
): Array<{ id: string; label: string; glyph: string; kpis: KpiItem[] }> {
  return groupKpisByCategory(type, kpis, (k) => kpiSortSlug(k)).map((s) => ({
    id: s.id,
    label: s.label,
    glyph: s.glyph,
    kpis: s.kpis,
  }));
}

// ---------------------------------------------------------------------------
// PickerCard — a single card tile in the picker
// ---------------------------------------------------------------------------

type PickerCardVariant = 'selected' | 'available' | 'locked' | 'disabled';

type PickerCardProps = {
  kpi: KpiItem;
  variant: PickerCardVariant;
  todayCount: number;
  customKpi?: CustomKpiRow;
  positionLabel?: string; // e.g. "1" for the first slot
  recommended?: boolean; // show ★ badge on available cards
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  onRemove?: () => void; // explicit × button handler (selected cards only)
  onEditCustom: (row: CustomKpiRow) => void;
};

function PickerCard({
  kpi,
  variant,
  todayCount,
  customKpi,
  positionLabel,
  recommended,
  onPress,
  onLongPress,
  delayLongPress,
  onRemove,
  onEditCustom,
}: PickerCardProps) {
  const selected = variant === 'selected';
  const locked = variant === 'locked';
  const disabled = variant === 'disabled' || locked;

  const overlay = (
    <>
      {/* Explicit × remove button on selected cards (top-left) */}
      {selected && onRemove ? (
        <Pressable
          style={styles.removeButton}
          hitSlop={8}
          onPress={(e) => {
            e.stopPropagation?.();
            onRemove();
          }}
        >
          <MaterialCommunityIcons name="close" size={13} color="#F0EDE6" />
        </Pressable>
      ) : null}

      {/* Drag handle icon on selected cards (bottom-right, purely a visual cue) */}
      {selected ? (
        <View style={styles.dragHandleHint} pointerEvents="none">
          <MaterialCommunityIcons
            name="drag-horizontal-variant"
            size={14}
            color="rgba(201,168,76,0.8)"
          />
        </View>
      ) : null}

      {/* Slot number on selected cards (top-right) */}
      {selected && positionLabel ? (
        <View style={styles.slotBadge} pointerEvents="none">
          <Text style={styles.slotBadgeText}>{positionLabel}</Text>
        </View>
      ) : null}

      {/* Recommended ★ badge on available (unselected) cards */}
      {!selected && recommended ? (
        <View style={styles.recommendedBadge} pointerEvents="none">
          <Text style={styles.recommendedBadgeText}>★</Text>
        </View>
      ) : null}

      {/* Locked overlay */}
      {locked ? (
        <View style={styles.lockOverlay} pointerEvents="none">
          <MaterialCommunityIcons name="lock" size={18} color={THEME.subtitle} />
        </View>
      ) : null}

      {/* Edit pencil for custom KPIs (available cards only to avoid corner collision) */}
      {customKpi && !selected ? (
        <Pressable
          style={styles.editPencil}
          hitSlop={8}
          onPress={(e) => {
            e.stopPropagation?.();
            onEditCustom(customKpi);
          }}
        >
          <MaterialCommunityIcons name="pencil-outline" size={12} color={THEME.title} />
        </Pressable>
      ) : null}
    </>
  );

  return (
    <KpiButtonCard
      kpi={kpi}
      todayCount={todayCount}
      confirmed={selected}
      disabled={disabled && !selected}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      overlay={overlay}
      nameColor={selected ? THEME.title : THEME.subtitle}
    />
  );
}

// ---------------------------------------------------------------------------
// SelectedRow — horizontal draggable list for selected KPIs of a single type
// ---------------------------------------------------------------------------

type SelectedRowProps = {
  type: KpiType;
  selectedKpis: KpiItem[];
  todayCountById: Record<string, number>;
  customKpiById: Map<string, CustomKpiRow>;
  onRemove: (kpiId: string) => void;
  onReorder: (type: KpiType, newOrder: string[]) => void;
  onEditCustom: (row: CustomKpiRow) => void;
};

function SelectedRow({
  type,
  selectedKpis,
  todayCountById,
  customKpiById,
  onRemove,
  onReorder,
  onEditCustom,
}: SelectedRowProps) {
  if (selectedKpis.length === 0) {
    return (
      <View style={styles.trayEmpty}>
        <Text style={styles.trayEmptyText}>
          Tap a card below to add it to your {HOME_PANEL_LABELS[type]} grid.
        </Text>
      </View>
    );
  }

  const renderItem = ({ item, drag, isActive }: RenderItemParams<KpiItem>) => {
    const customKpi = customKpiById.get(String(item.id));
    return (
      <ScaleDecorator activeScale={1.08}>
        <View style={[styles.trayCell, isActive && styles.trayCellActive]}>
          <PickerCard
            kpi={item}
            variant="selected"
            todayCount={todayCountById[item.id] ?? 0}
            customKpi={customKpi}
            positionLabel={String(
              selectedKpis.findIndex((k) => k.id === item.id) + 1
            )}
            // Tap body does nothing — removal is the explicit × button.
            // Long-press (shortened to 200ms) grabs the card for drag-to-reorder.
            onLongPress={drag}
            delayLongPress={200}
            onRemove={() => onRemove(item.id)}
            onEditCustom={onEditCustom}
          />
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.tray}>
      <View style={styles.trayHintRow}>
        <MaterialCommunityIcons
          name="drag-horizontal-variant"
          size={13}
          color={THEME.gold}
        />
        <Text style={styles.trayHintText}>HOLD & DRAG TO REORDER</Text>
      </View>
      <NestableDraggableFlatList
        data={selectedKpis}
        horizontal
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onDragEnd={({ data }) => onReorder(type, data.map((k) => k.id))}
        contentContainerStyle={styles.trayContent}
        activationDistance={6}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// AvailableGrid — flex-wrap grid of unselected cards for a type or sub-section
// ---------------------------------------------------------------------------

type AvailableGridProps = {
  kpis: KpiItem[];
  includeCreateCard: boolean;
  capReached: boolean;
  gpUnlocked: boolean;
  vpUnlocked: boolean;
  todayCountById: Record<string, number>;
  customKpiById: Map<string, CustomKpiRow>;
  onSelect: (kpiId: string) => void;
  onCreateCustom: () => void;
  onEditCustom: (row: CustomKpiRow) => void;
};

function AvailableGrid({
  kpis,
  includeCreateCard,
  capReached,
  gpUnlocked,
  vpUnlocked,
  todayCountById,
  customKpiById,
  onSelect,
  onCreateCustom,
  onEditCustom,
}: AvailableGridProps) {
  const cells: React.ReactNode[] = [];

  if (includeCreateCard) {
    cells.push(
      <View style={styles.cell} key="__create__">
        <View style={styles.cardOuter}>
          <Pressable onPress={onCreateCustom} style={styles.createCard}>
            <MaterialCommunityIcons name="plus" size={28} color={THEME.gold} />
          </Pressable>
          <Text style={styles.createCardLabel} numberOfLines={2}>
            Create Custom
          </Text>
        </View>
      </View>
    );
  }

  for (const kpi of kpis) {
    const locked =
      (kpi.type === 'GP' && !gpUnlocked) ||
      (kpi.type === 'VP' && !vpUnlocked);
    const customKpi = customKpiById.get(String(kpi.id));
    const variant: PickerCardVariant = locked
      ? 'locked'
      : capReached
      ? 'disabled'
      : 'available';
    const recommended = isRecommendedSlug(kpiSortSlug(kpi));
    cells.push(
      <View style={styles.cell} key={kpi.id}>
        <PickerCard
          kpi={kpi}
          variant={variant}
          todayCount={todayCountById[kpi.id] ?? 0}
          customKpi={customKpi}
          recommended={recommended}
          onPress={locked || capReached ? undefined : () => onSelect(kpi.id)}
          onEditCustom={onEditCustom}
        />
      </View>
    );
  }

  // Chunk into rows of 4 so cards stay at 25% width even on the last row.
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < cells.length; i += 4) {
    rows.push(cells.slice(i, i + 4));
  }

  return (
    <>
      {rows.map((rowCells, rowIdx) => {
        const padded = [...rowCells];
        while (padded.length < 4) {
          padded.push(
            <View
              key={`__pad-${rowIdx}-${padded.length}`}
              style={styles.cell}
            />
          );
        }
        return (
          <View key={`row-${rowIdx}`} style={styles.row}>
            {padded}
          </View>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// TypeSection — full vertical slice for one type (Selected row + Available)
// ---------------------------------------------------------------------------

type TypeSectionProps = {
  type: KpiType;
  isFirst: boolean;
  allTypeKpis: KpiItem[];
  managedKpiIdSet: Set<string>;
  managedKpiIdOrder: string[];
  selectedCountsByType: Record<KpiType, number>;
  todayCountById: Record<string, number>;
  customKpiById: Map<string, CustomKpiRow>;
  gpUnlocked: boolean;
  vpUnlocked: boolean;
  canCreateCustomKpis: boolean;
  toggleManagedKpi: (kpiId: string) => void;
  reorderManagedKpiType: (type: KpiType, newOrder: string[]) => void;
  openCreateCustomKpiModal: () => void;
  openEditCustomKpiModal: (row: CustomKpiRow) => void;
};

function TypeSection({
  type,
  isFirst,
  allTypeKpis,
  managedKpiIdSet,
  managedKpiIdOrder,
  selectedCountsByType,
  todayCountById,
  customKpiById,
  gpUnlocked,
  vpUnlocked,
  canCreateCustomKpis,
  toggleManagedKpi,
  reorderManagedKpiType,
  openCreateCustomKpiModal,
  openEditCustomKpiModal,
}: TypeSectionProps) {
  const selectedCount = selectedCountsByType[type];
  const capReached = selectedCount >= MAX_KPIS_PER_TYPE;
  const locked =
    (type === 'GP' && !gpUnlocked) || (type === 'VP' && !vpUnlocked);

  // Compute the per-type selected order from the managed order.
  const selectedKpis = useMemo(() => {
    const byId = new Map(allTypeKpis.map((k) => [k.id, k]));
    const ordered: KpiItem[] = [];
    for (const id of managedKpiIdOrder) {
      const kpi = byId.get(id);
      if (kpi) ordered.push(kpi);
    }
    return ordered;
  }, [allTypeKpis, managedKpiIdOrder]);

  // Unselected list (available grid)
  const availableKpis = useMemo(
    () => allTypeKpis.filter((k) => !managedKpiIdSet.has(k.id)),
    [allTypeKpis, managedKpiIdSet]
  );

  // Group available cards by activity-based category (phone/in-person/etc.)
  const subSections = useMemo(
    () => groupAvailableByCategory(type, availableKpis),
    [type, availableKpis]
  );

  return (
    <View style={isFirst ? styles.firstSection : styles.section}>
      <SectionHeader
        title={HOME_PANEL_LABELS[type]}
        selectedCount={selectedCount}
        cap={MAX_KPIS_PER_TYPE}
        accent={kpiTypeAccent(type as any)}
        lockedHint={locked}
      />

      {/* Selected row — draggable horizontal list */}
      {!locked ? (
        <SelectedRow
          type={type}
          selectedKpis={selectedKpis}
          todayCountById={todayCountById}
          customKpiById={customKpiById}
          onRemove={toggleManagedKpi}
          onReorder={reorderManagedKpiType}
          onEditCustom={openEditCustomKpiModal}
        />
      ) : (
        <View style={styles.trayEmpty}>
          <Text style={styles.trayEmptyText}>
            {type === 'GP'
              ? 'Growth unlocks after 3 active days or 20 logs.'
              : 'Vitality unlocks after 7 active days or 40 logs.'}
          </Text>
        </View>
      )}

      {/* Available category sub-sections (Phone / In Person / etc.) */}
      {subSections.map((section, idx) => {
        const isFirstSub = idx === 0;
        return (
          <View key={section.id} style={styles.subSection}>
            <Text style={styles.subSectionHeader}>
              <Text style={styles.subSectionGlyph}>{section.glyph}  </Text>
              {section.label}
            </Text>
            <AvailableGrid
              kpis={section.kpis}
              includeCreateCard={
                isFirstSub && canCreateCustomKpis && type === 'PC'
              }
              capReached={capReached}
              gpUnlocked={gpUnlocked}
              vpUnlocked={vpUnlocked}
              todayCountById={todayCountById}
              customKpiById={customKpiById}
              onSelect={toggleManagedKpi}
              onCreateCustom={openCreateCustomKpiModal}
              onEditCustom={openEditCustomKpiModal}
            />
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  selectedCount,
  cap,
  accent,
  lockedHint,
}: {
  title: string;
  selectedCount?: number;
  cap?: number;
  accent?: string;
  lockedHint?: boolean;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View
        style={[styles.sectionAccent, accent ? { backgroundColor: accent } : null]}
      />
      <Text style={styles.sectionTitle}>{title}</Text>
      {lockedHint ? (
        <MaterialCommunityIcons name="lock" size={12} color={THEME.subtitle} />
      ) : null}
      {typeof selectedCount === 'number' && typeof cap === 'number' ? (
        <Text style={styles.sectionCount}>
          {selectedCount}/{cap}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function KpiAddDrawer({
  addDrawerVisible,
  setAddDrawerVisible,
  drawerFilter,
  setDrawerFilter,
  drawerCatalogKpis,
  managedKpiIdSet,
  managedKpiIdOrder,
  customKpiById,
  selectedCountsByType,
  todayCountById,
  gpUnlocked,
  vpUnlocked,
  canCreateCustomKpis,
  toggleManagedKpi,
  reorderManagedKpiType,
  openCreateCustomKpiModal,
  openEditCustomKpiModal,
}: KpiAddDrawerProps) {
  // Group catalog by type
  const kpisByType = useMemo(() => {
    const byType: Record<KpiType, KpiItem[]> = { PC: [], GP: [], VP: [] };
    for (const kpi of drawerCatalogKpis) {
      if (kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP') {
        byType[kpi.type].push(kpi);
      }
    }
    return byType;
  }, [drawerCatalogKpis]);

  const sectionPropsBase = {
    managedKpiIdSet,
    managedKpiIdOrder,
    selectedCountsByType,
    todayCountById,
    customKpiById,
    gpUnlocked,
    vpUnlocked,
    canCreateCustomKpis,
    toggleManagedKpi,
    reorderManagedKpiType,
    openCreateCustomKpiModal,
    openEditCustomKpiModal,
  };

  const typesToRender: KpiType[] =
    drawerFilter === 'Quick'
      ? ['PC', 'GP', 'VP']
      : [drawerFilter as KpiType];

  return (
    <Modal
      visible={addDrawerVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setAddDrawerVisible(false)}
    >
      <GestureHandlerRootView style={styles.backdrop}>
        <Pressable
          style={styles.backdropDismiss}
          onPress={() => setAddDrawerVisible(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Priority Settings</Text>
            <Text style={styles.subtitle}>
              Tap to add · Hold & drag to reorder · Tap × to remove
            </Text>
          </View>

          <View style={styles.filterRow}>
            {FILTERS.map((filter) => {
              const active = drawerFilter === filter;
              const label =
                filter === 'Quick' ? 'PRIORITY' : HOME_PANEL_LABELS[filter];
              return (
                <Pressable
                  key={filter}
                  onPress={() => setDrawerFilter(filter)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <NestableScrollContainer
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {typesToRender.map((type, idx) => (
              <TypeSection
                key={type}
                type={type}
                isFirst={idx === 0}
                allTypeKpis={kpisByType[type]}
                {...sectionPropsBase}
              />
            ))}
            <View style={{ height: 24 }} />
          </NestableScrollContainer>

          <View style={styles.footer}>
            <View style={styles.footerRow}>
              <Text style={styles.footerSummary}>
                {`${HOME_PANEL_LABELS.PC} ${selectedCountsByType.PC}/${MAX_KPIS_PER_TYPE}  ·  ${HOME_PANEL_LABELS.GP} ${selectedCountsByType.GP}/${MAX_KPIS_PER_TYPE}  ·  ${HOME_PANEL_LABELS.VP} ${selectedCountsByType.VP}/${MAX_KPIS_PER_TYPE}`}
              </Text>
              <Pressable
                style={styles.doneButton}
                onPress={() => setAddDrawerVisible(false)}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: THEME.backdrop,
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: THEME.sheet,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: THEME.sheetBorder,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 18,
    maxHeight: '94%',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -4 },
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginBottom: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.title,
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 11,
    color: THEME.subtitle,
    fontWeight: '500',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.chipIdleBorder,
    backgroundColor: THEME.chipIdle,
    alignItems: 'center',
  },
  filterChipActive: {
    borderColor: THEME.chipActiveBorder,
    backgroundColor: THEME.chipActive,
  },
  filterChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.chipIdleText,
    letterSpacing: 0.8,
  },
  filterChipTextActive: {
    color: THEME.chipActiveText,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingTop: 4,
  },
  firstSection: {
    marginTop: 2,
  },
  section: {
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: THEME.gold,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.sectionHeader,
    letterSpacing: 0.8,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.sectionCount,
  },
  tray: {
    backgroundColor: THEME.trayBg,
    borderWidth: 1,
    borderColor: THEME.trayBorder,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 12,
    minHeight: 140,
  },
  trayHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingBottom: 6,
    opacity: 0.9,
  },
  trayHintText: {
    color: THEME.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  trayContent: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  trayCell: {
    width: 82,
    marginHorizontal: 4,
  },
  trayCellActive: {
    opacity: 0.9,
  },
  trayEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: THEME.trayBorder,
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayEmptyText: {
    color: THEME.trayEmptyText,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15,
  },
  subSection: {
    marginTop: 2,
  },
  subSectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.sectionHeader,
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 2,
    textTransform: 'uppercase',
  },
  subSectionGlyph: {
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  cell: {
    flex: 1,
  },
  cardOuter: {
    alignItems: 'center',
    gap: 6,
  },
  createCard: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: THEME.ghostBorder,
    borderStyle: 'dashed',
    backgroundColor: THEME.ghostBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCardLabel: {
    color: THEME.chipActiveText,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
  },
  slotBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 16,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: THEME.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotBadgeText: {
    color: '#1A1302',
    fontSize: 9,
    fontWeight: '900',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(200,60,60,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  dragHandleHint: {
    position: 'absolute',
    bottom: 5,
    right: 5,
  },
  recommendedBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(201,168,76,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendedBadgeText: {
    color: '#E8C97A',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME.lockBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  editPencil: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: THEME.sheetBorder,
    paddingTop: 10,
    marginTop: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerSummary: {
    flex: 1,
    color: THEME.subtitle,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  doneButton: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: THEME.doneBg,
  },
  doneButtonText: {
    color: THEME.doneText,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
