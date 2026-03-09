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
import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
  type MediaAttachment,
  type ThreadSendPayload,
} from './messageLinkedTasks';

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
  onRequestMediaUpload: () => void;
  onSendLatestMediaAttachment: () => void;
  mediaUploadBusy: boolean;
  mediaUploadStatus: string | null;
  liveSessionBusy: boolean;
  liveSessionStatus: string | null;
  canHostLiveSession: boolean;
  liveCallerRole: 'host' | 'viewer' | null;
  livePlaybackUrl: string | null;
  liveStreamKey: string | null;
  liveProviderMode: 'mock' | 'mux' | 'unavailable' | null;
  onStartLiveSession: () => void;
  onRefreshLiveSession: () => void;
  onWatchLiveStream: () => void;
  onEndLiveSession: () => void;
  composerBottomInset?: number;

  /* ── broadcast composer ─── */
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

  return (
    <View style={[st.root, composerBottomInset ? { paddingBottom: composerBottomInset } : undefined]}>
      {/* ─── Top bar: persona badge + back nav ─── */}
      <CommsTopBar {...props} />

      {/* ─── Tab strip (hidden during thread & broadcast compose) ─── */}
      <CommsTabs {...props} />

      {/* ─── View router ─── */}
      {screen === 'channel_thread' ? (
        <ThreadView key={props.selectedChannelId ?? 'thread'} {...props} />
      ) : showBroadcastPanel ? (
        /* Broadcast compose lives inside the same comms shell for parity with Channels */
        <BroadcastCompose {...props} />
      ) : (
        /* inbox/inbox_channels and any other screen → full channel list */
        <ChannelList {...props} />
      )}
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
    onRequestMediaUpload, onSendLatestMediaAttachment, mediaUploadBusy, mediaUploadStatus,
    liveSessionBusy, liveSessionStatus, canHostLiveSession, liveCallerRole, livePlaybackUrl, liveStreamKey, liveProviderMode,
    onStartLiveSession, onRefreshLiveSession, onWatchLiveStream, onEndLiveSession,
    composerBottomInset,
    gateBlocksActions, fmtTime, fmtDate, personaVariant, roleCanBroadcast,
  } = props;

  const scrollRef = useRef<ScrollView>(null);
  const [pendingAttachments, setPendingAttachments] = useState<Array<{ id: string; name: string; kind: string }>>([]);
  const [composerPanel, setComposerPanel] = useState<'none' | 'tools' | 'attach' | 'media' | 'live'>('none');
  const [slashHintError, setSlashHintError] = useState<string | null>(null);

  const canUseTaskCommands = personaVariant !== 'sponsor';
  const showSlashMenu = messageDraft.trim().startsWith('/');
  const parsedMessages = useMemo(
    () => messages.map((msg) => ({ msg, parsed: parseThreadMessage(msg) })),
    [messages]
  );
  const taskStatusMap = useMemo(() => buildLegacyTaskStatusMap(parsedMessages), [parsedMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

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

  const onPickAttachment = (kind: 'image' | 'doc' | 'link') => {
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
    const name =
      kind === 'image'
        ? `Photo-${suffix}.png`
        : kind === 'doc'
          ? `Brief-${suffix}.pdf`
          : `Reference-${suffix}.url`;
    setPendingAttachments((prev) => [...prev, { id, name, kind }]);
    setComposerPanel('none');
  };

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
      pendingAttachments: pendingAttachments.map((attachment) => ({ name: attachment.name, kind: attachment.kind })),
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
    setPendingAttachments([]);
    setComposerPanel('none');
  };

  return (
    <View style={st.threadRoot}>
      {/* Messages area */}
      <ScrollView
        ref={scrollRef}
        style={st.threadScroll}
        contentContainerStyle={st.threadScrollInner}
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
                    isMine
                      ? st.bubbleSent
                      : isBroadcast
                        ? st.bubbleBroadcast
                        : st.bubbleReceived,
                    !startsGroup && st.bubbleFollow,
                  ]}
                >
                  {parsed.text ? (
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
                    <View style={st.taskCard}>
                      <View style={st.taskCardHead}>
                        <Text style={st.taskCardTitle}>
                          {parsed.linkedTaskCard.task_type === 'coach_task' ? 'Coach Task' : 'Personal Task'}
                        </Text>
                        <Text style={st.taskCardStatus}>{String(parsed.linkedTaskCard.status ?? 'pending').replace('_', ' ').toUpperCase()}</Text>
                      </View>
                      <Text style={st.taskCardBody}>{parsed.linkedTaskCard.title}</Text>
                      {parsed.linkedTaskCard.description ? (
                        <Text style={st.taskCardMeta}>{parsed.linkedTaskCard.description}</Text>
                      ) : null}
                      <View style={st.taskCardMetaRow}>
                        {parsed.linkedTaskCard.assignee?.display_name ? (
                          <Text style={st.taskCardMeta}>Owner: {parsed.linkedTaskCard.assignee.display_name}</Text>
                        ) : null}
                        {parsed.linkedTaskCard.due_at ? (
                          <Text style={st.taskCardMeta}>Due: {fmtDate(parsed.linkedTaskCard.due_at)}</Text>
                        ) : null}
                      </View>
                      <Text style={st.taskCardId}>#{parsed.linkedTaskCard.task_id}</Text>
                    </View>
                  ) : null}
                  {parsed.legacyTaskCard ? (
                    <View style={st.taskCard}>
                      <View style={st.taskCardHead}>
                        <Text style={st.taskCardTitle}>Task</Text>
                        <Text style={st.taskCardStatus}>{String(legacyTaskCardStatus ?? 'open').toUpperCase()}</Text>
                      </View>
                      <Text style={st.taskCardBody}>{parsed.legacyTaskCard.title}</Text>
                      <View style={st.taskCardMetaRow}>
                        {parsed.legacyTaskCard.owner ? <Text style={st.taskCardMeta}>Owner: {parsed.legacyTaskCard.owner}</Text> : null}
                        {parsed.legacyTaskCard.due ? <Text style={st.taskCardMeta}>Due: {parsed.legacyTaskCard.due}</Text> : null}
                      </View>
                      <Text style={st.taskCardId}>#{parsed.legacyTaskCard.taskId}</Text>
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
      </ScrollView>

      {/* ── Modern slim composer (iMessage-style) ── */}
      <View style={st.composer}>
        {/* Error bar — only when error */}
        {messageSubmitError || slashHintError ? (
          <View style={st.composerError}>
            <Text style={st.composerErrorText}>{messageSubmitError ?? slashHintError}</Text>
          </View>
        ) : null}

        {/* Pending attachments — only when present */}
        {pendingAttachments.length > 0 ? (
          <View style={st.pendingAttachmentRow}>
            {pendingAttachments.map((att) => (
              <Pressable
                key={att.id}
                style={st.pendingAttachmentChip}
                onPress={() => setPendingAttachments((prev) => prev.filter((x) => x.id !== att.id))}
              >
                <Text style={st.pendingAttachmentChipText}>
                  {att.kind === 'image' ? '🖼' : att.kind === 'doc' ? '📄' : '🔗'} {att.name} ×
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Active status toast — only when media/live busy */}
        {(mediaUploadBusy || liveSessionBusy) ? (
          <View style={st.composerStatusToast}>
            <Text style={st.composerStatusText}>
              {mediaUploadBusy ? (mediaUploadStatus ?? 'Uploading…') : (liveSessionStatus ?? 'Working…')}
            </Text>
          </View>
        ) : null}

        {/* Slash menu — only when "/" typed */}
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

        {/* ── Primary input row: [⊕] [TextInput] [Send] ── */}
        <View style={st.composerInputRow}>
          <Pressable
            style={[st.composerPlusBtn, composerPanel !== 'none' && st.composerPlusBtnActive]}
            onPress={() => setComposerPanel((prev) => prev !== 'none' ? 'none' : 'tools')}
            disabled={gateBlocksActions}
          >
            <Text style={[st.composerPlusBtnText, composerPanel !== 'none' && st.composerPlusBtnTextActive]}>
              {composerPanel !== 'none' ? '×' : '+'}
            </Text>
          </Pressable>
          <View style={st.composerInputWrap}>
            <TextInput
              value={messageDraft}
              onChangeText={onChangeMessageDraft}
              placeholder="Write a message…"
              placeholderTextColor={C.textTertiary}
              multiline
              style={st.composerInput}
              editable={!gateBlocksActions && !messageSubmitting}
            />
          </View>
          <Pressable
            style={[
              st.composerSendBtn,
              (!selectedChannelId || messageSubmitting || gateBlocksActions || (!messageDraft.trim() && pendingAttachments.length === 0))
                && st.composerSendBtnDisabled,
            ]}
            disabled={!selectedChannelId || messageSubmitting || gateBlocksActions || (!messageDraft.trim() && pendingAttachments.length === 0)}
            onPress={handleSend}
          >
            <Text style={st.composerSendBtnText}>
              {messageSubmitting ? '…' : '➤'}
            </Text>
          </Pressable>
        </View>

        {/* ── Tools grid (tap ⊕ to reveal) ── */}
        {composerPanel === 'tools' ? (
          <View style={st.composerToolsGrid}>
            <Pressable style={st.composerToolBtn} onPress={() => setComposerPanel('attach')}>
              <Text style={st.composerToolIcon}>📎</Text>
              <Text style={st.composerToolLabel}>Attach</Text>
            </Pressable>
            <Pressable
              style={[st.composerToolBtn, gateBlocksActions && st.composerToolBtnDisabled]}
              disabled={gateBlocksActions}
              onPress={() => { onOpenAiAssist('channel_thread'); setComposerPanel('none'); }}
            >
              <Text style={st.composerToolIcon}>✨</Text>
              <Text style={st.composerToolLabel}>AI Draft</Text>
            </Pressable>
            <Pressable style={st.composerToolBtn} onPress={() => setComposerPanel('media')}>
              <Text style={st.composerToolIcon}>🎥</Text>
              <Text style={st.composerToolLabel}>Media</Text>
            </Pressable>
            <Pressable style={st.composerToolBtn} onPress={() => setComposerPanel('live')}>
              <Text style={st.composerToolIcon}>📡</Text>
              <Text style={st.composerToolLabel}>Live</Text>
            </Pressable>
            <Pressable
              style={[st.composerToolBtn, messageSubmitting && st.composerToolBtnDisabled]}
              disabled={messageSubmitting}
              onPress={() => { onRefreshMessages(); setComposerPanel('none'); }}
            >
              <Text style={st.composerToolIcon}>↻</Text>
              <Text style={st.composerToolLabel}>Refresh</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Attach sub-panel ── */}
        {composerPanel === 'attach' ? (
          <View style={st.composerSubPanel}>
            <Pressable style={st.composerSubPanelItem} onPress={() => onPickAttachment('image')}>
              <Text style={st.composerSubPanelItemText}>🖼 Photo</Text>
            </Pressable>
            <Pressable style={st.composerSubPanelItem} onPress={() => onPickAttachment('doc')}>
              <Text style={st.composerSubPanelItemText}>📄 Document</Text>
            </Pressable>
            <Pressable style={st.composerSubPanelItem} onPress={() => onPickAttachment('link')}>
              <Text style={st.composerSubPanelItemText}>🔗 Link</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Media sub-panel ── */}
        {composerPanel === 'media' ? (
          <View style={st.composerSubPanelWrap}>
            <Text style={st.composerSubPanelTitle}>Mux Media</Text>
            <View style={st.composerSubPanelBtnRow}>
              <Pressable
                style={[st.composerSubPanelBtn, (gateBlocksActions || mediaUploadBusy || !selectedChannelId) && st.composerSubPanelBtnDisabled]}
                disabled={gateBlocksActions || mediaUploadBusy || !selectedChannelId}
                onPress={onRequestMediaUpload}
              >
                <Text style={st.composerSubPanelBtnText}>{mediaUploadBusy ? 'Working…' : 'Get Upload URL'}</Text>
              </Pressable>
              <Pressable
                style={[st.composerSubPanelBtn, (gateBlocksActions || mediaUploadBusy || !selectedChannelId) && st.composerSubPanelBtnDisabled]}
                disabled={gateBlocksActions || mediaUploadBusy || !selectedChannelId}
                onPress={onSendLatestMediaAttachment}
              >
                <Text style={st.composerSubPanelBtnText}>Send Attachment</Text>
              </Pressable>
            </View>
            <Text style={st.composerSubPanelStatus}>{mediaUploadStatus ?? 'No media action yet.'}</Text>
          </View>
        ) : null}

        {/* ── Live Session sub-panel (host/viewer) ── */}
        {composerPanel === 'live' ? (
          <View style={st.composerSubPanelWrap}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={st.composerSubPanelTitle}>
                {liveCallerRole === 'host' ? 'Live Broadcast (Host)' : liveCallerRole === 'viewer' ? 'Live Broadcast' : 'Live Session'}
              </Text>
              {liveProviderMode === 'mux' ? (
                <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: '#dbeafe' }}>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#64748b' }}>Mux</Text>
                </View>
              ) : liveProviderMode === 'mock' ? (
                <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: '#fef3c7' }}>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#64748b' }}>Mock</Text>
                </View>
              ) : null}
            </View>
            {liveCallerRole === 'host' && liveStreamKey ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748b' }}>Stream Key:</Text>
                <Text style={{ fontSize: 10, fontFamily: 'monospace', color: '#334155' }}>{liveStreamKey.slice(0, 6)}…{liveStreamKey.slice(-4)}</Text>
              </View>
            ) : null}
            <View style={st.composerSubPanelBtnRow}>
              {canHostLiveSession ? (
                <Pressable
                  style={[st.composerSubPanelBtn, (gateBlocksActions || liveSessionBusy || !selectedChannelId) && st.composerSubPanelBtnDisabled]}
                  disabled={gateBlocksActions || liveSessionBusy || !selectedChannelId}
                  onPress={onStartLiveSession}
                >
                  <Text style={st.composerSubPanelBtnText}>Start</Text>
                </Pressable>
              ) : null}
              {!canHostLiveSession || liveCallerRole === 'viewer' ? (
                <Pressable
                  style={[st.composerSubPanelBtn, (gateBlocksActions || liveSessionBusy || !livePlaybackUrl) && st.composerSubPanelBtnDisabled]}
                  disabled={gateBlocksActions || liveSessionBusy || !livePlaybackUrl}
                  onPress={onWatchLiveStream}
                >
                  <Text style={st.composerSubPanelBtnText}>{livePlaybackUrl ? '▶ Watch' : 'Watch'}</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[st.composerSubPanelBtn, (gateBlocksActions || liveSessionBusy || !selectedChannelId) && st.composerSubPanelBtnDisabled]}
                disabled={gateBlocksActions || liveSessionBusy || !selectedChannelId}
                onPress={onRefreshLiveSession}
              >
                <Text style={st.composerSubPanelBtnText}>Refresh</Text>
              </Pressable>
              {canHostLiveSession ? (
                <Pressable
                  style={[st.composerSubPanelBtn, (gateBlocksActions || liveSessionBusy || !selectedChannelId) && st.composerSubPanelBtnDisabled]}
                  disabled={gateBlocksActions || liveSessionBusy || !selectedChannelId}
                  onPress={onEndLiveSession}
                >
                  <Text style={st.composerSubPanelBtnText}>End</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={st.composerSubPanelStatus}>{liveSessionStatus ?? 'No live session action yet.'}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ================================================================
   BROADCAST COMPOSE — first-class messaging tool
   ================================================================ */

function BroadcastCompose(props: CommsHubProps) {
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
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.24)',
    padding: 10,
    gap: 6,
  },
  taskCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E3A8A',
    textTransform: 'uppercase',
  },
  taskCardStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  taskCardBody: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textPrimary,
  },
  taskCardMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  taskCardMeta: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: '500',
  },
  taskCardId: {
    fontSize: 10,
    color: C.textTertiary,
    fontWeight: '600',
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

  /* ─── broadcast compose ─── */
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
