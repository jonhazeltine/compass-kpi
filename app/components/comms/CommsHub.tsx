/**
 * CommsHub — Messaging-first communications interface for Compass.
 *
 * Renders comms views based on `screen` prop:
 *   1. ChannelList  — direct default list (inbox + inbox_channels alias)
 *   2. ThreadView   — chat-style message bubbles + sticky composer
 *   3. BroadcastCompose — first-class broadcast authoring tool
 *
 * All data fetching / state lives in the parent (KPIDashboardScreen).
 * This component is purely presentational + handles local UI state.
 */
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  commsColors as C,
  commsRadii as R,
  commsSpace as S,
  commsType as T,
  commsAvatarSize,
  channelScopeVisual,
} from './commsTokens';
import {
  buildLegacyTaskStatusMap,
  parseThreadMessage,
  resolveThreadSendPayload,
  type LinkedTaskCard,
  type LinkedTaskType,
  type MediaAttachment,
  type ThreadSendPayload,
} from './messageLinkedTasks';
import BroadcastTargetHeader, { type BroadcastTargetHeaderProps, type TargetOption } from './BroadcastComposer';
import LiveThreadCard from './LiveThreadCard';
import ThreadComposer from './ThreadComposer';
import type { PickedFile } from './useThreadPickers';
import { VideoView, useVideoPlayer } from 'expo-video';

/* ================================================================
   TYPES
   ================================================================ */

export type CommsScreen = 'inbox' | 'inbox_channels' | 'channel_thread' | 'coach_broadcast_compose';
export type CommsPrimaryTab = 'all' | 'channels' | 'dms' | 'broadcast';
export type CommsScopeFilter = 'all' | 'team' | 'cohort' | 'global';

export interface ChannelRow {
  id: string;
  name: string;
  type?: string | null;
  scope: string;
  avatar_url?: string | null;
  avatar_label?: string | null;
  avatar_tone?: string | null;
  unread_count?: number | null;
  member_count?: number | null;
  my_role?: string | null;
  last_seen_at?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
  snippet?: string | null;
}

export interface MessageRow {
  id: string;
  channel_id: string;
  sender_user_id?: string | null;
  sender_name?: string | null;
  body: string;
  message_kind?: 'text' | 'personal_task' | 'coach_task' | string;
  linked_task_card?: LinkedTaskCard | null;
  media_attachment?: MediaAttachment;
  message_type?: 'message' | 'broadcast' | 'media_attachment' | string;
  created_at?: string | null;
}

export interface FallbackChannelRow {
  scope: string;
  label: string;
  context: string;
  avatar_url?: string | null;
  avatar_label?: string | null;
  avatar_tone?: string | null;
}

export interface FallbackDmRow {
  id: string;
  name: string;
  role: string;
  avatar_url?: string | null;
  avatar_label?: string | null;
  avatar_tone?: string | null;
}

export interface CommsHubProps {
  /* ── navigation ─── */
  screen: CommsScreen;
  primaryTab: CommsPrimaryTab;
  scopeFilter: CommsScopeFilter;
  searchQuery: string;
  onChangePrimaryTab: (tab: CommsPrimaryTab) => void;
  onChangeScopeFilter: (filter: CommsScopeFilter) => void;
  onChangeSearchQuery: (q: string) => void;
  onOpenChannel: (channelId: string, channelName: string, scope: string) => void;
  onOpenDm: (memberId: string, memberName: string) => void;
  onOpenBroadcast: () => void;
  onOpenChannelsCta: () => void;
  onBack: () => void;
  headerAvatarLabel?: string | null;
  headerAvatarTone?: string | null;
  headerAvatarKind?: 'dm' | 'team' | 'channel';
  onPressHeaderAvatar?: (() => void) | null;

  /* ── persona / role ─── */
  personaVariant: 'coach' | 'team_leader' | 'sponsor' | 'member' | 'solo';
  /** Broadcast tab + compose: visible for coach & team_leader, hidden for member/sponsor/solo */
  roleCanBroadcast: boolean;

  /* ── channel list data ─── */
  channels: ChannelRow[];
  channelsLoading: boolean;
  channelsError: string | null;
  onRetryChannels: () => void;
  fallbackChannels: FallbackChannelRow[];
  fallbackDms: FallbackDmRow[];
  useFallback: boolean;

  /* ── selected channel ─── */
  selectedChannelId: string | null;
  selectedChannelName: string | null;

  /* ── thread data ─── */
  messages: MessageRow[];
  messagesLoading: boolean;
  messagesError: string | null;
  currentUserId: string | null;

  /* ── message composer ─── */
  messageDraft: string;
  onChangeMessageDraft: (text: string) => void;
  messageSubmitting: boolean;
  messageSubmitError: string | null;
  onSendMessage: (payload: ThreadSendPayload) => void;
  onRefreshMessages: () => void;
  onOpenAiAssist: (host: string) => void;
  onSendLatestMediaAttachment: () => void;
  resolveMediaPlaybackUrl?: (mediaId: string) => Promise<string | null>;
  pendingMediaUpload?: {
    fileName: string;
    progress: number;
    status: 'picking' | 'uploading' | 'processing' | 'ready' | 'error';
    error?: string;
    uri?: string;
    contentType?: string;
    thumbnailUri?: string;
    sent?: boolean;
  } | null;
  localMediaPreviewById?: Record<string, {
    uri?: string;
    thumbnailUri?: string;
    contentType?: string;
  }>;
  onPickMediaFile?: (file: PickedFile) => void;
  onCancelMediaUpload: () => void;
  mediaUploadBusy: boolean;
  mediaUploadStatus: string | null;
  liveSessionBusy: boolean;
  liveSessionStatus: string | null;
  canHostLiveSession: boolean;
  liveCallerRole: 'host' | 'viewer' | null;
  livePlaybackUrl: string | null;
  liveStreamKey: string | null;
  liveProviderMode: 'mock' | 'mux' | 'unavailable' | null;
  liveSessionRecord?: { session_id: string; status: 'scheduled' | 'live' | 'ended' | 'cancelled'; [k: string]: unknown } | null;
  onGoLive: () => void;
  onRefreshLiveSession: () => void;
  onEndLiveSession: () => void;
  onPublishReplay?: () => void;
  replayBusy?: boolean;
  replayPublished?: boolean;
  composerBottomInset?: number;

  /* ── broadcast composer (legacy channel-scoped) ─── */
  broadcastDraft: string;
  onChangeBroadcastDraft: (text: string) => void;
  broadcastTargetScope: 'team' | 'cohort' | 'channel' | 'segment';
  broadcastTargetOptions: string[];
  onChangeBroadcastTarget: (scope: 'team' | 'cohort' | 'channel' | 'segment') => void;
  broadcastSubmitting: boolean;
  broadcastError: string | null;
  broadcastSuccessNote: string | null;
  broadcastAudienceLabel?: string | null;
  onSendBroadcast: () => void;

  /* ── broadcast campaign (target header for DM fan-out) ─── */
  broadcastCampaignProps?: BroadcastTargetHeaderProps | null;
  /** Callback when broadcast send is triggered via ThreadComposer */
  onSendBroadcastCampaign?: () => void;
  broadcastCampaignSubmitting?: boolean;
  /** Task draft for broadcast mode — set by broadcast task composer, consumed by campaign send */
  broadcastTaskDraft?: { task_type: 'personal_task' | 'assigned_task' | 'team_task'; title: string; description?: string | null; due_at?: string | null } | null;
  onSetBroadcastTaskDraft?: (draft: { task_type: 'personal_task' | 'assigned_task' | 'team_task'; title: string; description?: string | null; due_at?: string | null } | null) => void;

  /* ── package gate ─── */
  gateBlocksActions: boolean;

  /* ── helpers ─── */
  fmtTime: (iso: string | null | undefined) => string;
  fmtDate: (iso: string | null | undefined) => string;
}


