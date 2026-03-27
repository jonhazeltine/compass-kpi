/**
 * JourneyBuilderDrawer — Extracted from KPIDashboardScreen.
 * Renders the Journey Builder lesson/task editor section
 * (jb* state — save banner, action bar, asset library, lesson/task list, confirm delete).
 *
 * This component is embedded inside the coaching_journey_detail section of CoachTab.
 */

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  CoachingJourneyDetailMilestone,
  CoachingShellScreen,
  CoachingShellContext,
  JourneyBuilderLesson,
  JourneyBuilderSaveState,
  LibraryAsset,
  LibraryCollection,
} from '../../screens/kpi-dashboard/types';

/** Tap-to-pick / tap-to-drop grip handle. */
const JbGrip = React.memo(function JbGrip({
  isPickedUp, isDropTarget, onPress, small,
}: {
  isPickedUp: boolean; isDropTarget: boolean; onPress: () => void; small?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      style={{
        width: small ? 18 : 22, height: small ? 22 : 28,
        alignItems: 'center' as const, justifyContent: 'center' as const,
        marginRight: small ? 3 : 6, borderRadius: 4,
        backgroundColor: isPickedUp ? '#bfdbfe' : isDropTarget ? '#dcfce7' : '#e2e8f0',
        borderWidth: isPickedUp ? 1.5 : isDropTarget ? 1 : 0,
        borderColor: isPickedUp ? '#3b82f6' : isDropTarget ? '#22c55e' : 'transparent',
      }}
    >
      <Text style={{ fontSize: small ? 11 : 14, color: isPickedUp ? '#2563eb' : isDropTarget ? '#16a34a' : '#64748b' }}>⠿</Text>
    </TouchableOpacity>
  );
});

export interface JourneyBuilderDrawerProps {
  // Journey context
  selectedJourneyId: string | null;
  selectedLessonId: string | null;
  selectedJourneyTitle: string | null;
  coachingShellContext: CoachingShellContext;
  milestoneRows: CoachingJourneyDetailMilestone[];

  // Permissions
  isCoachRuntimeOperator: boolean;
  shellPackageGateBlocksActions: boolean;

  // JB state from useJourneyBuilder
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

  // JB setters
  setJbShowAssetLibrary: (v: boolean | ((prev: boolean) => boolean)) => void;
  setJbConfirmDelete: (v: { type: 'lesson' | 'task'; id: string; parentId?: string; label: string } | null) => void;
  setJbNewTaskTitle: (v: string) => void;
  setJbAddingTaskToLessonId: (v: string | null) => void;
  setJbEditingLessonId: (v: string | null) => void;
  setJbEditingLessonTitle: (v: string) => void;
  setJbEditingTaskKey: (v: string | null) => void;
  setJbEditingTaskTitle: (v: string) => void;
  setJbMovingItem: (v: JourneyBuilderDrawerProps['jbMovingItem'] | null) => void;

  // JB callbacks
  jbAddLesson: (journeyId: string) => Promise<void>;
  jbAddTask: (journeyId: string, lessonId: string) => Promise<void>;
  jbAddAssetAsTask: (journeyId: string, lessonId: string, asset: LibraryAsset) => Promise<void>;
  jbDeleteLesson: (journeyId: string, lessonId: string) => Promise<void>;
  jbRemoveTask: (journeyId: string, lessonId: string, taskId: string) => Promise<void>;
  jbReorderLessons: (journeyId: string, fromIndex: number, toIndex: number) => Promise<void>;
  jbReorderTasks: (journeyId: string, lessonId: string, fromIndex: number, toIndex: number) => Promise<void>;
  jbRenameLesson: (journeyId: string, lessonId: string, newTitle: string) => Promise<void>;
  jbRenameTask: (journeyId: string, lessonId: string, taskId: string, newTitle: string) => Promise<void>;

