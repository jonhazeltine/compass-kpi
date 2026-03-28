/**
 * useJourneyBuilder — Extracted from KPIDashboardScreen.
 * Encapsulates all Journey Builder state and CRUD callbacks
 * (lesson/task add/rename/delete/reorder, asset library).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';

import type {
  CoachingJourneyDetailResponse,
  JourneyBuilderLesson,
  JourneyBuilderSaveState,
  LibraryAsset,
  LibraryCollection,
} from '../screens/kpi-dashboard/types';

import { API_URL } from '../lib/supabase';

// ── Dependencies injected by host ──────────────────────────────────

export interface JourneyBuilderDeps {
  accessToken: string | null;
  coachingJourneyDetail: CoachingJourneyDetailResponse | null;
  /** The host's fetchCoachingJourneyDetail function (triggers data refresh). */
  fetchCoachingJourneyDetail: (journeyId: string) => Promise<void>;
}

// ── Public surface ─────────────────────────────────────────────────

export interface JourneyBuilderState {
  jbLessons: JourneyBuilderLesson[];
  jbSaveState: JourneyBuilderSaveState;
  jbSaveMessage: string;
  jbAssets: LibraryAsset[];
  jbCollections: LibraryCollection[];
  jbShowAssetLibrary: boolean;
  jbActiveTaskMenu: { lessonId: string; taskId: string } | null;
  jbConfirmDelete: { type: 'lesson' | 'task'; id: string; parentId?: string; label: string } | null;
  jbNewLessonTitle: string;
  jbNewTaskTitle: string;
  jbAddingTaskToLessonId: string | null;
  jbEditingLessonId: string | null;
  jbEditingLessonTitle: string;
  jbEditingTaskKey: string | null;
  jbEditingTaskTitle: string;
  jbMovingItem: {
    type: 'lesson' | 'task';
    lessonIdx: number;
    lessonId: string;
    taskIdx?: number;
    taskId?: string;
  } | null;
  jbAssetsById: Map<string, LibraryAsset>;

  setJbLessons: React.Dispatch<React.SetStateAction<JourneyBuilderLesson[]>>;
  setJbSaveState: React.Dispatch<React.SetStateAction<JourneyBuilderSaveState>>;
  setJbSaveMessage: React.Dispatch<React.SetStateAction<string>>;
  setJbAssets: React.Dispatch<React.SetStateAction<LibraryAsset[]>>;
  setJbCollections: React.Dispatch<React.SetStateAction<LibraryCollection[]>>;
  setJbShowAssetLibrary: React.Dispatch<React.SetStateAction<boolean>>;
  setJbActiveTaskMenu: React.Dispatch<React.SetStateAction<{ lessonId: string; taskId: string } | null>>;
  setJbConfirmDelete: React.Dispatch<React.SetStateAction<{ type: 'lesson' | 'task'; id: string; parentId?: string; label: string } | null>>;
  setJbNewLessonTitle: React.Dispatch<React.SetStateAction<string>>;
  setJbNewTaskTitle: React.Dispatch<React.SetStateAction<string>>;
  setJbAddingTaskToLessonId: React.Dispatch<React.SetStateAction<string | null>>;
  setJbEditingLessonId: React.Dispatch<React.SetStateAction<string | null>>;
  setJbEditingLessonTitle: React.Dispatch<React.SetStateAction<string>>;
  setJbEditingTaskKey: React.Dispatch<React.SetStateAction<string | null>>;
  setJbEditingTaskTitle: React.Dispatch<React.SetStateAction<string>>;
  setJbMovingItem: React.Dispatch<React.SetStateAction<JourneyBuilderState['jbMovingItem']>>;

