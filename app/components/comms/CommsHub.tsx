/**
 * CommsHub — Messaging-first communications interface for Compass.
 *
 * Renders three views based on `screen` prop:
 *   1. ChannelList  — inbox with modern channel rows
 *   2. ThreadView   — chat-style message bubbles + sticky composer
 *   3. BroadcastCompose — first-class broadcast authoring tool
 *
 * All data fetching / state lives in the parent (KPIDashboardScreen).
 * This component is purely presentational + handles local UI state.
 */
import React, { useRef, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
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

/* ================================================================
   TYPES
   ================================================================ */

export type CommsScreen = 'inbox' | 'inbox_channels' | 'channel_thread' | 'coach_broadcast_compose';
export type CommsPrimaryTab = 'all' | 'channels' | 'dms' | 'broadcast';
export type CommsScopeFilter = 'all' | 'team' | 'cohort' | 'segment' | 'global';

export interface ChannelRow {
  id: string;
  name: string;
  type?: string | null;
  scope: string;
  unread_count?: number | null;
  member_count?: number | null;
  my_role?: string | null;
  last_seen_at?: string | null;
  created_at?: string | null;
  snippet?: string | null;
}

export interface MessageRow {
  id: string;
  channel_id: string;
  sender_user_id?: string | null;
  sender_name?: string | null;
  body: string;
  message_type?: 'message' | 'broadcast' | string;
  created_at?: string | null;
}

export interface FallbackChannelRow {
  scope: string;
  label: string;
  context: string;
}

export interface FallbackDmRow {
  id: string;
  name: string;
  role: string;
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
  onBack: () => void;

  /* ── persona / role ─── */
  personaVariant: 'coach' | 'team_leader' | 'sponsor' | 'member' | 'solo';
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
  onSendMessage: () => void;
  onRefreshMessages: () => void;
  onOpenAiAssist: (host: string) => void;

  /* ── broadcast composer ─── */
  broadcastDraft: string;
  onChangeBroadcastDraft: (text: string) => void;
  broadcastTargetScope: 'team' | 'cohort' | 'channel';
  broadcastTargetOptions: string[];
  onChangeBroadcastTarget: (scope: 'team' | 'cohort' | 'channel') => void;
  broadcastSubmitting: boolean;
  broadcastError: string | null;
  broadcastSuccessNote: string | null;
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
  const { screen } = props;

  return (
    <View style={st.root}>
      {/* ─── Top bar: persona badge + back nav ─── */}
      <CommsTopBar {...props} />

      {/* ─── Tab strip ─── */}
      <CommsTabs {...props} />

      {/* ─── View router ─── */}
      {screen === 'channel_thread' ? (
        <ThreadView {...props} />
      ) : screen === 'coach_broadcast_compose' ? (
        <BroadcastCompose {...props} />
      ) : (
        <ChannelList {...props} />
      )}
    </View>
  );
}

/* ================================================================
   TOP BAR — persona badge + contextual back button
   ================================================================ */

function CommsTopBar(props: CommsHubProps) {
  const { personaVariant, screen, onBack, selectedChannelName } = props;
  const showBack = screen === 'channel_thread' || screen === 'coach_broadcast_compose';
  const personaLabel = personaVariant.replace('_', ' ');

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
        <Text style={st.topBarChannelName} numberOfLines={1}>{selectedChannelName}</Text>
      ) : null}
      <View style={{ flex: 1 }} />
      <View style={st.personaBadge}>
        <Text style={st.personaBadgeText}>{personaLabel}</Text>
      </View>
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
    roleCanBroadcast, screen,
  } = props;

  if (screen === 'channel_thread' || screen === 'coach_broadcast_compose') return null;

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
    { key: 'segment', label: 'Segment' },
    { key: 'global', label: 'Global' },
  ];

  const placeholder =
    primaryTab === 'dms'
      ? 'Search people...'
      : primaryTab === 'channels'
        ? scopeFilter === 'all'
          ? 'Search channels...'
          : `Search ${scopeFilter} channels...`
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
        if (scopeFilter === 'segment') return r.scope === 'challenge' || r.scope === 'sponsor';
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
  const timeLabel = row.last_seen_at ? fmtTime(row.last_seen_at) : row.created_at ? fmtDate(row.created_at) : '';
  const snippet = row.snippet || (row.member_count ? `${row.member_count} members` : 'No messages yet');

  return (
    <Pressable
      style={[st.channelRow, isSelected && st.channelRowSelected, disabled && st.channelRowDisabled]}
      disabled={disabled}
      onPress={onPress}
    >
      {/* Avatar */}
      <View style={[st.channelAvatar, { backgroundColor: vis.bg }]}>
        <Text style={[st.channelAvatarIcon, { color: vis.fg }]}>{vis.icon}</Text>
      </View>

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
  const initials = row.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Pressable style={[st.channelRow, disabled && st.channelRowDisabled]} disabled={disabled} onPress={onPress}>
      <View style={[st.channelAvatar, { backgroundColor: vis.bg }]}>
        <Text style={[st.channelAvatarIcon, { color: vis.fg, fontSize: 14 }]}>{initials}</Text>
      </View>
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
      <View style={[st.channelAvatar, { backgroundColor: vis.bg }]}>
        <Text style={[st.channelAvatarIcon, { color: vis.fg }]}>{vis.icon}</Text>
      </View>
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
    onSendMessage, onRefreshMessages, onOpenAiAssist,
    gateBlocksActions, fmtTime,
  } = props;

  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  return (
    <View style={st.threadRoot}>
      {/* Messages area */}
      <ScrollView
        ref={scrollRef}
        style={st.threadScroll}
        contentContainerStyle={st.threadScrollInner}
        keyboardShouldPersistTaps="handled"
      >
        {messagesLoading && messages.length === 0 ? (
          <View style={st.threadEmpty}>
            <ActivityIndicator size="small" color={C.brand} />
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
        ) : messages.length > 0 ? (
          messages.map((msg, idx) => {
            const isMine = String(msg.sender_user_id ?? '') === String(currentUserId ?? '');
            const isBroadcast = String(msg.message_type ?? '') === 'broadcast';
            const prev = idx > 0 ? messages[idx - 1] : null;
            const startsGroup = !prev || String(prev.sender_user_id ?? '') !== String(msg.sender_user_id ?? '');
            const senderLabel = msg.sender_name || (isMine ? 'You' : 'Member');
            const time = fmtTime(msg.created_at);

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
                    {msg.body}
                  </Text>
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

      {/* ── Sticky composer ── */}
      <View style={st.composer}>
        {messageSubmitError ? (
          <View style={st.composerError}>
            <Text style={st.composerErrorText}>{messageSubmitError}</Text>
          </View>
        ) : null}

        <View style={st.composerRow}>
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

        <View style={st.composerActions}>
          <Pressable
            style={st.composerGhostBtn}
            onPress={() => onOpenAiAssist('channel_thread')}
            disabled={gateBlocksActions}
          >
            <Text style={st.composerGhostBtnText}>✨ AI Draft</Text>
          </Pressable>
          <Pressable
            style={st.composerGhostBtn}
            onPress={onRefreshMessages}
            disabled={messageSubmitting}
          >
            <Text style={st.composerGhostBtnText}>↻ Refresh</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            style={[
              st.composerSendBtn,
              (!selectedChannelId || messageSubmitting || gateBlocksActions || !messageDraft.trim())
                && st.composerSendBtnDisabled,
            ]}
            disabled={!selectedChannelId || messageSubmitting || gateBlocksActions || !messageDraft.trim()}
            onPress={onSendMessage}
          >
            <Text style={st.composerSendBtnText}>
              {messageSubmitting ? '…' : '➤'}
            </Text>
          </Pressable>
        </View>
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
    selectedChannelName,
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

  const targetLabels: Record<string, string> = { team: 'Team', cohort: 'Cohort', channel: 'Channel' };

  return (
    <ScrollView style={st.broadcastScroll} contentContainerStyle={st.broadcastScrollInner} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={st.broadcastHeader}>
        <Text style={st.broadcastHeaderTitle}>New Broadcast</Text>
        <Text style={st.broadcastHeaderSub}>
          Send a message to {selectedChannelName || 'your audience'}. All members will be notified.
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
                onPress={() => onChangeBroadcastTarget(target as 'team' | 'cohort' | 'channel')}
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
    flex: 1,
    minWidth: 0,
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

  /* ─── sticky composer ─── */
  composer: {
    backgroundColor: C.cardBg,
    borderTopWidth: 1,
    borderTopColor: C.divider,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  composerError: {
    backgroundColor: C.errorBg,
    borderRadius: 8,
    padding: 8,
  },
  composerErrorText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.error,
  },
  composerRow: {
    backgroundColor: C.inputBg,
    borderRadius: R.composer,
    borderWidth: 1,
    borderColor: C.inputBorder,
    paddingHorizontal: S.composerPadH,
    paddingVertical: S.composerPadV,
    minHeight: 44,
    maxHeight: 120,
  },
  composerInput: {
    ...T.composerInput,
    color: C.textPrimary,
    padding: 0,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerGhostBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.badge,
    backgroundColor: C.inputBg,
  },
  composerGhostBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSecondary,
  },
  composerSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerSendBtnDisabled: {
    backgroundColor: C.inputBg,
  },
  composerSendBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textOnBrand,
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