/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function CommsHub(props: CommsHubProps) {
  const { screen, composerBottomInset, primaryTab } = props;
  const showBroadcastPanel = primaryTab === 'broadcast' || screen === 'coach_broadcast_compose';
  const threadEnterAnim = useRef(new Animated.Value(screen === 'channel_thread' ? 1 : 0)).current;
  const [threadOverlayVisible, setThreadOverlayVisible] = useState(screen === 'channel_thread');
  const latestThreadPropsRef = useRef<CommsHubProps>(props);
  if (screen === 'channel_thread') latestThreadPropsRef.current = props;

  useEffect(() => {
    if (screen === 'channel_thread') {
      setThreadOverlayVisible(true);
      Animated.timing(threadEnterAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
      return;
    }
    if (threadOverlayVisible) {
      Animated.timing(threadEnterAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setThreadOverlayVisible(false);
      });
    }
  }, [screen, threadEnterAnim, threadOverlayVisible]);

  const threadAnimatedStyle = {
    opacity: threadEnterAnim,
    transform: [
      {
        translateX: threadEnterAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [32, 0],
        }),
      },
    ],
  };

  return (
    <View style={[st.root, composerBottomInset ? { paddingBottom: composerBottomInset } : undefined]}>
      {/* ─── Top bar: persona badge + back nav ─── */}
      <CommsTopBar {...props} />

      {/* ─── Tab strip (hidden during thread & broadcast compose) ─── */}
      <CommsTabs {...props} />

      <View style={st.sceneViewport}>
        {screen !== 'channel_thread' ? (
          showBroadcastPanel ? (
            props.broadcastCampaignProps ? (
              <BroadcastCampaignPanel {...props} />
            ) : (
              <BroadcastComposeLegacy {...props} />
            )
          ) : (
            <ChannelList {...props} />
          )
        ) : null}
        {threadOverlayVisible ? (
          <Animated.View style={[st.threadSceneOverlay, threadAnimatedStyle]}>
            <ThreadView key={latestThreadPropsRef.current.selectedChannelId ?? 'thread'} {...latestThreadPropsRef.current} />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

/* ================================================================
   TOP BAR — persona badge + contextual back button
   ================================================================ */

function CommsTopBar(props: CommsHubProps) {
  const {
    screen,
    onBack,
    selectedChannelName,
    headerAvatarLabel,
    headerAvatarTone,
    headerAvatarKind,
    onPressHeaderAvatar,
  } = props;
  const showBack = screen === 'channel_thread';
  const showHeaderAvatar = screen === 'channel_thread';
  const resolvedAvatarLabel = String(headerAvatarLabel ?? '?').slice(0, 2);
  const resolvedAvatarTone =
    headerAvatarTone ?? (headerAvatarKind === 'team' ? '#dff0da' : headerAvatarKind === 'dm' ? '#e7eaf1' : '#eef2f8');
  const avatar = (
    <View style={[st.headerAvatar, { backgroundColor: resolvedAvatarTone }]}>
      <Text style={st.headerAvatarText}>{resolvedAvatarLabel}</Text>
    </View>
  );

  return (
    <View style={st.topBar}>
      {showBack ? (
        <Pressable style={st.backBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={st.backBtnIcon}>‹</Text>
          <Text style={st.backBtnText}>Back</Text>
        </Pressable>
      ) : (
        <Text style={st.topBarTitle}>Messages</Text>
      )}
      {showBack && selectedChannelName ? (
        <View style={st.topBarTitleWrap}>
          {showHeaderAvatar ? (
            onPressHeaderAvatar ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open conversation profile"
                onPress={onPressHeaderAvatar}
                style={st.headerAvatarPressable}
              >
                {avatar}
              </Pressable>
            ) : (
              avatar
            )
          ) : null}
          <Text style={st.topBarChannelName} numberOfLines={1}>{selectedChannelName}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
    </View>
  );
}

/* ================================================================
   TABS — primary tab strip + scope filter chips
   ================================================================ */

function CommsTabs(props: CommsHubProps) {
  const {
    primaryTab, onChangePrimaryTab,
    scopeFilter, onChangeScopeFilter,
    searchQuery, onChangeSearchQuery,
    roleCanBroadcast, screen, personaVariant,
  } = props;

  // Hide tab strip only in deep thread view.
  if (screen === 'channel_thread') return null;

  const tabs: { key: CommsPrimaryTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'channels', label: 'Channels' },
    { key: 'dms', label: 'DMs' },
    ...(roleCanBroadcast ? [{ key: 'broadcast' as const, label: 'Broadcast' }] : []),
  ];

  const scopeFilters: { key: CommsScopeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'team', label: 'Team' },
    { key: 'cohort', label: 'Cohort' },
    ...(personaVariant === 'coach' ? [{ key: 'global' as const, label: 'Global' }] : []),
  ];

  const placeholder =
    primaryTab === 'dms'
      ? 'Search people...'
      : primaryTab === 'channels'
        ? scopeFilter === 'all'
          ? 'Search channels...'
          : `Search ${scopeFilter} channels...`
        : primaryTab === 'broadcast'
          ? 'Search broadcast destinations...'
        : 'Search messages...';

  return (
    <View style={st.tabSection}>
      {/* Primary tabs */}
      <View style={st.tabRow}>
        {tabs.map((tab) => {
          const active = primaryTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[st.tab, active && st.tabActive]}
              onPress={() => onChangePrimaryTab(tab.key)}
            >
              <Text style={[st.tabText, active && st.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Scope filter chips (channels only) */}
      {primaryTab === 'channels' ? (
        <View style={st.filterRow}>
          {scopeFilters.map((f) => {
            const active = scopeFilter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[st.filterChip, active && st.filterChipActive]}
                onPress={() => onChangeScopeFilter(f.key)}
              >
                <Text style={[st.filterChipText, active && st.filterChipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Search bar */}
      <View style={st.searchWrap}>
        <Text style={st.searchIcon}>⌕</Text>
        <TextInput
          value={searchQuery}
          onChangeText={onChangeSearchQuery}
          placeholder={placeholder}
          placeholderTextColor={C.textTertiary}
          style={st.searchInput}
          autoFocus={primaryTab === 'dms' && searchQuery.trim().length > 0}
        />
      </View>
    </View>
  );
}

/* ================================================================
   CHANNEL LIST — messaging-app inbox rows
   ================================================================ */

function ChannelList(props: CommsHubProps) {
  const {
    channels, channelsLoading, channelsError, onRetryChannels,
    primaryTab, scopeFilter, searchQuery,
    onOpenChannel, onOpenDm, onOpenBroadcast,
    useFallback, fallbackChannels, fallbackDms,
    selectedChannelId, gateBlocksActions, fmtTime, fmtDate,
  } = props;

  /* ── filter & search ── */
  const filteredChannels = useMemo(() => {
    let rows = channels;
    // tab filter
    if (primaryTab === 'dms') {
      rows = rows.filter((r) => r.scope === 'dm' || r.type === 'direct');
    } else if (primaryTab === 'channels') {
      rows = rows.filter((r) => r.scope !== 'dm' && r.type !== 'direct');
    }
    // scope filter
    if (primaryTab === 'channels' && scopeFilter !== 'all') {
      rows = rows.filter((r) => {
        if (scopeFilter === 'team') return r.scope === 'team';
        if (scopeFilter === 'cohort') return r.scope === 'cohort';
        if (scopeFilter === 'global') return r.scope === 'community';
        return true;
      });
    }
    // search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    return rows;
  }, [channels, primaryTab, scopeFilter, searchQuery]);

  /* ── loading ── */
  if (channelsLoading && channels.length === 0) {
    return (
      <View style={st.emptyState}>
        <ActivityIndicator size="small" color={C.brand} />
        <Text style={st.emptyTitle}>Loading channels…</Text>
      </View>
    );
  }

  /* ── error ── */
  if (channelsError) {
    return (
      <View style={st.emptyState}>
        <Text style={st.emptyIcon}>⚠</Text>
        <Text style={st.emptyTitle}>Couldn't load channels</Text>
        <Text style={st.emptySub}>{channelsError}</Text>
        <Pressable style={st.retryBtn} onPress={onRetryChannels}>
          <Text style={st.retryBtnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  /* ── channel rows ── */
  const showApiRows = filteredChannels.length > 0;
  const showFallback = !showApiRows && useFallback;
  const showEmpty = !showApiRows && !showFallback;

  return (
    <ScrollView style={st.channelScroll} contentContainerStyle={st.channelScrollInner}>
      {/* API channel rows */}
      {showApiRows
        ? filteredChannels.map((row) => (
            <ChannelRowItem
              key={row.id}
              row={row}
              isSelected={String(row.id) === String(selectedChannelId ?? '')}
              disabled={gateBlocksActions}
              fmtTime={fmtTime}
              fmtDate={fmtDate}
              onPress={() => onOpenChannel(String(row.id), row.name, row.scope)}
            />
          ))
        : null}

      {/* Fallback DMs */}
      {showFallback && primaryTab === 'dms'
        ? fallbackDms.map((dm) => (
            <DmRowItem
              key={dm.id}
              row={dm}
              disabled={gateBlocksActions}
              onPress={() => onOpenDm(dm.id, dm.name)}
            />
          ))
        : null}

      {/* Fallback channels */}
      {showFallback && primaryTab !== 'dms'
        ? fallbackChannels.map((ch) => (
            <FallbackChannelRowItem
              key={ch.label}
              row={ch}
              disabled={gateBlocksActions}
              onPress={() => onOpenChannel(ch.label, ch.label, ch.scope)}
            />
          ))
        : null}

      {/* Empty */}
      {showEmpty ? (
        <View style={st.emptyState}>
          <Text style={st.emptyIcon}>{primaryTab === 'dms' ? '💬' : '📨'}</Text>
          <Text style={st.emptyTitle}>
            {primaryTab === 'dms' ? 'No direct messages' : 'No channels found'}
          </Text>
          <Text style={st.emptySub}>
            {primaryTab === 'dms'
              ? 'Direct messages will appear here once started.'
              : 'Try adjusting your filters or check back later.'}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

/* ── Individual channel row (API data) ── */

function ChannelAvatarCircle({
  avatarUrl,
  avatarLabel,
  avatarTone,
  fallbackIcon,
  fallbackBg,
  fallbackFg,
}: {
  avatarUrl?: string | null;
  avatarLabel?: string | null;
  avatarTone?: string | null;
  fallbackIcon: string;
  fallbackBg: string;
  fallbackFg: string;
}) {
  const normalizedUrl = String(avatarUrl ?? '').trim();
  const hasHttpAvatar = /^https?:\/\//i.test(normalizedUrl);
  const label = String(avatarLabel ?? '').trim();
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [normalizedUrl]);

  const resolvedBg = String(avatarTone ?? '').trim() || fallbackBg;
  const resolvedLabel = label || fallbackIcon;
  const isFallbackIcon = !label;

  return (
    <View style={[st.channelAvatar, { backgroundColor: resolvedBg }]}>
      {hasHttpAvatar && !avatarLoadFailed ? (
        <Image
          source={{ uri: normalizedUrl }}
          style={st.channelAvatarImage}
          resizeMode="cover"
          onError={() => setAvatarLoadFailed(true)}
        />
      ) : (
        <Text
          style={[
            st.channelAvatarIcon,
            {
              color: isFallbackIcon ? fallbackFg : C.textPrimary,
              fontSize: resolvedLabel.length <= 2 ? 15 : 13,
            },
          ]}
        >
          {resolvedLabel}
        </Text>
      )}
    </View>
  );
}

function ChannelRowItem({
  row,
  isSelected,
  disabled,
  fmtTime,
  fmtDate,
  onPress,
}: {
  row: ChannelRow;
  isSelected: boolean;
  disabled: boolean;
  fmtTime: (iso: string | null | undefined) => string;
  fmtDate: (iso: string | null | undefined) => string;
  onPress: () => void;
}) {
  const vis = channelScopeVisual(row.scope);
  const hasUnread = Number(row.unread_count ?? 0) > 0;
  const timeLabel = row.last_message_at
    ? fmtTime(row.last_message_at)
    : row.last_seen_at
      ? fmtTime(row.last_seen_at)
      : row.created_at
        ? fmtDate(row.created_at)
        : '';
  const snippet = row.snippet || (row.member_count ? `${row.member_count} members` : 'No messages yet');

  return (
    <Pressable
      style={[st.channelRow, isSelected && st.channelRowSelected, disabled && st.channelRowDisabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <ChannelAvatarCircle
        avatarUrl={row.avatar_url}
        avatarLabel={row.avatar_label}
        avatarTone={row.avatar_tone}
        fallbackIcon={vis.icon}
        fallbackBg={vis.bg}
        fallbackFg={vis.fg}
      />

      {/* Body: title row + snippet */}
      <View style={st.channelBody}>
        <View style={st.channelTitleRow}>
          <Text
            numberOfLines={1}
            style={[st.channelTitle, hasUnread && st.channelTitleUnread]}
          >
            {row.name}
          </Text>
          {timeLabel ? <Text style={st.channelTime}>{timeLabel}</Text> : null}
        </View>
        <View style={st.channelSnippetRow}>
          <Text numberOfLines={1} style={[st.channelSnippet, hasUnread && st.channelSnippetUnread]}>
            {snippet}
          </Text>
          {hasUnread ? (
            <View style={st.unreadBadge}>
              <Text style={st.unreadBadgeText}>{row.unread_count}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/* ── DM row (fallback) ── */

function DmRowItem({
  row,
  disabled,
  onPress,
}: {
  row: FallbackDmRow;
  disabled: boolean;
  onPress: () => void;
}) {
  const vis = channelScopeVisual('dm');
  const initials =
    row.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'DM';

  return (
    <Pressable style={[st.channelRow, disabled && st.channelRowDisabled]} disabled={disabled} onPress={onPress}>
      <ChannelAvatarCircle
        avatarUrl={row.avatar_url}
        avatarLabel={row.avatar_label ?? initials}
        avatarTone={row.avatar_tone}
        fallbackIcon={vis.icon}
        fallbackBg={vis.bg}
        fallbackFg={vis.fg}
      />
      <View style={st.channelBody}>
        <Text numberOfLines={1} style={st.channelTitle}>{row.name}</Text>
        <Text numberOfLines={1} style={st.channelSnippet}>{row.role} · Direct message</Text>
      </View>
    </Pressable>
  );
}

/* ── Fallback channel row ── */

function FallbackChannelRowItem({
  row,
  disabled,
  onPress,
}: {
  row: FallbackChannelRow;
  disabled: boolean;
  onPress: () => void;
}) {
  const vis = channelScopeVisual(row.scope);

  return (
    <Pressable style={[st.channelRow, disabled && st.channelRowDisabled]} disabled={disabled} onPress={onPress}>
      <ChannelAvatarCircle
        avatarUrl={row.avatar_url}
        avatarLabel={row.avatar_label}
        avatarTone={row.avatar_tone}
        fallbackIcon={vis.icon}
        fallbackBg={vis.bg}
        fallbackFg={vis.fg}
      />
      <View style={st.channelBody}>
        <Text numberOfLines={1} style={st.channelTitle}>{row.label}</Text>
        <Text numberOfLines={1} style={st.channelSnippet}>{row.context}</Text>
      </View>
    </Pressable>
  );
}

/* ================================================================
   THREAD VIEW — chat bubbles + sticky composer
   ================================================================ */

function ThreadView(props: CommsHubProps) {
  const {
    messages, messagesLoading, messagesError,
    currentUserId, selectedChannelId, selectedChannelName,
    messageDraft, onChangeMessageDraft,
    messageSubmitting, messageSubmitError,
    onSendMessage, onRefreshMessages, onOpenAiAssist, onOpenBroadcast,
    onSendLatestMediaAttachment, resolveMediaPlaybackUrl, pendingMediaUpload, onPickMediaFile, onCancelMediaUpload, mediaUploadBusy, mediaUploadStatus,
    localMediaPreviewById = {},
    liveSessionBusy, liveSessionStatus, canHostLiveSession, liveCallerRole, livePlaybackUrl, liveStreamKey, liveProviderMode,
    liveSessionRecord, onGoLive, onRefreshLiveSession, onEndLiveSession,
    onPublishReplay, replayBusy = false, replayPublished = false,
    composerBottomInset = 0,
    gateBlocksActions, fmtTime, fmtDate, personaVariant, roleCanBroadcast,
  } = props;

  const scrollRef = useRef<ScrollView>(null);
  const [slashHintError, setSlashHintError] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(96);
  const [taskComposerOpen, setTaskComposerOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueAt, setTaskDueAt] = useState('');
  const [taskDueDateValue, setTaskDueDateValue] = useState<Date | null>(null);
  const [taskAssigneeId, setTaskAssigneeId] = useState<string | null>(null);
  const [taskDatePickerOpen, setTaskDatePickerOpen] = useState(false);

  const canUseTaskCommands = personaVariant !== 'sponsor';
  const canAuthorCoachTask = personaVariant === 'coach' || personaVariant === 'team_leader';
  const showSlashMenu = messageDraft.trim().startsWith('/');
  const threadDockInset = keyboardVisible
    ? keyboardHeight + composerHeight + 20
    : composerHeight + composerBottomInset + 20;
  const parsedMessages = useMemo(
    () => messages.map((msg) => ({ msg, parsed: parseThreadMessage(msg) })),
    [messages]
  );
  const taskStatusMap = useMemo(() => buildLegacyTaskStatusMap(parsedMessages), [parsedMessages]);
  const taskAssigneeOptions = useMemo(() => {
    const rows = [
      { id: String(currentUserId ?? ''), name: 'You', role: personaVariant },
      ...props.fallbackDms.map((row) => ({ id: row.id, name: row.name, role: row.role })),
    ].filter((row) => row.id);
    const seen = new Set<string>();
    return rows.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [currentUserId, personaVariant, props.fallbackDms]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  useEffect(() => {
    if (!keyboardVisible) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
    return () => clearTimeout(timer);
  }, [keyboardVisible]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(Math.max(0, event.endCoordinates?.height ?? 0));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!taskComposerOpen) return;
    if (canAuthorCoachTask) {
      if (!taskAssigneeId) {
        const preferred = taskAssigneeOptions.find((row) => row.id !== String(currentUserId ?? '')) ?? taskAssigneeOptions[0] ?? null;
        setTaskAssigneeId(preferred?.id ?? null);
      }
      return;
    }
    setTaskAssigneeId(String(currentUserId ?? '') || null);
  }, [canAuthorCoachTask, currentUserId, taskAssigneeId, taskAssigneeOptions, taskComposerOpen]);

  const slashItems = useMemo(() => {
    const roleScoped = [
      ...(canUseTaskCommands
        ? [
            { command: '/task', help: 'Create task card: /task title | owner | due YYYY-MM-DD' },
            { command: '/task-update', help: 'Update task: /task-update task_id done|open|blocked | note' },
          ]
        : []),
      ...(roleCanBroadcast ? [{ command: '/broadcast', help: 'Open broadcast composer' }] : []),
      { command: '/help', help: 'List available slash commands' },
    ];
    const query = messageDraft.trim().toLowerCase();
    return roleScoped.filter((item) => item.command.toLowerCase().startsWith(query));
  }, [canUseTaskCommands, messageDraft, roleCanBroadcast]);

  const onSlashInsert = (command: string) => {
    if (command === '/task') {
      onChangeMessageDraft('/task Follow up with buyer | Sarah Johnson | 2026-03-05');
      setSlashHintError(null);
      return;
    }
    if (command === '/task-update') {
      onChangeMessageDraft('/task-update task-abc123 done | Completed outreach');
      setSlashHintError(null);
      return;
    }
    if (command === '/broadcast') {
      onOpenBroadcast();
      return;
    }
    if (command === '/help') {
      onChangeMessageDraft(
        canUseTaskCommands
          ? '/task, /task-update' + (roleCanBroadcast ? ', /broadcast' : '')
          : roleCanBroadcast
            ? '/broadcast'
            : 'No slash commands for this role'
      );
    }
  };

  const handleSend = () => {
    if (gateBlocksActions || messageSubmitting || !selectedChannelId) return;
    const resolved = resolveThreadSendPayload({
      draft: messageDraft,
      personaVariant,
      currentUserId,
      selectedChannelName,
      directory: props.fallbackDms.map((row) => ({ id: row.id, name: row.name, role: row.role })),
      messages,
      pendingAttachments: [],
      roleCanBroadcast,
    });
    if (resolved.action === 'open_broadcast') {
      onOpenBroadcast();
      onChangeMessageDraft('');
      setSlashHintError(null);
      return;
    }
    if (resolved.action === 'error' || !resolved.payload) {
      setSlashHintError(resolved.error ?? 'Unable to send message.');
      return;
    }

    setSlashHintError(null);
    onSendMessage(resolved.payload);
    onChangeMessageDraft('');
  };

  const resetTaskComposer = () => {
    setTaskComposerOpen(false);
    setTaskTitle('');
    setTaskDescription('');
    setTaskDueAt('');
    setTaskDueDateValue(null);
    setTaskDatePickerOpen(false);
    setTaskAssigneeId(canAuthorCoachTask ? null : String(currentUserId ?? '') || null);
  };

  const formatTaskDueDate = (value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleTaskDateChange = (event: DateTimePickerEvent, value?: Date) => {
    setTaskDatePickerOpen(false);
    if (event.type === 'dismissed' || !value) return;
    setTaskDueDateValue(value);
    setTaskDueAt(formatTaskDueDate(value));
  };

  const handleSendTask = () => {
    if (gateBlocksActions || messageSubmitting || !selectedChannelId) return;
    const trimmedTitle = taskTitle.trim();
    if (!trimmedTitle) {
      setSlashHintError('Task title is required.');
      return;
    }
    const assigneeId = canAuthorCoachTask
      ? String(taskAssigneeId ?? '').trim()
      : String(currentUserId ?? '').trim();
    if (!assigneeId) {
      setSlashHintError('Choose an assignee before sending the task.');
      return;
    }
    const taskType: LinkedTaskType = canAuthorCoachTask ? 'coach_task' : 'personal_task';
    setSlashHintError(null);
    onSendMessage({
      message_kind: taskType,
      task_action: 'create',
      task_card_draft: {
        task_type: taskType,
        title: trimmedTitle,
        description: taskDescription.trim() || undefined,
        assignee_id: assigneeId,
        due_at: taskDueAt.trim() || undefined,
        status: 'pending',
      },
    });
    resetTaskComposer();
  };

  const liveCardStatus = liveSessionStatus
    ?? (liveCallerRole === 'host'
      ? 'Broadcast ready to start'
      : liveCallerRole === 'viewer'
        ? 'Broadcast available to watch'
        : null);
  const showLiveCard = Boolean(
    liveCardStatus
      || livePlaybackUrl
      || liveStreamKey
      || liveSessionBusy
  );

  const openAttachmentUrl = async (url: string | null | undefined) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // noop; attachment remains visible even if URL open fails
    }
  };

  return (
    <View style={st.threadRoot}>
      <ScrollView
        ref={scrollRef}
        style={st.threadScroll}
        contentContainerStyle={[
          st.threadScrollInner,
          { paddingBottom: 12 + threadDockInset },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {messagesLoading && parsedMessages.length === 0 ? (
          <View style={st.threadEmpty}>
            <Text style={st.emptyIcon}>💬</Text>
            <Text style={st.emptyTitle}>Loading messages…</Text>
          </View>
        ) : messagesError ? (
          <View style={st.threadEmpty}>
            <Text style={st.emptyIcon}>⚠</Text>
            <Text style={st.emptyTitle}>Messages failed to load</Text>
            <Text style={st.emptySub}>{messagesError}</Text>
            <Pressable style={st.retryBtn} onPress={onRefreshMessages}>
              <Text style={st.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : parsedMessages.length > 0 ? (
          parsedMessages.map(({ msg, parsed }, idx) => {
            const isMine = String(msg.sender_user_id ?? '') === String(currentUserId ?? '');
            const isBroadcast = String(msg.message_type ?? '') === 'broadcast';
            const prev = idx > 0 ? parsedMessages[idx - 1].msg : null;
            const startsGroup = !prev || String(prev.sender_user_id ?? '') !== String(msg.sender_user_id ?? '');
            const senderLabel = msg.sender_name || (isMine ? 'You' : 'Member');
            const time = fmtTime(msg.created_at);
            const legacyTaskCardStatus = parsed.legacyTaskCard
              ? taskStatusMap.get(parsed.legacyTaskCard.taskId) ?? parsed.legacyTaskCard.status
              : null;
            const mediaCaption = String(parsed.mediaAttachment?.caption ?? '').trim();
            const mediaAutoNamed = /^media attachment$/i.test(parsed.text)
              || /^media:\s/i.test(parsed.text)
              || /^[a-f0-9-]{20,}\.(png|jpe?g|gif|webp|heic)$/i.test(mediaCaption)
              || /^capture-\d+\.(mp4|mov)$/i.test(mediaCaption);
            const isTaskMessage = Boolean(parsed.linkedTaskCard || parsed.legacyTaskCard);
            const showMessageText = Boolean(parsed.text) && !(parsed.mediaAttachment && mediaAutoNamed) && !isTaskMessage;
            const isStructuredMediaBubble = Boolean(parsed.mediaAttachment);
            const mediaTitle =
              !mediaAutoNamed && mediaCaption
                ? mediaCaption
                : parsed.mediaAttachment?.content_type?.startsWith('video/')
                  ? 'Video'
                  : parsed.mediaAttachment?.content_type?.startsWith('image/')
                    ? ''
                    : 'Attachment';

            const localPreview = parsed.mediaAttachment?.media_id
              ? localMediaPreviewById[parsed.mediaAttachment.media_id] ?? null
              : null;
            return (
              <View
                key={msg.id}
                style={[
                  st.bubbleWrap,
                  isMine ? st.bubbleWrapSent : st.bubbleWrapReceived,
                  !startsGroup && st.bubbleWrapFollow,
                ]}
              >
                {startsGroup ? (
                  <View style={[st.bubbleMetaRow, isMine && st.bubbleMetaRowSent]}>
                    <Text style={st.bubbleSender}>{senderLabel}</Text>
                    <Text style={st.bubbleTime}>{time}</Text>
                  </View>
                ) : null}
                <View
                  style={[
                    st.bubble,
                    isStructuredMediaBubble && st.bubbleMedia,
                    !isStructuredMediaBubble && isMine
                      ? st.bubbleSent
                      : !isStructuredMediaBubble && isBroadcast
                        ? st.bubbleBroadcast
                        : st.bubbleReceived,
                    !startsGroup && st.bubbleFollow,
                  ]}
                >
                  {showMessageText ? (
                    <Text
                      style={[
                        st.bubbleText,
                        isMine
                          ? st.bubbleTextSent
                          : isBroadcast
                            ? st.bubbleTextBroadcast
                            : st.bubbleTextReceived,
                      ]}
                    >
                      {parsed.text}
                    </Text>
                  ) : null}
                  {parsed.linkedTaskCard ? (
                    <View style={[st.taskCard, isMine ? st.taskCardSent : st.taskCardReceived]}>
                      <View style={st.taskCardHead}>
                        <Text style={st.taskCardTitle}>
                          {parsed.linkedTaskCard.task_type === 'coach_task' ? 'Coach Task' : 'Personal Task'}
                        </Text>
                        <Text
                          style={[
                            st.taskCardStatus,
                            parsed.linkedTaskCard.status === 'completed'
                              ? st.taskCardStatusDone
                              : parsed.linkedTaskCard.status === 'in_progress'
                                ? st.taskCardStatusActive
                                : st.taskCardStatusPending,
                          ]}
                        >
                          {String(parsed.linkedTaskCard.status ?? 'pending').replace('_', ' ')}
                        </Text>
                      </View>
                      <Text
                        style={[
                          st.taskCardBody,
                          parsed.linkedTaskCard.status === 'completed' && st.taskCardBodyCompleted,
                        ]}
                      >
                        {parsed.linkedTaskCard.title}
                      </Text>
                      {parsed.linkedTaskCard.description ? (
                        <Text
                          style={[
                            st.taskCardDescription,
                            parsed.linkedTaskCard.status === 'completed' && st.taskCardDescriptionCompleted,
                          ]}
                        >
                          {parsed.linkedTaskCard.description}
                        </Text>
                      ) : null}
                      <View style={st.taskCardMetaRow}>
                        {parsed.linkedTaskCard.assignee?.display_name ? (
                          <Text style={st.taskCardMetaPill}>Owner: {parsed.linkedTaskCard.assignee.display_name}</Text>
                        ) : null}
                        {parsed.linkedTaskCard.due_at ? (
                          <Text style={st.taskCardMetaPill}>Due: {fmtDate(parsed.linkedTaskCard.due_at)}</Text>
                        ) : null}
                      </View>
                      {(parsed.linkedTaskCard.status !== 'completed'
                        ? parsed.linkedTaskCard.rights?.can_mark_complete
                        : parsed.linkedTaskCard.rights?.can_update_status) ? (
                        <Pressable
                          style={st.taskCardActionBtn}
                          onPress={() => onSendMessage({
                            body: undefined,
                            message_kind: parsed.linkedTaskCard?.task_type,
                            task_action: parsed.linkedTaskCard?.status === 'completed' ? 'update' : 'complete',
                            task_card_draft: {
                              task_type: parsed.linkedTaskCard?.task_type,
                              task_id: parsed.linkedTaskCard?.task_id,
                              ...(parsed.linkedTaskCard?.status === 'completed' ? { status: 'pending' as const } : {}),
                            },
                          })}
                        >
                          <Text style={st.taskCardActionBtnText}>
                            {parsed.linkedTaskCard.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  {parsed.legacyTaskCard ? (
                    <View style={[st.taskCard, isMine ? st.taskCardSent : st.taskCardReceived]}>
                      <View style={st.taskCardHead}>
                        <Text style={st.taskCardTitle}>Task</Text>
                        <Text style={[st.taskCardStatus, st.taskCardStatusPending]}>{String(legacyTaskCardStatus ?? 'open').toLowerCase()}</Text>
                      </View>
                      <Text style={st.taskCardBody}>{parsed.legacyTaskCard.title}</Text>
                      <View style={st.taskCardMetaRow}>
                        {parsed.legacyTaskCard.owner ? <Text style={st.taskCardMetaPill}>Owner: {parsed.legacyTaskCard.owner}</Text> : null}
                        {parsed.legacyTaskCard.due ? <Text style={st.taskCardMetaPill}>Due: {parsed.legacyTaskCard.due}</Text> : null}
                      </View>
                    </View>
                  ) : null}
                  {parsed.legacyTaskUpdate ? (
                    <View style={st.taskUpdateCard}>
                      <Text style={st.taskUpdateText}>
                        Task #{parsed.legacyTaskUpdate.taskId}: {parsed.legacyTaskUpdate.status.toUpperCase()}
                      </Text>
                      {parsed.legacyTaskUpdate.note ? <Text style={st.taskUpdateNote}>{parsed.legacyTaskUpdate.note}</Text> : null}
                    </View>
                  ) : null}
                  {parsed.attachments.length > 0 ? (
                    <View style={st.attachmentsWrap}>
                      {parsed.attachments.map((att, aIdx) => (
                        <View key={`${msg.id}-att-${aIdx}`} style={st.attachmentChip}>
                          <Text style={st.attachmentChipText}>
                            {att.kind === 'image' ? '🖼' : att.kind === 'doc' ? '📄' : '🔗'} {att.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {parsed.mediaAttachment ? (
                    <View
                      style={st.mediaAttachmentCard}
                    >
                      {(parsed.mediaAttachment.file_url || localPreview?.thumbnailUri || localPreview?.uri) && parsed.mediaAttachment.content_type?.startsWith('image/') ? (
                        <View style={st.inlineImageWrap}>
                          <Image
                            source={{ uri: parsed.mediaAttachment.file_url || localPreview?.thumbnailUri || localPreview?.uri }}
                            style={st.mediaAttachmentPreview}
                            resizeMode="cover"
                          />
                        </View>
                      ) : parsed.mediaAttachment.content_type?.startsWith('video/') ? (
                        <InlineVideoAttachment
                          media={parsed.mediaAttachment}
                          resolvePlaybackUrl={resolveMediaPlaybackUrl}
                          localPreviewUri={localPreview?.thumbnailUri || localPreview?.uri || null}
                        />
                      ) : (
                        <Pressable
                          style={st.mediaAttachmentPreviewFallback}
                          disabled={!parsed.mediaAttachment.file_url}
                          onPress={() => void openAttachmentUrl(parsed.mediaAttachment?.file_url)}
                        >
                          <Text style={st.mediaAttachmentPreviewFallbackIcon}>
                            {parsed.mediaAttachment.content_type?.startsWith('video/')
                              ? '▶'
                              : parsed.mediaAttachment.content_type?.startsWith('image/')
                                ? '🖼'
                                : '📄'}
                          </Text>
                        </Pressable>
                      )}
                      {!parsed.mediaAttachment.content_type?.startsWith('image/')
                        && !parsed.mediaAttachment.content_type?.startsWith('video/') ? (
                        <View style={st.mediaAttachmentBody}>
                          <View style={st.mediaAttachmentMetaRow}>
                            {mediaTitle ? (
                              <Text style={st.mediaAttachmentTitle} numberOfLines={1}>
                                {mediaTitle}
                              </Text>
                            ) : <View style={st.mediaAttachmentSpacer} />}
                            <Text style={st.mediaAttachmentState}>
                              {parsed.mediaAttachment.lifecycle?.processing_status
                                ? String(parsed.mediaAttachment.lifecycle.processing_status).replace(/_/g, ' ')
                                : parsed.mediaAttachment.file_url
                                  ? 'ready'
                                  : 'file'}
                            </Text>
                          </View>
                          <Text style={st.mediaAttachmentSub}>
                            {parsed.mediaAttachment.file_url
                              ? 'Tap to open'
                              : 'Attachment uploaded'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  {isBroadcast ? (
                    <View style={st.broadcastTag}>
                      <Text style={st.broadcastTagText}>Broadcast</Text>
                    </View>
                  ) : null}
                </View>
                {!startsGroup ? (
                  <Text style={[st.bubbleTimeInline, isMine && st.bubbleTimeInlineSent]}>{time}</Text>
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={st.threadEmpty}>
            <Text style={st.emptyIcon}>💬</Text>
            <Text style={st.emptyTitle}>
              {selectedChannelId ? 'No messages yet' : 'Select a channel'}
            </Text>
            <Text style={st.emptySub}>
              {selectedChannelId
                ? 'Be the first to send a message in this channel.'
                : 'Pick a channel from the inbox to start messaging.'}
            </Text>
          </View>
        )}
        {showLiveCard ? (
          <LiveThreadCard
            status={liveCardStatus}
            canHost={canHostLiveSession}
            callerRole={liveCallerRole}
            playbackUrl={livePlaybackUrl}
            streamKey={liveStreamKey}
            providerMode={liveProviderMode}
            busy={liveSessionBusy}
            gateBlocksActions={gateBlocksActions}
            sessionStatus={liveSessionRecord?.status ?? null}
            onWatch={() => {/* inline player handled inside LiveThreadCard */}}
            onEnd={onEndLiveSession}
            onRefresh={canHostLiveSession && !liveCallerRole ? onGoLive : onRefreshLiveSession}
            onPublishReplay={onPublishReplay}
            replayBusy={replayBusy}
            replayPublished={replayPublished}
          />
        ) : null}
      </ScrollView>
      {(mediaUploadBusy || liveSessionBusy) ? (
        <View style={st.composerStatusToast}>
          <Text style={st.composerStatusText}>
            {mediaUploadBusy ? (mediaUploadStatus ?? 'Uploading…') : (liveSessionStatus ?? 'Working…')}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          st.threadDock,
          keyboardVisible && Platform.OS === 'ios' ? { bottom: Math.max(0, keyboardHeight) } : null,
        ]}
      >
      {(messageSubmitError || slashHintError) ? (
        <View style={st.composerError}>
          <Text style={st.composerErrorText}>{messageSubmitError ?? slashHintError}</Text>
        </View>
      ) : null}
      {showSlashMenu ? (
        <View style={st.slashMenu}>
          {slashItems.length > 0 ? (
            slashItems.map((item) => (
              <Pressable key={item.command} style={st.slashItem} onPress={() => onSlashInsert(item.command)}>
                <Text style={st.slashCmd}>{item.command}</Text>
                <Text style={st.slashHelp}>{item.help}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={st.slashEmpty}>No available commands for this role.</Text>
          )}
        </View>
      ) : null}
      {!keyboardVisible ? (
      <View style={st.threadUtilityRow}>
        <Pressable
          style={[st.threadUtilityPill, gateBlocksActions && st.threadUtilityPillDisabled]}
          disabled={gateBlocksActions}
          onPress={() => onOpenAiAssist('channel_thread')}
        >
          <Text style={st.threadUtilityPillText}>AI Draft</Text>
        </Pressable>
        <Pressable
          style={[st.threadUtilityPill, messageSubmitting && st.threadUtilityPillDisabled]}
          disabled={messageSubmitting}
          onPress={onRefreshMessages}
        >
          <Text style={st.threadUtilityPillText}>Refresh</Text>
        </Pressable>
        {roleCanBroadcast ? (
          <Pressable
            style={[st.threadUtilityPill, gateBlocksActions && st.threadUtilityPillDisabled]}
            disabled={gateBlocksActions}
            onPress={onOpenBroadcast}
          >
            <Text style={st.threadUtilityPillText}>Broadcast</Text>
          </Pressable>
        ) : null}
      </View>
      ) : null}
      {taskComposerOpen ? (
        <View style={st.taskComposerCard}>
          <View style={st.taskComposerHeader}>
            <Text style={st.taskComposerTitle}>{canAuthorCoachTask ? 'New Coach Task' : 'New Personal Task'}</Text>
            <Pressable onPress={resetTaskComposer} hitSlop={8}>
              <Text style={st.taskComposerClose}>✕</Text>
            </Pressable>
          </View>
          <TextInput
            value={taskTitle}
            onChangeText={setTaskTitle}
            placeholder="Task name"
            placeholderTextColor={C.textTertiary}
            style={st.taskComposerInput}
          />
          <TextInput
            value={taskDescription}
            onChangeText={setTaskDescription}
            placeholder="Description"
            placeholderTextColor={C.textTertiary}
            multiline
            style={[st.taskComposerInput, st.taskComposerTextarea]}
          />
          {canAuthorCoachTask ? (
            <View style={st.taskComposerChips}>
              {taskAssigneeOptions.map((option) => (
                <Pressable
                  key={option.id}
                  style={[st.taskComposerChip, taskAssigneeId === option.id && st.taskComposerChipActive]}
                  onPress={() => setTaskAssigneeId(option.id)}
                >
                  <Text style={[st.taskComposerChipText, taskAssigneeId === option.id && st.taskComposerChipTextActive]}>
                    {option.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={st.taskComposerMeta}>Assignee: You</Text>
          )}
          <Pressable style={st.taskComposerDateBtn} onPress={() => setTaskDatePickerOpen((prev) => !prev)}>
            <Text style={taskDueAt ? st.taskComposerDateValue : st.taskComposerDatePlaceholder}>
              {taskDueAt || 'Choose due date'}
            </Text>
          </Pressable>
          {taskDatePickerOpen ? (
            <View style={st.taskComposerDatePickerWrap}>
              <DateTimePicker
                value={taskDueDateValue ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onChange={handleTaskDateChange}
              />
              {taskDueAt ? (
                <Pressable
                  style={st.taskComposerDateClearBtn}
                  onPress={() => {
                    setTaskDueAt('');
                    setTaskDueDateValue(null);
                    if (Platform.OS !== 'ios') setTaskDatePickerOpen(false);
                  }}
                >
                  <Text style={st.taskComposerDateClearBtnText}>Clear date</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <Pressable
            style={[st.taskComposerSendBtn, (!taskTitle.trim() || messageSubmitting) && st.taskComposerSendBtnDisabled]}
            disabled={!taskTitle.trim() || messageSubmitting}
            onPress={handleSendTask}
          >
            <Text style={st.taskComposerSendBtnText}>{messageSubmitting ? 'Sending…' : 'Send Task'}</Text>
          </Pressable>
        </View>
      ) : null}
      <ThreadComposer
        messageDraft={messageDraft}
        onChangeMessageDraft={onChangeMessageDraft}
        onSend={handleSend}
        sendDisabled={!selectedChannelId}
        messageSubmitting={messageSubmitting}
        pendingUpload={pendingMediaUpload ?? null}
        onSendUploadedMedia={onSendLatestMediaAttachment}
        onCancelUpload={onCancelMediaUpload}
        gateBlocksActions={gateBlocksActions}
        onPickMediaFile={onPickMediaFile}
        onStartLiveSession={onGoLive}
        onInsertTask={() => {
          setTaskComposerOpen(true);
          setSlashHintError(null);
        }}
        canUseTaskCommands={canUseTaskCommands}
        bottomInset={composerBottomInset}
        keyboardVisible={keyboardVisible}
        onLayout={setComposerHeight}
      />
      </View>
    </View>
  );
}

function InlineVideoAttachment(props: {
  media: MediaAttachment;
  resolvePlaybackUrl?: (mediaId: string) => Promise<string | null>;
  localPreviewUri?: string | null;
}) {
  const { media, resolvePlaybackUrl, localPreviewUri } = props;
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const posterUrl = media.playback_id ? `https://image.mux.com/${media.playback_id}/thumbnail.jpg?time=0` : null;
  const directVideoUrl = media.file_url && media.content_type?.startsWith('video/') ? media.file_url : null;
  const directPlaybackUrl = media.playback_id ? `https://stream.mux.com/${media.playback_id}.m3u8` : null;

  useEffect(() => {
    let cancelled = false;
    if (directVideoUrl) {
      setResolvedUrl(directVideoUrl);
      return () => {
        cancelled = true;
      };
    }
    if (directPlaybackUrl) {
      setResolvedUrl(directPlaybackUrl);
      return () => {
        cancelled = true;
      };
    }
    if (!media.media_id || !resolvePlaybackUrl || !media.lifecycle?.playback_ready) {
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    void resolvePlaybackUrl(media.media_id)
      .then((url) => {
        if (!cancelled) setResolvedUrl(url);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [directPlaybackUrl, directVideoUrl, media.lifecycle?.playback_ready, media.media_id, resolvePlaybackUrl]);

  const player = useVideoPlayer(resolvedUrl, (instance) => {
    instance.loop = false;
  });

  useEffect(() => {
    if (!showPlayer || !resolvedUrl) return;
    try {
      player.play();
    } catch {
      // Keep the inline player mounted even if autoplay fails.
    }
  }, [player, resolvedUrl, showPlayer]);

  return (
    <View style={st.inlineVideoWrap}>
      {showPlayer && resolvedUrl ? (
        <VideoView
          player={player}
          style={st.mediaAttachmentPreview}
          nativeControls
          contentFit="cover"
        />
      ) : posterUrl || localPreviewUri ? (
        <Pressable style={st.mediaAttachmentPreviewFallback} onPress={() => resolvedUrl ? setShowPlayer(true) : undefined}>
          <Image source={{ uri: posterUrl || localPreviewUri! }} style={st.mediaAttachmentPreview} resizeMode="cover" />
          <View style={st.videoPlayOverlay}>
            <Text style={st.videoPlayOverlayIcon}>▶</Text>
          </View>
        </Pressable>
      ) : (
        <View style={st.mediaAttachmentPreviewFallback}>
          <Text style={st.mediaAttachmentPreviewFallbackIcon}>▶</Text>
        </View>
      )}
      {media.lifecycle?.processing_status
      && !['ready', 'uploaded', 'queued_for_upload'].includes(media.lifecycle.processing_status) ? (
        <View style={st.mediaStatusBadge}>
          <Text style={st.mediaStatusBadgeText}>
            {loading
              ? 'LOADING'
              : String(media.lifecycle.processing_status).replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* ================================================================
   BROADCAST CAMPAIGN PANEL — target header + ThreadComposer
   Same UX as normal thread, but message goes to campaign fan-out.
   ================================================================ */

function BroadcastCampaignPanel(props: CommsHubProps) {
  const {
    broadcastCampaignProps,
    roleCanBroadcast,
    gateBlocksActions,
    onSendBroadcastCampaign,
    broadcastCampaignSubmitting,
    messageDraft,
    onChangeMessageDraft,
    pendingMediaUpload,
    onSendLatestMediaAttachment,
    onCancelMediaUpload,
    onPickMediaFile,
    onGoLive,
    composerBottomInset = 0,
    personaVariant,
    broadcastTaskDraft,
    onSetBroadcastTaskDraft,
  } = props;

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [taskComposerOpen, setTaskComposerOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueAt, setTaskDueAt] = useState('');
  const [taskDueDateValue, setTaskDueDateValue] = useState<Date | null>(null);
  const [taskDatePickerOpen, setTaskDatePickerOpen] = useState(false);
  const canUseTaskCommands = personaVariant !== 'sponsor';
  const hasTargets = (broadcastCampaignProps?.selectedTargets.length ?? 0) > 0;

  const resetBroadcastTaskComposer = useCallback(() => {
    setTaskComposerOpen(false);
    setTaskTitle('');
    setTaskDescription('');
    setTaskDueAt('');
    setTaskDueDateValue(null);
    setTaskDatePickerOpen(false);
  }, []);

  const handleBroadcastTaskDateChange = useCallback((_event: unknown, date?: Date) => {
    if (date) {
      setTaskDueDateValue(date);
      setTaskDueAt(date.toISOString().split('T')[0]);
      if (Platform.OS !== 'ios') setTaskDatePickerOpen(false);
    }
  }, []);

  const handleSendBroadcastTask = useCallback(() => {
    const trimmedTitle = taskTitle.trim();
    if (!trimmedTitle || !onSetBroadcastTaskDraft) return;
    onSetBroadcastTaskDraft({
      task_type: 'assigned_task',
      title: trimmedTitle,
      description: taskDescription.trim() || null,
      due_at: taskDueAt.trim() || null,
    });
    resetBroadcastTaskComposer();
    // Auto-trigger send after setting the draft
    setTimeout(() => onSendBroadcastCampaign?.(), 50);
  }, [taskTitle, taskDescription, taskDueAt, onSetBroadcastTaskDraft, onSendBroadcastCampaign, resetBroadcastTaskComposer]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(Math.max(0, event.endCoordinates?.height ?? 0));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (!roleCanBroadcast) {
    return (
      <View style={st.emptyState}>
        <Text style={st.emptyIcon}>🔒</Text>
        <Text style={st.emptyTitle}>Broadcasts restricted</Text>
        <Text style={st.emptySub}>Your current role doesn't have permission to send broadcasts.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Target selector header */}
      {broadcastCampaignProps ? (
        <BroadcastTargetHeader {...broadcastCampaignProps} />
      ) : null}

      {/* Empty state hint when no targets selected */}
      {!hasTargets ? (
        <View style={st.broadcastEmptyHint}>
          <Text style={st.broadcastEmptyHintText}>
            Select an audience above, then compose your message below.
          </Text>
        </View>
      ) : null}

      {/* Pending broadcast task draft badge */}
      {broadcastTaskDraft ? (
        <View style={st.broadcastTaskBadge}>
          <Text style={st.broadcastTaskBadgeText}>
            Task queued: {broadcastTaskDraft.title}
          </Text>
          <Pressable onPress={() => onSetBroadcastTaskDraft?.(null)} hitSlop={8}>
            <Text style={st.broadcastTaskBadgeClear}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Spacer to push composer to bottom */}
      <View style={{ flex: 1 }} />

      {/* Docked at bottom — task composer + ThreadComposer shift together with keyboard */}
      <View
        style={[
          st.threadDock,
          keyboardVisible && Platform.OS === 'ios' ? { bottom: Math.max(0, keyboardHeight) } : null,
        ]}
      >
        {/* Broadcast task composer — shown above the ThreadComposer inside the dock */}
        {taskComposerOpen ? (
          <View style={[st.taskComposerCard, { marginBottom: 0 }]}>
            <View style={st.taskComposerHeader}>
              <Text style={st.taskComposerTitle}>Broadcast Task</Text>
              <Pressable onPress={resetBroadcastTaskComposer} hitSlop={8}>
                <Text style={st.taskComposerClose}>✕</Text>
              </Pressable>
            </View>
            <TextInput
              value={taskTitle}
              onChangeText={setTaskTitle}
              placeholder="Task name"
              placeholderTextColor={C.textTertiary}
              style={st.taskComposerInput}
              autoFocus
            />
            <TextInput
              value={taskDescription}
              onChangeText={setTaskDescription}
              placeholder="Description (optional)"
              placeholderTextColor={C.textTertiary}
              multiline
              style={[st.taskComposerInput, st.taskComposerTextarea]}
            />
            <Text style={st.taskComposerMeta}>Each recipient will receive an individual task assignment.</Text>
            <Pressable style={st.taskComposerDateBtn} onPress={() => setTaskDatePickerOpen((prev) => !prev)}>
              <Text style={taskDueAt ? st.taskComposerDateValue : st.taskComposerDatePlaceholder}>
                {taskDueAt || 'Choose due date'}
              </Text>
            </Pressable>
            {taskDatePickerOpen ? (
              <View style={st.taskComposerDatePickerWrap}>
                <DateTimePicker
                  value={taskDueDateValue ?? new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={new Date()}
                  onChange={handleBroadcastTaskDateChange}
                />
                {taskDueAt ? (
                  <Pressable
                    style={st.taskComposerDateClearBtn}
                    onPress={() => {
                      setTaskDueAt('');
                      setTaskDueDateValue(null);
                      if (Platform.OS !== 'ios') setTaskDatePickerOpen(false);
                    }}
                  >
                    <Text style={st.taskComposerDateClearBtnText}>Clear date</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Pressable
              style={[st.taskComposerSendBtn, (!taskTitle.trim() || !hasTargets || broadcastCampaignSubmitting) && st.taskComposerSendBtnDisabled]}
              disabled={!taskTitle.trim() || !hasTargets || broadcastCampaignSubmitting === true}
              onPress={handleSendBroadcastTask}
            >
              <Text style={st.taskComposerSendBtnText}>{broadcastCampaignSubmitting ? 'Sending…' : 'Send Task to All'}</Text>
            </Pressable>
          </View>
        ) : null}
        <ThreadComposer
          messageDraft={messageDraft}
          onChangeMessageDraft={onChangeMessageDraft}
          onSend={() => onSendBroadcastCampaign?.()}
          sendDisabled={!hasTargets || broadcastCampaignSubmitting === true}
          messageSubmitting={broadcastCampaignSubmitting ?? false}
          pendingUpload={pendingMediaUpload ?? null}
          onSendUploadedMedia={() => onSendBroadcastCampaign?.()}
          onCancelUpload={onCancelMediaUpload}
          gateBlocksActions={gateBlocksActions}
          onPickMediaFile={onPickMediaFile}
          onStartLiveSession={onGoLive}
          onInsertTask={() => {
            setTaskComposerOpen(true);
          }}
          canUseTaskCommands={canUseTaskCommands}
          bottomInset={composerBottomInset}
          keyboardVisible={keyboardVisible}
        />
      </View>
    </View>
  );
}

/* ================================================================
   BROADCAST COMPOSE LEGACY — first-class messaging tool
   ================================================================ */

function BroadcastComposeLegacy(props: CommsHubProps) {
  const {
    roleCanBroadcast, gateBlocksActions,
    broadcastDraft, onChangeBroadcastDraft,
    broadcastTargetScope, broadcastTargetOptions, onChangeBroadcastTarget,
    broadcastSubmitting, broadcastError, broadcastSuccessNote,
    onSendBroadcast, onOpenAiAssist,
    broadcastAudienceLabel,
  } = props;

  if (!roleCanBroadcast) {
    return (
      <View style={st.emptyState}>
        <Text style={st.emptyIcon}>🔒</Text>
        <Text style={st.emptyTitle}>Broadcasts restricted</Text>
        <Text style={st.emptySub}>Your current role doesn't have permission to send broadcasts.</Text>
      </View>
    );
  }

  const targetLabels: Record<string, string> = {
    team: 'Team',
    cohort: 'Cohort',
    channel: 'Channel',
    segment: 'Segment',
  };

  return (
    <ScrollView style={st.broadcastScroll} contentContainerStyle={st.broadcastScrollInner} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={st.broadcastHeader}>
        <Text style={st.broadcastHeaderTitle}>New Broadcast</Text>
        <Text style={st.broadcastHeaderSub}>
          Send a message to {broadcastAudienceLabel || 'your audience'}. All members will be notified.
        </Text>
      </View>

      {/* Target selector */}
      <View style={st.broadcastSection}>
        <Text style={st.broadcastSectionLabel}>AUDIENCE</Text>
        <View style={st.broadcastTargetRow}>
          {broadcastTargetOptions.map((target) => {
            const active = broadcastTargetScope === target;
            return (
              <Pressable
                key={target}
                style={[st.broadcastTargetBtn, active && st.broadcastTargetBtnActive]}
                onPress={() => onChangeBroadcastTarget(target as 'team' | 'cohort' | 'channel' | 'segment')}
              >
                <Text style={[st.broadcastTargetBtnText, active && st.broadcastTargetBtnTextActive]}>
                  {targetLabels[target] ?? target}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Message input */}
      <View style={st.broadcastSection}>
        <Text style={st.broadcastSectionLabel}>MESSAGE</Text>
        <TextInput
          value={broadcastDraft}
          onChangeText={onChangeBroadcastDraft}
          placeholder="Type your broadcast message…"
          placeholderTextColor={C.textTertiary}
          multiline
          style={st.broadcastInput}
          editable={!gateBlocksActions && !broadcastSubmitting}
        />
      </View>

      {/* AI Draft button */}
      <Pressable
        style={st.broadcastAiBtn}
        onPress={() => onOpenAiAssist('coach_broadcast_compose')}
        disabled={gateBlocksActions}
      >
        <Text style={st.broadcastAiBtnText}>✨ AI Draft / Rewrite</Text>
      </Pressable>

      {/* Error / success */}
      {broadcastError ? (
        <View style={st.broadcastAlert}>
          <Text style={st.broadcastAlertTextError}>{broadcastError}</Text>
        </View>
      ) : null}
      {broadcastSuccessNote ? (
        <View style={[st.broadcastAlert, st.broadcastAlertSuccess]}>
          <Text style={st.broadcastAlertTextSuccess}>{broadcastSuccessNote}</Text>
        </View>
      ) : null}

      {/* Send button */}
      <Pressable
        style={[
          st.broadcastSendBtn,
          (broadcastSubmitting || gateBlocksActions || !broadcastDraft.trim()) && st.broadcastSendBtnDisabled,
        ]}
        disabled={broadcastSubmitting || gateBlocksActions || !broadcastDraft.trim()}
        onPress={onSendBroadcast}
      >
        <Text style={st.broadcastSendBtnText}>
          {broadcastSubmitting ? 'Sending…' : 'Send Broadcast'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

/* ================================================================
   STYLES
   ================================================================ */

const st = StyleSheet.create({
  /* ─── root ─── */
  root: {
    flex: 1,
    backgroundColor: C.pageBg,
    gap: 0,
    overflow: 'hidden',
  },
  sceneViewport: {
    flex: 1,
    position: 'relative',
  },
  threadScene: {
    flex: 1,
  },
  threadSceneOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.pageBg,
  },

  /* ─── top bar ─── */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    gap: 10,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: -0.4,
  },
  topBarChannelName: {
    fontSize: 16,
    fontWeight: '600',
    color: C.textPrimary,
    minWidth: 0,
  },
  topBarTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  headerAvatarPressable: {
    borderRadius: 16,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  headerAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textPrimary,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: 8,
  },
  backBtnIcon: {
    fontSize: 22,
    fontWeight: '300',
    color: C.brand,
    marginTop: -2,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: C.brand,
  },
  personaBadge: {
    backgroundColor: C.brandLight,
    borderRadius: R.badge,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  personaBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.brand,
    textTransform: 'capitalize',
  },

  /* ─── tab section ─── */
  tabSection: {
    backgroundColor: C.cardBg,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tab: {
    flex: 1,
    borderRadius: R.badge,
    borderWidth: 1.5,
    borderColor: C.divider,
    backgroundColor: C.cardBg,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    borderColor: C.brand,
    backgroundColor: C.brand,
  },
  tabText: {
    ...T.filterChip,
    color: C.textSecondary,
  },
  tabTextActive: {
    color: C.textOnBrand,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    borderRadius: R.badge,
    borderWidth: 1,
    borderColor: C.divider,
    backgroundColor: C.cardBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    borderColor: C.brand,
    backgroundColor: C.brandLight,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textTertiary,
  },
  filterChipTextActive: {
    color: C.brand,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.inputBg,
    borderRadius: R.channelRow,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    fontSize: 14,
    color: C.textTertiary,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.textPrimary,
    padding: 0,
  },

  /* ─── channel list ─── */
  channelScroll: {
    flex: 1,
  },
  channelScrollInner: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.channelRowPadH,
    paddingVertical: S.channelRowPadV,
    gap: 12,
    borderRadius: R.channelRow,
    marginBottom: 2,
  },
  channelRowSelected: {
    backgroundColor: C.brandLight,
  },
  channelRowDisabled: {
    opacity: 0.45,
  },
  channelAvatar: {
    width: commsAvatarSize.md,
    height: commsAvatarSize.md,
    borderRadius: commsAvatarSize.md / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  channelAvatarImage: {
    width: '100%',
    height: '100%',
  },
  channelAvatarIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  channelBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  channelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  channelTitle: {
    ...T.channelTitle,
    color: C.textPrimary,
    flex: 1,
    minWidth: 0,
  },
  channelTitleUnread: {
    fontWeight: '700',
  },
  channelTime: {
    ...T.channelMeta,
    color: C.textTertiary,
    flexShrink: 0,
  },
  channelSnippetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  channelSnippet: {
    ...T.channelSnippet,
    color: C.textTertiary,
    flex: 1,
    minWidth: 0,
  },
  channelSnippetUnread: {
    color: C.textSecondary,
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.unreadBadgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    ...T.badgeText,
    color: C.unreadBadgeText,
  },

  /* ─── empty state ─── */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  emptyTitle: {
    ...T.emptyTitle,
    color: C.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    ...T.emptySub,
    color: C.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    borderRadius: R.badge,
    backgroundColor: C.brand,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryBtnText: {
    color: C.textOnBrand,
    fontSize: 13,
    fontWeight: '700',
  },

  /* ─── thread view ─── */
  threadRoot: {
    flex: 1,
  },
  threadDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.pageBg,
  },
  threadScroll: {
    flex: 1,
    backgroundColor: C.pageBg,
  },
  threadScrollInner: {
    padding: 16,
    paddingBottom: 8,
    gap: 2,
  },
  threadEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },

  /* ── bubbles ── */
  bubbleWrap: {
    marginBottom: 6,
    maxWidth: '82%',
  },
  bubbleWrapSent: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleWrapReceived: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubbleWrapFollow: {
    marginBottom: 2,
  },
  bubbleMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  bubbleMetaRowSent: {
    flexDirection: 'row-reverse',
  },
  bubbleSender: {
    ...T.bubbleMeta,
    color: C.textSecondary,
    fontWeight: '600',
  },
  bubbleTime: {
    ...T.bubbleMeta,
    color: C.textTertiary,
  },
  bubble: {
    borderRadius: R.bubble,
    paddingHorizontal: S.bubblePadH,
    paddingVertical: S.bubblePadV,
    maxWidth: '100%',
  },
  bubbleMedia: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  bubbleSent: {
    backgroundColor: C.bubbleSent,
    borderBottomRightRadius: R.bubbleTail,
  },
  bubbleReceived: {
    backgroundColor: C.bubbleReceived,
    borderBottomLeftRadius: R.bubbleTail,
  },
  bubbleBroadcast: {
    backgroundColor: C.bubbleBroadcast,
    borderBottomLeftRadius: R.bubbleTail,
  },
  bubbleFollow: {
    borderRadius: R.bubble,
  },
  bubbleText: {
    ...T.bubbleBody,
  },
  bubbleTextSent: {
    color: C.bubbleSentText,
  },
  bubbleTextReceived: {
    color: C.bubbleReceivedText,
  },
  bubbleTextBroadcast: {
    color: C.bubbleBroadcastText,
  },
  broadcastTag: {
    backgroundColor: 'rgba(146, 64, 14, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  broadcastTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  bubbleTimeInline: {
    ...T.bubbleMeta,
    color: C.textTertiary,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  bubbleTimeInlineSent: {
    textAlign: 'right',
  },
  taskCard: {
    marginTop: 8,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4f2',
    padding: 14,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  taskCardSent: {
    borderColor: 'rgba(59, 130, 246, 0.24)',
  },
  taskCardReceived: {
    borderColor: '#dbe4f2',
  },
  taskCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  taskCardStatus: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  taskCardStatusPending: {
    color: '#92400e',
    backgroundColor: '#ffedd5',
  },
  taskCardStatusActive: {
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
  },
  taskCardStatusDone: {
    color: '#166534',
    backgroundColor: '#dcfce7',
  },
  taskCardBody: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  taskCardBodyCompleted: {
    color: '#64748b',
    textDecorationLine: 'line-through',
  },
  taskCardDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  taskCardDescriptionCompleted: {
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  taskCardMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  taskCardMetaPill: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    backgroundColor: '#f8fafc',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  taskCardActionBtn: {
    marginTop: 2,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  taskCardActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  taskUpdateCard: {
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 118, 110, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  taskUpdateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
  },
  taskUpdateNote: {
    fontSize: 12,
    color: C.textSecondary,
  },
  attachmentsWrap: {
    marginTop: 8,
    gap: 6,
  },
  attachmentChip: {
    borderRadius: 8,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  attachmentChipText: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: '600',
  },
  mediaAttachmentCard: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe3ef',
    overflow: 'hidden',
  },
  mediaAttachmentPreview: {
    width: '100%' as any,
    aspectRatio: 16 / 9,
    backgroundColor: '#e2e8f0',
  },
  inlineImageWrap: {
    position: 'relative',
  },
  inlineVideoWrap: {
    position: 'relative',
  },
  mediaAttachmentPreviewFallback: {
    width: '100%' as any,
    aspectRatio: 16 / 9,
    backgroundColor: '#e8eef8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaAttachmentPreviewFallbackIcon: {
    fontSize: 28,
    color: '#1d4ed8',
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
  },
  videoPlayOverlayIcon: {
    fontSize: 34,
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.24)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  mediaAttachmentBody: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  mediaAttachmentSpacer: {
    flex: 1,
  },
  mediaStatusBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mediaStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  mediaAttachmentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  mediaAttachmentTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#223047',
  },
  mediaAttachmentState: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  mediaAttachmentSub: {
    fontSize: 12,
    color: '#64748b',
  },

  /* ─── modern slim composer (iMessage-style) ─── */
  composer: {
    backgroundColor: C.cardBg,
    borderTopWidth: 1,
    borderTopColor: C.divider,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  composerError: {
    backgroundColor: C.errorBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  composerErrorText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.error,
  },
  composerStatusToast: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  composerStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  threadUtilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: C.pageBg,
  },
  threadUtilityPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#e8eef8',
  },
  threadUtilityPillDisabled: {
    opacity: 0.45,
  },
  threadUtilityPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#31568d',
  },
  taskComposerCard: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: C.divider,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  taskComposerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskComposerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
  },
  taskComposerClose: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textSecondary,
  },
  taskComposerInput: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.inputBorder,
    backgroundColor: C.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.textPrimary,
    ...T.composerInput,
  },
  taskComposerTextarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  taskComposerDateBtn: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.inputBorder,
    backgroundColor: C.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  taskComposerDatePlaceholder: {
    ...T.composerInput,
    color: C.textTertiary,
  },
  taskComposerDateValue: {
    ...T.composerInput,
    color: C.textPrimary,
  },
  taskComposerDatePickerWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: C.inputBorder,
  },
  taskComposerDateClearBtn: {
    alignSelf: 'flex-start',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  taskComposerDateClearBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3730a3',
  },
  taskComposerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  taskComposerChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.inputBorder,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  taskComposerChipActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderColor: 'rgba(37, 99, 235, 0.35)',
  },
  taskComposerChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSecondary,
  },
  taskComposerChipTextActive: {
    color: '#1d4ed8',
  },
  taskComposerMeta: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '600',
  },
  taskComposerSendBtn: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: C.brand,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  taskComposerSendBtnDisabled: {
    opacity: 0.45,
  },
  taskComposerSendBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  pendingAttachmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pendingAttachmentChip: {
    borderRadius: 8,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pendingAttachmentChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textSecondary,
  },
  /* primary input row: [⊕] [input] [send] */
  composerInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerPlusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.inputBorder,
  },
  composerPlusBtnActive: {
    backgroundColor: C.brand,
    borderColor: C.brand,
  },
  composerPlusBtnText: {
    fontSize: 22,
    fontWeight: '600',
    color: C.textSecondary,
    marginTop: -1,
  },
  composerPlusBtnTextActive: {
    color: C.textOnBrand,
  },
  composerInputWrap: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    maxHeight: 100,
  },
  composerInput: {
    ...T.composerInput,
    color: C.textPrimary,
    padding: 0,
  },
  composerSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerSendBtnDisabled: {
    backgroundColor: C.inputBg,
  },
  composerSendBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textOnBrand,
  },
  /* tools grid (expanded from ⊕ button) */
  composerToolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
    paddingHorizontal: 4,
  },
  composerToolBtn: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
  },
  composerToolBtnDisabled: {
    opacity: 0.45,
  },
  composerToolIcon: {
    fontSize: 20,
  },
  composerToolLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textSecondary,
  },
  /* attach sub-panel (row of attachment type buttons) */
  composerSubPanel: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  composerSubPanelItem: {
    borderRadius: 10,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  composerSubPanelItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSecondary,
  },
  /* media / live sub-panels */
  composerSubPanelWrap: {
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    gap: 6,
  },
  composerSubPanelTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  composerSubPanelBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  composerSubPanelBtn: {
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  composerSubPanelBtnDisabled: {
    opacity: 0.45,
  },
  composerSubPanelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  composerSubPanelStatus: {
    fontSize: 11,
    color: '#334155',
  },
  /* slash menu */
  slashMenu: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.divider,
    backgroundColor: C.cardBg,
    overflow: 'hidden',
  },
  slashItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    gap: 2,
  },
  slashCmd: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textPrimary,
  },
  slashHelp: {
    fontSize: 11,
    color: C.textTertiary,
  },
  slashEmpty: {
    fontSize: 12,
    color: C.textTertiary,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },

  /* ─── broadcast campaign panel ─── */
  broadcastEmptyHint: {
    padding: 24,
    alignItems: 'center',
  },
  broadcastEmptyHintText: {
    fontSize: 14,
    color: C.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  broadcastTaskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: C.brandLight,
    borderRadius: 8,
  },
  broadcastTaskBadgeText: {
    flex: 1,
    fontSize: 13,
    color: C.brand,
    fontWeight: '600',
  },
  broadcastTaskBadgeClear: {
    fontSize: 14,
    color: C.brand,
    paddingLeft: 8,
  },

  /* ─── broadcast compose legacy ─── */
  broadcastScroll: {
    flex: 1,
  },
  broadcastScrollInner: {
    padding: 16,
    gap: 20,
  },
  broadcastHeader: {
    gap: 6,
  },
  broadcastHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: -0.4,
  },
  broadcastHeaderSub: {
    fontSize: 14,
    fontWeight: '400',
    color: C.textTertiary,
    lineHeight: 20,
  },
  broadcastSection: {
    gap: 8,
  },
  broadcastSectionLabel: {
    ...T.sectionHeader,
    color: C.textTertiary,
  },
  broadcastTargetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  broadcastTargetBtn: {
    flex: 1,
    borderRadius: R.channelRow,
    borderWidth: 1.5,
    borderColor: C.divider,
    backgroundColor: C.cardBg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastTargetBtnActive: {
    borderColor: C.brand,
    backgroundColor: C.brandLight,
  },
  broadcastTargetBtnText: {
    ...T.broadcastLabel,
    color: C.textSecondary,
  },
  broadcastTargetBtnTextActive: {
    color: C.brand,
    fontWeight: '700',
  },
  broadcastInput: {
    backgroundColor: C.inputBg,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.inputBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: C.textPrimary,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  broadcastAiBtn: {
    borderRadius: R.channelRow,
    borderWidth: 1.5,
    borderColor: C.divider,
    backgroundColor: C.cardBg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastAiBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
  },
  broadcastAlert: {
    borderRadius: 10,
    padding: 12,
    backgroundColor: C.errorBg,
  },
  broadcastAlertSuccess: {
    backgroundColor: C.successBg,
  },
  broadcastAlertTextError: {
    fontSize: 13,
    fontWeight: '500',
    color: C.error,
  },
  broadcastAlertTextSuccess: {
    fontSize: 13,
    fontWeight: '500',
    color: C.success,
  },
  broadcastSendBtn: {
    borderRadius: R.channelRow,
    backgroundColor: C.brand,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastSendBtnDisabled: {
    backgroundColor: C.inputBg,
  },
  broadcastSendBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textOnBrand,
  },
});
