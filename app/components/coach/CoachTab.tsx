import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { CoachingShellContext } from '../../screens/kpi-dashboard/types';
import type {
  CoachAssignment,
  CoachAssignmentType,
  CoachCohortRow,
  CoachEngagement,
  CoachEngagementStatus,
  CoachEntitlementState,
  CoachProfile,
  CoachSegmentPreset,
  CoachTabScreen,
  CoachWorkflowAssignMode,
  CoachWorkflowSection,
} from '../../screens/kpi-dashboard/types';

// ── Props ───────────────────────────────────────────────────────────

export interface CoachTabProps {
  coachTabScreen: CoachTabScreen;
  coachTabDefault: CoachTabScreen;
  coachEngagementStatus: CoachEngagementStatus;
  coachEntitlementState: CoachEntitlementState;
  coachAssignments: CoachAssignment[];
  coachGoalsTasksFilter: CoachAssignmentType | 'all';
  coachProfiles: CoachProfile[];
  coachMarketplaceLoading: boolean;
  coachActiveEngagement: CoachEngagement | null;
  coachEngagementLoading: boolean;
  coachCohorts: CoachCohortRow[];
  coachCohortsLoading: boolean;
  coachCohortsError: string | null;
  coachWorkflowSection: CoachWorkflowSection;
  coachWorkflowAssignMode: CoachWorkflowAssignMode;
  coachWorkflowAssignJourneyId: string | null;
  coachWorkflowAssignTargetCohortId: string | null;
  coachWorkflowAssignTargetUserId: string | null;
  coachInviteLinkCopied: boolean;
  coachSegmentPresets: CoachSegmentPreset[];
  setCoachTabScreen: React.Dispatch<React.SetStateAction<CoachTabScreen>>;
  setCoachGoalsTasksFilter: React.Dispatch<React.SetStateAction<CoachAssignmentType | 'all'>>;
  setCoachSelectedProfile: React.Dispatch<React.SetStateAction<CoachProfile | null>>;
  setCoachWorkflowSection: React.Dispatch<React.SetStateAction<CoachWorkflowSection>>;
  setCoachWorkflowAssignMode: React.Dispatch<React.SetStateAction<CoachWorkflowAssignMode>>;
  setCoachWorkflowAssignJourneyId: React.Dispatch<React.SetStateAction<string | null>>;
  setCoachWorkflowAssignTargetCohortId: React.Dispatch<React.SetStateAction<string | null>>;
  setCoachWorkflowAssignTargetUserId: React.Dispatch<React.SetStateAction<string | null>>;
  setCoachInviteLinkCopied: React.Dispatch<React.SetStateAction<boolean>>;
  openCoachingShell: (screen: import('../../screens/kpi-dashboard/types').CoachingShellScreen, contextPatch?: Partial<CoachingShellContext>) => void;
  setActiveTab: (tab: import('../../screens/kpi-dashboard/types').BottomTab) => void;
  session: Session | null;
  isCoachRuntimeOperator: boolean;
  coachingClients: Array<{ id: string; name: string; avatarUrl?: string | null; enrolledJourneyIds: string[]; enrolledJourneyNames?: string[] }>;
  coachingJourneys: import('../../screens/kpi-dashboard/types').CoachingJourneyListItem[] | null;
  coachingJourneysLoading: boolean;
  createCoachEngagement: (coachId: string) => Promise<void>;
  fetchCoachMarketplace: () => Promise<void>;
  onClientPress: (clientId: string) => void;
}

