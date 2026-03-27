/**
 * CustomKpiModal — Extracted from KPIDashboardScreen.
 * Renders the create/edit custom KPI modal.
 */

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KpiIconPicker } from '../kpi';
import type { CustomKpiDraft } from '../../screens/kpi-dashboard/types';
import { normalizeKpiIdentifier } from '../../lib/kpiIcons';

export interface CustomKpiModalProps {
  customKpiModalVisible: boolean;
  setCustomKpiModalVisible: (v: boolean) => void;

  customKpiDraft: CustomKpiDraft;
  setCustomKpiDraft: React.Dispatch<React.SetStateAction<CustomKpiDraft>>;

  customKpiSaving: boolean;
  customKpiError: string | null;
  customKpiSuccessNote: string | null;

  submitCustomKpi: () => Promise<void>;
}

export default function CustomKpiModal({
  customKpiModalVisible,
  setCustomKpiModalVisible,
  customKpiDraft,
  setCustomKpiDraft,
  customKpiSaving,
  customKpiError,
  customKpiSuccessNote,
  submitCustomKpi,
}: CustomKpiModalProps) {
  return (
    <Modal
      visible={customKpiModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setCustomKpiModalVisible(false)}
    >
      <Pressable style={styles.drawerBackdrop} onPress={() => setCustomKpiModalVisible(false)}>
        <Pressable style={[styles.drawerCard, { maxHeight: '86%' }]} onPress={() => {}}>
          <Text style={styles.drawerTitle}>{customKpiDraft.id ? 'Edit Custom KPI' : 'Create Custom KPI'}</Text>
          <Text style={styles.drawerUnlockedHint}>
            Custom KPIs stay owner-scoped and still fall back safely where icon metadata is not backfilled yet.
          </Text>
          <ScrollView style={styles.drawerGridScroll} contentContainerStyle={{ gap: 14, paddingBottom: 10 }}>
            <View>
              <Text style={styles.formLabel}>Name</Text>
              <TextInput
                value={customKpiDraft.name}
                onChangeText={(name) =>
                  setCustomKpiDraft((prev) => ({
                    ...prev,
                    name,
                    slug: prev.id ? prev.slug : normalizeKpiIdentifier(name),
                  }))
                }
                style={styles.input}
                placeholder="Neighborhood Mailer Responses"
              />
            </View>
            <View>
              <Text style={styles.formLabel}>Slug</Text>
              <TextInput
                value={customKpiDraft.slug}
                onChangeText={(slug) => setCustomKpiDraft((prev) => ({ ...prev, slug }))}
                style={styles.input}
                placeholder="neighborhood_mailer_responses"
              />
            </View>
            <View>
              <Text style={styles.formLabel}>Options</Text>
              <View style={styles.inlineToggleRow}>
                <Pressable
                  onPress={() =>
                    setCustomKpiDraft((prev) => ({
                      ...prev,
                      requiresDirectValueInput: !prev.requiresDirectValueInput,
                    }))
                  }
                  style={[styles.toggleChip, customKpiDraft.requiresDirectValueInput && styles.toggleChipOn]}
                >
                  <Text
                    style={[
                      styles.toggleChipText,
                      customKpiDraft.requiresDirectValueInput && styles.toggleChipTextOn,
                    ]}
                  >
                    Direct Value Input
                  </Text>
                </Pressable>
              </View>
            </View>
            <KpiIconPicker
              value={{
                icon_source: customKpiDraft.iconSource ?? null,
                icon_name: customKpiDraft.iconName ?? null,
                icon_emoji: null,
                icon_file: customKpiDraft.iconSource === 'brand_asset' ? customKpiDraft.iconName ?? null : null,
              }}
              onChange={(next) =>
                setCustomKpiDraft((prev) => ({
                  ...prev,
                  iconSource: next.icon_source ?? null,
                  iconName: next.icon_name ?? null,
                }))
              }
              kpiType="Custom"
              subtitle="Choose the canonical icon metadata used by mobile KPI tiles and future catalog backfill."
            />
            {customKpiError ? <Text style={[styles.metaRow, styles.errorText]}>{customKpiError}</Text> : null}
            {customKpiSuccessNote ? <Text style={[styles.metaRow, styles.successText]}>{customKpiSuccessNote}</Text> : null}
          </ScrollView>
          <View style={styles.formActionsRow}>
            <TouchableOpacity
              style={styles.smallGhostButton}
              onPress={() => setCustomKpiModalVisible(false)}
              disabled={customKpiSaving}
            >
              <Text style={styles.smallGhostButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={() => void submitCustomKpi()} disabled={customKpiSaving}>
              <Text style={styles.primaryButtonText}>{customKpiSaving ? 'Saving...' : customKpiDraft.id ? 'Save Custom KPI' : 'Create Custom KPI'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  drawerGridScroll: {
    maxHeight: 500,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D8E4FA',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  inlineToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  toggleChip: {
    borderWidth: 1,
    borderColor: '#D8E4FA',
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleChipOn: {
    borderColor: '#2F5FE3',
    backgroundColor: '#E8F0FF',
  },
  toggleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  toggleChipTextOn: {
    color: '#204ECF',
  },
  metaRow: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
  },
  errorText: {
    color: '#b42318',
    fontWeight: '600',
  },
  successText: {
    color: '#0F7A45',
    fontWeight: '600',
  },
  formActionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  smallGhostButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D8E4FA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  smallGhostButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#2453D4',
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