  jbAddLesson: (journeyId: string) => Promise<void>;
  jbAddTask: (journeyId: string, lessonId: string) => Promise<void>;
  jbAddAssetAsTask: (journeyId: string, lessonId: string, asset: LibraryAsset) => Promise<void>;
  jbRemoveTask: (journeyId: string, lessonId: string, taskId: string) => Promise<void>;
  jbDeleteLesson: (journeyId: string, lessonId: string) => Promise<void>;
  jbReorderLessons: (journeyId: string, fromIndex: number, toIndex: number) => Promise<void>;
  jbReorderTasks: (journeyId: string, lessonId: string, fromIndex: number, toIndex: number) => Promise<void>;
  jbRenameLesson: (journeyId: string, lessonId: string, newTitle: string) => Promise<void>;
  jbRenameTask: (journeyId: string, lessonId: string, taskId: string, newTitle: string) => Promise<void>;
  jbFetchAssetLibrary: () => Promise<void>;
}

// ── Hook ───────────────────────────────────────────────────────────

export function useJourneyBuilder({
  accessToken,
  coachingJourneyDetail,
  fetchCoachingJourneyDetail,
}: JourneyBuilderDeps): JourneyBuilderState {
  // ── State ──────────────────────────────────────────────────────
  const [jbLessons, setJbLessons] = useState<JourneyBuilderLesson[]>([]);
  const [jbSaveState, setJbSaveState] = useState<JourneyBuilderSaveState>('idle');
  const [jbSaveMessage, setJbSaveMessage] = useState('');
  const [jbAssets, setJbAssets] = useState<LibraryAsset[]>([]);
  const [jbCollections, setJbCollections] = useState<LibraryCollection[]>([]);
  const [jbShowAssetLibrary, setJbShowAssetLibrary] = useState(false);
  const [jbActiveTaskMenu, setJbActiveTaskMenu] = useState<{ lessonId: string; taskId: string } | null>(null);
  const [jbConfirmDelete, setJbConfirmDelete] = useState<{ type: 'lesson' | 'task'; id: string; parentId?: string; label: string } | null>(null);
  const [jbNewLessonTitle, setJbNewLessonTitle] = useState('');
  const [jbNewTaskTitle, setJbNewTaskTitle] = useState('');
  const [jbAddingTaskToLessonId, setJbAddingTaskToLessonId] = useState<string | null>(null);
  const [jbEditingLessonId, setJbEditingLessonId] = useState<string | null>(null);
  const [jbEditingLessonTitle, setJbEditingLessonTitle] = useState('');
  const [jbEditingTaskKey, setJbEditingTaskKey] = useState<string | null>(null);
  const [jbEditingTaskTitle, setJbEditingTaskTitle] = useState('');
  const [jbMovingItem, setJbMovingItem] = useState<JourneyBuilderState['jbMovingItem']>(null);

  // ── Helpers ────────────────────────────────────────────────────

  const jbMoveItem = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return items;
    const copy = [...items];
    const [item] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, item);
    return copy;
  };

  const jbRunMutation = useCallback(async (pendingLabel: string, successLabel: string, action: () => Promise<void>) => {
    setJbSaveState('pending');
    setJbSaveMessage(pendingLabel);
    try {
      await action();
      setJbSaveState('saved');
      setJbSaveMessage(`${successLabel} at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      setJbSaveState('error');
      setJbSaveMessage(message);
    }
  }, []);

  const jbSendJson = useCallback(async <T,>(
    path: string,
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    body?: Record<string, unknown>
  ): Promise<T> => {
    const token = accessToken;
    if (!token) throw new Error('Session token required');
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const payload = (await response.json()) as { error?: unknown };
        if (payload.error && typeof payload.error === 'object' && typeof (payload.error as Record<string, unknown>).message === 'string') message = (payload.error as Record<string, unknown>).message as string;
        else if (typeof payload.error === 'string' && payload.error) message = payload.error;
      } catch { /* ignore */ }
      throw new Error(message);
    }
    return (await response.json()) as T;
  }, [accessToken]);

  const jbSyncLessonsFromDetail = useCallback((detail: CoachingJourneyDetailResponse | null) => {
    if (!detail?.milestones) { setJbLessons([]); return; }
    const lessons: JourneyBuilderLesson[] = (detail.milestones ?? []).map((m) => ({
      id: String(m.id),
      title: m.title ?? `Lesson ${(m as Record<string, unknown>).sort_order ?? 0}`,
      is_locked: (m as Record<string, unknown>).is_locked === true,
      release_strategy: String((m as Record<string, unknown>).release_strategy ?? 'immediate'),
      release_date: ((m as Record<string, unknown>).release_date as string | null | undefined) ?? null,
      tasks: (m.lessons ?? []).map((l) => ({
        id: String(l.id),
        title: l.title ?? 'Untitled Task',
        assetId: typeof (l as Record<string, unknown>).body === 'string' && ((l as Record<string, unknown>).body as string).startsWith('asset:') ? ((l as Record<string, unknown>).body as string).slice(6) : null,
        progressStatus: (l.progress_status as 'not_started' | 'in_progress' | 'completed' | undefined) ?? 'not_started',
        completedAt: l.completed_at ?? null,
      })),
    }));
    setJbLessons(lessons);
    // Seed asset library from detail.assets so thumbnails work even if library endpoint is unavailable
    if (Array.isArray(detail.assets) && detail.assets.length > 0) {
      setJbAssets((prev) => {
        if (prev.length > 0) return prev; // don't overwrite if library already loaded
        return detail.assets!.map((a) => ({
          id: a.id,
          title: a.title,
          category: a.category,
          scope: a.scope,
          duration: a.duration,
          playbackId: a.playbackId ?? null,
        }));
      });
    }
  }, []);

  const jbRefreshJourney = useCallback(async (journeyId: string) => {
    await fetchCoachingJourneyDetail(journeyId);
  }, [fetchCoachingJourneyDetail]);

  // Sync lessons when journey detail changes
  useEffect(() => {
    jbSyncLessonsFromDetail(coachingJourneyDetail);
    setJbMovingItem(null);
  }, [coachingJourneyDetail, jbSyncLessonsFromDetail]);

  // ── CRUD callbacks ─────────────────────────────────────────────

  const jbAddLesson = useCallback(async (journeyId: string) => {
    const nextCount = jbLessons.length + 1;
    const title = jbNewLessonTitle.trim() || `Lesson ${nextCount}`;
    await jbRunMutation('Adding lesson…', 'Lesson added', async () => {
      await jbSendJson<{ lesson: { id: string } }>(
        `/api/coaching/journeys/${journeyId}/lessons`,
        'POST',
        { title, sort_order: jbLessons.length }
      );
      setJbNewLessonTitle('');
      await jbRefreshJourney(journeyId);
    });
  }, [jbLessons.length, jbNewLessonTitle, jbRefreshJourney, jbRunMutation, jbSendJson]);

  const jbAddTask = useCallback(async (journeyId: string, lessonId: string) => {
    const lesson = jbLessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    const title = jbNewTaskTitle.trim() || `Task ${lesson.tasks.length + 1}`;
    await jbRunMutation('Adding task…', 'Task added', async () => {
      await jbSendJson<{ task: { id: string } }>(
        `/api/coaching/journeys/${journeyId}/lessons/${lessonId}/tasks`,
        'POST',
        { title, sort_order: lesson.tasks.length }
      );
      setJbNewTaskTitle('');
      setJbAddingTaskToLessonId(null);
      await jbRefreshJourney(journeyId);
    });
  }, [jbLessons, jbNewTaskTitle, jbRefreshJourney, jbRunMutation, jbSendJson]);

  const jbAddAssetAsTask = useCallback(async (journeyId: string, lessonId: string, asset: LibraryAsset) => {
    const lesson = jbLessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    await jbRunMutation('Adding asset…', 'Asset added', async () => {
      await jbSendJson<{ task: { id: string } }>(
        `/api/coaching/journeys/${journeyId}/lessons/${lessonId}/tasks`,
        'POST',
        { title: asset.title, body: `asset:${asset.id}`, sort_order: lesson.tasks.length }
      );
      await jbRefreshJourney(journeyId);
    });
  }, [jbLessons, jbRefreshJourney, jbRunMutation, jbSendJson]);

  const jbRemoveTask = useCallback(async (journeyId: string, lessonId: string, taskId: string) => {
    await jbRunMutation('Removing task…', 'Task removed', async () => {
      await jbSendJson(
        `/api/coaching/journeys/${journeyId}/lessons/${lessonId}/tasks/${taskId}`,
        'DELETE'
      );
      await jbRefreshJourney(journeyId);
    });
    setJbActiveTaskMenu(null);
    setJbConfirmDelete(null);
  }, [jbRefreshJourney, jbRunMutation, jbSendJson]);

  const jbDeleteLesson = useCallback(async (journeyId: string, lessonId: string) => {
    await jbRunMutation('Deleting lesson…', 'Lesson deleted', async () => {
      await jbSendJson(
        `/api/coaching/journeys/${journeyId}/lessons/${lessonId}`,
        'DELETE'
      );
      await jbRefreshJourney(journeyId);
    });
    setJbConfirmDelete(null);
  }, [jbRefreshJourney, jbRunMutation, jbSendJson]);

  const jbReorderLessons = useCallback(async (journeyId: string, fromIndex: number, toIndex: number) => {
    const reordered = jbMoveItem(jbLessons, fromIndex, toIndex);
    if (reordered === jbLessons) return;
    setJbLessons(reordered);
    const lessonIds = reordered.map((l) => l.id);
    await jbRunMutation('Saving lesson order…', 'Lesson order updated', async () => {
      await jbSendJson(
        `/api/coaching/journeys/${journeyId}/lessons/reorder`,
        'POST',
        { lesson_ids: lessonIds }
      );
      await jbRefreshJourney(journeyId);
    });
  }, [jbLessons, jbRefreshJourney, jbRunMutation, jbSendJson]);

  const jbReorderTasks = useCallback(async (journeyId: string, lessonId: string, fromIndex: number, toIndex: number) => {
    const lesson = jbLessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    const reordered = jbMoveItem(lesson.tasks, fromIndex, toIndex);
    if (reordered === lesson.tasks) return;
    setJbLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? { ...l, tasks: reordered } : l))
    );
    const taskIds = reordered.map((t) => t.id);
    await jbRunMutation('Saving task order…', 'Task order updated', async () => {
      await jbSendJson(
        `/api/coaching/journeys/${journeyId}/lessons/${lessonId}/tasks/reorder`,
        'POST',
        { task_ids: taskIds }
      );
      await jbRefreshJourney(journeyId);
    });
  }, [jbLessons, jbRefreshJourney, jbRunMutation, jbSendJson]);

  const jbFetchAssetLibrary = useCallback(async () => {
    const token = accessToken;
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/coaching/library`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const body = (await response.json()) as { assets?: Array<Record<string, unknown>>; collections?: LibraryCollection[] };
        // Map snake_case playback_id → camelCase playbackId expected by muxThumb
        const mapped: LibraryAsset[] = Array.isArray(body.assets)
          ? body.assets.map((a) => ({
              id: String(a.id ?? ''),
              title: String(a.title ?? ''),
              category: String(a.category ?? 'Video'),
              scope: String(a.scope ?? ''),
              duration: String(a.duration ?? '-'),
              playbackId: (a.playback_id as string | null | undefined) ?? null,
            }))
          : [];
        setJbAssets(mapped);
        setJbCollections(Array.isArray(body.collections) ? body.collections : []);
      }
    } catch {
      // Library fetch is non-blocking; empty state is acceptable
    }
  }, [accessToken]);

  // Auto-fetch asset library when opened
  useEffect(() => {
    if (jbShowAssetLibrary && jbAssets.length === 0) {
      void jbFetchAssetLibrary();
    }
  }, [jbShowAssetLibrary, jbAssets.length, jbFetchAssetLibrary]);

  const jbAssetsById = useMemo(() => {
    const map = new Map<string, LibraryAsset>();
    for (const a of jbAssets) map.set(a.id, a);
    return map;
  }, [jbAssets]);

  // Prefetch Mux thumbnails the moment the asset list lands — so by the time
  // the user opens a journey detail the images are already in the disk cache.
  useEffect(() => {
    if (jbAssets.length === 0) return;
    for (const asset of jbAssets) {
      if (asset.playbackId) {
        const url = `https://image.mux.com/${asset.playbackId}/thumbnail.jpg?width=320&height=180&time=1&fit_mode=smartcrop`;
        void Image.prefetch(url);
      }
    }
  }, [jbAssets]);

  const jbRenameLesson = useCallback(async (journeyId: string, lessonId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) { setJbEditingLessonId(null); return; }
    const existing = jbLessons.find((l) => l.id === lessonId);
    if (existing && existing.title === trimmed) { setJbEditingLessonId(null); return; }
    setJbLessons((prev) => prev.map((l) => (l.id === lessonId ? { ...l, title: trimmed } : l)));
    setJbEditingLessonId(null);
    await jbRunMutation('Renaming lesson…', 'Lesson renamed', async () => {
      await jbSendJson(
        `/api/coaching/journeys/${journeyId}/lessons/${lessonId}`,
        'PATCH',
        { title: trimmed }
      );
      await jbRefreshJourney(journeyId);
    });
  }, [jbLessons, jbRefreshJourney, jbRunMutation, jbSendJson]);

  const jbRenameTask = useCallback(async (journeyId: string, lessonId: string, taskId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) { setJbEditingTaskKey(null); return; }
    const lesson = jbLessons.find((l) => l.id === lessonId);
    const task = lesson?.tasks.find((t) => t.id === taskId);
    if (task && task.title === trimmed) { setJbEditingTaskKey(null); return; }
    setJbLessons((prev) =>
      prev.map((l) =>
        l.id === lessonId
          ? { ...l, tasks: l.tasks.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t)) }
          : l
      )
    );
    setJbEditingTaskKey(null);
    await jbRunMutation('Renaming task…', 'Task renamed', async () => {
      await jbSendJson(
        `/api/coaching/journeys/${journeyId}/lessons/${lessonId}/tasks/${taskId}`,
        'PATCH',
        { title: trimmed }
      );
      await jbRefreshJourney(journeyId);
    });
  }, [jbLessons, jbRefreshJourney, jbRunMutation, jbSendJson]);

  // ── Return ─────────────────────────────────────────────────────

  return {
    jbLessons,
    jbSaveState,
    jbSaveMessage,
    jbAssets,
    jbCollections,
    jbShowAssetLibrary,
    jbActiveTaskMenu,
    jbConfirmDelete,
    jbNewLessonTitle,
    jbNewTaskTitle,
    jbAddingTaskToLessonId,
    jbEditingLessonId,
    jbEditingLessonTitle,
    jbEditingTaskKey,
    jbEditingTaskTitle,
    jbMovingItem,
    jbAssetsById,

    setJbLessons,
    setJbSaveState,
    setJbSaveMessage,
    setJbAssets,
    setJbCollections,
    setJbShowAssetLibrary,
    setJbActiveTaskMenu,
    setJbConfirmDelete,
    setJbNewLessonTitle,
    setJbNewTaskTitle,
    setJbAddingTaskToLessonId,
    setJbEditingLessonId,
    setJbEditingLessonTitle,
    setJbEditingTaskKey,
    setJbEditingTaskTitle,
    setJbMovingItem,

    jbAddLesson,
    jbAddTask,
    jbAddAssetAsTask,
    jbRemoveTask,
    jbDeleteLesson,
    jbReorderLessons,
    jbReorderTasks,
    jbRenameLesson,
    jbRenameTask,
    jbFetchAssetLibrary,
  };
}