export default function CoachTab({
  coachTabScreen,
  coachTabDefault,
  coachEngagementStatus,
  coachEntitlementState,
  coachAssignments,
  coachGoalsTasksFilter,
  coachProfiles,
  coachMarketplaceLoading,
  coachActiveEngagement,
  coachEngagementLoading,
  coachCohorts,
  coachCohortsLoading,
  coachCohortsError,
  coachWorkflowSection,
  coachWorkflowAssignMode,
  coachWorkflowAssignJourneyId,
  coachWorkflowAssignTargetCohortId,
  coachWorkflowAssignTargetUserId,
  coachInviteLinkCopied,
  coachSegmentPresets,
  setCoachTabScreen,
  setCoachGoalsTasksFilter,
  setCoachSelectedProfile,
  setCoachWorkflowSection,
  setCoachWorkflowAssignMode,
  setCoachWorkflowAssignJourneyId,
  setCoachWorkflowAssignTargetCohortId,
  setCoachWorkflowAssignTargetUserId,
  setCoachInviteLinkCopied,
  openCoachingShell,
  setActiveTab,
  session,
  isCoachRuntimeOperator,
  coachingClients,
  coachingJourneys,
  coachingJourneysLoading,
  createCoachEngagement,
  fetchCoachMarketplace,
  onClientPress,
}: CoachTabProps) {
  return (
    <>
      {
coachTabScreen === 'coach_marketplace' ? (
  /* ── No-Coach Hero Marketing Surface ── */
  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
    {/* Hero Banner */}
    <View style={{ backgroundColor: '#1e1b4b', borderRadius: 16, marginHorizontal: 16, marginTop: 16, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center' as const }}>
      <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#a5b4fc', letterSpacing: 1.2, textTransform: 'uppercase' as const, marginBottom: 8 }}>Coaching</Text>
      <Text style={{ fontSize: 24, fontWeight: '700' as const, color: '#ffffff', textAlign: 'center' as const, marginBottom: 8 }}>Accelerate Your Growth</Text>
      <Text style={{ fontSize: 14, color: '#c7d2fe', textAlign: 'center' as const, lineHeight: 20 }}>
        Get personalized coaching to reach your goals faster. Choose the path that fits your journey.
      </Text>
    </View>

    {/* Offering Card 1 — Real Human DM Coaching */}
    <View style={{ backgroundColor: '#ffffff', borderRadius: 14, marginHorizontal: 16, marginTop: 16, padding: 20, borderWidth: 1, borderColor: '#e0e7ff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#eef2ff', alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '700' as const, color: '#4338ca' }}>DM</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700' as const, color: '#1e1b4b' }}>Real Human DM Coaching</Text>
        </View>
      </View>
      <Text style={{ fontSize: 13, color: '#4338ca', fontWeight: '600' as const, marginBottom: 6 }}>Tailored KPI Acceleration</Text>
      <Text style={{ fontSize: 13.5, color: '#475569', lineHeight: 20, marginBottom: 16 }}>
        Work 1-on-1 with a dedicated coach through direct messaging. Get real-time feedback on your KPIs, personalized action plans, and accountability that drives results.
      </Text>
      <View style={{ flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginBottom: 16 }}>
        {['Direct messaging', 'KPI review', 'Action plans', 'Accountability'].map((tag) => (
          <View key={tag} style={{ backgroundColor: '#eef2ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontSize: 11.5, color: '#4338ca', fontWeight: '500' as const }}>{tag}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={{ backgroundColor: '#4338ca', borderRadius: 10, paddingVertical: 13, alignItems: 'center' as const }}
        onPress={() => setCoachTabScreen('coach_offer_dm_coaching')}
      >
        <Text style={{ fontSize: 15, fontWeight: '600' as const, color: '#ffffff' }}>Sign Up</Text>
      </TouchableOpacity>
    </View>

    {/* Offering Card 2 — Fourth Reason Coaching */}
    <View style={{ backgroundColor: '#ffffff', borderRadius: 14, marginHorizontal: 16, marginTop: 12, padding: 20, borderWidth: 1, borderColor: '#fce7f3', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#fdf2f8', alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 12 }}>
          <Text style={{ fontSize: 20 }}>✦</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700' as const, color: '#1e1b4b' }}>Fourth Reason Coaching</Text>
        </View>
      </View>
      <Text style={{ fontSize: 13, color: '#be185d', fontWeight: '600' as const, marginBottom: 6 }}>Beyond Wealth, Time & Family</Text>
      <Text style={{ fontSize: 13.5, color: '#475569', lineHeight: 20, marginBottom: 16 }}>
        Discover your deeper purpose — the fourth reason that drives lasting fulfillment. Guided coaching journeys that go beyond metrics to build the life you actually want.
      </Text>
      <View style={{ flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginBottom: 16 }}>
        {['Purpose discovery', 'Guided journeys', 'Life design', 'Fulfillment'].map((tag) => (
          <View key={tag} style={{ backgroundColor: '#fdf2f8', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontSize: 11.5, color: '#be185d', fontWeight: '500' as const }}>{tag}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={{ backgroundColor: '#be185d', borderRadius: 10, paddingVertical: 13, alignItems: 'center' as const }}
        onPress={() => setCoachTabScreen('coach_offer_fourth_reason')}
      >
        <Text style={{ fontSize: 15, fontWeight: '600' as const, color: '#ffffff' }}>Sign Up</Text>
      </TouchableOpacity>
    </View>

    {/* Browse All Coaches link (preserves existing marketplace fallback) */}
    {coachProfiles.length > 0 && (
      <View style={{ marginHorizontal: 16, marginTop: 16, padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
        <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Or browse available coaches directly:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {coachProfiles.slice(0, 5).map((coach) => (
            <TouchableOpacity
              key={coach.id}
              style={{ flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' }}
              onPress={() => { setCoachSelectedProfile(coach); }}
            >
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#eef2ff', alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700' as const, color: '#4338ca' }}>
                  {coach.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <Text style={{ fontSize: 12.5, color: '#334155', fontWeight: '500' as const }} numberOfLines={1}>{coach.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )}

    {/* View Challenges link */}
    <TouchableOpacity
      style={{ marginHorizontal: 16, marginTop: 16, paddingVertical: 10, alignItems: 'center' as const }}
      onPress={() => setActiveTab('challenge')}
    >
      <Text style={{ fontSize: 13, color: '#4338ca', fontWeight: '600' as const }}>View Challenges →</Text>
    </TouchableOpacity>
  </ScrollView>
) : coachTabScreen === 'coach_offer_dm_coaching' ? (
  /* ── Offer Detail: Real Human DM Coaching ── */
  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
    <TouchableOpacity onPress={() => setCoachTabScreen('coach_marketplace')} style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
      <Text style={{ fontSize: 14, color: '#4338ca', fontWeight: '500' as const }}>← Back to Coaching</Text>
    </TouchableOpacity>

    {/* Hero */}
    <View style={{ backgroundColor: '#eef2ff', borderRadius: 16, marginHorizontal: 16, marginTop: 8, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center' as const }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#4338ca', alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 12 }}>
        <Text style={{ fontSize: 28, color: '#ffffff' }}>💬</Text>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '700' as const, color: '#1e1b4b', textAlign: 'center' as const, marginBottom: 6 }}>Real Human DM Coaching</Text>
      <Text style={{ fontSize: 14, color: '#4338ca', fontWeight: '600' as const, marginBottom: 8 }}>Tailored KPI Acceleration</Text>
      <Text style={{ fontSize: 13.5, color: '#475569', textAlign: 'center' as const, lineHeight: 20 }}>
        Connect directly with a certified coach who understands your KPIs, your market, and your goals.
      </Text>
    </View>

    {/* What You Get */}
    <View style={{ marginHorizontal: 16, marginTop: 20 }}>
      <Text style={{ fontSize: 16, fontWeight: '700' as const, color: '#1e1b4b', marginBottom: 12 }}>What You Get</Text>
      {[
        { title: 'Direct Message Access', desc: 'Unlimited async DM access to your personal coach — get answers when you need them.' },
        { title: 'Weekly KPI Review', desc: 'Your coach reviews your dashboard metrics weekly and provides targeted guidance.' },
        { title: 'Custom Action Plans', desc: 'Receive tailored action plans based on your specific goals and current performance.' },
        { title: 'Accountability Partner', desc: 'Regular check-ins to keep you on track and celebrate your wins.' },
      ].map((item) => (
        <View key={item.title} style={{ flexDirection: 'row' as const, marginBottom: 14, alignItems: 'flex-start' as const }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4338ca', marginRight: 12, marginTop: 7 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#1e1b4b', marginBottom: 2 }}>{item.title}</Text>
            <Text style={{ fontSize: 12.5, color: '#64748b', lineHeight: 18 }}>{item.desc}</Text>
          </View>
        </View>
      ))}
    </View>

    {/* Choose Coach CTA */}
    <View style={{ marginHorizontal: 16, marginTop: 16 }}>
      {coachMarketplaceLoading ? (
        <View style={{ padding: 20, alignItems: 'center' as const }}>
          <ActivityIndicator size="small" color="#4338ca" />
          <Text style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Loading available coaches...</Text>
        </View>
      ) : coachProfiles.length > 0 ? (
        <>
          <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#1e1b4b', marginBottom: 10 }}>Choose Your Coach</Text>
          {coachProfiles.map((coach) => (
            <TouchableOpacity
              key={coach.id}
              style={{ flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e0e7ff' }}
              onPress={() => {
                if (coachEntitlementState !== 'allowed') { setCoachTabScreen('coach_subscription_shell'); return; }
                void createCoachEngagement(coach.id);
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#eef2ff', alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '700' as const, color: '#4338ca' }}>
                  {coach.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#1e1b4b' }}>{coach.name}</Text>
                <Text style={{ fontSize: 12, color: '#64748b' }} numberOfLines={1}>{coach.specialties.join(' · ') || 'General Coaching'}</Text>
              </View>
              <View style={{ backgroundColor: '#4338ca', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '600' as const, color: '#ffffff' }}>
                  {coachEngagementLoading ? '...' : 'Start'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      ) : (
        <View style={{ padding: 20, backgroundColor: '#f8fafc', borderRadius: 12, alignItems: 'center' as const }}>
          <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center' as const }}>No coaches available right now. Check back soon!</Text>
          <TouchableOpacity onPress={() => void fetchCoachMarketplace()} style={{ marginTop: 10, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#eef2ff', borderRadius: 8 }}>
            <Text style={{ fontSize: 13, color: '#4338ca', fontWeight: '600' as const }}>Refresh</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  </ScrollView>
) : coachTabScreen === 'coach_offer_fourth_reason' ? (
  /* ── Offer Detail: Fourth Reason Coaching ── */
  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
    <TouchableOpacity onPress={() => setCoachTabScreen('coach_marketplace')} style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
      <Text style={{ fontSize: 14, color: '#be185d', fontWeight: '500' as const }}>← Back to Coaching</Text>
    </TouchableOpacity>

    {/* Hero */}
    <View style={{ backgroundColor: '#fdf2f8', borderRadius: 16, marginHorizontal: 16, marginTop: 8, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center' as const }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#be185d', alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 12 }}>
        <Text style={{ fontSize: 28, color: '#ffffff' }}>✦</Text>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '700' as const, color: '#1e1b4b', textAlign: 'center' as const, marginBottom: 6 }}>Fourth Reason Coaching</Text>
      <Text style={{ fontSize: 14, color: '#be185d', fontWeight: '600' as const, marginBottom: 8 }}>Beyond Wealth, Time & Family</Text>
      <Text style={{ fontSize: 13.5, color: '#475569', textAlign: 'center' as const, lineHeight: 20 }}>
        Most people chase wealth, time freedom, or family. The Fourth Reason is the deeper purpose that makes everything else meaningful.
      </Text>
    </View>

    {/* The Journey */}
    <View style={{ marginHorizontal: 16, marginTop: 20 }}>
      <Text style={{ fontSize: 16, fontWeight: '700' as const, color: '#1e1b4b', marginBottom: 12 }}>Your Journey Includes</Text>
      {[
        { title: 'Purpose Discovery', desc: 'Guided exercises to uncover what truly drives you beyond conventional success metrics.' },
        { title: 'Curated Coaching Journeys', desc: 'Multi-week structured journeys with lessons, reflections, and milestones.' },
        { title: 'Life Design Framework', desc: 'Build a holistic plan that integrates your professional goals with personal fulfillment.' },
        { title: 'Insight & Reflection', desc: 'Regular prompts and guided reflections to deepen your self-awareness and clarity.' },
      ].map((item) => (
        <View key={item.title} style={{ flexDirection: 'row' as const, marginBottom: 14, alignItems: 'flex-start' as const }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#be185d', marginRight: 12, marginTop: 7 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#1e1b4b', marginBottom: 2 }}>{item.title}</Text>
            <Text style={{ fontSize: 12.5, color: '#64748b', lineHeight: 18 }}>{item.desc}</Text>
          </View>
        </View>
      ))}
    </View>

    {/* Get Started CTA */}
    <View style={{ marginHorizontal: 16, marginTop: 16 }}>
      {coachMarketplaceLoading ? (
        <View style={{ padding: 20, alignItems: 'center' as const }}>
          <ActivityIndicator size="small" color="#be185d" />
          <Text style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Loading available coaches...</Text>
        </View>
      ) : coachProfiles.length > 0 ? (
        <>
          <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#1e1b4b', marginBottom: 10 }}>Begin With a Coach</Text>
          {coachProfiles.map((coach) => (
            <TouchableOpacity
              key={coach.id}
              style={{ flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#fce7f3' }}
              onPress={() => {
                if (coachEntitlementState !== 'allowed') { setCoachTabScreen('coach_subscription_shell'); return; }
                void createCoachEngagement(coach.id);
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fdf2f8', alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '700' as const, color: '#be185d' }}>
                  {coach.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#1e1b4b' }}>{coach.name}</Text>
                <Text style={{ fontSize: 12, color: '#64748b' }} numberOfLines={1}>{coach.specialties.join(' · ') || 'General Coaching'}</Text>
              </View>
              <View style={{ backgroundColor: '#be185d', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '600' as const, color: '#ffffff' }}>
                  {coachEngagementLoading ? '...' : 'Start'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      ) : (
        <View style={{ padding: 20, backgroundColor: '#fdf2f8', borderRadius: 12, alignItems: 'center' as const }}>
          <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center' as const }}>No coaches available right now. Check back soon!</Text>
          <TouchableOpacity onPress={() => void fetchCoachMarketplace()} style={{ marginTop: 10, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fdf2f8', borderRadius: 8 }}>
            <Text style={{ fontSize: 13, color: '#be185d', fontWeight: '600' as const }}>Refresh</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  </ScrollView>
) : coachTabScreen === 'coach_subscription_shell' ? (
  <View style={styles.coachSubscriptionWrap}>
    <Text style={styles.coachSubscriptionTitle}>Coaching Plans</Text>
    <Text style={styles.coachSubscriptionSub}>
      {coachEntitlementState === 'allowed'
        ? 'You are eligible for coaching.'
        : coachEntitlementState === 'pending'
          ? 'Your coaching access is being reviewed.'
          : coachEntitlementState === 'blocked'
            ? 'Coaching is not available for your current plan.'
            : 'Coaching is temporarily unavailable. Please try again later.'}
    </Text>
    <TouchableOpacity
      style={styles.coachSubscriptionCTA}
      onPress={() => setCoachTabScreen(coachTabDefault)}
    >
      <Text style={styles.coachSubscriptionCTAText}>
        {coachEntitlementState === 'allowed' ? 'Continue' : 'Back to Coach'}
      </Text>
    </TouchableOpacity>
  </View>
) : coachTabScreen === 'coach_hub_primary' ? (
  isCoachRuntimeOperator ? (
  /* ── Coach-Operator Workflow Surface ── */
  <View style={styles.cwfWrap}>
    {/* Section nav */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cwfNavScroll} contentContainerStyle={styles.cwfNavRow}>
      {([
        { key: 'journeys' as const, label: 'Journeys' },
        { key: 'clients' as const, label: 'People' },
        { key: 'cohorts' as const, label: 'Cohorts' },
        { key: 'segments' as const, label: 'Segments' },
      ]).map((sec) => (
        <TouchableOpacity
          key={sec.key}
          style={[styles.cwfNavBtn, coachWorkflowSection === sec.key && styles.cwfNavBtnActive]}
          onPress={() => setCoachWorkflowSection(sec.key)}
        >
          <Text style={[styles.cwfNavLabel, coachWorkflowSection === sec.key && styles.cwfNavLabelActive]}>{sec.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>

    {/* ── Journeys section ── */}
    {coachWorkflowSection === 'journeys' && (
      <View style={styles.cwfSection}>
        <Text style={styles.cwfSectionTitle}>Coaching Journeys</Text>
        {coachingJourneysLoading ? (
          <Text style={styles.cwfEmpty}>Loading journeys...</Text>
        ) : !coachingJourneys || coachingJourneys.length === 0 ? (
          <Text style={styles.cwfEmpty}>No journeys yet. Create a journey from the Coach Portal.</Text>
        ) : (
          coachingJourneys.map((j) => {
            const pct = typeof j.completion_percent === 'number' ? j.completion_percent : 0;
            return (
              <TouchableOpacity key={j.id} style={styles.cwfJourneyCard} onPress={() => openCoachingShell('coaching_journey_detail', { selectedJourneyId: String(j.id), selectedJourneyTitle: j.title })}>
                <View style={styles.cwfJourneyHeader}>
                  <Text style={styles.cwfJourneyTitle} numberOfLines={1}>{j.title}</Text>
                  <View style={styles.cwfJourneyPctWrap}>
                    <View style={[styles.cwfJourneyPctBar, { width: `${Math.min(pct, 100)}%` } as any]} />
                  </View>
                  <Text style={styles.cwfJourneyPctLabel}>{pct}%</Text>
                </View>
                {j.description ? <Text style={styles.cwfJourneyDesc} numberOfLines={2}>{j.description}</Text> : null}
                <View style={styles.cwfJourneyActions}>
                  <TouchableOpacity
                    style={styles.cwfActionChip}
                    onPress={() => openCoachingShell('coaching_journey_detail', { selectedJourneyId: String(j.id), selectedJourneyTitle: j.title })}
                  >
                    <Text style={styles.cwfActionChipText}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cwfActionChip}
                    onPress={() => {
                      setCoachWorkflowAssignMode('cohort');
                      setCoachWorkflowAssignJourneyId(String(j.id));
                    }}
                  >
                    <Text style={styles.cwfActionChipText}>Assign Cohort</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cwfActionChip}
                    onPress={() => {
                      setCoachWorkflowAssignMode('individual');
                      setCoachWorkflowAssignJourneyId(String(j.id));
                    }}
                  >
                    <Text style={styles.cwfActionChipText}>Assign Person</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cwfActionChipBroadcast}
                    onPress={() => {
                      openCoachingShell('coach_broadcast_compose', {
                        broadcastAudienceLabel: `${j.title} enrollees`,
                        broadcastRoleAllowed: true,
                      });
                    }}
                  >
                    <Text style={styles.cwfActionChipBroadcastText}>Broadcast</Text>
                  </TouchableOpacity>
                </View>

                {/* ── Inline assignment panel ── */}
                {coachWorkflowAssignJourneyId === String(j.id) && coachWorkflowAssignMode !== 'none' && (
                  <View style={styles.cwfAssignPanel}>
                    <View style={styles.cwfAssignHeader}>
                      <Text style={styles.cwfAssignTitle}>
                        {coachWorkflowAssignMode === 'cohort' ? 'Assign to Cohort' : 'Assign to Individual'}
                      </Text>
                      <TouchableOpacity onPress={() => { setCoachWorkflowAssignMode('none'); setCoachWorkflowAssignJourneyId(null); setCoachWorkflowAssignTargetCohortId(null); setCoachWorkflowAssignTargetUserId(null); }}>
                        <Text style={styles.cwfAssignClose}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    {coachWorkflowAssignMode === 'cohort' && (
                      <View>
                        {coachCohortsLoading ? <Text style={styles.cwfEmpty}>Loading cohorts...</Text>
                          : coachCohorts.length === 0 ? <Text style={styles.cwfEmpty}>No cohorts available.</Text>
                            : coachCohorts.map((c) => (
                              <TouchableOpacity
                                key={c.id}
                                style={[styles.cwfAssignRow, coachWorkflowAssignTargetCohortId === c.id && styles.cwfAssignRowSelected]}
                                onPress={() => setCoachWorkflowAssignTargetCohortId(c.id)}
                              >
                                <Text style={styles.cwfAssignRowName}>{c.name}</Text>
                                <Text style={styles.cwfAssignRowMeta}>{c.members_count} members</Text>
                              </TouchableOpacity>
                            ))}
                        {coachWorkflowAssignTargetCohortId && (
                          <TouchableOpacity style={styles.cwfAssignConfirm} onPress={() => { setCoachWorkflowAssignMode('none'); setCoachWorkflowAssignJourneyId(null); setCoachWorkflowAssignTargetCohortId(null); }}>
                            <Text style={styles.cwfAssignConfirmText}>Confirm Assignment</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                    {coachWorkflowAssignMode === 'individual' && (
                      <View>
                        {coachMarketplaceLoading ? <Text style={styles.cwfEmpty}>Loading people...</Text>
                          : coachProfiles.length === 0 ? <Text style={styles.cwfEmpty}>No people found.</Text>
                            : coachProfiles.map((p) => (
                              <TouchableOpacity
                                key={p.id}
                                style={[styles.cwfAssignRow, coachWorkflowAssignTargetUserId === p.id && styles.cwfAssignRowSelected]}
                                onPress={() => setCoachWorkflowAssignTargetUserId(p.id)}
                              >
                                <Text style={styles.cwfAssignRowName}>{p.name}</Text>
                                <Text style={styles.cwfAssignRowMeta}>{p.specialties.join(', ') || 'Member'}</Text>
                              </TouchableOpacity>
                            ))}
                        {coachWorkflowAssignTargetUserId && (
                          <TouchableOpacity style={styles.cwfAssignConfirm} onPress={() => { setCoachWorkflowAssignMode('none'); setCoachWorkflowAssignJourneyId(null); setCoachWorkflowAssignTargetUserId(null); }}>
                            <Text style={styles.cwfAssignConfirmText}>Confirm Assignment</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
        {/* Journey Library link removed — coach hub IS the journey list on mobile */}
      </View>
    )}

    {/* ── Clients / People section ── */}
    {coachWorkflowSection === 'clients' && (
      <View style={styles.cwfSection}>
        <Text style={styles.cwfSectionTitle}>People</Text>
        {isCoachRuntimeOperator ? (
          coachingClients.length === 0 ? (
            <Text style={styles.cwfEmpty}>No clients yet. Client profiles will appear once members enroll in a journey.</Text>
          ) : (
            coachingClients.map((client) => (
              <TouchableOpacity key={client.id} style={styles.cwfPersonCard} onPress={() => onClientPress(client.id)}>
                <View style={styles.cwfPersonAvatar}>
                  <Text style={styles.cwfPersonAvatarText}>
                    {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cwfPersonInfo}>
                  <Text style={styles.cwfPersonName}>{client.name}</Text>
                  <Text style={styles.cwfPersonRole} numberOfLines={1}>
                    {client.enrolledJourneyIds.length === 0
                      ? 'No journeys enrolled'
                      : client.enrolledJourneyNames && client.enrolledJourneyNames.length > 0
                        ? client.enrolledJourneyNames.join(' · ')
                        : `${client.enrolledJourneyIds.length} journey${client.enrolledJourneyIds.length !== 1 ? 's' : ''}`}
                  </Text>
                </View>
                <View style={styles.cwfPersonActions}>
                  <TouchableOpacity style={styles.cwfSmallChip} onPress={() => openCoachingShell('inbox_channels', { preferredChannelScope: 'team' })}>
                    <Text style={styles.cwfSmallChipText}>Message</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )
        ) : (
          coachMarketplaceLoading ? (
            <Text style={styles.cwfEmpty}>Loading people...</Text>
          ) : coachProfiles.length === 0 ? (
            <Text style={styles.cwfEmpty}>No people found. Client profiles will appear once team members are onboarded.</Text>
          ) : (
            coachProfiles.map((person) => (
              <View key={person.id} style={styles.cwfPersonCard}>
                <View style={styles.cwfPersonAvatar}>
                  <Text style={styles.cwfPersonAvatarText}>
                    {person.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cwfPersonInfo}>
                  <Text style={styles.cwfPersonName}>{person.name}</Text>
                  <Text style={styles.cwfPersonRole} numberOfLines={1}>{person.specialties.join(' · ') || 'Member'}</Text>
                </View>
                <View style={styles.cwfPersonActions}>
                  <TouchableOpacity style={styles.cwfSmallChip} onPress={() => openCoachingShell('inbox_channels', { preferredChannelScope: 'team' })}>
                    <Text style={styles.cwfSmallChipText}>Message</Text>
                  </TouchableOpacity>
                  <View style={[styles.cwfAvailDot, person.engagement_availability === 'available' ? styles.cwfAvailGreen : person.engagement_availability === 'waitlist' ? styles.cwfAvailYellow : styles.cwfAvailRed]} />
                </View>
              </View>
            ))
          )
        )}
      </View>
    )}

    {/* ── Cohorts section ── */}
    {coachWorkflowSection === 'cohorts' && (
      <View style={styles.cwfSection}>
        <Text style={styles.cwfSectionTitle}>Cohort Management</Text>
        {coachCohortsLoading ? (
          <Text style={styles.cwfEmpty}>Loading cohorts...</Text>
        ) : coachCohortsError ? (
          <Text style={styles.cwfEmpty}>{coachCohortsError}</Text>
        ) : coachCohorts.length === 0 ? (
          <Text style={styles.cwfEmpty}>No cohorts found. Create cohorts from the Coach Portal.</Text>
        ) : (
          coachCohorts.map((cohort) => (
            <View key={cohort.id} style={styles.cwfCohortCard}>
              <View style={styles.cwfCohortHeader}>
                <Text style={styles.cwfCohortName}>{cohort.name}</Text>
                <Text style={styles.cwfCohortCount}>{cohort.members_count} members · {cohort.leaders_count} leaders</Text>
              </View>
              <View style={styles.cwfCohortActions}>
                <TouchableOpacity
                  style={styles.cwfActionChip}
                  onPress={() => openCoachingShell('inbox_channels', { preferredChannelScope: 'cohort', preferredChannelLabel: cohort.name })}
                >
                  <Text style={styles.cwfActionChipText}>Channel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cwfActionChip}
                  onPress={() => {
                    setCoachWorkflowSection('journeys');
                    setCoachWorkflowAssignMode('cohort');
                    setCoachWorkflowAssignTargetCohortId(cohort.id);
                  }}
                >
                  <Text style={styles.cwfActionChipText}>Assign Journey</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cwfActionChipBroadcast}
                  onPress={() => {
                    openCoachingShell('coach_broadcast_compose', {
                      broadcastAudienceLabel: cohort.name,
                      broadcastRoleAllowed: true,
                    });
                  }}
                >
                  <Text style={styles.cwfActionChipBroadcastText}>Broadcast</Text>
                </TouchableOpacity>
              </View>
              {cohort.my_membership_role && (
                <Text style={styles.cwfCohortRole}>Your role: {cohort.my_membership_role === 'team_leader' ? 'Leader' : 'Member'}</Text>
              )}
            </View>
          ))
        )}
      </View>
    )}

    {/* ── Segments section ── */}
    {coachWorkflowSection === 'segments' && (
      <View style={styles.cwfSection}>
        <Text style={styles.cwfSectionTitle}>Smart Segments</Text>
        <View style={styles.cwfSegmentBanner}>
          <Text style={styles.cwfSegmentBannerText}>Segments are in preview mode. Targeting rules are not yet server-backed.</Text>
        </View>
        {coachSegmentPresets.map((seg) => (
          <View key={seg.id} style={styles.cwfSegmentCard}>
            <View style={styles.cwfSegmentHeader}>
              <Text style={styles.cwfSegmentLabel}>{seg.label}</Text>
              <View style={[styles.cwfSegmentStatusBadge, seg.status === 'live' ? styles.cwfSegmentLive : styles.cwfSegmentPreview]}>
                <Text style={styles.cwfSegmentStatusText}>{seg.status === 'live' ? 'Live' : 'Preview'}</Text>
              </View>
            </View>
            <Text style={styles.cwfSegmentDesc}>{seg.description}</Text>
            <Text style={styles.cwfSegmentRule}>Rule: {seg.rule.replace(/_/g, ' ')}</Text>
            <View style={styles.cwfSegmentActions}>
              <TouchableOpacity
                style={[styles.cwfActionChip, seg.status === 'preview' && styles.cwfActionChipMuted]}
                onPress={() => {
                  if (seg.status === 'preview') return;
                  openCoachingShell('coach_broadcast_compose', {
                    broadcastAudienceLabel: seg.label,
                    broadcastRoleAllowed: true,
                  });
                }}
              >
                <Text style={styles.cwfActionChipText}>{seg.status === 'live' ? 'Broadcast to Segment' : 'Not Available Yet'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    )}

    {/* ── Coach Invite Link Controls ── */}
    <View style={{ marginHorizontal: 0, marginTop: 16, padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '700' as const, color: '#1e1b4b', flex: 1 }}>Invite Clients</Text>
        <View style={{ backgroundColor: '#eef2ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '600' as const, color: '#4338ca' }}>Coach</Text>
        </View>
      </View>
      <Text style={{ fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 12 }}>
        Share your coaching invite link with potential clients. They can sign up and be matched directly to you.
      </Text>
      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingLeft: 12, overflow: 'hidden' as const }}>
        <Text style={{ flex: 1, fontSize: 12, color: '#94a3b8' }} numberOfLines={1}>
          {`compass.app/coach/${String(session?.user?.id ?? 'you').slice(0, 8)}/invite`}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: coachInviteLinkCopied ? '#22c55e' : '#4338ca', paddingHorizontal: 16, paddingVertical: 10 }}
          onPress={() => {
            setCoachInviteLinkCopied(true);
            setTimeout(() => setCoachInviteLinkCopied(false), 2000);
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600' as const, color: '#ffffff' }}>
            {coachInviteLinkCopied ? 'Copied!' : 'Copy Link'}
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={{ marginTop: 10, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: '#eef2ff', borderRadius: 10, paddingVertical: 10 }}
        onPress={() => {
          setCoachInviteLinkCopied(true);
          setTimeout(() => setCoachInviteLinkCopied(false), 2000);
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600' as const, color: '#4338ca' }}>↗  Share Invite Link</Text>
      </TouchableOpacity>
    </View>

    <TouchableOpacity
      style={styles.cwfFooterLink}
      onPress={() => setActiveTab('challenge')}
    >
      <Text style={styles.cwfFooterLinkText}>View Challenges →</Text>
    </TouchableOpacity>
  </View>
  ) : (
  /* ── Has-Coach Client Landing (hero card + enrolled journeys) ── */
  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
    {/* Coach Hero Card */}
    <View style={{ backgroundColor: '#1e1b4b', borderRadius: 16, marginHorizontal: 16, marginTop: 16, padding: 20 }}>
      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#4338ca', alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 14 }}>
          <Text style={{ fontSize: 18, fontWeight: '700' as const, color: '#ffffff' }}>
            {coachActiveEngagement?.coach?.name ? coachActiveEngagement.coach.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'C'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700' as const, color: '#ffffff' }}>
            {coachActiveEngagement?.coach?.name ?? 'Your Coach'}
          </Text>
          {coachActiveEngagement?.plan_tier_label ? (
            <Text style={{ fontSize: 12, color: '#a5b4fc', marginTop: 2 }}>{coachActiveEngagement.plan_tier_label}</Text>
          ) : null}
          {coachActiveEngagement?.coach?.specialties && coachActiveEngagement.coach.specialties.length > 0 ? (
            <Text style={{ fontSize: 12, color: '#c7d2fe', marginTop: 2 }} numberOfLines={1}>
              {coachActiveEngagement.coach.specialties.join(' · ')}
            </Text>
          ) : null}
        </View>
        {coachEngagementStatus === 'pending' ? (
          <View style={{ backgroundColor: '#fbbf24', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '600' as const, color: '#1e1b4b' }}>Pending</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: '#22c55e', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '600' as const, color: '#ffffff' }}>Active</Text>
          </View>
        )}
      </View>
      {coachEngagementStatus === 'pending' ? (
        <Text style={{ fontSize: 13, color: '#c7d2fe', lineHeight: 18 }}>
          Your coaching request is being reviewed. You'll be notified once your coach confirms.
        </Text>
      ) : (
        <Text style={{ fontSize: 13, color: '#c7d2fe', lineHeight: 18 }}>
          {coachActiveEngagement?.next_step_cta ?? 'Your personalized coaching hub — messages, sessions, and goals in one place.'}
        </Text>
      )}
    </View>

    {/* Quick Actions Grid */}
    <View style={{ flexDirection: 'row' as const, flexWrap: 'wrap' as const, marginHorizontal: 12, marginTop: 12, gap: 8 }}>
      {[
        { label: 'Messages', screen: 'coach_direct_comms' as CoachTabScreen },
        { label: 'Video Session', screen: 'coach_video_session' as CoachTabScreen },
        { label: 'Goals & Tasks', screen: 'coach_goals_tasks' as CoachTabScreen },
        { label: 'Content', screen: 'coach_content_library' as CoachTabScreen },
      ].map((action) => (
        <TouchableOpacity
          key={action.label}
          onPress={() => setCoachTabScreen(action.screen)}
          style={{ width: '47%' as any, backgroundColor: '#ffffff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' as const, justifyContent: 'center' as const }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600' as const, color: '#334155' }}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>

    {/* Enrolled Journeys */}
    <View style={{ marginHorizontal: 16, marginTop: 20 }}>
      <Text style={{ fontSize: 16, fontWeight: '700' as const, color: '#1e1b4b', marginBottom: 10 }}>Your Journeys</Text>
      {coachingJourneysLoading ? (
        <View style={{ padding: 16, alignItems: 'center' as const }}>
          <ActivityIndicator size="small" color="#4338ca" />
          <Text style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>Loading journeys...</Text>
        </View>
      ) : !coachingJourneys || coachingJourneys.length === 0 ? (
        <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 20, alignItems: 'center' as const }}>
          <Text style={{ fontSize: 16, fontWeight: '700' as const, color: '#94a3b8', marginBottom: 8 }}>No Journeys</Text>
          <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#334155', marginBottom: 4 }}>No journeys yet</Text>
          <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center' as const }}>Your coach will assign journeys to guide your growth.</Text>
        </View>
      ) : (
        coachingJourneys.map((j) => {
          const pct = typeof j.completion_percent === 'number' ? j.completion_percent : 0;
          return (
            <TouchableOpacity
              key={j.id}
              style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' }}
              onPress={() => openCoachingShell('coaching_journey_detail', { selectedJourneyId: String(j.id), selectedJourneyTitle: j.title })}
            >
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: '600' as const, color: '#1e1b4b', flex: 1 }} numberOfLines={1}>{j.title}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600' as const, color: pct >= 100 ? '#16a34a' : '#4338ca' }}>{pct}%</Text>
              </View>
              <View style={{ height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' as const }}>
                <View style={{ height: 4, backgroundColor: pct >= 100 ? '#22c55e' : '#4338ca', borderRadius: 2, width: `${Math.min(pct, 100)}%` } as any} />
              </View>
              {j.description ? <Text style={{ fontSize: 12, color: '#64748b', marginTop: 6 }} numberOfLines={1}>{j.description}</Text> : null}
            </TouchableOpacity>
          );
        })
      )}
    </View>

    <TouchableOpacity
      style={{ marginHorizontal: 16, marginTop: 16, paddingVertical: 10, alignItems: 'center' as const }}
      onPress={() => setActiveTab('challenge')}
    >
      <Text style={{ fontSize: 13, color: '#4338ca', fontWeight: '600' as const }}>View Challenges →</Text>
    </TouchableOpacity>
  </ScrollView>
  )
) : coachTabScreen === 'coach_goals_tasks' ? (
  <View style={styles.coachGoalsWrap}>
    <View style={styles.coachGoalsHeader}>
      <TouchableOpacity onPress={() => setCoachTabScreen('coach_hub_primary')}>
        <Text style={styles.coachGoalsBack}>← Hub</Text>
      </TouchableOpacity>
      <Text style={styles.coachGoalsTitle}>Goals & Tasks</Text>
    </View>
    <View style={styles.coachGoalsFilterRow}>
      {(['all', 'personal_goal', 'team_leader_goal', 'coach_goal', 'personal_task', 'coach_task'] as const).map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[styles.coachGoalsFilterBtn, coachGoalsTasksFilter === filter && styles.coachGoalsFilterBtnActive]}
          onPress={() => setCoachGoalsTasksFilter(filter)}
        >
          <Text style={[styles.coachGoalsFilterText, coachGoalsTasksFilter === filter && styles.coachGoalsFilterTextActive]}>
            {filter === 'all' ? 'All' : filter === 'personal_goal' ? 'My Goals' : filter === 'team_leader_goal' ? 'Leader' : filter === 'coach_goal' ? 'Coach Goals' : filter === 'personal_task' ? 'My Tasks' : 'Coach Tasks'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
    <View style={styles.coachGoalsList}>
      {coachAssignments
        .filter((a) => coachGoalsTasksFilter === 'all' || a.type === coachGoalsTasksFilter)
        .map((assignment) => (
          <View key={assignment.id} style={styles.coachGoalCard}>
            <View style={styles.coachGoalCardHeader}>
              <Text style={styles.coachGoalCardType}>
                {assignment.type === 'personal_goal' ? 'Goal' : assignment.type === 'team_leader_goal' ? 'Team' : assignment.type === 'coach_goal' ? 'Coach' : assignment.type === 'personal_task' ? 'Task' : 'Item'}
              </Text>
              <Text style={styles.coachGoalCardTitle}>{assignment.title}</Text>
            </View>
            <View style={styles.coachGoalCardMeta}>
              <Text style={[
                styles.coachGoalCardStatus,
                assignment.status === 'completed' && styles.coachGoalCardStatusDone,
                assignment.status === 'in_progress' && styles.coachGoalCardStatusProgress,
              ]}>
                {assignment.status === 'pending' ? 'Pending' : assignment.status === 'in_progress' ? 'In Progress' : 'Done'}
              </Text>
              {assignment.due_at ? (
                <Text style={styles.coachGoalCardDue}>Due {assignment.due_at.slice(0, 10)}</Text>
              ) : null}
            </View>
          </View>
        ))}
      {coachAssignments.filter((a) => coachGoalsTasksFilter === 'all' || a.type === coachGoalsTasksFilter).length === 0 ? (
        <Text style={styles.coachGoalsEmpty}>No items yet. Goals and tasks from your coach will appear here.</Text>
      ) : null}
    </View>
  </View>
) : coachTabScreen === 'coach_video_session' ? (
  <View style={styles.coachPlaceholderScreen}>
    <TouchableOpacity onPress={() => setCoachTabScreen('coach_hub_primary')}>
      <Text style={styles.coachGoalsBack}>← Hub</Text>
    </TouchableOpacity>
    <Text style={styles.coachPlaceholderTitle}>Video Sessions</Text>
    <Text style={styles.coachPlaceholderSub}>Video coaching sessions will be available after provider activation.</Text>
  </View>
) : coachTabScreen === 'coach_content_library' ? (
  <View style={styles.coachPlaceholderScreen}>
    <TouchableOpacity onPress={() => setCoachTabScreen('coach_hub_primary')}>
      <Text style={styles.coachGoalsBack}>← Hub</Text>
    </TouchableOpacity>
    <Text style={styles.coachPlaceholderTitle}>Content Library</Text>
    <Text style={styles.coachPlaceholderSub}>Your coach's curated content and resources will appear here.</Text>
  </View>
) : coachTabScreen === 'coach_direct_comms' ? (
  <View style={styles.coachPlaceholderScreen}>
    <TouchableOpacity onPress={() => setCoachTabScreen('coach_hub_primary')}>
      <Text style={styles.coachGoalsBack}>← Hub</Text>
    </TouchableOpacity>
    <Text style={styles.coachPlaceholderTitle}>Direct Messages</Text>
    <Text style={styles.coachPlaceholderSub}>Direct messaging with your coach will be available after provider activation.</Text>
  </View>
) : null
    }
    </>
  );
}

const styles = StyleSheet.create({
  coachGoalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8edf3',
    gap: 6,
  },
  coachGoalCardDue: {
    fontSize: 11,
    color: '#8896aa',
  },
  coachGoalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachGoalCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 24,
  },
  coachGoalCardStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b8860b',
  },
  coachGoalCardStatusDone: {
    color: '#2e7d32',
  },
  coachGoalCardStatusProgress: {
    color: '#1565c0',
  },
  coachGoalCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a2138',
    flex: 1,
  },
  coachGoalCardType: {
    fontSize: 16,
  },
  coachGoalsBack: {
    color: '#3366cc',
    fontWeight: '600',
    fontSize: 14,
  },
  coachGoalsEmpty: {
    fontSize: 13,
    color: '#8896aa',
    textAlign: 'center',
    paddingVertical: 24,
  },
  coachGoalsFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f0f4f8',
  },
  coachGoalsFilterBtnActive: {
    backgroundColor: '#3366cc',
  },
  coachGoalsFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  coachGoalsFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7a90',
  },
  coachGoalsFilterTextActive: {
    color: '#ffffff',
  },
  coachGoalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coachGoalsList: {
    gap: 8,
  },
  coachGoalsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a2138',
  },
  coachGoalsWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  coachPlaceholderScreen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  coachPlaceholderSub: {
    fontSize: 14,
    color: '#8896aa',
    lineHeight: 20,
  },
  coachPlaceholderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a2138',
  },
  coachSubscriptionCTA: {
    backgroundColor: '#3366cc',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  coachSubscriptionCTAText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  coachSubscriptionSub: {
    fontSize: 14,
    color: '#6b7a90',
    textAlign: 'center',
    lineHeight: 20,
  },
  coachSubscriptionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a2138',
  },
  coachSubscriptionWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    alignItems: 'center',
    gap: 16,
  },
  cwfActionChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#e8f0fe',
  },
  cwfActionChipBroadcast: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#fef0e1',
  },
  cwfActionChipBroadcastText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#c46200',
  },
  cwfActionChipMuted: {
    backgroundColor: '#f0f2f5',
    opacity: 0.6,
  },
  cwfActionChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1a73e8',
  },
  cwfAssignClose: {
    fontSize: 16,
    color: '#888',
    paddingHorizontal: 4,
  },
  cwfAssignConfirm: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1a73e8',
    alignItems: 'center' as const,
  },
  cwfAssignConfirmText: {
    color: '#fff',
    fontWeight: '700' as const,
    fontSize: 13,
  },
  cwfAssignHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  cwfAssignPanel: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#fafbfd',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dde2eb',
  },
  cwfAssignRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  cwfAssignRowMeta: {
    fontSize: 12,
    color: '#888',
  },
  cwfAssignRowName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1a1a2e',
  },
  cwfAssignRowSelected: {
    backgroundColor: '#e8f0fe',
  },
  cwfAssignTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1a1a2e',
  },
  cwfAvailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cwfAvailGreen: {
    backgroundColor: '#34a853',
  },
  cwfAvailRed: {
    backgroundColor: '#ea4335',
  },
  cwfAvailYellow: {
    backgroundColor: '#fbbc04',
  },
  cwfCohortActions: {
    flexDirection: 'row' as const,
    gap: 6,
  },
  cwfCohortCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e6e9ef',
  },
  cwfCohortCount: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  cwfCohortHeader: {
    marginBottom: 8,
  },
  cwfCohortName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1a1a2e',
  },
  cwfCohortRole: {
    fontSize: 11,
    color: '#1a73e8',
    marginTop: 6,
    fontWeight: '600' as const,
  },
  cwfEmpty: {
    fontSize: 13,
    color: '#888',
    paddingVertical: 16,
    textAlign: 'center' as const,
  },
  cwfFooterLink: {
    paddingVertical: 10,
    alignItems: 'center' as const,
    marginTop: 4,
  },
  cwfFooterLinkText: {
    color: '#3366cc',
    fontWeight: '600' as const,
    fontSize: 13,
  },
  cwfJourneyActions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    marginTop: 6,
  },
  cwfJourneyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e6e9ef',
  },
  cwfJourneyDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  cwfJourneyHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  cwfJourneyPctBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34a853',
  },
  cwfJourneyPctLabel: {
    fontSize: 11,
    color: '#888',
    width: 32,
    textAlign: 'right' as const,
  },
  cwfJourneyPctWrap: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e6e9ef',
    marginHorizontal: 8,
    overflow: 'hidden' as const,
  },
  cwfJourneyTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1a1a2e',
  },
  cwfNavBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f2f5',
  },
  cwfNavBtnActive: {
    backgroundColor: '#1a73e8',
  },
  cwfNavLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#555',
  },
  cwfNavLabelActive: {
    color: '#fff',
  },
  cwfNavRow: {
    flexDirection: 'row' as const,
    gap: 4,
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingRight: 72,
  },
  cwfNavScroll: {
    maxHeight: 56,
    flexGrow: 0,
  },
  cwfPersonActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  cwfPersonAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e8f0fe',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 10,
  },
  cwfPersonAvatarText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#1a73e8',
  },
  cwfPersonCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e6e9ef',
  },
  cwfPersonInfo: {
    flex: 1,
  },
  cwfPersonName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1a1a2e',
  },
  cwfPersonRole: {
    fontSize: 12,
    color: '#888',
    marginTop: 1,
  },
  cwfSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cwfSectionCTA: {
    paddingVertical: 10,
    alignItems: 'center' as const,
  },
  cwfSectionCTAText: {
    color: '#3366cc',
    fontWeight: '600' as const,
    fontSize: 13,
  },
  cwfSectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#1a1a2e',
    marginBottom: 10,
  },
  cwfSegmentActions: {
    flexDirection: 'row' as const,
    gap: 6,
  },
  cwfSegmentBanner: {
    backgroundColor: '#fef7e0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  cwfSegmentBannerText: {
    fontSize: 12,
    color: '#7a6415',
  },
  cwfSegmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e6e9ef',
  },
  cwfSegmentDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  cwfSegmentHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  cwfSegmentLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1a1a2e',
  },
  cwfSegmentLive: {
    backgroundColor: '#e6f4ea',
  },
  cwfSegmentPreview: {
    backgroundColor: '#fef7e0',
  },
  cwfSegmentRule: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
  },
  cwfSegmentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cwfSegmentStatusText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#333',
  },
  cwfSmallChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#e8f0fe',
  },
  cwfSmallChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#1a73e8',
  },
  cwfWrap: {
    flex: 1,
    paddingTop: 4,
  }
});
