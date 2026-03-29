/**
 * WizardTemplateGallery — Step 0: Pick a template or start from scratch.
 */
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { wiz } from './wizardTheme';
import type { ChallengeTemplateDefaultRow } from '../../../screens/kpi-dashboard/defaultChallengeTemplates';

interface Props {
  templates: ChallengeTemplateDefaultRow[];
  loading: boolean;
  selectedId: string | null;
  onSelectTemplate: (template: ChallengeTemplateDefaultRow) => void;
  onStartFromScratch: () => void;
}

export default function WizardTemplateGallery({
  templates,
  loading,
  selectedId,
  onSelectTemplate,
  onStartFromScratch,
}: Props) {
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={wiz.primary} />
        <Text style={styles.loadingText}>Loading templates...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headline}>What challenge will you crush?</Text>
      <Text style={styles.subline}>Pick a template to get started, or build your own.</Text>

      {templates.map((template) => (
        <TouchableOpacity
          key={template.id}
          style={[styles.card, selectedId === template.id && styles.cardSelected]}
          onPress={() => onSelectTemplate(template)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>{(template as any).icon ?? '🏆'}</Text>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>{template.title}</Text>
              <View style={styles.cardBadgeRow}>
                <View style={styles.cardBadge}>
                  <Text style={styles.cardBadgeText}>
                    {template.duration_weeks ? `${template.duration_weeks}w` : `${template.suggested_duration_days}d`}
                  </Text>
                </View>
                <View style={[styles.cardBadge, styles.cardBadgeKpi]}>
                  <Text style={styles.cardBadgeText}>{template.kpi_defaults.length} KPIs</Text>
                </View>
                {template.phase_count > 0 && (
                  <View style={[styles.cardBadge, styles.cardBadgePhase]}>
                    <Text style={styles.cardBadgeText}>{template.phase_count} phases</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <Text style={styles.cardDescription}>{template.description}</Text>
        </TouchableOpacity>
      ))}

      {/* Start from scratch */}
      <TouchableOpacity style={styles.scratchCard} onPress={onStartFromScratch} activeOpacity={0.7}>
        <Text style={styles.scratchIcon}>✍️</Text>
        <View>
          <Text style={styles.scratchTitle}>Start from Scratch</Text>
          <Text style={styles.scratchSub}>Build a fully custom challenge</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    padding: wiz.pagePadding,
    paddingBottom: 40,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: wiz.textSecondary,
  },
  headline: {
    fontSize: 24,
    fontWeight: '900',
    color: wiz.textPrimary,
    marginBottom: 4,
  },
  subline: {
    fontSize: 14,
    color: wiz.textSecondary,
    marginBottom: 20,
  },
  card: {
    backgroundColor: wiz.surface,
    borderRadius: wiz.cardRadius,
    borderWidth: 1.5,
    borderColor: wiz.surfaceBorder,
    padding: wiz.cardPadding,
    marginBottom: 12,
  },
  cardSelected: {
    borderColor: wiz.primary,
    backgroundColor: wiz.primaryLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  cardIcon: {
    fontSize: 32,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: wiz.textPrimary,
    marginBottom: 4,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  cardBadge: {
    backgroundColor: wiz.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cardBadgeKpi: {
    backgroundColor: wiz.kpiPCLight,
  },
  cardBadgePhase: {
    backgroundColor: wiz.kpiGPLight,
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: wiz.primary,
  },
  cardDescription: {
    fontSize: 13,
    color: wiz.textSecondary,
    lineHeight: 18,
  },
  scratchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: wiz.surface,
    borderRadius: wiz.cardRadius,
    borderWidth: 1.5,
    borderColor: wiz.surfaceBorder,
    borderStyle: 'dashed',
    padding: wiz.cardPadding,
    marginTop: 8,
  },
  scratchIcon: {
    fontSize: 28,
  },
  scratchTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: wiz.textPrimary,
  },
  scratchSub: {
    fontSize: 12,
    color: wiz.textMuted,
  },
});
