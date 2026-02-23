import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { colors, fontScale, lineHeights, radii, space, type } from '../theme/tokens';

type TeamMode = 'existing' | 'create' | 'solo';
type TeamBranchScreen = 'teamCode' | 'inviteFriend';
type KpiTier = 'core' | 'pro';
type KpiType = 'PC' | 'GP' | 'VP' | 'Custom';
type KpiKey = string;

type EditableField = 'avgPrice' | 'commissionRate' | 'lastYearGci' | 'ytdGci';
type KpiInputState = { historicalWeeklyAverage: number; targetWeeklyCount: number };

const DEFAULT_KPI_INPUT: KpiInputState = {
  historicalWeeklyAverage: 0,
  targetWeeklyCount: 0,
};

const EXCLUDED_OPERATIONAL_KPIS = ['deal_closed', 'pipeline_anchor'] as const;

const KPI_CATALOG: {
  key: KpiKey;
  title: string;
  description: string;
  recommended: boolean;
  tier: KpiTier;
  type: KpiType;
  pcWeightPercent: number | null;
}[] = [
  {
    key: 'phone_call_logged',
    title: 'Phone Call Logged',
    description: 'Outbound prospecting phone calls',
    recommended: false,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.00025,
  },
  {
    key: 'sphere_call',
    title: 'Sphere Call',
    description: 'Daily outreach calls',
    recommended: true,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.0004,
  },
  {
    key: 'fsbo_expired_call',
    title: 'FSBO/Expired Call',
    description: 'FSBO or expired listing outreach calls',
    recommended: false,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.0005,
  },
  {
    key: 'door_knock_logged',
    title: 'Door Knock Logged',
    description: 'Door-knocking activities logged',
    recommended: false,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.0003,
  },
  {
    key: 'appointment_set_buyer',
    title: 'Appointment Set (Buyer)',
    description: 'Buyer appointments scheduled',
    recommended: true,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.005,
  },
  {
    key: 'biz_post',
    title: 'Biz Post',
    description: 'Business post published as a long-tail nurture touchpoint',
    recommended: false,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.0002,
  },
  {
    key: 'appointment_set_seller',
    title: 'Appointment Set (Seller)',
    description: 'Seller appointments scheduled',
    recommended: true,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.005,
  },
  {
    key: 'coffee_lunch_sphere',
    title: 'Coffee/Lunch with Sphere',
    description: 'Relationship touchpoints with sphere',
    recommended: false,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.001,
  },
  {
    key: 'conversations_held',
    title: 'Conversations Held',
    description: 'Meaningful prospect/client conversations',
    recommended: false,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.001,
  },
  {
    key: 'listing_taken',
    title: 'Listing Taken',
    description: 'New listings secured',
    recommended: true,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.07,
  },
  {
    key: 'buyer_contract_signed',
    title: 'Buyer Contract Signed',
    description: 'Buyer agency agreements signed',
    recommended: true,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.05,
  },
  {
    key: 'new_client_logged',
    title: 'New Client Logged',
    description: 'New client profiles added',
    recommended: false,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.0125,
  },
  {
    key: 'text_dm_conversation',
    title: 'Text/DM Conversation',
    description: 'Text and DM outreach conversations',
    recommended: false,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.0001,
  },
  {
    key: 'open_house_logged',
    title: 'Open House Logged',
    description: 'Open house events hosted',
    recommended: false,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.002,
  },
  {
    key: 'time_blocks_honored',
    title: 'Time Blocks Honored',
    description: 'Protected work blocks completed',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'social_posts_shared',
    title: 'Social Posts Shared',
    description: 'Business social posts published',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'crm_tag_applied',
    title: 'CRM Tag Applied',
    description: 'CRM hygiene updates completed',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'smart_plan_activated',
    title: 'Smart Plan Activated',
    description: 'Automated plan actions triggered',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'email_subscribers_added',
    title: 'Email Subscribers Added',
    description: 'Audience growth actions',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'listing_video_created',
    title: 'Listing Video Created',
    description: 'Video marketing content produced',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'listing_presentation_given',
    title: 'Listing Presentation Given',
    description: 'In-person or virtual listing presentations',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'buyer_consult_held',
    title: 'Buyer Consult Held',
    description: 'Buyer consult sessions completed',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'business_book_completed',
    title: 'Business Book Completed',
    description: 'Business development learning completed',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'pipeline_cleaned_up',
    title: 'Pipeline Cleaned Up',
    description: 'Pipeline hygiene and follow-up cleanup',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'automation_rule_added',
    title: 'Automation Rule Added',
    description: 'Workflow automation added',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'instagram_post_shared',
    title: 'Instagram Post Shared',
    description: 'Instagram business post published',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'facebook_post_shared',
    title: 'Facebook Post Shared',
    description: 'Facebook business post published',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'tiktok_post_shared',
    title: 'TikTok Post Shared',
    description: 'TikTok business post published',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'x_post_shared',
    title: 'X Post Shared',
    description: 'X business post published',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'linkedin_post_shared',
    title: 'LinkedIn Post Shared',
    description: 'LinkedIn business post published',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'youtube_short_posted',
    title: 'YouTube Short Posted',
    description: 'YouTube Short published',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
  {
    key: 'gratitude_entry',
    title: 'Gratitude Entry',
    description: 'Mindset and reflection journaling',
    recommended: false,
    tier: 'core',
    type: 'VP',
    pcWeightPercent: null,
  },
  {
    key: 'good_night_sleep',
    title: 'Good Night of Sleep',
    description: 'Rest and recovery habit',
    recommended: false,
    tier: 'core',
    type: 'VP',
    pcWeightPercent: null,
  },
  {
    key: 'exercise_session',
    title: 'Exercise Session',
    description: 'Physical activity session',
    recommended: false,
    tier: 'core',
    type: 'VP',
    pcWeightPercent: null,
  },
  {
    key: 'prayer_meditation_time',
    title: 'Prayer/Meditation Time',
    description: 'Mental wellbeing practice',
    recommended: false,
    tier: 'core',
    type: 'VP',
    pcWeightPercent: null,
  },
  {
    key: 'seasonal_check_in_call',
    title: 'Seasonal Check-In Call',
    description: 'Seasonal sphere nurture touchpoint',
    recommended: false,
    tier: 'core',
    type: 'VP',
    pcWeightPercent: null,
  },
  {
    key: 'pop_by_delivered',
    title: 'Pop-By Delivered',
    description: 'Client pop-by delivered',
    recommended: false,
    tier: 'core',
    type: 'VP',
    pcWeightPercent: null,
  },
  {
    key: 'holiday_card_sent',
    title: 'Holiday Card Sent',
    description: 'Holiday outreach completed',
    recommended: false,
    tier: 'core',
    type: 'VP',
    pcWeightPercent: null,
  },
  {
    key: 'custom_kpi',
    title: 'Custom KPI',
    description: 'User-defined custom KPI',
    recommended: false,
    tier: 'pro',
    type: 'Custom',
    pcWeightPercent: null,
  },
  {
    key: 'buyers_signed',
    title: 'Buyers Signed',
    description: 'Buyer agreements signed',
    recommended: false,
    tier: 'core',
    type: 'PC',
    pcWeightPercent: 0.25,
  },
  {
    key: 'calls_made',
    title: 'Calls Made',
    description: 'Calls tracked in call activity',
    recommended: false,
    tier: 'core',
    type: 'GP',
    pcWeightPercent: null,
  },
];

const KPI_OPTIONS = KPI_CATALOG.filter(
  (kpi) => !EXCLUDED_OPERATIONAL_KPIS.includes(kpi.key as (typeof EXCLUDED_OPERATIONAL_KPIS)[number])
);

type Props = {
  onBack: () => void;
  onComplete: () => void;
  onAlreadyHaveAccount: () => void;
};

const heroAssets = {
  notifications: require('../assets/figma/heroes/notifications_hero_v1.png'),
  success: require('../assets/figma/heroes/success_hero_v1.png'),
} as const;

function ScaledText(props: TextProps) {
  return <Text allowFontScaling maxFontSizeMultiplier={fontScale.maxMultiplier} {...props} />;
}

function StepDots({ index, total }: { index: number; total: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.dot, i <= index ? styles.dotActive : null]} />
      ))}
    </View>
  );
}

