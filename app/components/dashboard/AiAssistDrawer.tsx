/**
 * AiAssistDrawer — Extracted from KPIDashboardScreen.
 * Renders the AI-assist approval-first drafting modal.
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { fmtMonthDayTime } from '../../screens/kpi-dashboard/helpers';
import type {
  AIAssistShellContext,
  AiSuggestionApiRow,
  AiSuggestionQueueSummary,
} from '../../screens/kpi-dashboard/types';

export interface AiAssistDrawerProps {
  // Visibility
  aiAssistVisible: boolean;
  setAiAssistVisible: (v: boolean) => void;

  // Context
  aiAssistContext: AIAssistShellContext | null;

  // Prompt / draft
  aiAssistPrompt: string;
  setAiAssistPrompt: (v: string) => void;
  aiAssistDraftText: string;
  setAiAssistDraftText: (v: string) => void;

  // State flags
  aiAssistGenerating: boolean;
  aiAssistNotice: string | null;
  setAiAssistNotice: (v: string | null) => void;

  // Queue / suggestion state
  aiSuggestionQueueSubmitting: boolean;
  aiSuggestionQueueError: string | null;
  aiSuggestionQueueSuccess: string | null;
  aiSuggestionRows: AiSuggestionApiRow[] | null;
  aiSuggestionQueueSummary: AiSuggestionQueueSummary | null;
  aiSuggestionListLoading: boolean;
  aiSuggestionListError: string | null;

  // Actions
  generateAiAssistDraft: () => void;
  applyAiAssistDraftToHumanInput: () => void;
  queueAiSuggestionForApproval: () => void;
}

export default function AiAssistDrawer({
  aiAssistVisible,
  setAiAssistVisible,
  aiAssistContext,
  aiAssistPrompt,
  setAiAssistPrompt,
  aiAssistDraftText,
  setAiAssistDraftText,
  aiAssistGenerating,
  aiAssistNotice,
  setAiAssistNotice,
  aiSuggestionQueueSubmitting,
  aiSuggestionQueueError,
  aiSuggestionQueueSuccess,
  aiSuggestionRows,
  aiSuggestionQueueSummary,
  aiSuggestionListLoading,
  aiSuggestionListError,
  generateAiAssistDraft,
  applyAiAssistDraftToHumanInput,
  queueAiSuggestionForApproval,
}: AiAssistDrawerProps) {
  return (
    <Modal visible={aiAssistVisible} transparent animationType="fade" onRequestClose={() => setAiAssistVisible(false)}>
      <Pressable style={styles.aiAssistBackdrop} onPress={() => setAiAssistVisible(false)}>
        <Pressable style={styles.aiAssistCard} onPress={() => {}}>
          <View style={styles.aiAssistHeader}>
            <View style={styles.aiAssistHeaderCopy}>
              <Text style={styles.aiAssistTitle}>{aiAssistContext?.title ?? 'AI Assist (Approval-First)'}</Text>
              <Text style={styles.aiAssistSub}>
                {aiAssistContext?.sub ??
                  'AI assist is advisory only. Review and edit all content before any human send/publish action.'}
              </Text>
            </View>
            <TouchableOpacity style={styles.aiAssistCloseBtn} onPress={() => setAiAssistVisible(false)}>
              <Text style={styles.aiAssistCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.aiAssistPolicyBanner}>
            <Text style={styles.aiAssistPolicyBannerText}>
              Approval-first shell: no KPI writes, no forecast/challenge-state mutation, no auto-send or auto-publish.
            </Text>
          </View>
          <View style={styles.aiAssistField}>
            <Text style={styles.aiAssistFieldLabel}>Approved insert point</Text>
            <Text style={styles.aiAssistFieldValue}>{aiAssistContext?.targetLabel ?? 'Unknown context'}</Text>
          </View>
          <View style={styles.aiAssistField}>
            <Text style={styles.aiAssistFieldLabel}>Draft request (human guided)</Text>
            <TextInput
              value={aiAssistPrompt}
              onChangeText={(text) => {
                setAiAssistPrompt(text);
                if (aiAssistNotice) setAiAssistNotice(null);
              }}
              placeholder="Describe the draft tone, purpose, and audience..."
              placeholderTextColor="#97a1af"
              multiline
              style={[styles.aiAssistInput, styles.aiAssistInputTall]}
            />
          </View>
          <View style={styles.aiAssistField}>
            <Text style={styles.aiAssistFieldLabel}>AI draft review (editable)</Text>
            <TextInput
              value={aiAssistDraftText}
              onChangeText={(text) => {
                setAiAssistDraftText(text);
                if (aiAssistNotice) setAiAssistNotice(null);
              }}
              placeholder="Generated draft appears here. Edit before applying."
              placeholderTextColor="#97a1af"
              multiline
              style={[styles.aiAssistInput, styles.aiAssistDraftInput]}
            />
          </View>
          <View style={styles.aiAssistQueueCard}>
            <View style={styles.aiAssistQueueCardTopRow}>
              <Text style={styles.aiAssistQueueTitle}>Approval Queue (Review-Only)</Text>
              {aiSuggestionListLoading ? <ActivityIndicator size="small" /> : null}
            </View>
            {aiSuggestionListError ? <Text style={styles.aiAssistQueueError}>{aiSuggestionListError}</Text> : null}
            {aiSuggestionQueueError ? <Text style={styles.aiAssistQueueError}>{aiSuggestionQueueError}</Text> : null}
            {aiSuggestionQueueSuccess ? <Text style={styles.aiAssistQueueSuccess}>{aiSuggestionQueueSuccess}</Text> : null}
            {aiSuggestionQueueSummary ? (
              <Text style={styles.aiAssistQueueSummaryText}>
                Queue summary: {Number(aiSuggestionQueueSummary.total ?? 0)} total • pending{' '}
                {Number(aiSuggestionQueueSummary.by_status?.pending ?? 0)} • approved{' '}
                {Number(aiSuggestionQueueSummary.by_status?.approved ?? 0)} • rejected{' '}
                {Number(aiSuggestionQueueSummary.by_status?.rejected ?? 0)}
              </Text>
            ) : (
              <Text style={styles.aiAssistQueueSummaryText}>
                Queue summary unavailable in this session. Queueing still creates a pending review item only (no send/publish).
              </Text>
            )}
            {(() => {
              const hostKey = aiAssistContext?.host ?? null;
              const hostMatches = (aiSuggestionRows ?? []).filter((row) => {
                const source = String(row.ai_queue_read_model?.source_surface ?? '');
                if (!hostKey) return true;
                if (hostKey === 'coaching_journeys') return source === 'coaching_journey_detail' || source === 'coaching_journey_list';
                if (hostKey === 'coaching_journey_detail') return source === 'coaching_journey_detail';
                if (hostKey === 'coaching_lesson_detail') return source === 'coaching_lesson_detail';
                if (hostKey === 'coach_broadcast_compose') return source === 'coach_broadcast_compose';
                if (hostKey === 'channel_thread') return source === 'channel_thread';
                if (hostKey === 'challenge_coaching_module') return source === 'challenge_coaching_block';
                if (hostKey === 'team_member_coaching_module' || hostKey === 'team_leader_coaching_module') {
                  return source === 'team_coaching_module';
                }
                return true;
              });
              const rows = (hostMatches.length > 0 ? hostMatches : aiSuggestionRows ?? []).slice(0, 3);
              if (rows.length === 0) {
                return (
                  <Text style={styles.aiAssistQueueRecentEmpty}>
                    No recent AI review items for this user/context yet. Queueing remains approval-first and advisory only.
                  </Text>
                );
              }
              return (
                <View style={styles.aiAssistQueueRecentList}>
                  {rows.map((row, idx) => {
                    const queueStatus = String(
                      row.ai_queue_read_model?.approval_queue?.queue_status ?? row.status ?? 'unknown'
                    );
                    const createdAt = fmtMonthDayTime(row.created_at ?? null);
                    return (
                      <View
                        key={`ai-suggestion-recent-${row.id}`}
                        style={[styles.aiAssistQueueRecentRow, idx > 0 ? styles.aiAssistQueueRecentRowDivider : null]}
                      >
                        <View style={styles.aiAssistQueueRecentRowCopy}>
                          <Text style={styles.aiAssistQueueRecentStatus}>{queueStatus}</Text>
                          <Text style={styles.aiAssistQueueRecentMeta}>
                            {row.ai_queue_read_model?.target_scope_summary ?? row.scope ?? 'scope unavailable'}
                          </Text>
                          <Text style={styles.aiAssistQueueRecentMeta}>
                            {createdAt ? `Created ${createdAt}` : `Suggestion ${row.id}`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </View>
          {aiAssistNotice ? <Text style={styles.aiAssistNotice}>{aiAssistNotice}</Text> : null}
          <View style={styles.aiAssistActionRow}>
            <TouchableOpacity
              style={[styles.aiAssistSecondaryBtn, aiAssistGenerating ? styles.disabled : null]}
              disabled={aiAssistGenerating}
              onPress={generateAiAssistDraft}
            >
              <Text style={styles.aiAssistSecondaryBtnText}>
                {aiAssistGenerating ? 'Generating…' : 'Generate Draft (Shell)'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.aiAssistSecondaryBtn} onPress={applyAiAssistDraftToHumanInput}>
              <Text style={styles.aiAssistSecondaryBtnText}>
                {aiAssistContext?.host === 'channel_thread' || aiAssistContext?.host === 'coach_broadcast_compose'
                  ? 'Insert Into Human Composer'
                  : 'Mark Ready For Human Review'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.aiAssistPrimaryBtn,
              (aiSuggestionQueueSubmitting || aiAssistGenerating || !aiAssistDraftText.trim()) ? styles.disabled : null,
            ]}
            disabled={aiSuggestionQueueSubmitting || aiAssistGenerating || !aiAssistDraftText.trim()}
            onPress={() => void queueAiSuggestionForApproval()}
          >
            <Text style={styles.aiAssistPrimaryBtnText}>
              {aiSuggestionQueueSubmitting ? 'Queueing For Review…' : 'Queue For Approval Review'}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  aiAssistBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  aiAssistCard: {
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe4f2',
    padding: 14,
    gap: 10,
    shadowColor: '#1f2f46',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    maxHeight: '86%',
  },
  aiAssistHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  aiAssistHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  aiAssistTitle: {
    color: '#263142',
    fontSize: 15,
    fontWeight: '900',
  },
  aiAssistSub: {
    color: '#6d7a8d',
    fontSize: 11,
    lineHeight: 15,
  },
  aiAssistCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eef2f8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dce4f1',
  },
  aiAssistCloseBtnText: {
    color: '#44536a',
    fontSize: 12,
    fontWeight: '800',
  },
  aiAssistPolicyBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3d7ff',
    backgroundColor: '#f7f1ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aiAssistPolicyBannerText: {
    color: '#55476f',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  aiAssistField: {
    gap: 5,
  },
  aiAssistFieldLabel: {
    color: '#57657a',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  aiAssistFieldValue: {
    color: '#2f3949',
    fontSize: 12,
    fontWeight: '700',
  },
  aiAssistInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dde5f0',
    backgroundColor: '#fbfcfe',
    color: '#2e3646',
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  aiAssistInputTall: {
    minHeight: 70,
  },
  aiAssistDraftInput: {
    minHeight: 118,
  },
  aiAssistQueueCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce4ef',
    backgroundColor: '#f8fbff',
    padding: 10,
    gap: 6,
  },
  aiAssistQueueCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  aiAssistQueueTitle: {
    color: '#304258',
    fontSize: 11,
    fontWeight: '800',
  },
  aiAssistQueueSummaryText: {
    color: '#55677f',
    fontSize: 10,
    lineHeight: 14,
  },
  aiAssistQueueError: {
    color: '#b42318',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  aiAssistQueueSuccess: {
    color: '#1d6f42',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  aiAssistQueueRecentEmpty: {
    color: '#697a90',
    fontSize: 10,
    lineHeight: 14,
  },
  aiAssistQueueRecentList: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e3eaf3',
    backgroundColor: '#fff',
  },
  aiAssistQueueRecentRow: {
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  aiAssistQueueRecentRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#edf1f6',
  },
  aiAssistQueueRecentRowCopy: {
    gap: 2,
  },
  aiAssistQueueRecentStatus: {
    color: '#33465f',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  aiAssistQueueRecentMeta: {
    color: '#65778f',
    fontSize: 10,
    lineHeight: 13,
  },
  aiAssistNotice: {
    color: '#4c5f79',
    fontSize: 11,
    lineHeight: 14,
  },
  aiAssistActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  aiAssistSecondaryBtn: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#d8e1ef',
    backgroundColor: '#f5f8fd',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAssistSecondaryBtnText: {
    color: '#364a6d',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  aiAssistPrimaryBtn: {
    borderRadius: 9,
    backgroundColor: '#2f3442',
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAssistPrimaryBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
});
