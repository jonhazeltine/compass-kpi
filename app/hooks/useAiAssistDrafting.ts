/**
 * useAiAssistDrafting — State-management hook for the AI-assist
 * approval-first drafting shell.
 *
 * Encapsulates all AI-assist modal state, the local draft generator,
 * the "apply to human input" helper, the suggestion-queue CRUD, and
 * the suggestion-list fetcher.
 */

import { useCallback, useEffect, useState } from 'react';

import type {
  AIAssistShellContext,
  AiSuggestionApiRow,
  AiSuggestionCreateResponse,
  AiSuggestionQueueSummary,
  AiSuggestionsListResponse,
} from '../screens/kpi-dashboard/types';

import { API_URL } from '../lib/supabase';

// ── Public state shape ───────────────────────────────────────────────

export interface AiAssistDraftingState {
  aiAssistVisible: boolean;
  aiAssistContext: AIAssistShellContext | null;
  aiAssistPrompt: string;
  aiAssistDraftText: string;
  aiAssistGenerating: boolean;
  aiAssistNotice: string | null;
  aiSuggestionQueueSubmitting: boolean;
  aiSuggestionQueueError: string | null;
  aiSuggestionQueueSuccess: string | null;
  aiSuggestionRows: AiSuggestionApiRow[] | null;
  aiSuggestionQueueSummary: AiSuggestionQueueSummary | null;
  aiSuggestionListLoading: boolean;
  aiSuggestionListError: string | null;
}

