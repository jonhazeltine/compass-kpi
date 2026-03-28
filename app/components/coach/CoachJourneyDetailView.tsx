import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

/* ─── Types ─── */

export type JBTask = {
  id: string;
  title: string;
  assetId: string | null;
  progressStatus?: 'not_started' | 'in_progress' | 'completed';
  completedAt?: string | null;
};

export type JBLesson = {
  id: string;
  title: string;
  tasks: JBTask[];
};

export type LibraryAsset = {
  id: string;
  title: string;
  category: string;
  scope: string;
  duration: string;
  /** Mux playback ID for thumbnail generation */
  playbackId?: string | null;
};

export type LibraryCollection = {
  id: string;
  name: string;
  assetIds: string[];
};

export type EnrolledMember = {
  id: string;
  name: string;
  roleLabel?: string;
  avatarTone?: string;
};

export type CoachJourneyDetailProps = {
  /* Journey data */
  journeyTitle: string;
  journeyDescription?: string;
  lessons: JBLesson[];
  enrolledMembers: EnrolledMember[];

  /* Asset library */
  assets: LibraryAsset[];
  assetsById: Map<string, LibraryAsset>;
  collections: LibraryCollection[];
  onFetchAssets: () => void;

  /* Can this user edit? */
  isOperator: boolean;

  /* Actions */
  onBack: () => void;
  onAddLesson: () => void;
  onDeleteLesson: (lessonId: string) => void;
  onRenameLesson: (lessonId: string, title: string) => void;
  onReorderLessons: (fromIdx: number, toIdx: number) => void;
  onAddTask: (lessonId: string) => void;
  onDeleteTask: (lessonId: string, taskId: string) => void;
  onRenameTask: (lessonId: string, taskId: string, title: string) => void;
  onReorderTasks: (lessonId: string, fromIdx: number, toIdx: number) => void;
  onAddAssetAsTask: (lessonId: string, asset: LibraryAsset) => void;
  onLessonPress?: (lessonId: string, lessonTitle: string) => void;
  onMarkComplete?: (taskId: string) => void;
  onMemberPress: (memberId: string) => void;
  onShareInvite?: () => void;
  /** All coaching clients NOT yet enrolled in this journey */
  availableClients?: Array<{ id: string; name: string }>;
  onEnrollClient?: (clientId: string) => void | Promise<void>;
  onUnenrollMember?: (memberId: string) => void | Promise<void>;

  /* Save state */
  saveState: 'idle' | 'pending' | 'saved' | 'error';
  saveMessage?: string;

  /* Loading states */
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

/* ─── Mux Thumbnail Helper ─── */

function muxThumb(playbackId: string | null | undefined, opts?: { width?: number; time?: number }): string | null {
  if (!playbackId) return null;
  const w = opts?.width ?? 320;
  const t = opts?.time ?? 1;
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${w}&height=${Math.round(w * 0.5625)}&time=${t}&fit_mode=smartcrop`;
}

/* ─── Inline Lesson Video Card ─── */

function LessonVideoCard({ playbackId, title }: { playbackId: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const streamUrl = `https://stream.mux.com/${playbackId}.m3u8`;
  const posterUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?width=640&height=360&time=1&fit_mode=smartcrop`;
  const player = useVideoPlayer(playing ? streamUrl : null, (p) => { p.loop = false; });
  useEffect(() => {
    if (playing) { try { player.play(); } catch { /* ignore */ } }
  }, [player, playing]);

  return (
    <View style={{ borderRadius: 10, overflow: 'hidden', backgroundColor: '#0F172A' }}>
      {playing ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <VideoView player={player} style={s.lessonThumb} nativeControls contentFit="contain" />
      ) : (
        <Pressable onPress={() => setPlaying(true)} style={{ width: '100%' as any }}>
          <Image source={{ uri: posterUrl }} style={s.lessonThumb} resizeMode="cover" />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 18, marginLeft: 3 }}>▶</Text>
            </View>
          </View>
          {title ? (
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{title}</Text>
            </View>
          ) : null}
        </Pressable>
      )}
    </View>
  );
}

/* ─── Component ─── */

export default function CoachJourneyDetailView(props: CoachJourneyDetailProps) {
  const {
    journeyTitle,
    journeyDescription,
    lessons,
    enrolledMembers,
    assets,
    assetsById,
    collections,
    onFetchAssets,
    isOperator,
    onBack,
    onAddLesson,
    onDeleteLesson,
    onRenameLesson,
    onReorderLessons,
    onAddTask,
    onDeleteTask,
    onRenameTask,
    onReorderTasks,
    onAddAssetAsTask,
    onLessonPress,
    onMarkComplete,
    onMemberPress,
    onShareInvite,
    availableClients,
    onEnrollClient,
    onUnenrollMember,
    saveState,
    saveMessage,
    loading,
    error,
    onRetry,
  } = props;

  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [assetModalTargetLesson, setAssetModalTargetLesson] = useState<string | null>(null);
  const [addMenuLessonId, setAddMenuLessonId] = useState<string | null>(null);
  const [linkInputLessonId, setLinkInputLessonId] = useState<string | null>(null);
  const [linkInputValue, setLinkInputValue] = useState('');
  const [textTaskValue, setTextTaskValue] = useState('');
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingLessonTitle, setEditingLessonTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<{ type: 'lesson' | 'task'; id: string; parentId?: string; label: string } | null>(null);
  const [expandedLessonIds, setExpandedLessonIds] = useState<Set<string>>(new Set());
  const [showEnrollPicker, setShowEnrollPicker] = useState(false);
  const screenWidth = Dimensions.get('window').width;

  // Kick off the asset library fetch immediately on mount so thumbnails
  // are available without waiting for the user to open the library picker.
  useEffect(() => {
    if (assetsById.size === 0) {
      onFetchAssets();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLesson = useCallback((id: string) => {
    setExpandedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const openAssetPicker = useCallback((lessonId: string) => {
    setAssetModalTargetLesson(lessonId);
    setAssetModalOpen(true);
    onFetchAssets();
  }, [onFetchAssets]);

  /* Count total tasks across all lessons */
  const totalTasks = useMemo(() => lessons.reduce((sum, l) => sum + l.tasks.length, 0), [lessons]);

  /* ─── Loading / Error ─── */
  if (loading) {
    return (
      <View style={s.centerWrap}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={s.loadingText}>Loading journey...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.centerWrap}>
        <Text style={s.errorIcon}>!</Text>
        <Text style={s.errorText}>{error}</Text>
        {onRetry && (
          <TouchableOpacity style={s.retryBtn} onPress={onRetry}>
            <Text style={s.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  /* ─── Render ─── */
  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.backArrow}>‹</Text>
          <Text style={s.backLabel}>Journeys</Text>
        </TouchableOpacity>
        {saveState === 'pending' && <Text style={s.savePill}>Saving...</Text>}
        {saveState === 'saved' && <Text style={[s.savePill, s.savePillOk]}>Saved</Text>}
        {saveState === 'error' && <Text style={[s.savePill, s.savePillErr]}>{saveMessage || 'Error'}</Text>}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollInner} showsVerticalScrollIndicator={false}>
        {/* ── Journey Info Card ── */}
        <View style={s.heroCard}>
          <Text style={s.heroTitle}>{journeyTitle}</Text>
          {journeyDescription ? <Text style={s.heroDesc}>{journeyDescription}</Text> : null}
          <View style={s.heroStats}>
            <View style={s.statChip}>
              <Text style={s.statNum}>{lessons.length}</Text>
              <Text style={s.statLabel}>Lessons</Text>
            </View>
            <View style={s.statChip}>
              <Text style={s.statNum}>{totalTasks}</Text>
              <Text style={s.statLabel}>Tasks</Text>
            </View>
            <View style={s.statChip}>
              <Text style={s.statNum}>{enrolledMembers.length}</Text>
              <Text style={s.statLabel}>Members</Text>
            </View>
          </View>
          {isOperator && onShareInvite && (
            <TouchableOpacity style={s.inviteBtn} onPress={onShareInvite}>
              <Text style={s.inviteBtnText}>Share Invite Link</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Enrolled Clients ── */}
        {isOperator && (
          <View style={s.membersSection}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel}>Enrolled Clients</Text>
              {isOperator && (
                <TouchableOpacity
                  style={[s.addLessonBtn, (availableClients?.length ?? 0) === 0 && { opacity: 0.4 }]}
                  onPress={() => (availableClients?.length ?? 0) > 0 && setShowEnrollPicker((v) => !v)}
                >
                  <Text style={s.addLessonBtnText}>+ Enroll Client</Text>
                </TouchableOpacity>
              )}
            </View>
            {enrolledMembers.length === 0 && (
              <Text style={{ fontSize: 13, color: '#94A3B8', paddingHorizontal: 16, paddingBottom: 8 }}>
                No clients enrolled yet. Tap "+ Enroll Client" to add someone.
              </Text>
            )}
            {enrolledMembers.length > 0 ? (
              <View style={{ paddingHorizontal: 16, gap: 6 }}>
                {enrolledMembers.map((m) => (
                  // Row is a plain View — avatar+name tap opens profile, × button is a sibling (no nesting)
                  <View key={m.id} style={{ flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' as const }}>
                    <TouchableOpacity style={{ flexDirection: 'row' as const, alignItems: 'center' as const, flex: 1, padding: 10, gap: 10 }} onPress={() => onMemberPress(m.id)} activeOpacity={0.7}>
                      <View style={[s.memberAvatar, { backgroundColor: m.avatarTone || '#E0E7FF' }]}>
                        <Text style={s.memberAvatarText}>
                          {m.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: '500' as const, color: '#1E293B' }}>{m.name}</Text>
                    </TouchableOpacity>
                    {onUnenrollMember && (
                      <TouchableOpacity onPress={() => onUnenrollMember(m.id)} style={{ paddingHorizontal: 14, paddingVertical: 10 }} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                        <Text style={{ fontSize: 18, color: '#94A3B8', lineHeight: 20 }}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: '#94A3B8', paddingHorizontal: 16, paddingBottom: 4 }}>
                No clients enrolled yet.
              </Text>
            )}
            {/* Enroll picker */}
            {showEnrollPicker && (availableClients?.length ?? 0) > 0 && (
              <View style={s.enrollPicker}>
                {availableClients!.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={s.enrollPickerRow}
                    onPress={() => { onEnrollClient?.(c.id); setShowEnrollPicker(false); }}
                  >
                    <View style={[s.memberAvatar, { backgroundColor: '#DBEAFE', width: 32, height: 32, borderRadius: 16 }]}>
                      <Text style={[s.memberAvatarText, { fontSize: 12 }]}>
                        {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={s.enrollPickerName}>{c.name}</Text>
                    <Text style={s.enrollPickerAction}>Enroll</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Lessons ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>Lessons</Text>
          {isOperator && (
            <TouchableOpacity style={s.addLessonBtn} onPress={onAddLesson}>
              <Text style={s.addLessonBtnText}>+ Add Lesson</Text>
            </TouchableOpacity>
          )}
        </View>

        {lessons.length === 0 ? (
          <View style={s.emptyLessons}>
            <Text style={s.emptyIcon}>📚</Text>
            <Text style={s.emptyTitle}>No lessons yet</Text>
            <Text style={s.emptySub}>
              {isOperator ? 'Tap "+ Add Lesson" to start building your program.' : 'No lessons have been created yet.'}
            </Text>
          </View>
        ) : (
          lessons.map((lesson, idx) => {
            const isExpanded = expandedLessonIds.has(lesson.id);
            const firstVideoTask = lesson.tasks.find((t) => {
              if (!t.assetId) return false;
              const a = assetsById.get(t.assetId);
              return a?.playbackId;
            });
            const thumbAsset = firstVideoTask?.assetId ? assetsById.get(firstVideoTask.assetId) : null;
            const thumbUrl = muxThumb(thumbAsset?.playbackId, { width: screenWidth > 400 ? 640 : 320 });

            const primaryTask = lesson.tasks[0];
            const progressStatus = primaryTask?.progressStatus ?? 'not_started';

            return (
              <View key={lesson.id} style={s.lessonCard}>
                {/* Thumbnail / inline video */}
                {thumbAsset?.playbackId ? (
                  <View style={{ position: 'relative' }}>
                    <View style={{ margin: 0 }}>
                      <LessonVideoCard playbackId={thumbAsset.playbackId} title={thumbAsset.title} />
                    </View>
                    <View style={s.lessonNumberBadge}>
                      <Text style={s.lessonNumberText}>{idx + 1}</Text>
                    </View>
                  </View>
                ) : (
                  <Pressable style={s.lessonThumbPlaceholder} onPress={() => toggleLesson(lesson.id)}>
                    <View style={s.lessonNumberBadgePlain}>
                      <Text style={s.lessonNumberTextPlain}>{idx + 1}</Text>
                    </View>
                    <Text style={s.placeholderIcon}>🎬</Text>
                    <Text style={s.placeholderText}>No video attached</Text>
                  </Pressable>
                )}

                {/* Lesson info */}
                <View style={s.lessonInfo}>
                  {editingLessonId === lesson.id && isOperator ? (
                    <TextInput
                      style={s.lessonTitleEdit}
                      value={editingLessonTitle}
                      onChangeText={setEditingLessonTitle}
                      autoFocus
                      selectTextOnFocus
                      onBlur={() => { onRenameLesson(lesson.id, editingLessonTitle); setEditingLessonId(null); }}
                      onSubmitEditing={() => { onRenameLesson(lesson.id, editingLessonTitle); setEditingLessonId(null); }}
                    />
                  ) : (
                    <Pressable
                      onPress={() => toggleLesson(lesson.id)}
                      onLongPress={isOperator ? () => { setEditingLessonId(lesson.id); setEditingLessonTitle(lesson.title); } : undefined}
                    >
                      <Text style={s.lessonTitle} numberOfLines={2}>{lesson.title}</Text>
                    </Pressable>
                  )}
                  <Text style={s.lessonMeta}>
                    {lesson.tasks.length} task{lesson.tasks.length !== 1 ? 's' : ''}
                    {thumbAsset ? ` · ${thumbAsset.duration || ''}` : ''}
                  </Text>

                  {/* Progress status + expand toggle */}
                  <View style={s.lessonActionRow}>
                    {primaryTask && (
                      <View style={s.lessonProgressRow}>
                        {progressStatus === 'completed' ? (
                          <View style={s.progressPillDone}><Text style={s.progressPillDoneText}>✓ Completed</Text></View>
                        ) : progressStatus === 'in_progress' ? (
                          <View style={s.progressPillActive}><Text style={s.progressPillActiveText}>In Progress</Text></View>
                        ) : onMarkComplete ? (
                          <TouchableOpacity style={s.progressPillBtn} onPress={() => onMarkComplete(primaryTask.id)}>
                            <Text style={s.progressPillBtnText}>Mark Complete</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}
                    {lesson.tasks.length > 0 && (
                      <Pressable style={s.expandBtn} onPress={() => toggleLesson(lesson.id)}>
                        <Text style={s.expandBtnText}>{isExpanded ? 'Hide tasks ▴' : 'Show tasks ▾'}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Operator toolbar — compact row under lesson info */}
                {isOperator && (
                  <View style={s.lessonToolbar}>
                    <TouchableOpacity
                      style={s.toolbarAddTask}
                      onPress={() => {
                        setAddMenuLessonId(addMenuLessonId === lesson.id ? null : lesson.id);
                        setTextTaskValue('');
                        setLinkInputLessonId(null);
                      }}
                    >
                      <Text style={s.toolbarAddTaskText}>+ Add Task</Text>
                    </TouchableOpacity>
                    <View style={s.toolbarRight}>
                      {idx > 0 && (
                        <TouchableOpacity style={s.toolbarBtn} onPress={() => onReorderLessons(idx, idx - 1)}>
                          <Text style={s.toolbarBtnText}>▲</Text>
                        </TouchableOpacity>
                      )}
                      {idx < lessons.length - 1 && (
                        <TouchableOpacity style={s.toolbarBtn} onPress={() => onReorderLessons(idx, idx + 1)}>
                          <Text style={s.toolbarBtnText}>▼</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={s.toolbarBtn}
                        onPress={() => setConfirmDeleteId({ type: 'lesson', id: lesson.id, label: lesson.title })}
                      >
                        <Text style={[s.toolbarBtnText, { color: '#EF4444' }]}>×</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Add Task panel — name field with optional attachment row */}
                {addMenuLessonId === lesson.id && (
                  <View style={s.addTaskPanel}>
                    <TextInput
                      style={s.addTaskInput}
                      value={textTaskValue}
                      onChangeText={setTextTaskValue}
                      placeholder="Task name..."
                      placeholderTextColor="#94A3B8"
                      autoFocus
                      onSubmitEditing={() => {
                        if (textTaskValue.trim()) {
                          onAddTask(lesson.id);
                          setTextTaskValue('');
                          setAddMenuLessonId(null);
                        }
                      }}
                    />
                    {/* Attachment options row */}
                    <View style={s.addTaskActions}>
                      <TouchableOpacity style={s.addTaskAttach} onPress={() => openAssetPicker(lesson.id)}>
                        <Text style={s.addTaskAttachText}>Attach Video</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.addTaskAttach} onPress={() => { setLinkInputLessonId(lesson.id); setLinkInputValue(''); }}>
                        <Text style={s.addTaskAttachText}>Add Link</Text>
                      </TouchableOpacity>
                      <View style={{ flex: 1 }} />
                      <TouchableOpacity
                        style={[s.addTaskSave, !textTaskValue.trim() && { opacity: 0.4 }]}
                        disabled={!textTaskValue.trim()}
                        onPress={() => {
                          if (textTaskValue.trim()) {
                            onAddTask(lesson.id);
                            setTextTaskValue('');
                            setAddMenuLessonId(null);
                          }
                        }}
                      >
                        <Text style={s.addTaskSaveText}>Save</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Inline link input (shows when "Add Link" tapped) */}
                    {linkInputLessonId === lesson.id && (
                      <View style={s.linkRow}>
                        <TextInput
                          style={s.linkInput}
                          value={linkInputValue}
                          onChangeText={setLinkInputValue}
                          placeholder="https://..."
                          placeholderTextColor="#94A3B8"
                          autoFocus
                          autoCapitalize="none"
                          keyboardType="url"
                          onSubmitEditing={() => {
                            if (linkInputValue.trim()) {
                              onAddAssetAsTask(lesson.id, { id: `link_${Date.now()}`, title: linkInputValue.trim(), category: 'Link', scope: '', duration: '' });
                              setLinkInputLessonId(null);
                            }
                          }}
                        />
                        <TouchableOpacity
                          style={[s.addTaskSave, !linkInputValue.trim() && { opacity: 0.4 }]}
                          disabled={!linkInputValue.trim()}
                          onPress={() => {
                            if (linkInputValue.trim()) {
                              onAddAssetAsTask(lesson.id, { id: `link_${Date.now()}`, title: linkInputValue.trim(), category: 'Link', scope: '', duration: '' });
                              setLinkInputLessonId(null);
                            }
                          }}
                        >
                          <Text style={s.addTaskSaveText}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {/* Expanded task list */}
                {isExpanded && lesson.tasks.length > 0 && (
                  <View style={s.taskList}>
                    {lesson.tasks.map((task, tIdx) => {
                      const taskAsset = task.assetId ? assetsById.get(task.assetId) : null;
                      const taskThumb = muxThumb(taskAsset?.playbackId, { width: 160 });
                      return (
                        <View key={task.id} style={s.taskRow}>
                          {taskThumb ? (
                            <Image source={{ uri: taskThumb }} style={s.taskThumb} resizeMode="cover" />
                          ) : (
                            <View style={s.taskThumbEmpty}>
                              <Text style={s.taskThumbEmptyText}>{tIdx + 1}</Text>
                            </View>
                          )}
                          <View style={s.taskInfo}>
                            <Text style={s.taskTitle} numberOfLines={1}>{task.title}</Text>
                            {taskAsset && <Text style={s.taskMeta}>{taskAsset.category} · {taskAsset.duration}</Text>}
                          </View>
                          {isOperator && (
                            <TouchableOpacity
                              style={s.taskDeleteBtn}
                              onPress={() => setConfirmDeleteId({ type: 'task', id: task.id, parentId: lesson.id, label: task.title })}
                            >
                              <Text style={s.taskDeleteText}>×</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ─── Asset Library Modal ─── */}
      <Modal visible={assetModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAssetModalOpen(false)}>
        <View style={s.modalRoot}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add Content</Text>
            <TouchableOpacity onPress={() => setAssetModalOpen(false)}>
              <Text style={s.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={assets}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.modalList}
            renderItem={({ item: asset }) => {
              const thumb = muxThumb(asset.playbackId, { width: 240 });
              return (
                <TouchableOpacity
                  style={s.modalAssetRow}
                  onPress={() => {
                    if (assetModalTargetLesson) {
                      onAddAssetAsTask(assetModalTargetLesson, asset);
                    }
                    setAssetModalOpen(false);
                  }}
                >
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={s.modalAssetThumb} resizeMode="cover" />
                  ) : (
                    <View style={[s.modalAssetThumb, s.modalAssetThumbEmpty]}>
                      <Text style={{ color: '#94A3B8', fontSize: 20 }}>🎬</Text>
                    </View>
                  )}
                  <View style={s.modalAssetInfo}>
                    <Text style={s.modalAssetTitle} numberOfLines={2}>{asset.title}</Text>
                    <Text style={s.modalAssetMeta}>{asset.category} · {asset.duration}</Text>
                  </View>
                  <View style={s.modalAddBadge}>
                    <Text style={s.modalAddBadgeText}>Add</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={s.modalEmpty}>
                <ActivityIndicator size="small" color="#6366F1" />
                <Text style={s.modalEmptyText}>Loading asset library...</Text>
              </View>
            }
          />
        </View>
      </Modal>

      {/* ─── Confirm Delete Dialog ─── */}
      {confirmDeleteId && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setConfirmDeleteId(null)}>
          <Pressable style={s.dialogBackdrop} onPress={() => setConfirmDeleteId(null)}>
            <View style={s.dialogCard}>
              <Text style={s.dialogTitle}>Delete {confirmDeleteId.type}?</Text>
              <Text style={s.dialogBody}>"{confirmDeleteId.label}" will be permanently removed.</Text>
              <View style={s.dialogBtns}>
                <TouchableOpacity style={s.dialogCancel} onPress={() => setConfirmDeleteId(null)}>
                  <Text style={s.dialogCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.dialogDanger}
                  onPress={() => {
                    if (confirmDeleteId.type === 'lesson') onDeleteLesson(confirmDeleteId.id);
                    else if (confirmDeleteId.parentId) onDeleteTask(confirmDeleteId.parentId, confirmDeleteId.id);
                    setConfirmDeleteId(null);
                  }}
                >
                  <Text style={s.dialogDangerText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

/* ─── Styles ─── */

const THUMB_RATIO = 9 / 16;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backArrow: { fontSize: 28, color: '#6366F1', fontWeight: '300', marginTop: -2 },
  backLabel: { fontSize: 16, color: '#6366F1', fontWeight: '600' },
  savePill: { fontSize: 12, color: '#64748B', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  savePillOk: { backgroundColor: '#ECFDF5', color: '#059669' },
  savePillErr: { backgroundColor: '#FEF2F2', color: '#DC2626' },

  /* Scroll */
  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingBottom: 120, gap: 16 },

  /* Hero card */
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  heroDesc: { fontSize: 14, color: '#64748B', lineHeight: 20, marginBottom: 16 },
  heroStats: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statChip: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statNum: { fontSize: 20, fontWeight: '700', color: '#6366F1' },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  inviteBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  inviteBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  /* Members */
  membersRow: { gap: 8 },
  membersSection: { gap: 4 },
  enrollPicker: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden' as const,
  },
  enrollPickerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  enrollPickerName: { flex: 1, fontSize: 14, fontWeight: '500' as const, color: '#1E293B' },
  enrollPickerAction: { fontSize: 13, fontWeight: '600' as const, color: '#6366F1' },
  memberScroll: { gap: 12, paddingVertical: 4 },
  memberChip: { alignItems: 'center', gap: 4, width: 56 },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 14, fontWeight: '700', color: '#4338CA' },
  memberName: { fontSize: 11, color: '#64748B', textAlign: 'center' },

  /* Section headers */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  addLessonBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addLessonBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  /* Lesson card */
  lessonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  lessonThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E2E8F0',
  },
  lessonThumbOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { color: '#FFF', fontSize: 18, marginLeft: 3 },
  lessonNumberBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(99,102,241,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumberText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  lessonThumbPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  lessonNumberBadgePlain: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumberTextPlain: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  placeholderIcon: { fontSize: 28 },
  placeholderText: { fontSize: 12, color: '#94A3B8' },
  lessonInfo: { padding: 14, gap: 4 },
  lessonTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  lessonTitleEdit: { fontSize: 16, fontWeight: '600', color: '#0F172A', borderBottomWidth: 1, borderBottomColor: '#6366F1', paddingVertical: 4 },
  lessonMeta: { fontSize: 12, color: '#94A3B8' },
  lessonActionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  lessonProgressRow: { flexDirection: 'row' as const },
  progressPillDone: { backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  progressPillDoneText: { color: '#15803D', fontSize: 12, fontWeight: '600' as const },
  progressPillActive: { backgroundColor: '#FEF3C7', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  progressPillActiveText: { color: '#92400E', fontSize: 12, fontWeight: '600' as const },
  progressPillBtn: { backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  progressPillBtnText: { color: '#4338CA', fontSize: 12, fontWeight: '600' as const },
  expandBtn: {},
  expandBtnText: { fontSize: 12, color: '#6366F1', fontWeight: '600' },

  /* Lesson actions */
  lessonActions: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
  },
  lessonActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  lessonActionIcon: { fontSize: 18, color: '#6366F1', fontWeight: '600' },
  lessonActionDanger: { },
  lessonActionDangerIcon: { fontSize: 20, color: '#EF4444', fontWeight: '600' },

  /* Lesson toolbar */
  lessonToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F1F5F9',
  },
  toolbarAddTask: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toolbarAddTaskText: { fontSize: 13, fontWeight: '600', color: '#6366F1' },
  toolbarRight: { flexDirection: 'row', marginLeft: 'auto', gap: 4 },
  toolbarBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarBtnText: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },

  /* Add Task panel */
  addTaskPanel: {
    backgroundColor: '#FAFAFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  addTaskInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  addTaskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addTaskAttach: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  addTaskAttachText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  addTaskSave: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addTaskSaveText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  linkRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  linkInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },

  /* Task list */
  taskList: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
  },
  taskThumb: { width: 56, height: 32, borderRadius: 6, backgroundColor: '#E2E8F0' },
  taskThumbEmpty: { width: 56, height: 32, borderRadius: 6, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  taskThumbEmptyText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 13, fontWeight: '500', color: '#334155' },
  taskMeta: { fontSize: 11, color: '#94A3B8' },
  taskDeleteBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  taskDeleteText: { fontSize: 16, color: '#CBD5E1', fontWeight: '600' },

  /* Empty state */
  emptyLessons: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#334155' },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', maxWidth: 260 },

  /* Loading / error */
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  loadingText: { fontSize: 14, color: '#64748B' },
  errorIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEE2E2', color: '#DC2626', fontSize: 20, fontWeight: '700', textAlign: 'center', lineHeight: 40, overflow: 'hidden' },
  errorText: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  retryBtn: { backgroundColor: '#6366F1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#FFF', fontWeight: '600' },

  /* Asset modal */
  modalRoot: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  modalClose: { fontSize: 16, color: '#6366F1', fontWeight: '600' },
  modalList: { padding: 16, gap: 12 },
  modalAssetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 8,
  },
  modalAssetThumb: { width: 100, height: 56, borderRadius: 8, backgroundColor: '#E2E8F0' },
  modalAssetThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  modalAssetInfo: { flex: 1 },
  modalAssetTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  modalAssetMeta: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  modalAddBadge: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modalAddBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  modalEmpty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  modalEmptyText: { fontSize: 14, color: '#64748B' },

  /* Confirm dialog */
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialogCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    gap: 12,
  },
  dialogTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  dialogBody: { fontSize: 14, color: '#64748B' },
  dialogBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dialogCancel: { flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  dialogCancelText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  dialogDanger: { flex: 1, backgroundColor: '#EF4444', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  dialogDangerText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
});