  // Navigation
  openCoachingShell: (screen: CoachingShellScreen, contextPatch?: Partial<CoachingShellContext>) => void;
}

export default function JourneyBuilderDrawer({
  selectedJourneyId,
  selectedLessonId,
  selectedJourneyTitle,
  coachingShellContext,
  milestoneRows,
  isCoachRuntimeOperator,
  shellPackageGateBlocksActions,
  jbLessons,
  jbSaveState,
  jbSaveMessage,
  jbAssets,
  jbCollections,
  jbShowAssetLibrary,
  jbActiveTaskMenu: _jbActiveTaskMenu,
  jbConfirmDelete,
  jbNewTaskTitle,
  jbAddingTaskToLessonId,
  jbEditingLessonId,
  jbEditingLessonTitle,
  jbEditingTaskKey,
  jbEditingTaskTitle,
  jbMovingItem,
  jbAssetsById,
  setJbShowAssetLibrary,
  setJbConfirmDelete,
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
  jbDeleteLesson,
  jbRemoveTask,
  jbReorderLessons,
  jbReorderTasks,
  jbRenameLesson,
  jbRenameTask,
  openCoachingShell,
}: JourneyBuilderDrawerProps) {
  return (
    <>
      {/* ── Journey Builder: save status banner ── */}
      {jbSaveState !== 'idle' && (
        <View style={[styles.jbSaveBanner, jbSaveState === 'error' ? styles.jbSaveBannerError : jbSaveState === 'pending' ? styles.jbSaveBannerPending : styles.jbSaveBannerOk]}>
          <Text style={styles.jbSaveBannerText}>
            {jbSaveState === 'pending' ? '⏳ ' : jbSaveState === 'error' ? '⚠️ ' : '✅ '}
            {jbSaveMessage}
          </Text>
        </View>
      )}

      {/* Moving-item banner */}
      {jbMovingItem && (
        <View style={{ backgroundColor: '#eff6ff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginBottom: 6, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const }}>
          <Text style={{ fontSize: 12, color: '#1e40af' }}>
            Moving {jbMovingItem.type === 'lesson' ? 'lesson' : 'task'} — tap another ⠿ to place
          </Text>
          <TouchableOpacity onPress={() => setJbMovingItem(null)} style={{ paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 12, fontWeight: '600' as const, color: '#3b82f6' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Journey Builder: action bar (coach operators) ── */}
      {isCoachRuntimeOperator && !shellPackageGateBlocksActions && (
        <View style={styles.jbActionBar}>
          <TouchableOpacity
            style={styles.jbActionBtn}
            onPress={() => {
              const jid = selectedJourneyId;
              if (jid) void jbAddLesson(jid);
            }}
          >
            <Text style={styles.jbActionBtnText}>＋ Lesson</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.jbActionBtn, styles.jbActionBtnSecondary]}
            onPress={() => setJbShowAssetLibrary((prev: boolean) => !prev)}
          >
            <Text style={[styles.jbActionBtnText, styles.jbActionBtnSecondaryText]}>
              {jbShowAssetLibrary ? 'Close Library' : 'Asset Library'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Asset Library Panel ── */}
      {jbShowAssetLibrary && isCoachRuntimeOperator && (
        <View style={styles.jbAssetLibraryPanel}>
          <Text style={styles.jbAssetLibraryTitle}>Asset Library</Text>
          {jbAssets.length === 0 ? (
            <Text style={styles.jbAssetLibraryEmpty}>No assets available. Assets from the coaching library will appear here.</Text>
          ) : (
            <>
              {jbCollections.length > 0 && (
                <View style={styles.jbAssetCollectionRow}>
                  {jbCollections.map((col) => (
                    <TouchableOpacity key={col.id} style={styles.jbAssetCollectionChip}>
                      <Text style={styles.jbAssetCollectionChipText} numberOfLines={1}>{col.name} ({col.assetIds.length})</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <ScrollView style={styles.jbAssetListScroll} nestedScrollEnabled>
                {jbAssets.map((asset) => (
                  <View key={asset.id} style={styles.jbAssetRow}>
                    <View style={styles.jbAssetRowInfo}>
                      <Text style={styles.jbAssetRowTitle} numberOfLines={1}>{asset.title}</Text>
                      <Text style={styles.jbAssetRowMeta} numberOfLines={1}>{asset.category} · {asset.duration}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.jbAssetAddBtn}
                      onPress={() => {
                        const jid = selectedJourneyId;
                        if (!jid) return;
                        if (jbLessons.length === 1) {
                          void jbAddAssetAsTask(jid, jbLessons[0].id, asset);
                        } else if (jbLessons.length > 1) {
                          setJbAddingTaskToLessonId(null);
                          void jbAddAssetAsTask(jid, jbLessons[0].id, asset);
                        }
                      }}
                    >
                      <Text style={styles.jbAssetAddBtnText}>＋ Add</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      )}

      {/* ── Journey Builder: Lessons + Tasks (editable) ── */}
      {jbLessons.length === 0 && milestoneRows.length === 0 ? (
        <View style={styles.coachingJourneyEmptyCard}>
          <Text style={styles.coachingJourneyEmptyTitle}>No lessons yet</Text>
          <Text style={styles.coachingJourneyEmptySub}>
            {isCoachRuntimeOperator ? 'Tap "+ Lesson" above to create your first lesson.' : 'No lessons have been created for this journey.'}
          </Text>
        </View>
      ) : (
        <View style={styles.coachingJourneyListCard}>
          {jbLessons.map((lesson, lessonIdx) => {
            const isActiveLesson = String(lesson.id) === String(selectedLessonId ?? '');
            return (
              <View key={`jb-lesson-${lesson.id}`} style={[styles.jbLessonBlock, lessonIdx > 0 ? styles.coachingJourneyRowDivider : null, jbMovingItem?.type === 'lesson' && jbMovingItem.lessonIdx === lessonIdx ? { borderWidth: 1.5, borderColor: '#3b82f6', borderRadius: 8, backgroundColor: '#eff6ff' } : null]}>
                {/* Lesson header with reorder + delete */}
                <View style={styles.jbLessonHeader}>
                  {isCoachRuntimeOperator && (
                    <JbGrip
                      isPickedUp={jbMovingItem?.type === 'lesson' && jbMovingItem.lessonIdx === lessonIdx}
                      isDropTarget={!!jbMovingItem && jbMovingItem.type === 'lesson' && jbMovingItem.lessonIdx !== lessonIdx}
                      onPress={() => {
                        const jid = selectedJourneyId;
                        if (!jid) return;
                        if (!jbMovingItem) {
                          setJbMovingItem({ type: 'lesson', lessonIdx, lessonId: lesson.id });
                        } else if (jbMovingItem.type === 'lesson' && jbMovingItem.lessonIdx === lessonIdx) {
                          setJbMovingItem(null);
                        } else if (jbMovingItem.type === 'lesson') {
                          void jbReorderLessons(jid, jbMovingItem.lessonIdx, lessonIdx);
                          setJbMovingItem(null);
                        } else {
                          setJbMovingItem(null);
                        }
                      }}
                    />
                  )}
                  {jbEditingLessonId === lesson.id && isCoachRuntimeOperator ? (
                    <View style={[styles.jbLessonTitleBtn, styles.jbEditingWrap]}>
                      <TextInput
                        style={styles.jbEditInput}
                        value={jbEditingLessonTitle}
                        onChangeText={setJbEditingLessonTitle}
                        autoFocus
                        selectTextOnFocus
                        onBlur={() => { const jid = selectedJourneyId; if (jid) void jbRenameLesson(jid, lesson.id, jbEditingLessonTitle); }}
                        onSubmitEditing={() => { const jid = selectedJourneyId; if (jid) void jbRenameLesson(jid, lesson.id, jbEditingLessonTitle); }}
                        placeholder="Lesson title…"
                        placeholderTextColor="#999"
                      />
                      <Text style={styles.jbLessonTaskCount}>{lesson.tasks.length} task{lesson.tasks.length !== 1 ? 's' : ''}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.jbLessonTitleBtn, isActiveLesson ? styles.coachingLessonRowSelected : null]}
                      onPress={() =>
                        openCoachingShell('coaching_lesson_detail', {
                          selectedJourneyId: selectedJourneyId ?? null,
                          selectedJourneyTitle: coachingShellContext.selectedJourneyTitle ?? selectedJourneyTitle ?? null,
                          selectedLessonId: String(lesson.id),
                          selectedLessonTitle: lesson.title,
                        })
                      }
                      onLongPress={() => {
                        if (isCoachRuntimeOperator) {
                          setJbEditingLessonId(lesson.id);
                          setJbEditingLessonTitle(lesson.title);
                        }
                      }}
                    >
                      <Text numberOfLines={1} style={styles.jbLessonTitleText}>{lesson.title}</Text>
                      {isCoachRuntimeOperator && <Text style={styles.jbEditHint}>long-press to rename</Text>}
                      <Text style={styles.jbLessonTaskCount}>{lesson.tasks.length} task{lesson.tasks.length !== 1 ? 's' : ''}</Text>
                    </TouchableOpacity>
                  )}
                  {isCoachRuntimeOperator && (
                    <TouchableOpacity
                      style={styles.jbDeleteBtn}
                      onPress={() => setJbConfirmDelete({ type: 'lesson', id: lesson.id, label: lesson.title })}
                    >
                      <Text style={styles.jbDeleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Tasks within lesson */}
                {lesson.tasks.map((task, taskIdx) => {
                  const assetInfo = task.assetId ? jbAssetsById.get(task.assetId) : null;
                  return (
                    <View key={`jb-task-${task.id}`} style={[styles.jbTaskRow, jbMovingItem?.type === 'task' && jbMovingItem.lessonId === lesson.id && jbMovingItem.taskIdx === taskIdx ? { borderWidth: 1, borderColor: '#3b82f6', borderRadius: 6, backgroundColor: '#eff6ff' } : null]}>
                      {isCoachRuntimeOperator && (
                        <JbGrip
                          small
                          isPickedUp={jbMovingItem?.type === 'task' && jbMovingItem.lessonId === lesson.id && jbMovingItem.taskIdx === taskIdx}
                          isDropTarget={!!jbMovingItem && jbMovingItem.type === 'task' && jbMovingItem.lessonId === lesson.id && jbMovingItem.taskIdx !== taskIdx}
                          onPress={() => {
                            const jid = selectedJourneyId;
                            if (!jid) return;
                            if (!jbMovingItem) {
                              setJbMovingItem({ type: 'task', lessonIdx, lessonId: lesson.id, taskIdx, taskId: task.id });
                            } else if (jbMovingItem.type === 'task' && jbMovingItem.lessonId === lesson.id && jbMovingItem.taskIdx === taskIdx) {
                              setJbMovingItem(null);
                            } else if (jbMovingItem.type === 'task' && jbMovingItem.lessonId === lesson.id && jbMovingItem.taskIdx !== undefined) {
                              void jbReorderTasks(jid, lesson.id, jbMovingItem.taskIdx, taskIdx);
                              setJbMovingItem(null);
                            } else {
                              setJbMovingItem(null);
                            }
                          }}
                        />
                      )}
                      <View style={styles.jbTaskContent}>
                        {jbEditingTaskKey === `${lesson.id}:${task.id}` && isCoachRuntimeOperator ? (
                          <TextInput
                            style={styles.jbEditInputSm}
                            value={jbEditingTaskTitle}
                            onChangeText={setJbEditingTaskTitle}
                            autoFocus
                            selectTextOnFocus
                            onBlur={() => { const jid = selectedJourneyId; if (jid) void jbRenameTask(jid, lesson.id, task.id, jbEditingTaskTitle); }}
                            onSubmitEditing={() => { const jid = selectedJourneyId; if (jid) void jbRenameTask(jid, lesson.id, task.id, jbEditingTaskTitle); }}
                            placeholder="Task title…"
                            placeholderTextColor="#999"
                          />
                        ) : (
                          <TouchableOpacity
                            onLongPress={() => {
                              if (isCoachRuntimeOperator) {
                                setJbEditingTaskKey(`${lesson.id}:${task.id}`);
                                setJbEditingTaskTitle(task.title);
                              }
                            }}
                          >
                            <Text numberOfLines={1} style={styles.jbTaskTitle}>{task.title}</Text>
                          </TouchableOpacity>
                        )}
                        {assetInfo && (
                          <View style={styles.jbTaskAssetBadge}>
                            <Text style={styles.jbTaskAssetBadgeText} numberOfLines={1}>{assetInfo.title}</Text>
                          </View>
                        )}
                      </View>
                      {isCoachRuntimeOperator && (
                        <TouchableOpacity
                          style={styles.jbDeleteBtnSm}
                          onPress={() => setJbConfirmDelete({ type: 'task', id: task.id, parentId: lesson.id, label: task.title })}
                        >
                          <Text style={styles.jbDeleteBtnSmText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}

                {/* Add task to this lesson */}
                {isCoachRuntimeOperator && !shellPackageGateBlocksActions && (
                  <View style={styles.jbAddTaskRow}>
                    {jbAddingTaskToLessonId === lesson.id ? (
                      <View style={styles.jbAddTaskInline}>
                        <TextInput
                          style={styles.jbAddTaskInput}
                          placeholder="Task title…"
                          placeholderTextColor="#999"
                          value={jbNewTaskTitle}
                          onChangeText={setJbNewTaskTitle}
                          onSubmitEditing={() => { const jid = selectedJourneyId; if (jid) void jbAddTask(jid, lesson.id); }}
                        />
                        <TouchableOpacity
                          style={styles.jbAddTaskConfirmBtn}
                          onPress={() => { const jid = selectedJourneyId; if (jid) void jbAddTask(jid, lesson.id); }}
                        >
                          <Text style={styles.jbAddTaskConfirmBtnText}>Add</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.jbAddTaskCancelBtn}
                          onPress={() => { setJbAddingTaskToLessonId(null); setJbNewTaskTitle(''); }}
                        >
                          <Text style={styles.jbAddTaskCancelBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.jbAddTaskBtn}
                        onPress={() => { setJbAddingTaskToLessonId(lesson.id); setJbNewTaskTitle(''); }}
                      >
                        <Text style={styles.jbAddTaskBtnText}>＋ Task</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* Fallback: show original milestones/lessons in read-only for non-operators if jbLessons is empty */}
          {jbLessons.length === 0 && milestoneRows.map((milestone, milestoneIdx) => (
            <View
              key={`coaching-milestone-${milestone.id}`}
              style={[styles.coachingMilestoneBlock, milestoneIdx > 0 ? styles.coachingJourneyRowDivider : null]}
            >
              <Text style={styles.coachingMilestoneTitle}>{milestone.title}</Text>
              {(milestone.lessons ?? []).length === 0 ? (
                <Text style={styles.coachingMilestoneEmpty}>No active lessons yet.</Text>
              ) : (
                (milestone.lessons ?? []).map((lesson, lessonIdx) => {
                  const statusLabel = String(lesson.progress_status ?? 'not_started').replace('_', ' ');
                  return (
                    <TouchableOpacity
                      key={`coaching-lesson-${lesson.id}`}
                      style={[styles.coachingLessonRow, lessonIdx > 0 ? styles.coachingLessonRowDivider : null, shellPackageGateBlocksActions ? styles.disabled : null]}
                      disabled={shellPackageGateBlocksActions}
                      onPress={() =>
                        openCoachingShell('coaching_lesson_detail', {
                          selectedJourneyId: selectedJourneyId ?? null,
                          selectedJourneyTitle: coachingShellContext.selectedJourneyTitle ?? selectedJourneyTitle ?? null,
                          selectedLessonId: String(lesson.id),
                          selectedLessonTitle: lesson.title,
                        })
                      }
                    >
                      <View style={styles.coachingLessonRowCopy}>
                        <Text numberOfLines={1} style={styles.coachingLessonRowTitle}>{lesson.title}</Text>
                        <Text numberOfLines={2} style={styles.coachingLessonRowSub}>
                          {lesson.body?.trim() || 'Lesson content body available on lesson detail.'}
                        </Text>
                      </View>
                      <View style={styles.coachingLessonRowStatusPill}>
                        <Text style={styles.coachingLessonRowStatusText}>{statusLabel}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          ))}
        </View>
      )}

      {/* ── Confirm delete dialog ── */}
      {jbConfirmDelete && (
        <View style={styles.jbConfirmDeleteOverlay}>
          <View style={styles.jbConfirmDeleteCard}>
            <Text style={styles.jbConfirmDeleteTitle}>Delete {jbConfirmDelete.type}?</Text>
            <Text style={styles.jbConfirmDeleteSub}>"{jbConfirmDelete.label}" will be permanently removed.</Text>
            <View style={styles.jbConfirmDeleteActions}>
              <TouchableOpacity style={styles.jbConfirmDeleteCancel} onPress={() => setJbConfirmDelete(null)}>
                <Text style={styles.jbConfirmDeleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.jbConfirmDeleteConfirm}
                onPress={() => {
                  const jid = selectedJourneyId;
                  if (!jid || !jbConfirmDelete) return;
                  if (jbConfirmDelete.type === 'lesson') void jbDeleteLesson(jid, jbConfirmDelete.id);
                  else if (jbConfirmDelete.type === 'task' && jbConfirmDelete.parentId) void jbRemoveTask(jid, jbConfirmDelete.parentId, jbConfirmDelete.id);
                }}
              >
                <Text style={styles.jbConfirmDeleteConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  jbSaveBanner: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  jbSaveBannerOk: { backgroundColor: '#f0fdf4' },
  jbSaveBannerPending: { backgroundColor: '#fef9c3' },
  jbSaveBannerError: { backgroundColor: '#fef2f2' },
  jbSaveBannerText: { fontSize: 12, color: '#333' },
  jbActionBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  jbActionBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  jbActionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  jbActionBtnSecondary: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  jbActionBtnSecondaryText: { color: '#475569' },
  jbAssetLibraryPanel: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    maxHeight: 280,
  },
  jbAssetLibraryTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  jbAssetLibraryEmpty: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  jbAssetCollectionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  jbAssetCollectionChip: { backgroundColor: '#e0e7ff', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  jbAssetCollectionChipText: { fontSize: 11, color: '#3730a3', fontWeight: '600' },
  jbAssetListScroll: { flex: 1 },
  jbAssetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  jbAssetRowInfo: { flex: 1, marginRight: 8 },
  jbAssetRowTitle: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  jbAssetRowMeta: { fontSize: 11, color: '#94a3b8' },
  jbAssetAddBtn: { backgroundColor: '#dbeafe', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  jbAssetAddBtnText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  jbLessonBlock: { marginBottom: 4 },
  jbLessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    marginBottom: 2,
  },
  jbLessonTitleBtn: { flex: 1, marginRight: 8 },
  jbLessonTitleText: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  jbLessonTaskCount: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  jbDeleteBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#fef2f2' },
  jbDeleteBtnText: { fontSize: 14, color: '#dc2626' },
  jbDeleteBtnSm: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#fef2f2' },
  jbDeleteBtnSmText: { fontSize: 12, color: '#dc2626' },
  jbTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  jbTaskContent: { flex: 1, marginRight: 6 },
  jbTaskTitle: { fontSize: 13, fontWeight: '500', color: '#334155' },
  jbEditingWrap: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#2563eb', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
  jbEditInput: { fontSize: 14, fontWeight: '700', color: '#1e293b', paddingVertical: 2, paddingHorizontal: 0, borderWidth: 0 },
  jbEditInputSm: { fontSize: 13, fontWeight: '500', color: '#334155', paddingVertical: 2, paddingHorizontal: 0, borderWidth: 0, borderBottomWidth: 1, borderBottomColor: '#2563eb' },
  jbEditHint: { fontSize: 9, color: '#c0c8d4', fontStyle: 'italic', marginTop: 1 },
  jbTaskAssetBadge: { marginTop: 2, backgroundColor: '#eff6ff', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start' },
  jbTaskAssetBadgeText: { fontSize: 10, color: '#2563eb' },
  jbAddTaskRow: { marginLeft: 16, paddingVertical: 4, paddingHorizontal: 12 },
  jbAddTaskBtn: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#f0fdf4', borderRadius: 6, alignSelf: 'flex-start' },
  jbAddTaskBtnText: { fontSize: 12, fontWeight: '600', color: '#16a34a' },
  jbAddTaskInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  jbAddTaskInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, fontSize: 13, color: '#1e293b' },
  jbAddTaskConfirmBtn: { backgroundColor: '#16a34a', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  jbAddTaskConfirmBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  jbAddTaskCancelBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  jbAddTaskCancelBtnText: { fontSize: 14, color: '#94a3b8' },
  jbConfirmDeleteOverlay: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
  },
  jbConfirmDeleteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  jbConfirmDeleteTitle: { fontSize: 16, fontWeight: '700', color: '#dc2626', marginBottom: 6 },
  jbConfirmDeleteSub: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  jbConfirmDeleteActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  jbConfirmDeleteCancel: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#f1f5f9' },
  jbConfirmDeleteCancelText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  jbConfirmDeleteConfirm: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#dc2626' },
  jbConfirmDeleteConfirmText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  // Shared coaching styles used in the fallback read-only section
  coachingJourneyEmptyCard: {
    borderRadius: 10,
    backgroundColor: '#f4f6fa',
    borderWidth: 1,
    borderColor: '#e4e9f1',
    padding: 10,
    gap: 6,
    alignItems: 'flex-start',
  },
  coachingJourneyEmptyTitle: {
    color: '#3b4556',
    fontSize: 12,
    fontWeight: '800',
  },
  coachingJourneyEmptySub: {
    color: '#7d8899',
    fontSize: 11,
    lineHeight: 15,
  },
  coachingJourneyListCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f2',
    backgroundColor: '#f7f9fc',
    overflow: 'hidden',
  },
  coachingJourneyRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#e3e8f0',
  },
  coachingLessonRowSelected: {
    borderColor: '#cfe0ff',
    backgroundColor: '#f2f7ff',
  },
  coachingMilestoneBlock: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  coachingMilestoneTitle: {
    color: '#4a5569',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  coachingMilestoneEmpty: {
    color: '#8a93a3',
    fontSize: 11,
  },
  coachingLessonRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e1e7f0',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachingLessonRowDivider: {
    marginTop: 6,
  },
  coachingLessonRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  coachingLessonRowTitle: {
    color: '#394455',
    fontSize: 12,
    fontWeight: '700',
  },
  coachingLessonRowSub: {
    color: '#7f8999',
    fontSize: 10,
    lineHeight: 13,
  },
  coachingLessonRowStatusPill: {
    borderRadius: 999,
    backgroundColor: '#eef2f8',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coachingLessonRowStatusText: {
    color: '#5d6b81',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