export interface AiAssistDraftingActions {
  setAiAssistPrompt: (v: string) => void;
  setAiAssistDraftText: (v: string) => void;
  setAiAssistNotice: (v: string | null) => void;
  setAiAssistVisible: (v: boolean) => void;
  /** Open the AI-assist modal with context + optional seed content. */
  openAiAssistShell: (
    ctx: AIAssistShellContext,
    seed?: { prompt?: string | null; draft?: string | null },
  ) => void;
  /** Generate a local AI draft (no network call). */
  generateAiAssistDraft: () => void;
  /**
   * Apply the current draft text to the host input.
   * The caller provides callbacks for each supported host type.
   */
  applyAiAssistDraftToHumanInput: (callbacks: {
    setChannelMessageDraft: (v: string) => void;
    setBroadcastDraft: (v: string) => void;
  }) => void;
  /** Fetch the suggestion list from the server. */
  fetchAiSuggestions: () => Promise<void>;
  /**
   * Queue the current draft as a suggestion for approval.
   * Requires `buildScope` to produce the scope string and `aiAssistIntentForHost`.
   */
  queueAiSuggestionForApproval: (opts: {
    buildScope: (ctx: AIAssistShellContext) => string;
  }) => Promise<void>;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useAiAssistDrafting(
  accessToken: string | null,
): AiAssistDraftingState & AiAssistDraftingActions {
  const [aiAssistVisible, setAiAssistVisible] = useState(false);
  const [aiAssistContext, setAiAssistContext] = useState<AIAssistShellContext | null>(null);
  const [aiAssistPrompt, setAiAssistPrompt] = useState('');
  const [aiAssistDraftText, setAiAssistDraftText] = useState('');
  const [aiAssistGenerating, setAiAssistGenerating] = useState(false);
  const [aiAssistNotice, setAiAssistNotice] = useState<string | null>(null);
  const [aiSuggestionQueueSubmitting, setAiSuggestionQueueSubmitting] = useState(false);
  const [aiSuggestionQueueError, setAiSuggestionQueueError] = useState<string | null>(null);
  const [aiSuggestionQueueSuccess, setAiSuggestionQueueSuccess] = useState<string | null>(null);
  const [aiSuggestionRows, setAiSuggestionRows] = useState<AiSuggestionApiRow[] | null>(null);
  const [aiSuggestionQueueSummary, setAiSuggestionQueueSummary] = useState<AiSuggestionQueueSummary | null>(null);
  const [aiSuggestionListLoading, setAiSuggestionListLoading] = useState(false);
  const [aiSuggestionListError, setAiSuggestionListError] = useState<string | null>(null);

  // ── actions ──────────────────────────────────────────────────────

  const openAiAssistShell = useCallback(
    (ctx: AIAssistShellContext, seed?: { prompt?: string | null; draft?: string | null }) => {
      setAiAssistContext(ctx);
      setAiAssistPrompt(String(seed?.prompt ?? '').trim());
      setAiAssistDraftText(String(seed?.draft ?? '').trim());
      setAiAssistNotice(null);
      setAiSuggestionQueueError(null);
      setAiSuggestionQueueSuccess(null);
      setAiAssistGenerating(false);
      setAiAssistVisible(true);
    },
    [],
  );

  const generateAiAssistDraft = useCallback(() => {
    if (!aiAssistContext) return;
    const prompt = aiAssistPrompt.trim();
    setAiAssistGenerating(true);
    const hostLabel = aiAssistContext.targetLabel;
    const host = aiAssistContext.host;
    const generated = [
      host === 'coach_broadcast_compose'
        ? `Team update draft for ${hostLabel}:`
        : host === 'channel_thread'
          ? `Reply draft for ${hostLabel}:`
          : host === 'coaching_lesson_detail'
            ? `Lesson reflection prompt draft for ${hostLabel}:`
            : `Coaching suggestion draft for ${hostLabel}:`,
      prompt ? `Focus: ${prompt}` : 'Focus: Clarify the next best action and keep the tone supportive.',
      host === 'coach_broadcast_compose'
        ? 'Draft (human review required): Team, here is the suggested update. Please review and edit before sending.'
        : 'Draft (human review required): Here is a suggested coaching/support message. Please edit before using.',
    ].join('\n');
    setAiAssistDraftText(generated);
    setAiAssistNotice('AI draft shell generated locally for review. No request was sent and no content was published.');
    setAiAssistGenerating(false);
  }, [aiAssistContext, aiAssistPrompt]);

  const applyAiAssistDraftToHumanInput = useCallback(
    (callbacks: {
      setChannelMessageDraft: (v: string) => void;
      setBroadcastDraft: (v: string) => void;
    }) => {
      const ctx = aiAssistContext;
      const text = aiAssistDraftText.trim();
      if (!ctx || !text) {
        setAiAssistNotice('Add or generate a draft first.');
        return;
      }
      if (ctx.host === 'channel_thread') {
        callbacks.setChannelMessageDraft(text);
        setAiAssistNotice('Draft inserted into the message composer. Human send is still required.');
        return;
      }
      if (ctx.host === 'coach_broadcast_compose') {
        callbacks.setBroadcastDraft(text);
        setAiAssistNotice('Draft inserted into the broadcast composer. Human send is still required.');
        return;
      }
      setAiAssistNotice('Draft is ready for manual review/copy. No send/publish action is available from AI assist.');
    },
    [aiAssistContext, aiAssistDraftText],
  );

  const fetchAiSuggestions = useCallback(async () => {
    const token = accessToken;
    if (!token) {
      setAiSuggestionRows(null);
      setAiSuggestionQueueSummary(null);
      setAiSuggestionListError('Sign in is required to load AI suggestion queue status.');
      return;
    }
    setAiSuggestionListLoading(true);
    setAiSuggestionListError(null);
    try {
      const response = await fetch(`${API_URL}/api/ai/suggestions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => ({}))) as AiSuggestionsListResponse;
      if (!response.ok) {
        setAiSuggestionRows(null);
        setAiSuggestionQueueSummary(null);
        setAiSuggestionListError(String(body.error ?? `AI suggestions request failed (${response.status})`));
        return;
      }
      setAiSuggestionRows(Array.isArray(body.suggestions) ? body.suggestions : []);
      setAiSuggestionQueueSummary(body.queue_summary ?? null);
    } catch (err) {
      setAiSuggestionRows(null);
      setAiSuggestionQueueSummary(null);
      setAiSuggestionListError(err instanceof Error ? err.message : 'AI suggestions request failed');
    } finally {
      setAiSuggestionListLoading(false);
    }
  }, [accessToken]);

  const queueAiSuggestionForApproval = useCallback(
    async (opts: { buildScope: (ctx: AIAssistShellContext) => string }) => {
      const token = accessToken;
      const ctx = aiAssistContext;
      const proposedMessage = aiAssistDraftText.trim();
      if (!token) {
        setAiSuggestionQueueError('Sign in is required to queue AI suggestions.');
        setAiSuggestionQueueSuccess(null);
        return;
      }
      if (!ctx) {
        setAiSuggestionQueueError('AI assist context is missing.');
        setAiSuggestionQueueSuccess(null);
        return;
      }
      if (!proposedMessage) {
        setAiSuggestionQueueError('Generate or enter a draft before queueing for approval.');
        setAiSuggestionQueueSuccess(null);
        return;
      }
      setAiSuggestionQueueSubmitting(true);
      setAiSuggestionQueueError(null);
      setAiSuggestionQueueSuccess(null);
      try {
        const payload = {
          scope: opts.buildScope(ctx),
          proposed_message: proposedMessage,
        };
        const response = await fetch(`${API_URL}/api/ai/suggestions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const body = (await response.json().catch(() => ({}))) as AiSuggestionCreateResponse;
        if (!response.ok) {
          setAiSuggestionQueueError(String(body.error ?? `Queue request failed (${response.status})`));
          return;
        }
        const queued = body.suggestion ?? null;
        const queueStatus = queued?.ai_queue_read_model?.approval_queue?.queue_status ?? queued?.status ?? 'pending';
        setAiSuggestionQueueSuccess(
          `Queued for approval review (${String(queueStatus).replace(/_/g, ' ')}). No send/publish occurred; human approval remains required.`,
        );
        setAiAssistNotice('AI suggestion queued for approval review. Human send/publish still uses existing explicit actions only.');
        await fetchAiSuggestions();
      } catch (err) {
        setAiSuggestionQueueError(err instanceof Error ? err.message : 'Queue request failed');
      } finally {
        setAiSuggestionQueueSubmitting(false);
      }
    },
    [accessToken, aiAssistContext, aiAssistDraftText, fetchAiSuggestions],
  );

  // Auto-fetch suggestions when the modal becomes visible.
  useEffect(() => {
    if (!aiAssistVisible) return;
    void fetchAiSuggestions();
  }, [aiAssistVisible, fetchAiSuggestions]);

  return {
    aiAssistVisible,
    aiAssistContext,
    aiAssistPrompt,
    aiAssistDraftText,
    aiAssistGenerating,
    aiAssistNotice,
    aiSuggestionQueueSubmitting,
    aiSuggestionQueueError,
    aiSuggestionQueueSuccess,
    aiSuggestionRows,
    aiSuggestionQueueSummary,
    aiSuggestionListLoading,
    aiSuggestionListError,
    setAiAssistPrompt,
    setAiAssistDraftText,
    setAiAssistNotice,
    setAiAssistVisible,
    openAiAssistShell,
    generateAiAssistDraft,
    applyAiAssistDraftToHumanInput,
    fetchAiSuggestions,
    queueAiSuggestionForApproval,
  };
}