function HeroPanel({ variant }: { variant: 'team' | 'notification' | 'success' }) {
  if (variant === 'notification') {
    return (
      <View style={styles.heroPanel}>
        <Image source={heroAssets.notifications} style={styles.heroImage} resizeMode="contain" />
      </View>
    );
  }

  if (variant === 'success') {
    return (
      <View style={styles.heroPanel}>
        <Image source={heroAssets.success} style={styles.heroImage} resizeMode="contain" />
      </View>
    );
  }

  return (
    <View style={styles.heroPanel}>
      <View style={styles.teamCard}>
        <View style={styles.teamPerson} />
        <View style={styles.teamLines}>
          <View style={styles.teamLine} />
          <View style={styles.teamLine} />
        </View>
      </View>
      <View style={[styles.teamCard, styles.teamCardSmall]}>
        <View style={[styles.teamPerson, styles.teamPersonAlt]} />
        <View style={styles.teamLines}>
          <View style={styles.teamLine} />
        </View>
      </View>
    </View>
  );
}

function InfoBanner({ message }: { message: string }) {
  return (
    <View style={styles.infoBanner}>
      <ScaledText style={styles.infoIcon}>i</ScaledText>
      <ScaledText style={styles.infoBannerText}>{message}</ScaledText>
    </View>
  );
}

function formatCompactUsd(value: number) {
  if (value >= 1000000) {
    const millions = value / 1000000;
    const text = Number.isInteger(millions) ? `${millions}` : millions.toFixed(1);
    return `${text}M`;
  }
  if (value >= 1000) {
    const thousands = value / 1000;
    const text = Number.isInteger(thousands) ? `${thousands}` : thousands.toFixed(1);
    return `${text}K`;
  }
  return `${Math.round(value)}`;
}

function formatPercent(value: number) {
  const normalized = Number.isInteger(value) ? `${value}` : value.toFixed(1);
  return `${normalized}%`;
}

function formatUsdRounded(value: number) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function kpiTypeTint(type: KpiType) {
  if (type === 'PC') return '#e4f7ea';
  if (type === 'GP') return '#e5efff';
  if (type === 'VP') return '#fff0e2';
  if (type === 'Custom') return '#f3e8ff';
  return '#eceff3';
}

function kpiTypeAccent(type: KpiType) {
  if (type === 'PC') return '#2f9f56';
  if (type === 'GP') return '#2158d5';
  if (type === 'VP') return '#e38a1f';
  if (type === 'Custom') return '#7a4cc8';
  return colors.textSecondary;
}

function sanitizeNumericInput(input: string, allowDecimal: boolean) {
  if (allowDecimal) {
    return input.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  }
  return input.replace(/[^0-9]/g, '');
}

