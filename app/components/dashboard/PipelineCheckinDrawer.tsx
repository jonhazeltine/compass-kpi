/**
 * PipelineCheckinDrawer — Extracted from KPIDashboardScreen.
 * Renders the pipeline check-in modal overlay.
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
import type { PipelineCheckinFieldKey, PipelineCheckinReason } from '../../screens/kpi-dashboard/types';
import { PIPELINE_LOST_ENCOURAGEMENT_MESSAGES } from '../../screens/kpi-dashboard/constants';
import { fmtNum, formatLogDateHeading, isoTodayLocal, shiftIsoLocalDate } from '../../screens/kpi-dashboard/helpers';

export interface PipelineCheckinDrawerProps {
  pipelineCheckinVisible: boolean;
  pipelineCheckinListings: number;
  pipelineCheckinBuyers: number;
  pipelineCheckinSubmitting: boolean;
  pipelineCheckinReasonPromptVisible: boolean;
  pipelineCheckinDecreaseFields: string[];
  pipelineCheckinReason: PipelineCheckinReason | null;
  pipelineForceGciEntryField: PipelineCheckinFieldKey | null;
  pipelineCloseDateInput: string | null;
  pipelineCloseGciInput: string;
  pipelineLostEncouragement: string | null;

  setPipelineCheckinListings: (updater: (v: number) => number) => void;
  setPipelineCheckinBuyers: (updater: (v: number) => number) => void;
  setPipelineCloseDateInput: (updater: (v: string | null) => string) => void;
  setPipelineCloseGciInput: (v: string) => void;

  dismissPipelineCheckinForToday: () => void;
  onSavePipelineCheckin: () => void;
  onChoosePipelineDecreaseReason: (reason: PipelineCheckinReason) => void;
  finalizePipelineCheckinSave: (reason: PipelineCheckinReason) => Promise<void>;
}

export default function PipelineCheckinDrawer({
  pipelineCheckinVisible,
  pipelineCheckinListings,
  pipelineCheckinBuyers,
  pipelineCheckinSubmitting,
  pipelineCheckinReasonPromptVisible,
  pipelineCheckinDecreaseFields,
  pipelineCheckinReason,
  pipelineForceGciEntryField,
  pipelineCloseDateInput,
  pipelineCloseGciInput,
  pipelineLostEncouragement,
  setPipelineCheckinListings,
  setPipelineCheckinBuyers,
  setPipelineCloseDateInput,
  setPipelineCloseGciInput,
  dismissPipelineCheckinForToday,
  onSavePipelineCheckin,
  onChoosePipelineDecreaseReason,
  finalizePipelineCheckinSave,
}: PipelineCheckinDrawerProps) {
  return (
    <Modal
      visible={pipelineCheckinVisible}
      transparent
      animationType="fade"
      onRequestClose={dismissPipelineCheckinForToday}
    >
      <Pressable style={styles.pipelineCheckinBackdrop} onPress={dismissPipelineCheckinForToday}>
        <Pressable style={styles.pipelineCheckinCard} onPress={() => {}}>
          <ScrollView
            style={styles.pipelineCheckinScroll}
            contentContainerStyle={styles.pipelineCheckinScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.pipelineCheckinHeader}>
              <View style={styles.pipelineCheckinHeaderCopy}>
                <Text style={styles.pipelineCheckinTitle}>
                  {pipelineForceGciEntryField ? 'Log closed deal details' : 'Update your pipeline'}
                </Text>
                <Text style={styles.pipelineCheckinHelp}>
                  {pipelineForceGciEntryField
                    ? 'A downward pipeline change requires a close date and GCI entry.'
                    : 'Keep your forecast accurate with current pipeline counts.'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.pipelineCheckinCloseBtn}
                onPress={dismissPipelineCheckinForToday}
                disabled={pipelineCheckinSubmitting}
              >
                <Text style={styles.pipelineCheckinCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {!pipelineForceGciEntryField ? (
              <>
                <View style={styles.pipelineCheckinFieldCard}>
                  <Text style={styles.pipelineCheckinFieldLabel}>Pending listings</Text>
                  <View style={styles.pipelineCheckinStepperRow}>
                    <TouchableOpacity
                      style={styles.pipelineStepperBtn}
                      disabled={pipelineCheckinSubmitting}
                      onPress={() => setPipelineCheckinListings((v) => Math.max(0, v - 1))}
                    >
                      <Text style={styles.pipelineStepperBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.pipelineCheckinCountValue}>{fmtNum(pipelineCheckinListings)}</Text>
                    <TouchableOpacity
                      style={styles.pipelineStepperBtn}
                      disabled={pipelineCheckinSubmitting}
                      onPress={() => setPipelineCheckinListings((v) => Math.max(0, v + 1))}
                    >
                      <Text style={styles.pipelineStepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.pipelineCheckinFieldCard}>
                  <Text style={styles.pipelineCheckinFieldLabel}>Buyers under contract</Text>
                  <View style={styles.pipelineCheckinStepperRow}>
                    <TouchableOpacity
                      style={styles.pipelineStepperBtn}
                      disabled={pipelineCheckinSubmitting}
                      onPress={() => setPipelineCheckinBuyers((v) => Math.max(0, v - 1))}
                    >
                      <Text style={styles.pipelineStepperBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.pipelineCheckinCountValue}>{fmtNum(pipelineCheckinBuyers)}</Text>
                    <TouchableOpacity
                      style={styles.pipelineStepperBtn}
                      disabled={pipelineCheckinSubmitting}
                      onPress={() => setPipelineCheckinBuyers((v) => Math.max(0, v + 1))}
                    >
                      <Text style={styles.pipelineStepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : null}

            {pipelineCheckinReasonPromptVisible && !pipelineForceGciEntryField ? (
              <View style={styles.pipelineCheckinBranchCard}>
                <Text style={styles.pipelineCheckinBranchTitle}>Your pipeline count went down. What happened?</Text>
                {pipelineCheckinDecreaseFields.length > 0 ? (
                  <Text style={styles.pipelineCheckinBranchSub}>
                    Updated lower: {pipelineCheckinDecreaseFields.map((field) => (field === 'listings' ? 'Pending listings' : 'Buyers under contract')).join(', ')}
                  </Text>
                ) : null}
                <View style={styles.pipelineCheckinBranchButtons}>
                  <TouchableOpacity style={styles.pipelineBranchOption} onPress={() => onChoosePipelineDecreaseReason('deal_closed')}>
                    <Text style={styles.pipelineBranchOptionText}>A deal closed</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pipelineBranchOption} onPress={() => onChoosePipelineDecreaseReason('deal_lost')}>
                    <Text style={styles.pipelineBranchOptionText}>A deal was lost</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pipelineBranchOption} onPress={() => onChoosePipelineDecreaseReason('correction')}>
                    <Text style={styles.pipelineBranchOptionText}>Just correcting my count</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {pipelineCheckinReason === 'deal_closed' ? (
              <View style={styles.pipelineCheckinBranchCard}>
                <Text style={styles.pipelineCheckinBranchTitle}>Capture close follow-up</Text>
                <Text style={styles.pipelineCheckinBranchSub}>
                  Enter a close date and GCI amount to log the close and update pipeline counts.
                </Text>
                <View style={styles.pipelineCheckinDateRow}>
                  <TouchableOpacity
                    style={styles.pipelineCheckinDateBtn}
                    disabled={pipelineCheckinSubmitting}
                    onPress={() => setPipelineCloseDateInput((prev) => shiftIsoLocalDate(prev || isoTodayLocal(), -1))}
                  >
                    <Text style={styles.pipelineCheckinDateBtnText}>‹</Text>
                  </TouchableOpacity>
                  <View style={styles.pipelineCheckinDateValueWrap}>
                    <Text style={styles.pipelineCheckinDateValueLabel}>Close date</Text>
                    <Text style={styles.pipelineCheckinDateValueText}>
                      {formatLogDateHeading(pipelineCloseDateInput || isoTodayLocal())}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.pipelineCheckinDateBtn}
                    disabled={pipelineCheckinSubmitting}
                    onPress={() =>
                      setPipelineCloseDateInput((prev) => {
                        const next = shiftIsoLocalDate(prev || isoTodayLocal(), 1);
                        const today = isoTodayLocal();
                        return next > today ? today : next;
                      })
                    }
                  >
                    <Text style={styles.pipelineCheckinDateBtnText}>›</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.pipelineCheckinInlineInput}
                  value={pipelineCloseGciInput}
                  onChangeText={setPipelineCloseGciInput}
                  placeholder="GCI amount"
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={[styles.pipelineCheckinPrimaryBtn, pipelineCheckinSubmitting && styles.disabled]}
                  disabled={pipelineCheckinSubmitting}
                  onPress={() => void finalizePipelineCheckinSave('deal_closed')}
                >
                  <Text style={styles.pipelineCheckinPrimaryBtnText}>
                    {pipelineCheckinSubmitting ? 'Logging…' : 'Log close & save counts'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {pipelineCheckinReason === 'deal_lost' ? (
              <View style={styles.pipelineCheckinBranchCard}>
                <Text style={styles.pipelineCheckinBranchTitle}>Reset and keep moving</Text>
                <Text style={styles.pipelineCheckinBranchSub}>
                  {pipelineLostEncouragement || PIPELINE_LOST_ENCOURAGEMENT_MESSAGES[0]}
                </Text>
                <TouchableOpacity
                  style={[styles.pipelineCheckinPrimaryBtn, pipelineCheckinSubmitting && styles.disabled]}
                  disabled={pipelineCheckinSubmitting}
                  onPress={() => void finalizePipelineCheckinSave('deal_lost')}
                >
                  <Text style={styles.pipelineCheckinPrimaryBtnText}>
                    {pipelineCheckinSubmitting ? 'Logging…' : 'Log & save counts'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.pipelineCheckinActions}>
              <TouchableOpacity
                style={styles.pipelineCheckinSecondaryBtn}
                disabled={pipelineCheckinSubmitting}
                onPress={dismissPipelineCheckinForToday}
              >
                <Text style={styles.pipelineCheckinSecondaryBtnText}>Dismiss for today</Text>
              </TouchableOpacity>
              {pipelineCheckinReason !== 'deal_closed' &&
              pipelineCheckinReason !== 'deal_lost' &&
              !pipelineForceGciEntryField ? (
                <TouchableOpacity
                  style={[styles.pipelineCheckinPrimaryBtn, pipelineCheckinSubmitting && styles.disabled]}
                  disabled={pipelineCheckinSubmitting || pipelineCheckinReasonPromptVisible}
                  onPress={onSavePipelineCheckin}
                >
                  <Text style={styles.pipelineCheckinPrimaryBtnText}>
                    {pipelineCheckinSubmitting ? 'Updating…' : 'Update pipeline'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  pipelineCheckinBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(18, 22, 31, 0.42)',
  },
  pipelineCheckinCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e4eaf3',
    maxHeight: '82%',
    overflow: 'hidden',
  },
  pipelineCheckinScroll: {
    maxHeight: '100%',
  },
  pipelineCheckinScrollContent: {
    padding: 14,
    gap: 10,
  },
  pipelineCheckinHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pipelineCheckinHeaderCopy: {
    flex: 1,
  },
  pipelineCheckinTitle: {
    color: '#2d3442',
    fontSize: 20,
    fontWeight: '800',
  },
  pipelineCheckinHelp: {
    marginTop: 2,
    color: '#6f7888',
    fontSize: 12,
    lineHeight: 16,
  },
  pipelineCheckinCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f4f9',
  },
  pipelineCheckinCloseBtnText: {
    color: '#596478',
    fontSize: 13,
    fontWeight: '800',
  },
  pipelineCheckinFieldCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    backgroundColor: '#fbfcfe',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  pipelineCheckinFieldLabel: {
    color: '#3b4454',
    fontSize: 13,
    fontWeight: '700',
  },
  pipelineCheckinStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pipelineStepperBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8e1ef',
    backgroundColor: '#f0f5ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineStepperBtnText: {
    color: '#1f5fe2',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700',
  },
  pipelineCheckinCountValue: {
    minWidth: 72,
    textAlign: 'center',
    color: '#2f3442',
    fontSize: 28,
    lineHeight: 31,
    fontWeight: '800',
  },
  pipelineCheckinBranchCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ead39f',
    backgroundColor: '#fff8ea',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  pipelineCheckinBranchTitle: {
    color: '#5a4824',
    fontSize: 13,
    fontWeight: '800',
  },
  pipelineCheckinBranchSub: {
    color: '#745f31',
    fontSize: 12,
    lineHeight: 16,
  },
  pipelineCheckinBranchButtons: {
    gap: 8,
  },
  pipelineBranchOption: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8d3a6',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  pipelineBranchOptionText: {
    color: '#4f4121',
    fontSize: 12,
    fontWeight: '700',
  },
  pipelineCheckinInlineInput: {
    borderWidth: 1,
    borderColor: '#dddff0',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#2f3442',
  },
  pipelineCheckinDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pipelineCheckinDateBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8e1ef',
    backgroundColor: '#f0f5ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineCheckinDateBtnText: {
    color: '#1f5fe2',
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '800',
  },
  pipelineCheckinDateValueWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dddff0',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pipelineCheckinDateValueLabel: {
    color: '#7a8394',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  pipelineCheckinDateValueText: {
    marginTop: 2,
    color: '#2f3442',
    fontSize: 14,
    fontWeight: '700',
  },
  pipelineCheckinActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
    paddingTop: 2,
  },
  pipelineCheckinPrimaryBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#1f5fe2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pipelineCheckinPrimaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  pipelineCheckinSecondaryBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe2ee',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pipelineCheckinSecondaryBtnText: {
    color: '#5a6578',
    fontSize: 12,
    fontWeight: '700',
  },
});
