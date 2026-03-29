/**
 * WizardInviteLaunch — Step 3: Invite members, review summary, and launch.
 */
import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { wiz } from './wizardTheme';
import type { ChallengeWizardGoalDraft } from '../../../screens/kpi-dashboard/types';

interface Props {
  name: string;
  startAt: string;
  endAt: string;
  goals: ChallengeWizardGoalDraft[];
  inviteUserIds: string[];
  setInviteUserIds: (v: string[]) => void;
  teamMemberDirectory: Array<{ userId: string | null; name: string }>;
  isSoloPersona: boolean;
  hasTeamTier: boolean;
  challengeInviteLimit: number;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
  showPaywall?: (title: string, message: string, plan: string) => void;
}

export default function WizardInviteLaunch({
  name,
  startAt,
  endAt,
  goals,
  inviteUserIds,
  setInviteUserIds,
  teamMemberDirectory,
  isSoloPersona,
  hasTeamTier,
  challengeInviteLimit,
  onSubmit,
  submitting,
  submitError,
  showPaywall,
}: Props) {
  const inviteSet = useMemo(() => new Set(inviteUserIds), [inviteUserIds]);
  const atLimit = challengeInviteLimit > 0 && inviteUserIds.length >= challengeInviteLimit;
  const isUnlimited = challengeInviteLimit < 0;

  const toggleInvite = (userId: string | null) => {
    if (!userId) return;
    if (inviteSet.has(userId)) {
      setInviteUserIds(inviteUserIds.filter((id) => id !== userId));
    } else if (isUnlimited || !atLimit) {
      setInviteUserIds([...inviteUserIds, userId]);
    }
  };

  const handleLaunch = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSubmit();
  };

  const teamCount = goals.filter((g) => g.goal_scope === 'team').length;
  const individualCount = goals.filter((g) => g.goal_scope === 'individual').length;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Review Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryName}>{name || 'Untitled Challenge'}</Text>
        <Text style={styles.summaryMeta}>
          {startAt} → {endAt}
        </Text>
        <Text style={styles.summaryMeta}>
          {goals.length} KPIs ({teamCount} team, {individualCount} individual)
        </Text>
      </View>

      {/* Invite Section */}
      <Text style={styles.headline}>Invite your team</Text>

      {hasTeamTier && !isSoloPersona ? (
        // Team tier: full team enrollment
        <View style={styles.teamEnrollCard}>
          <Text style={styles.teamEnrollIcon}>👥</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.teamEnrollTitle}>Team-wide enrollment</Text>
            <Text style={styles.teamEnrollSub}>All team members can join from the Challenges tab.</Text>
          </View>
        </View>
      ) : (
        // Individual invites
        <>
          <Text style={styles.subline}>
            Invite up to {isUnlimited ? 'unlimited' : challengeInviteLimit} people to compete with you.
          </Text>
          {teamMemberDirectory.filter((m) => m.userId != null).slice(0, 12).map((member) => {
            const isInvited = inviteSet.has(member.userId!);
            return (
              <TouchableOpacity
                key={member.userId}
                style={[styles.memberRow, isInvited && styles.memberRowActive]}
                onPress={() => toggleInvite(member.userId)}
                activeOpacity={0.7}
              >
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {member.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={[styles.memberAction, isInvited && styles.memberActionActive]}>
                  {isInvited ? '✓ Invited' : 'Invite'}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Tier gate for more invites */}
          {atLimit && !isUnlimited && showPaywall && (
            <TouchableOpacity style={styles.tierGate} onPress={() => showPaywall('Unlock Unlimited Invites', 'Upgrade your plan to invite your whole network to challenges.', 'team')} activeOpacity={0.8}>
              <Text style={styles.tierGateIcon}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.tierGateTitle}>Unlock unlimited invites</Text>
                <Text style={styles.tierGateSub}>Upgrade to invite your whole network.</Text>
              </View>
              <Text style={styles.tierGateBtn}>Upgrade</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Error */}
      {submitError && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{submitError}</Text>
        </View>
      )}

      {/* Launch Button */}
      <TouchableOpacity
        style={[styles.launchBtn, submitting && styles.launchBtnDisabled]}
        onPress={submitting ? undefined : handleLaunch}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.launchBtnText}>Launch Challenge 🚀</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: wiz.pagePadding, paddingBottom: 60 },
  summaryCard: {
    backgroundColor: wiz.surface,
    borderRadius: wiz.cardRadius,
    borderWidth: 1,
    borderColor: wiz.surfaceBorder,
    padding: 16,
    marginBottom: 24,
  },
  summaryName: { fontSize: 18, fontWeight: '900', color: wiz.textPrimary, marginBottom: 4 },
  summaryMeta: { fontSize: 13, color: wiz.textSecondary, marginTop: 2 },
  headline: { fontSize: 20, fontWeight: '900', color: wiz.textPrimary, marginBottom: 4 },
  subline: { fontSize: 13, color: wiz.textSecondary, marginBottom: 16 },
  teamEnrollCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: wiz.primaryLight,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  teamEnrollIcon: { fontSize: 28 },
  teamEnrollTitle: { fontSize: 15, fontWeight: '800', color: wiz.textPrimary },
  teamEnrollSub: { fontSize: 12, color: wiz.textSecondary, marginTop: 2 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  memberRowActive: {
    backgroundColor: wiz.primaryLight,
  },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: wiz.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  memberAvatarText: { fontSize: 14, fontWeight: '800', color: wiz.textSecondary },
  memberName: { flex: 1, fontSize: 14, fontWeight: '600', color: wiz.textPrimary },
  memberAction: { fontSize: 13, fontWeight: '700', color: wiz.primary },
  memberActionActive: { color: wiz.success },
  tierGate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: wiz.tierGate,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: wiz.tierGateBorder,
    padding: 14,
    marginTop: 8,
  },
  tierGateIcon: { fontSize: 20 },
  tierGateTitle: { fontSize: 13, fontWeight: '800', color: wiz.tierGateText },
  tierGateSub: { fontSize: 11, color: wiz.textSecondary },
  tierGateBtn: { fontSize: 13, fontWeight: '800', color: wiz.primary },
  errorCard: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 12 },
  errorText: { fontSize: 13, color: wiz.error, fontWeight: '600' },
  launchBtn: {
    backgroundColor: wiz.success,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 28,
    shadowColor: wiz.success,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  launchBtnDisabled: { opacity: 0.6 },
  launchBtnText: { fontSize: 18, fontWeight: '900', color: '#ffffff' },
});