function parsePadValue(raw: string, allowDecimal: boolean) {
  if (!raw) return 0;
  const parsed = allowDecimal ? parseFloat(raw) : parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function NumericPadModal({
  visible,
  title,
  value,
  allowDecimal,
  onClose,
  onApply,
}: {
  visible: boolean;
  title: string;
  value: string;
  allowDecimal: boolean;
  onClose: () => void;
  onApply: (raw: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [replaceOnNextInput, setReplaceOnNextInput] = useState(true);

  React.useEffect(() => {
    if (visible) {
      setDraft(value);
      setReplaceOnNextInput(true);
    }
  }, [visible, value]);

  const append = (digit: string) => {
    if (digit === '.' && (!allowDecimal || draft.includes('.'))) return;
    if (replaceOnNextInput) {
      setReplaceOnNextInput(false);
      if (digit === '.') {
        setDraft('0.');
        return;
      }
      setDraft(digit);
      return;
    }
    if (draft === '0' && digit !== '.') {
      setDraft(digit);
      return;
    }
    setDraft((prev) => sanitizeNumericInput(`${prev}${digit}`, allowDecimal));
  };

  const remove = () => {
    setReplaceOnNextInput(false);
    setDraft((prev) => prev.slice(0, -1));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <ScaledText style={styles.modalTitle}>{title}</ScaledText>
          <View style={styles.modalValueBox}>
            <ScaledText style={styles.modalValueText}>{draft || '0'}</ScaledText>
          </View>

          <View style={styles.padGrid}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <TouchableOpacity key={k} style={styles.padKey} onPress={() => append(k)}>
                <ScaledText style={styles.padKeyText}>{k}</ScaledText>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.padKey, !allowDecimal && styles.padKeyDisabled]}
              onPress={() => append('.')}
              disabled={!allowDecimal}
            >
              <ScaledText style={styles.padKeyText}>.</ScaledText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.padKey} onPress={() => append('0')}>
              <ScaledText style={styles.padKeyText}>0</ScaledText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.padKey} onPress={remove}>
              <ScaledText style={styles.padKeyText}>⌫</ScaledText>
            </TouchableOpacity>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.secondaryAction} onPress={onClose}>
              <ScaledText style={styles.secondaryActionText}>Cancel</ScaledText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => {
                onApply(draft);
                onClose();
              }}
            >
              <ScaledText style={styles.primaryActionText}>Apply</ScaledText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StepperValue({
  label,
  valueText,
  onPlus,
  onMinus,
  onValuePress,
  editable = true,
}: {
  label: string;
  valueText: string;
  onPlus: () => void;
  onMinus: () => void;
  onValuePress?: () => void;
  editable?: boolean;
}) {
  return (
    <View style={styles.stepperGroup}>
      <ScaledText style={styles.stepperLabel}>{label}</ScaledText>
      <View style={styles.stepperRow}>
        <TouchableOpacity style={styles.stepperBtn} onPress={onMinus}>
          <ScaledText style={styles.stepperBtnText}>−</ScaledText>
        </TouchableOpacity>
        <TouchableOpacity onPress={onValuePress} style={styles.valuePressTarget} disabled={!editable}>
          <ScaledText style={styles.stepperValue}>{valueText}</ScaledText>
          {editable ? <ScaledText style={styles.valueHint}>Tap to edit</ScaledText> : null}
        </TouchableOpacity>
        <TouchableOpacity style={styles.stepperBtn} onPress={onPlus}>
          <ScaledText style={styles.stepperBtnText}>+</ScaledText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OnboardingFlowScreen({ onBack, onComplete, onAlreadyHaveAccount }: Props) {
  const [step, setStep] = useState(0);
  const [branchScreen, setBranchScreen] = useState<TeamBranchScreen | null>(null);

  const [avgPrice, setAvgPrice] = useState(300000);
  const [commissionRate, setCommissionRate] = useState(2.5);
  const [lastYearGci, setLastYearGci] = useState(5000000);
  const [ytdGci, setYtdGci] = useState(2000000);

  const [listingsPending, setListingsPending] = useState(1);
  const [purchasesPending, setPurchasesPending] = useState(3);
  const [selectedKpis, setSelectedKpis] = useState<KpiKey[]>([
    'sphere_call',
    'appointment_set_buyer',
    'listing_taken',
  ]);
  const [showFullCatalog, setShowFullCatalog] = useState(false);
  const [kpiInputs, setKpiInputs] = useState<Record<KpiKey, KpiInputState>>({
    sphere_call: { historicalWeeklyAverage: 25, targetWeeklyCount: 30 },
    appointment_set_buyer: { historicalWeeklyAverage: 8, targetWeeklyCount: 10 },
    listing_taken: { historicalWeeklyAverage: 3, targetWeeklyCount: 4 },
  });
  const [teamMode, setTeamMode] = useState<TeamMode>('solo');
  const [teamCode, setTeamCode] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);
  const [notificationEnabled, setNotificationEnabled] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [retypePassword, setRetypePassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editField, setEditField] = useState<EditableField | null>(null);

  const { signUp } = useAuth();

  const totalSteps = teamMode === 'solo' ? 9 : 10;
  const displayStep = useMemo(() => {
    if (branchScreen) return 7;
    if (step <= 5) return step + 1;
    return teamMode === 'solo' ? step + 1 : step + 2;
  }, [branchScreen, step, teamMode]);
  const stepText = useMemo(() => `Step ${displayStep}/${totalSteps}`, [displayStep, totalSteps]);

  const fieldConfig = useMemo(() => {
    if (editField === 'avgPrice') {
      return {
        title: 'Enter Avg Price Point (USD)',
        value: String(avgPrice),
        allowDecimal: false,
        apply: (raw: string) => setAvgPrice(Math.max(0, parsePadValue(raw, false))),
      };
    }
    if (editField === 'commissionRate') {
      return {
        title: 'Enter Commission Rate (%)',
        value: String(commissionRate),
        allowDecimal: true,
        apply: (raw: string) => setCommissionRate(Math.max(0, parsePadValue(raw, true))),
      };
    }
    if (editField === 'lastYearGci') {
      return {
        title: "Enter Last Year's Total GCI (USD)",
        value: String(lastYearGci),
        allowDecimal: false,
        apply: (raw: string) => setLastYearGci(Math.max(0, parsePadValue(raw, false))),
      };
    }
    return {
      title: 'Enter Current Year-to-Date GCI (USD)',
      value: String(ytdGci),
      allowDecimal: false,
      apply: (raw: string) => setYtdGci(Math.max(0, parsePadValue(raw, false))),
    };
  }, [editField, avgPrice, commissionRate, lastYearGci, ytdGci]);

  const recommendedKpis = useMemo(
    () =>
      KPI_OPTIONS.filter((kpi) => kpi.type === 'PC' && kpi.recommended).slice(0, 5),
    []
  );
  const additionalCatalogKpis = useMemo(
    () =>
      KPI_OPTIONS.filter((kpi) => kpi.type === 'PC' && !kpi.recommended),
    []
  );
  const isLockedKpi = (kpi: KpiKey) =>
    KPI_OPTIONS.find((option) => option.key === kpi)?.tier === 'pro';

  const toggleKpi = (kpi: KpiKey) => {
    const metadata = KPI_OPTIONS.find((option) => option.key === kpi);
    if (metadata && (metadata.type === 'GP' || metadata.type === 'VP')) {
      Alert.alert(
        'Unlock Criteria',
        'Business Growth unlocks after 3 active days or 20 logged KPIs. Vitality unlocks after 7 active days or 40 logged KPIs.'
      );
      return;
    }
    if (isLockedKpi(kpi)) {
      Alert.alert('Unlock Required', 'This KPI is locked right now and can be unlocked later.');
      return;
    }
    setSelectedKpis((prev) => (prev.includes(kpi) ? prev.filter((x) => x !== kpi) : [...prev, kpi]));
  };

  const updateKpiInput = (
    kpi: KpiKey,
    field: keyof KpiInputState,
    value: number
  ) => {
    setKpiInputs((prev) => ({
      ...prev,
      [kpi]: {
        ...(prev[kpi] ?? DEFAULT_KPI_INPUT),
        [field]: Math.max(0, value),
      },
    }));
  };

  const estimateKpiValuePerActivity = (kpi: KpiKey) => {
    const metadata = KPI_OPTIONS.find((option) => option.key === kpi);
    if (!metadata?.pcWeightPercent) return null;
    const grossCommissionPerDeal = avgPrice * (commissionRate / 100);
    return grossCommissionPerDeal * metadata.pcWeightPercent;
  };

  const next = () => {
    if (branchScreen) {
      if (branchScreen === 'teamCode' && teamCode.trim().length === 0) {
        Alert.alert('Team code required', 'Enter your team code to continue.');
        return;
      }
      setBranchScreen(null);
      setStep(6);
      return;
    }

    if (step === 3 && selectedKpis.length === 0) {
      Alert.alert('Select KPI', 'Please select at least one KPI to continue.');
      return;
    }

    if (step === 5) {
      if (teamMode === 'existing') {
        setBranchScreen('teamCode');
        return;
      }
      if (teamMode === 'create') {
        setBranchScreen('inviteFriend');
        return;
      }
    }

    setStep((s) => Math.min(8, s + 1));
  };
  const back = () => {
    if (branchScreen) {
      setBranchScreen(null);
      setStep(5);
      return;
    }

    if (step === 6 && teamMode !== 'solo') {
      setBranchScreen(teamMode === 'existing' ? 'teamCode' : 'inviteFriend');
      return;
    }

    if (step === 0) {
      onBack();
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  };

  const createAccount = async () => {
    const nameValue = fullName.trim();
    const emailValue = email.trim().toLowerCase();

    if (!nameValue || !emailValue || !password || !retypePassword) {
      Alert.alert('Missing details', 'Please fill all account fields.');
      return;
    }

    const looksLikeEmail = /.+@.+\..+/.test(emailValue);
    if (!looksLikeEmail) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }

    if (password !== retypePassword) {
      Alert.alert('Password mismatch', 'Passwords must match.');
      return;
    }

    setSubmitting(true);
    try {
      await signUp(emailValue, password, {
        full_name: nameValue,
        average_price_point: avgPrice,
        commission_rate_percent: commissionRate,
        last_year_gci: lastYearGci,
        ytd_gci: ytdGci,
        listings_pending: listingsPending,
        purchases_pending: purchasesPending,
        selected_kpis: selectedKpis,
        kpi_weekly_inputs: selectedKpis.reduce<Record<string, KpiInputState>>(
          (acc, key) => {
            acc[key] = kpiInputs[key] ?? DEFAULT_KPI_INPUT;
            return acc;
          },
          {}
        ),
        team_mode: teamMode,
        notifications_enabled: notificationEnabled,
      });
      Alert.alert('Account created', 'Check your email for verification, then log in.');
      onComplete();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign up failed';
      Alert.alert('Sign up failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const showPinnedFooterButton = step !== 6 || branchScreen !== null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, showPinnedFooterButton ? styles.contentWithPinnedFooter : null]}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <View style={styles.topRow}>
              <TouchableOpacity onPress={back} style={styles.backTap}>
                <ScaledText style={styles.backArrow}>‹</ScaledText>
              </TouchableOpacity>
              <ScaledText style={styles.stepText}>{stepText}</ScaledText>
            </View>

            <StepDots index={displayStep - 1} total={totalSteps} />

            {step === 0 && branchScreen === null ? (
              <View style={styles.screenBlock}>
                <ScaledText style={styles.title}>Your Avg price point, commission rate</ScaledText>
                <ScaledText style={styles.subtitle}>You can adjust these values later.</ScaledText>
                <StepperValue
                  label="Price Point (USD)"
                  valueText={formatCompactUsd(avgPrice)}
                  onMinus={() => setAvgPrice((v) => Math.max(0, v - 50000))}
                  onPlus={() => setAvgPrice((v) => v + 50000)}
                  onValuePress={() => setEditField('avgPrice')}
                />
                <StepperValue
                  label="Commission Rate"
                  valueText={formatPercent(commissionRate)}
                  onMinus={() => setCommissionRate((v) => Math.max(0, Number((v - 0.5).toFixed(1))))}
                  onPlus={() => setCommissionRate((v) => Number((v + 0.5).toFixed(1)))}
                  onValuePress={() => setEditField('commissionRate')}
                />
                <InfoBanner message="You can adjust entered value later." />
              </View>
            ) : null}

            {step === 1 && branchScreen === null ? (
              <View style={styles.screenBlock}>
                <ScaledText style={styles.title}>Understanding your past achievements</ScaledText>
                <ScaledText style={styles.subtitle}>This helps create a relevant starting point.</ScaledText>
                <StepperValue
                  label="Last Year's Total GCI (USD)"
                  valueText={formatCompactUsd(lastYearGci)}
                  onMinus={() => setLastYearGci((v) => Math.max(0, v - 100000))}
                  onPlus={() => setLastYearGci((v) => v + 100000)}
                  onValuePress={() => setEditField('lastYearGci')}
                />
                <StepperValue
                  label="Current Year-to-Date GCI"
                  valueText={formatCompactUsd(ytdGci)}
                  onMinus={() => setYtdGci((v) => Math.max(0, v - 100000))}
                  onPlus={() => setYtdGci((v) => v + 100000)}
                  onValuePress={() => setEditField('ytdGci')}
                />
                <InfoBanner message="You can adjust entered value later." />
              </View>
            ) : null}

            {step === 2 && branchScreen === null ? (
              <View style={styles.screenBlock}>
                <ScaledText style={styles.title}>
                  Great! Now, what's currently in your active pipeline and moving towards closing?
                </ScaledText>
                <ScaledText style={styles.subtitle}>Use your best estimate to start.</ScaledText>
                <StepperValue
                  label="Listings in Escrow/Pending"
                  valueText={`${listingsPending}`}
                  onMinus={() => setListingsPending((v) => Math.max(0, v - 1))}
                  onPlus={() => setListingsPending((v) => v + 1)}
                  editable={false}
                />
                <StepperValue
                  label="Purchase Transactions in Escrow/Pending"
                  valueText={`${purchasesPending}`}
                  onMinus={() => setPurchasesPending((v) => Math.max(0, v - 1))}
                  onPlus={() => setPurchasesPending((v) => v + 1)}
                  editable={false}
                />
                <InfoBanner message="You can adjust entered value later." />
              </View>
            ) : null}

            {step === 3 && branchScreen === null ? (
              <View style={styles.screenBlock}>
                <ScaledText style={styles.title}>Select one or more KPIs for logging</ScaledText>
                <ScaledText style={styles.subtitle}>Please select at least one KPI to continue.</ScaledText>
                <ScaledText style={styles.sectionHeading}>Recommended KPI Picks</ScaledText>
                {recommendedKpis.map((kpi) => {
                  const selected = selectedKpis.includes(kpi.key);
                  const locked = kpi.tier === 'pro';
                  return (
                    <TouchableOpacity
                      key={kpi.key}
                      style={[
                        styles.optionRow,
                        { backgroundColor: kpiTypeTint(kpi.type), borderColor: kpiTypeAccent(kpi.type) },
                        selected && styles.optionRowActive,
                        locked && styles.optionRowLocked,
                      ]}
                      onPress={() => toggleKpi(kpi.key)}
                    >
                      <View style={[styles.typePill, { backgroundColor: kpiTypeAccent(kpi.type) }]}>
                        <ScaledText style={styles.typePillText}>{kpi.type}</ScaledText>
                      </View>
                      <View style={styles.optionTextWrap}>
                        <ScaledText style={styles.optionTitle}>{kpi.title}</ScaledText>
                        <ScaledText style={styles.optionSubtitle}>{kpi.description}</ScaledText>
                      </View>
                      {locked ? (
                        <View style={styles.lockPill}>
                          <ScaledText style={styles.lockPillText}>Locked • Unlock Later</ScaledText>
                        </View>
                      ) : null}
                      {!locked && selected ? <ScaledText style={styles.optionCheck}>✓</ScaledText> : null}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.catalogToggle}
                  onPress={() => setShowFullCatalog((prev) => !prev)}
                >
                  <ScaledText style={styles.catalogToggleText}>
                    {showFullCatalog ? 'Hide full KPI catalog' : 'Browse full KPI catalog'}
                  </ScaledText>
                </TouchableOpacity>
                {showFullCatalog ? (
                  <View style={styles.catalogSection}>
                    <ScaledText style={styles.sectionHeading}>Full KPI Catalog (Onboarding Selectable)</ScaledText>
                    {additionalCatalogKpis.map((kpi) => {
                      const selected = selectedKpis.includes(kpi.key);
                      const locked = kpi.tier === 'pro';
                      return (
                        <TouchableOpacity
                          key={kpi.key}
                          style={[
                            styles.optionRow,
                            { backgroundColor: kpiTypeTint(kpi.type), borderColor: kpiTypeAccent(kpi.type) },
                            selected && styles.optionRowActive,
                            locked && styles.optionRowLocked,
                          ]}
                          onPress={() => toggleKpi(kpi.key)}
                        >
                          <View style={[styles.typePill, { backgroundColor: kpiTypeAccent(kpi.type) }]}>
                            <ScaledText style={styles.typePillText}>{kpi.type}</ScaledText>
                          </View>
                          <View style={styles.optionTextWrap}>
                            <ScaledText style={styles.optionTitle}>{kpi.title}</ScaledText>
                            <ScaledText style={styles.optionSubtitle}>{kpi.description}</ScaledText>
                          </View>
                          {locked ? (
                            <View style={styles.lockPill}>
                              <ScaledText style={styles.lockPillText}>Locked • Unlock Later</ScaledText>
                            </View>
                          ) : null}
                          {!locked && selected ? (
                            <ScaledText style={styles.optionCheck}>✓</ScaledText>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      style={styles.teaserButton}
                      onPress={() =>
                        Alert.alert(
                          'Unlock Criteria',
                          'Business Growth unlocks after 3 active days or 20 logged KPIs.'
                        )
                      }
                    >
                      <ScaledText style={styles.teaserButtonText}>✨ Track Business Growth KPIs</ScaledText>
                      <ScaledText style={styles.teaserButtonSubtext}>Locked during onboarding</ScaledText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.teaserButton}
                      onPress={() =>
                        Alert.alert(
                          'Unlock Criteria',
                          'Vitality unlocks after 7 active days or 40 logged KPIs.'
                        )
                      }
                    >
                      <ScaledText style={styles.teaserButtonText}>✨ Track Vitality KPIs</ScaledText>
                      <ScaledText style={styles.teaserButtonSubtext}>Locked during onboarding</ScaledText>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : null}

            {step === 4 && branchScreen === null ? (
              <View style={styles.screenBlock}>
                <ScaledText style={styles.title}>Set your KPI baseline and target</ScaledText>
                <ScaledText style={styles.subtitle}>
                  Activity counts are editable. KPI value/weight is system-managed by Super Admin and shown read-only.
                </ScaledText>
                {selectedKpis.map((key) => {
                  const def = KPI_OPTIONS.find((x) => x.key === key);
                  if (!def) return null;
                  const current = kpiInputs[key] ?? DEFAULT_KPI_INPUT;
                  const estimatedPerActivity = estimateKpiValuePerActivity(key);
                  return (
                    <View key={key} style={[styles.kpiInputCard, { backgroundColor: kpiTypeTint(def.type), borderColor: kpiTypeAccent(def.type) }]}>
                      <View style={[styles.typePill, { backgroundColor: kpiTypeAccent(def.type), alignSelf: 'flex-start' }]}>
                        <ScaledText style={styles.typePillText}>{def.type}</ScaledText>
                      </View>
                      <ScaledText style={styles.kpiInputTitle}>{def.title}</ScaledText>
                      <View style={styles.readOnlyValueCard}>
                        <ScaledText style={styles.readOnlyValueLabel}>Estimated Value per Activity</ScaledText>
                        <ScaledText style={styles.readOnlyValueText}>
                          {estimatedPerActivity === null
                            ? 'Managed by Super Admin'
                            : formatUsdRounded(estimatedPerActivity)}
                        </ScaledText>
                      </View>
                      <View style={styles.kpiInputRow}>
                        <ScaledText style={styles.kpiInputLabel}>Historical average / week</ScaledText>
                        <View style={styles.kpiStepperRow}>
                          <TouchableOpacity
                            style={styles.miniBtn}
                            onPress={() =>
                              updateKpiInput(
                                key,
                                'historicalWeeklyAverage',
                                current.historicalWeeklyAverage - 1
                              )
                            }
                          >
                            <ScaledText style={styles.miniBtnText}>−</ScaledText>
                          </TouchableOpacity>
                          <ScaledText style={styles.kpiInputValue}>{current.historicalWeeklyAverage}</ScaledText>
                          <TouchableOpacity
                            style={styles.miniBtn}
                            onPress={() =>
                              updateKpiInput(
                                key,
                                'historicalWeeklyAverage',
                                current.historicalWeeklyAverage + 1
                              )
                            }
                          >
                            <ScaledText style={styles.miniBtnText}>+</ScaledText>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.kpiInputRow}>
                        <ScaledText style={styles.kpiInputLabel}>Target / week</ScaledText>
                        <View style={styles.kpiStepperRow}>
                          <TouchableOpacity
                            style={styles.miniBtn}
                            onPress={() =>
                              updateKpiInput(
                                key,
                                'targetWeeklyCount',
                                current.targetWeeklyCount - 1
                              )
                            }
                          >
                            <ScaledText style={styles.miniBtnText}>−</ScaledText>
                          </TouchableOpacity>
                          <ScaledText style={styles.kpiInputValue}>{current.targetWeeklyCount}</ScaledText>
                          <TouchableOpacity
                            style={styles.miniBtn}
                            onPress={() =>
                              updateKpiInput(
                                key,
                                'targetWeeklyCount',
                                current.targetWeeklyCount + 1
                              )
                            }
                          >
                            <ScaledText style={styles.miniBtnText}>+</ScaledText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {step === 5 && branchScreen === null ? (
              <View style={styles.screenBlock}>
                <HeroPanel variant="team" />
                <ScaledText style={styles.title}>Are you part of a team, or flying solo for now?</ScaledText>
                <ScaledText style={styles.subtitle}>You can change this later in settings.</ScaledText>
                <TouchableOpacity
                  style={[styles.optionRow, teamMode === 'existing' && styles.optionRowActive]}
                  onPress={() => setTeamMode('existing')}
                >
                  <View style={styles.optionTextWrap}>
                    <ScaledText style={styles.optionTitle}>Join an Existing Team</ScaledText>
                    <ScaledText style={styles.optionSubtitle}>Apply an invite code from your team lead.</ScaledText>
                  </View>
                  {teamMode === 'existing' ? <ScaledText style={styles.optionCheck}>✓</ScaledText> : null}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.optionRow, teamMode === 'create' && styles.optionRowActive]}
                  onPress={() => setTeamMode('create')}
                >
                  <View style={styles.optionTextWrap}>
                    <ScaledText style={styles.optionTitle}>Create a New Team</ScaledText>
                    <ScaledText style={styles.optionSubtitle}>You'll become team admin and invite others.</ScaledText>
                  </View>
                  {teamMode === 'create' ? <ScaledText style={styles.optionCheck}>✓</ScaledText> : null}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.optionRow, teamMode === 'solo' && styles.optionRowActive]}
                  onPress={() => setTeamMode('solo')}
                >
                  <View style={styles.optionTextWrap}>
                    <ScaledText style={styles.optionTitle}>Continue Solo</ScaledText>
                    <ScaledText style={styles.optionSubtitle}>Start immediately and join a team later.</ScaledText>
                  </View>
                  {teamMode === 'solo' ? <ScaledText style={styles.optionCheck}>✓</ScaledText> : null}
                </TouchableOpacity>
              </View>
            ) : null}

            {step === 6 && branchScreen === null ? (
              <View style={styles.screenBlock}>
                <HeroPanel variant="notification" />
                <ScaledText style={styles.title}>Stay on track and motivated!</ScaledText>
                <ScaledText style={styles.subtitle}>
                  Allow notifications for challenge alerts and performance insights.
                </ScaledText>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => {
                    setNotificationEnabled(true);
                    next();
                  }}
                >
                  <ScaledText style={styles.primaryButtonText}>Allow Notifications</ScaledText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setNotificationEnabled(false);
                    next();
                  }}
                >
                  <ScaledText style={styles.secondaryButtonText}>Maybe Later</ScaledText>
                </TouchableOpacity>
              </View>
            ) : null}

            {step === 7 && branchScreen === null ? (
              <View style={styles.screenBlock}>
                <HeroPanel variant="success" />
                <ScaledText style={styles.title}>Fantastic!</ScaledText>
                <ScaledText style={styles.subtitle}>
                  You've provided all the initial info. Let's create your secure account.
                </ScaledText>
              </View>
            ) : null}

            {step === 8 && branchScreen === null ? (
              <View style={styles.screenBlock}>
                <ScaledText style={styles.title}>Create user account</ScaledText>
                <ScaledText style={styles.subtitle}>Complete the fields to finish setup.</ScaledText>
                <TextInput
                  style={styles.input}
                  maxFontSizeMultiplier={fontScale.maxMultiplier}
                  placeholder="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                />
                <TextInput
                  style={styles.input}
                  maxFontSizeMultiplier={fontScale.maxMultiplier}
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
                <TextInput
                  style={styles.input}
                  maxFontSizeMultiplier={fontScale.maxMultiplier}
                  placeholder="Password"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                <TextInput
                  style={styles.input}
                  maxFontSizeMultiplier={fontScale.maxMultiplier}
                  placeholder="Retype Password"
                  secureTextEntry
                  value={retypePassword}
                  onChangeText={setRetypePassword}
                />
                <TouchableOpacity style={styles.inlineLink} onPress={onAlreadyHaveAccount}>
                  <ScaledText style={styles.inlineLinkText}>Already have an account? Log In</ScaledText>
                </TouchableOpacity>
              </View>
            ) : null}

            {branchScreen === 'teamCode' ? (
              <View style={styles.screenBlock}>
                <ScaledText style={styles.title}>Enter team code</ScaledText>
                <ScaledText style={styles.subtitle}>
                  Apply your team invite code to load required KPIs.
                </ScaledText>
                <ScaledText style={styles.inputLabel}>Enter Team Code</ScaledText>
                <TextInput
                  style={styles.input}
                  maxFontSizeMultiplier={fontScale.maxMultiplier}
                  placeholder="XXX XXX XXXX XXX"
                  autoCapitalize="characters"
                  value={teamCode}
                  onChangeText={setTeamCode}
                />
                {teamCode.trim().length > 0 ? (
                  <>
                    <ScaledText style={styles.lockedHeading}>Locked KPI (Team mandated)</ScaledText>
                    <View style={styles.lockedCard}>
                      <ScaledText style={styles.lockedKpiTitle}>Sphere Calls</ScaledText>
                      <ScaledText style={styles.lockedKpiDesc}>Daily outreach calls</ScaledText>
                    </View>
                    <View style={styles.lockedCard}>
                      <ScaledText style={styles.lockedKpiTitle}>Appointments</ScaledText>
                      <ScaledText style={styles.lockedKpiDesc}>Client meetings scheduled</ScaledText>
                    </View>
                    <View style={styles.lockedCard}>
                      <ScaledText style={styles.lockedKpiTitle}>Closing</ScaledText>
                      <ScaledText style={styles.lockedKpiDesc}>Completed transactions</ScaledText>
                    </View>
                  </>
                ) : (
                  <InfoBanner message="Enter a team code to load required team KPIs." />
                )}
              </View>
            ) : null}

            {branchScreen === 'inviteFriend' ? (
              <View style={styles.screenBlock}>
                <ScaledText style={styles.title}>Invite a Friend</ScaledText>
                <ScaledText style={styles.subtitle}>
                  Add teammates now or continue and invite them later.
                </ScaledText>
                <ScaledText style={styles.inputLabel}>Add Friend by Name or Email</ScaledText>
                <View style={styles.inlineInputRow}>
                  <TextInput
                    style={[styles.input, styles.inlineInput]}
                    maxFontSizeMultiplier={fontScale.maxMultiplier}
                    placeholder="Enter friend's name or email"
                    value={inviteInput}
                    onChangeText={setInviteInput}
                  />
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={() => {
                      const value = inviteInput.trim();
                      if (!value) return;
                      setInvitedFriends((prev) => [value, ...prev]);
                      setInviteInput('');
                    }}
                  >
                    <ScaledText style={styles.sendBtnText}>Send</ScaledText>
                  </TouchableOpacity>
                </View>
                <View style={styles.inviteActions}>
                  <TouchableOpacity style={styles.inviteActionBtn}>
                    <ScaledText style={styles.inviteActionText}>Copy Invite Link</ScaledText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.inviteActionBtn}>
                    <ScaledText style={styles.inviteActionText}>Invite via...</ScaledText>
                  </TouchableOpacity>
                </View>
                <ScaledText style={styles.lockedHeading}>Invited Friends</ScaledText>
                {invitedFriends.length === 0 ? (
                  <InfoBanner message="No invites sent yet. Add a friend by name or email." />
                ) : (
                  invitedFriends.map((name) => (
                    <View key={name} style={styles.friendRow}>
                      <ScaledText style={styles.friendName}>{name}</ScaledText>
                      <ScaledText style={styles.friendStatus}>Invited</ScaledText>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </View>

        </ScrollView>

        {showPinnedFooterButton ? (
          <View style={styles.pinnedFooter}>
            <TouchableOpacity
              style={[styles.primaryButton, submitting && styles.disabledButton]}
              onPress={step === 8 && branchScreen === null ? createAccount : next}
              disabled={submitting}
            >
              <ScaledText style={styles.primaryButtonText}>
                {branchScreen !== null
                  ? 'Next'
                  : step === 7
                    ? "Let's Begin"
                    : step === 8
                      ? 'Create Account & View Dashboard'
                      : 'Next'}
              </ScaledText>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <NumericPadModal
        visible={editField !== null}
        title={fieldConfig.title}
        value={fieldConfig.value}
        allowDecimal={fieldConfig.allowDecimal}
        onApply={fieldConfig.apply}
        onClose={() => setEditField(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: 8,
    paddingBottom: 24,
  },
  contentWithPinnedFooter: {
    paddingBottom: 96,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backTap: {
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 34,
    lineHeight: 34,
    color: colors.textPrimary,
  },
  stepText: {
    color: colors.textSecondary,
    fontSize: type.bodySm,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    height: 4,
    width: 20,
    borderRadius: 4,
    backgroundColor: '#d6dbe3',
  },
  dotActive: {
    backgroundColor: '#21242a',
  },
  screenBlock: {
    marginBottom: 16,
  },
  heroPanel: {
    minHeight: 230,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroImage: {
    width: 300,
    height: 300,
  },
  teamCard: {
    width: 220,
    borderRadius: 14,
    backgroundColor: '#e8edf6',
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamCardSmall: {
    width: 180,
    alignSelf: 'flex-end',
    backgroundColor: '#eef3fb',
  },
  teamPerson: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#5a86eb',
  },
  teamPersonAlt: {
    backgroundColor: '#8f9fb8',
  },
  teamLines: {
    flex: 1,
    gap: 6,
  },
  teamLine: {
    height: 8,
    borderRadius: 6,
    backgroundColor: '#c5d1e4',
  },
  title: {
    fontSize: type.h1,
    lineHeight: lineHeights.h1,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: type.body,
    lineHeight: lineHeights.body,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  stepperGroup: {
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#dde2ea',
    paddingBottom: 12,
  },
  stepperLabel: {
    color: colors.textPrimary,
    fontSize: type.body,
    marginBottom: 10,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#9ba3b1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 24,
  },
  valuePressTarget: {
    alignItems: 'center',
    flex: 1,
  },
  stepperValue: {
    color: colors.brand,
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
  },
  valueHint: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: type.caption,
  },
  infoBanner: {
    marginTop: 4,
    borderRadius: radii.md,
    backgroundColor: '#eaedf1',
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    color: colors.textSecondary,
    borderWidth: 1,
    borderColor: '#9ea6b4',
    fontSize: 13,
    fontWeight: '700',
  },
  infoBannerText: {
    color: colors.textSecondary,
    fontSize: type.bodySm,
    lineHeight: lineHeights.bodySm,
    flex: 1,
  },
  optionRow: {
    backgroundColor: '#eceff3',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eceff3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionRowActive: {
    borderColor: colors.brand,
    borderWidth: 2,
  },
  optionRowLocked: {
    opacity: 0.75,
  },
  optionTitle: {
    color: colors.textPrimary,
    fontSize: type.body,
    fontWeight: '600',
  },
  optionTextWrap: {
    flex: 1,
    gap: 2,
  },
  optionSubtitle: {
    color: colors.textSecondary,
    fontSize: type.caption,
    lineHeight: lineHeights.caption,
  },
  typePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typePillText: {
    color: '#fff',
    fontSize: type.caption,
    fontWeight: '700',
    lineHeight: lineHeights.caption,
  },
  optionCheck: {
    color: colors.brand,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22,
  },
  sectionHeading: {
    color: colors.textPrimary,
    fontSize: type.bodySm,
    fontWeight: '700',
    marginBottom: 8,
  },
  lockPill: {
    borderRadius: 999,
    backgroundColor: '#fdeecf',
    borderWidth: 1,
    borderColor: '#efd79a',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lockPillText: {
    color: '#8a6510',
    fontSize: type.caption,
    fontWeight: '700',
  },
  catalogToggle: {
    marginTop: 2,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  catalogToggleText: {
    color: colors.brand,
    fontSize: type.bodySm,
    fontWeight: '700',
  },
  catalogSection: {
    marginTop: 2,
  },
  previewHint: {
    marginTop: -4,
    marginBottom: 8,
    color: colors.textSecondary,
    fontSize: type.caption,
    lineHeight: lineHeights.caption,
  },
  teaserButton: {
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    backgroundColor: '#1d5eff',
    borderWidth: 1,
    borderColor: '#0f47d1',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  teaserButtonText: {
    color: '#fff',
    fontSize: type.body,
    fontWeight: '700',
  },
  teaserButtonSubtext: {
    marginTop: 4,
    color: '#dce7ff',
    fontSize: type.caption,
    lineHeight: lineHeights.caption,
    fontWeight: '600',
  },
  kpiInputCard: {
    borderRadius: radii.md,
    backgroundColor: '#eceff3',
    borderWidth: 1,
    borderColor: '#dde3ec',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 8,
  },
  readOnlyValueCard: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#d6dce8',
    backgroundColor: '#f7f9fc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  readOnlyValueLabel: {
    color: colors.textSecondary,
    fontSize: type.caption,
    lineHeight: lineHeights.caption,
    fontWeight: '600',
  },
  readOnlyValueText: {
    color: colors.textPrimary,
    fontSize: type.bodySm,
    fontWeight: '700',
  },
  kpiInputTitle: {
    color: colors.textPrimary,
    fontSize: type.body,
    fontWeight: '700',
  },
  kpiInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiInputLabel: {
    color: colors.textSecondary,
    fontSize: type.bodySm,
    fontWeight: '600',
  },
  kpiStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#9ba3b1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  miniBtnText: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '600',
  },
  kpiInputValue: {
    color: colors.textPrimary,
    fontSize: type.bodySm,
    fontWeight: '700',
    minWidth: 72,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.inputBg,
    padding: 14,
    fontSize: type.body,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: type.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 8,
  },
  lockedHeading: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: type.bodySm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  lockedCard: {
    borderRadius: radii.md,
    backgroundColor: '#eceff3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#dde3ec',
  },
  lockedKpiTitle: {
    fontSize: type.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  lockedKpiDesc: {
    marginTop: 2,
    fontSize: type.caption,
    lineHeight: lineHeights.caption,
    color: colors.textSecondary,
  },
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inlineInput: {
    flex: 1,
    marginBottom: 0,
  },
  sendBtn: {
    minWidth: 76,
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: type.bodySm,
    fontWeight: '600',
  },
  inviteActions: {
    gap: 8,
    marginBottom: 8,
  },
  inviteActionBtn: {
    borderRadius: radii.md,
    minHeight: 42,
    borderWidth: 1,
    borderColor: '#d4dbe7',
    backgroundColor: '#f3f6fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteActionText: {
    fontSize: type.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  friendRow: {
    borderRadius: radii.md,
    backgroundColor: '#eceff3',
    minHeight: 46,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendName: {
    fontSize: type.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  friendStatus: {
    fontSize: type.caption,
    color: colors.brand,
    fontWeight: '600',
  },
  inlineLink: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inlineLinkText: {
    fontSize: type.bodySm,
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: radii.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: type.button,
  },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: colors.darkButton,
    borderRadius: radii.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: type.bodySm,
  },
  disabledButton: {
    opacity: 0.6,
  },
  pinnedFooter: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    bottom: 16,
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    paddingBottom: 26,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: type.subtitle,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalValueBox: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    borderRadius: radii.md,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalValueText: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
  },
  padGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  padKey: {
    width: '31%',
    minHeight: 64,
    borderRadius: 14,
    backgroundColor: '#f0f3f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  padKeyDisabled: {
    opacity: 0.45,
  },
  padKeyText: {
    fontSize: 30,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.md,
    backgroundColor: colors.darkButton,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionText: {
    color: '#fff',
    fontSize: type.body,
    fontWeight: '600',
  },
  primaryAction: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.md,
    backgroundColor: colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#fff',
    fontSize: type.body,
    fontWeight: '600',
  },
});
