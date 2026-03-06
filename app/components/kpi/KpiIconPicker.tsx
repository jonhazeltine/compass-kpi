import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import KpiIcon from './KpiIcon';
import {
  defaultKpiIconDraft,
  getKpiBrandAssetOptions,
  getKpiVectorIconOptions,
  getKpiTypeIconTreatment,
  type KpiAuthoringIconSource,
} from '../../lib/kpiIcons';

type IconDraft = {
  icon_source?: KpiAuthoringIconSource | null;
  icon_name?: string | null;
  icon_emoji?: string | null;
  icon_file?: string | null;
};

type Props = {
  value: IconDraft;
  onChange: (next: IconDraft) => void;
  title?: string;
  subtitle?: string;
  kpiType?: string | null;
};

const SOURCE_OPTIONS: Array<{ key: KpiAuthoringIconSource; label: string }> = [
  { key: 'brand_asset', label: 'Brand' },
  { key: 'vector_icon', label: 'Library' },
];

export default function KpiIconPicker({
  value,
  onChange,
  title = 'Icon',
  subtitle = 'Choose a shared icon source. Existing KPIs without metadata still fall back safely.',
  kpiType,
}: Props) {
  const activeSource = value.icon_source === 'vector_icon' ? 'vector_icon' : 'brand_asset';
  const brandAssetOptions = getKpiBrandAssetOptions();
  const vectorIconOptions = getKpiVectorIconOptions();
  const treatment = getKpiTypeIconTreatment(kpiType);

  const applySource = (source: KpiAuthoringIconSource) => {
    if (source === activeSource) return;
    onChange(defaultKpiIconDraft(source));
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.previewWrap}>
          <KpiIcon
            kpi={{
              type: kpiType ?? null,
              icon_source: value.icon_source ?? null,
              icon_name: value.icon_name ?? null,
              icon_emoji: value.icon_emoji ?? null,
              icon_file: value.icon_file ?? null,
            }}
            size={48}
            backgroundColor={treatment.background}
            color={treatment.foreground}
          />
        </View>
      </View>

      <View style={styles.sourceRow}>
        {SOURCE_OPTIONS.map((option) => {
          const selected = activeSource === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.sourceChip, selected && styles.sourceChipActive]}
              onPress={() => applySource(option.key)}
            >
              <Text style={[styles.sourceChipText, selected && styles.sourceChipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.optionsScroll} contentContainerStyle={styles.optionsGrid} showsVerticalScrollIndicator={false}>
        {activeSource === 'brand_asset'
          ? brandAssetOptions.map((option) => {
              const selected = value.icon_name === option.key || value.icon_file === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.optionTile, selected && styles.optionTileSelected]}
                  onPress={() =>
                    onChange({
                      icon_source: 'brand_asset',
                      icon_name: option.key,
                      icon_emoji: null,
                      icon_file: option.key,
                    })
                  }
                >
                  <KpiIcon
                    kpi={{ type: kpiType ?? null, icon_source: 'brand_asset', icon_name: option.key, icon_file: option.key }}
                    size={40}
                    backgroundColor={treatment.background}
                    color={treatment.foreground}
                  />
                  <Text style={styles.optionLabel} numberOfLines={2}>{option.label}</Text>
                </TouchableOpacity>
              );
            })
          : null}

        {activeSource === 'vector_icon'
          ? vectorIconOptions.map((option) => {
              const selected = value.icon_name === option.name;
              return (
                <TouchableOpacity
                  key={option.name}
                  style={[styles.optionTile, selected && styles.optionTileSelected]}
                  onPress={() =>
                    onChange({
                      icon_source: 'vector_icon',
                      icon_name: option.name,
                      icon_emoji: null,
                      icon_file: null,
                    })
                  }
                >
                  <KpiIcon
                    kpi={{ type: kpiType ?? null, icon_source: 'vector_icon', icon_name: option.name }}
                    size={40}
                    backgroundColor={treatment.background}
                    color={treatment.foreground}
                  />
                  <Text style={styles.optionLabel} numberOfLines={2}>{option.label}</Text>
                </TouchableOpacity>
              );
            })
          : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
  },
  previewWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sourceChip: {
    borderWidth: 1,
    borderColor: '#D8E4FA',
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sourceChipActive: {
    backgroundColor: '#E8F0FF',
    borderColor: '#2F5FE3',
  },
  sourceChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  sourceChipTextActive: {
    color: '#204ECF',
  },
  optionsScroll: {
    maxHeight: 260,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 4,
  },
  optionTile: {
    width: 108,
    minHeight: 98,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  optionTileSelected: {
    borderColor: '#2F5FE3',
    backgroundColor: '#EEF4FF',
  },
  optionLabel: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    color: '#334155',
    textAlign: 'center',
  },
});
