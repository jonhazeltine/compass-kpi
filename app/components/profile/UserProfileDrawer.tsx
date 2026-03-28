import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  createProfileGoal,
  createProfileTask,
  fetchProfileAssignments,
  type ProfileAssignment,
  type ProfileAssignmentsCapabilities,
  type ProfileAssignmentStatus,
  updateProfileGoal,
  updateProfileTask,
} from "../../lib/profileAssignmentsApi";
import {
  AVATAR_PRESETS,
  initialsFromName,
  saveProfileIdentity,
  toneForAvatarPreset,
  uploadProfileAvatar,
} from "../../lib/profileIdentity";

export type UserProfileDrawerMember = {
  id: string;
  userId: string | null;
  name: string;
  roleLabel: string;
  avatarTone: string;
  avatarPresetId?: string | null;
  avatarUrl: string | null;
  email: string;
  phone: string;
  coachingGoals: string[];
  kpiGoals: string[];
  cohorts: string[];
  journeys: string[];
};

type Props = {
  visible: boolean;
  member: UserProfileDrawerMember | null;
  accessToken: string | null;
  viewerUserId: string | null;
  canRemoveMember?: boolean;
  removeBusy?: boolean;
  onClose: () => void;
  onMessage: () => void;
  onRemoveMember?: () => void;
  onIdentityUpdated?: (next: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    avatarPresetId: string;
    avatarTone: string;
  }) => void;
  /** All journeys the coach owns — for enroll/unenroll picker */
  availableJourneys?: Array<{ id: string; title: string }>;
  onEnrollJourney?: (journeyId: string) => void | Promise<void>;
  onUnenrollJourney?: (journeyId: string) => void | Promise<void>;
};

type DrawerTab = "tasks" | "goals" | "completed";

const TAB_ORDER: DrawerTab[] = ["tasks", "goals", "completed"];

function formatShortDate(value: string | null | undefined) {
  if (!value) return "No due date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No due date";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function replaceAssignment(rows: ProfileAssignment[], next: ProfileAssignment | null) {
  if (!next) return rows;
  const existingIndex = rows.findIndex((row) => row.id === next.id && row.source === next.source);
  if (existingIndex === -1) {
    return [next, ...rows].sort(sortAssignments);
  }
  const copy = [...rows];
  copy[existingIndex] = next;
  return copy.sort(sortAssignments);
}

function sortAssignments(a: ProfileAssignment, b: ProfileAssignment) {
  const aDone = a.status === "completed";
  const bDone = b.status === "completed";
  if (aDone !== bDone) return aDone ? 1 : -1;
  if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
  if (a.due_at && !b.due_at) return -1;
  if (!a.due_at && b.due_at) return 1;
  return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
}

function tabLabel(tab: DrawerTab) {
  if (tab === "tasks") return "Tasks";
  if (tab === "goals") return "Goals";
  return "Completed";
}

function assignmentTypeLabel(type: string) {
  if (type === "coach_task") return "Coach Task";
  if (type.includes("task")) return "Task";
  if (type === "coach_goal") return "Coach Goal";
  if (type === "team_leader_goal") return "Team Goal";
  if (type === "sponsor_goal") return "Sponsor Goal";
  if (type.includes("goal")) return "Goal";
  return "Item";
}

function assignmentStatusLabel(status: string, isCompleted: boolean) {
  if (isCompleted) return "Completed";
  if (status === "in_progress") return "In Progress";
  return "Open";
}

export default function UserProfileDrawer({
  visible,
  member,
  accessToken,
  viewerUserId,
  canRemoveMember = false,
  removeBusy = false,
  onClose,
  onMessage,
  onRemoveMember,
  onIdentityUpdated,
  availableJourneys,
  onEnrollJourney,
  onUnenrollJourney,
}: Props) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("tasks");
  const [assignments, setAssignments] = useState<ProfileAssignment[]>([]);
  const [capabilities, setCapabilities] = useState<ProfileAssignmentsCapabilities | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDueAt, setGoalDueAt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [identityModalVisible, setIdentityModalVisible] = useState(false);
  const [identityDraftName, setIdentityDraftName] = useState("");
  const [identityDraftAvatarUrl, setIdentityDraftAvatarUrl] = useState("");
  const [identityDraftAvatarPresetId, setIdentityDraftAvatarPresetId] = useState(AVATAR_PRESETS[0].id);
  const [journeyPickerVisible, setJourneyPickerVisible] = useState(false);
  const [journeyActionBusy, setJourneyActionBusy] = useState<string | null>(null);
  const [identityBusy, setIdentityBusy] = useState(false);
  const [identityUploading, setIdentityUploading] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);

  const targetUserId = member?.userId ?? null;
  const canLoad = visible && Boolean(accessToken) && Boolean(targetUserId);
  const isSelfProfile = Boolean(targetUserId && viewerUserId && targetUserId === viewerUserId);
  const identityAvatarTone = toneForAvatarPreset(identityDraftAvatarPresetId, member?.avatarTone ?? "#dbeafe");

  const loadAssignments = useCallback(async () => {
    if (!accessToken || !targetUserId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchProfileAssignments(accessToken, targetUserId);
      setAssignments(result.assignments);
      setCapabilities(result.capabilities);
    } catch (err) {
      setAssignments([]);
      setCapabilities(null);
      // Suppress channel-membership errors — irrelevant for coach→client profiles
      const msg = err instanceof Error ? err.message : "Failed to load tasks and goals.";
      if (!msg.toLowerCase().includes('channel member')) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, targetUserId]);

  useEffect(() => {
    if (!canLoad) return;
    void loadAssignments();
  }, [canLoad, loadAssignments]);

  useEffect(() => {
    if (!visible) {
      setTaskModalVisible(false);
      setGoalModalVisible(false);
      setFormError(null);
      setActionBusyId(null);
      setIdentityModalVisible(false);
      setIdentityError(null);
      setActionMenuVisible(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!member) return;
    setIdentityDraftName(member.name);
    setIdentityDraftAvatarUrl(member.avatarUrl ?? "");
    setIdentityDraftAvatarPresetId(member.avatarPresetId ?? AVATAR_PRESETS[0].id);
    setIdentityError(null);
  }, [member]);

  const activeTasks = useMemo(
    () => assignments.filter((item) => item.type.includes("task") && item.status !== "completed"),
    [assignments]
  );
  const activeGoals = useMemo(
    () => assignments.filter((item) => item.type.includes("goal") && item.status !== "completed"),
    [assignments]
  );
  const completedItems = useMemo(
    () => assignments.filter((item) => item.status === "completed"),
    [assignments]
  );
  const visibleItems = activeTab === "tasks" ? activeTasks : activeTab === "goals" ? activeGoals : completedItems;

  const counts = {
    tasks: activeTasks.length,
    goals: activeGoals.length,
    completed: completedItems.length,
  };

  const resetTaskForm = () => {
    setTaskTitle("");
    setTaskDescription("");
    setTaskDueAt("");
    setFormError(null);
  };

  const resetGoalForm = () => {
    setGoalTitle("");
    setGoalDueAt("");
    setFormError(null);
  };

  const submitTask = useCallback(async () => {
    if (!accessToken || !targetUserId || !member) return;
    if (!taskTitle.trim()) {
      setFormError("Task title is required.");
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      const created = await createProfileTask(accessToken, targetUserId, {
        title: taskTitle.trim(),
        description: taskDescription.trim() || null,
        due_at: taskDueAt.trim() || null,
        assignee_id: targetUserId,
      });
      setAssignments((prev) => replaceAssignment(prev, created));
      setTaskModalVisible(false);
      resetTaskForm();
      setActiveTab("tasks");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Task create failed.");
    } finally {
      setFormBusy(false);
    }
  }, [accessToken, member, targetUserId, taskDescription, taskDueAt, taskTitle]);

  const submitGoal = useCallback(async () => {
    if (!accessToken || !targetUserId) return;
    if (!goalTitle.trim()) {
      setFormError("Goal title is required.");
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      const created = await createProfileGoal(accessToken, targetUserId, {
        title: goalTitle.trim(),
        due_at: goalDueAt.trim() || null,
      });
      setAssignments((prev) => replaceAssignment(prev, created));
      setGoalModalVisible(false);
      resetGoalForm();
      setActiveTab("goals");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Goal create failed.");
    } finally {
      setFormBusy(false);
    }
  }, [accessToken, goalDueAt, goalTitle, targetUserId]);

  const updateAssignmentStatus = useCallback(
    async (assignment: ProfileAssignment, nextStatus: ProfileAssignmentStatus) => {
      if (!accessToken || !targetUserId) return;
      setActionBusyId(assignment.id);
      setError(null);
      try {
        const updated = assignment.source === "goals"
          ? await updateProfileGoal(accessToken, targetUserId, assignment.id, { status: nextStatus })
          : await updateProfileTask(accessToken, targetUserId, assignment.id, {
              status: nextStatus,
              channel_id: String(assignment.channel_id ?? ""),
            });
        setAssignments((prev) => replaceAssignment(prev, updated));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Status update failed.");
      } finally {
        setActionBusyId(null);
      }
    },
    [accessToken, targetUserId]
  );

  const saveIdentity = useCallback(async () => {
    if (!accessToken || !targetUserId || !isSelfProfile) return;
    if (!identityDraftName.trim()) {
      setIdentityError("Name is required.");
      return;
    }
    setIdentityBusy(true);
    setIdentityError(null);
    try {
      await saveProfileIdentity(accessToken, {
        full_name: identityDraftName.trim(),
        avatar_url: identityDraftAvatarUrl.trim() || undefined,
        avatar_preset_id: identityDraftAvatarPresetId,
      });
      onIdentityUpdated?.({
        userId: targetUserId,
        name: identityDraftName.trim(),
        avatarUrl: identityDraftAvatarUrl.trim() || null,
        avatarPresetId: identityDraftAvatarPresetId,
        avatarTone: identityAvatarTone,
      });
      setIdentityModalVisible(false);
    } catch (err) {
      setIdentityError(err instanceof Error ? err.message : "Profile save failed.");
    } finally {
      setIdentityBusy(false);
    }
  }, [
    accessToken,
    identityAvatarTone,
    identityDraftAvatarPresetId,
    identityDraftAvatarUrl,
    identityDraftName,
    isSelfProfile,
    onIdentityUpdated,
    targetUserId,
  ]);

  const handleUploadAvatar = useCallback(async () => {
    if (!accessToken || !isSelfProfile) return;
    setIdentityUploading(true);
    setIdentityError(null);
    try {
      const fileUrl = await uploadProfileAvatar(accessToken);
      if (!fileUrl) return;
      setIdentityDraftAvatarUrl(fileUrl);
    } catch (err) {
      setIdentityError(err instanceof Error ? err.message : "Avatar upload failed.");
    } finally {
      setIdentityUploading(false);
    }
  }, [accessToken, isSelfProfile]);

  // Overflow menu has actions beyond Message
  const hasOverflowActions = isSelfProfile || capabilities?.can_create_task || capabilities?.can_create_goal || (canRemoveMember && onRemoveMember);

  const contextLine = [
    member ? `${member.cohorts.length} cohorts` : null,
    member ? `${member.journeys.length} journeys` : null,
    member ? `${member.kpiGoals.length} KPI goals` : null,
  ].filter(Boolean).join(" · ");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => setActionMenuVisible(false)}>
          <View style={styles.handle} />
          {member ? (
            <>
              {/* ── Header ── */}
              <View style={styles.header}>
                <View style={styles.identityRow}>
                  <TouchableOpacity
                    activeOpacity={isSelfProfile ? 0.9 : 1}
                    disabled={!isSelfProfile}
                    style={[styles.avatarWrap, { backgroundColor: isSelfProfile ? identityAvatarTone : member.avatarTone }]}
                    onPress={() => {
                      if (!isSelfProfile) return;
                      setIdentityModalVisible(true);
                    }}
                  >
                    {(isSelfProfile ? identityDraftAvatarUrl : member.avatarUrl) ? (
                      <Image
                        source={{ uri: isSelfProfile ? identityDraftAvatarUrl : String(member.avatarUrl ?? "") }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <Text style={styles.avatarText}>{initialsFromName(isSelfProfile ? identityDraftName : member.name)}</Text>
                    )}
                    {isSelfProfile ? (
                      <View style={styles.avatarEditBadge}>
                        <MaterialCommunityIcons name="pencil" size={12} color="#ffffff" />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                  <View style={styles.identityCopy}>
                    <Text style={styles.name}>{isSelfProfile ? identityDraftName || member.name : member.name}</Text>
                    <View style={styles.roleChip}>
                      <Text style={styles.roleChipText}>{member.roleLabel}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                    <MaterialCommunityIcons name="close" size={20} color="#324056" />
                  </TouchableOpacity>
                </View>

                {/* Action buttons: Message + overflow toggle */}
                <View style={styles.headerActions}>
                  <TouchableOpacity style={styles.messageBtn} onPress={onMessage}>
                    <MaterialCommunityIcons name="message-text-outline" size={15} color="#6366F1" />
                    <Text style={styles.messageBtnText}>Message</Text>
                  </TouchableOpacity>
                  {hasOverflowActions ? (
                    <TouchableOpacity
                      style={styles.overflowBtn}
                      onPress={() => setActionMenuVisible((prev) => !prev)}
                    >
                      <MaterialCommunityIcons name="dots-horizontal" size={20} color="#526175" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Inline action menu — renders below the button row to avoid overflow/z-index issues */}
                {actionMenuVisible ? (
                  <View style={styles.actionMenu}>
                    {isSelfProfile ? (
                      <TouchableOpacity
                        style={styles.actionMenuItem}
                        onPress={() => {
                          setActionMenuVisible(false);
                          setIdentityModalVisible(true);
                        }}
                      >
                        <MaterialCommunityIcons name="account-edit-outline" size={16} color="#6366F1" />
                        <Text style={styles.actionMenuItemText}>Edit Profile</Text>
                      </TouchableOpacity>
                    ) : null}
                    {capabilities?.can_create_task ? (
                      <TouchableOpacity
                        style={styles.actionMenuItem}
                        onPress={() => {
                          setActionMenuVisible(false);
                          resetTaskForm();
                          setTaskModalVisible(true);
                        }}
                      >
                        <MaterialCommunityIcons name="clipboard-plus-outline" size={16} color="#6366F1" />
                        <Text style={styles.actionMenuItemText}>Add Task</Text>
                      </TouchableOpacity>
                    ) : null}
                    {capabilities?.can_create_goal ? (
                      <TouchableOpacity
                        style={styles.actionMenuItem}
                        onPress={() => {
                          setActionMenuVisible(false);
                          resetGoalForm();
                          setGoalModalVisible(true);
                        }}
                      >
                        <MaterialCommunityIcons name="target" size={16} color="#6366F1" />
                        <Text style={styles.actionMenuItemText}>Add Goal</Text>
                      </TouchableOpacity>
                    ) : null}
                    {canRemoveMember && onRemoveMember ? (
                      <>
                        <View style={styles.actionMenuDivider} />
                        <TouchableOpacity
                          style={[styles.actionMenuItem, removeBusy ? { opacity: 0.5 } : null]}
                          disabled={removeBusy}
                          onPress={() => {
                            setActionMenuVisible(false);
                            onRemoveMember();
                          }}
                        >
                          <MaterialCommunityIcons name="account-remove-outline" size={16} color="#b9383d" />
                          <Text style={styles.actionMenuDangerText}>
                            {removeBusy ? "Removing…" : "Remove Member"}
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                ) : null}
              </View>

              {/* ── Journeys section ── */}
              {(availableJourneys != null || member.journeys.length > 0) && (
                <View style={styles.enrolledSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.enrolledLabel}>Journeys</Text>
                    {availableJourneys != null && (
                      <TouchableOpacity
                        onPress={() => setJourneyPickerVisible(true)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={{ fontSize: 12, color: '#6366F1', fontWeight: '600' }}>Manage</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {member.journeys.length === 0 ? (
                    <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>No journeys enrolled</Text>
                  ) : (
                    member.journeys.map((j, idx) => {
                      const journeyMatch = availableJourneys?.find((aj) => aj.title === j || aj.id === j);
                      const displayName = journeyMatch?.title ?? j;
                      return (
                        <View key={idx} style={styles.enrolledRow}>
                          <View style={styles.enrolledDot} />
                          <Text style={styles.enrolledText} numberOfLines={1}>{displayName}</Text>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* ── Tabs ── */}
              <View style={styles.tabRow}>
                {TAB_ORDER.map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tabBtn, activeTab === tab ? styles.tabBtnActive : null]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[styles.tabText, activeTab === tab ? styles.tabTextActive : null]}>
                      {tabLabel(tab)}
                    </Text>
                    <View style={[styles.tabCountPill, activeTab === tab ? styles.tabCountPillActive : null]}>
                      <Text style={[styles.tabCountText, activeTab === tab ? styles.tabCountTextActive : null]}>
                        {String(counts[tab])}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Scroll content ── */}
              <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                {/* Context summary — compact inline text */}
                <View style={styles.contextCard}>
                  <Text style={styles.contextMetaLine}>{contextLine}</Text>
                  {member.coachingGoals.length > 0 ? (
                    <Text style={styles.contextSub} numberOfLines={2}>
                      {member.coachingGoals.join(" · ")}
                    </Text>
                  ) : (
                    <Text style={styles.contextSub}>No coaching goals set</Text>
                  )}
                </View>

                {loading ? (
                  <View style={styles.stateCard}>
                    <ActivityIndicator color="#6366F1" />
                    <Text style={styles.stateText}>Loading tasks and goals…</Text>
                  </View>
                ) : null}

                {!loading && error ? (
                  <View style={[styles.stateCard, styles.stateCardError]}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#b9383d" />
                    <Text style={styles.stateText}>{error}</Text>
                  </View>
                ) : null}

                {!loading && !error && !targetUserId ? (
                  <View style={styles.stateCard}>
                    <MaterialCommunityIcons name="account-lock-outline" size={18} color="#64748b" />
                    <Text style={styles.stateText}>Profile is missing a live user id, so task and goal actions are unavailable.</Text>
                  </View>
                ) : null}

                {!loading && !error && targetUserId && visibleItems.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <MaterialCommunityIcons
                      name={activeTab === "completed" ? "archive-outline" : activeTab === "goals" ? "target" : "clipboard-text-outline"}
                      size={22}
                      color="#64748b"
                    />
                    <Text style={styles.emptyTitle}>Nothing here yet</Text>
                    <Text style={styles.emptySub}>
                      {activeTab === "tasks"
                        ? "Open tasks created from chat or this profile will appear here."
                        : activeTab === "goals"
                          ? "Goals assigned to this profile will appear here."
                          : "Completed work will collect here without cluttering the active sections."}
                    </Text>
                  </View>
                ) : null}

                {!loading && !error
                  ? visibleItems.map((assignment) => {
                      const isCompleted = assignment.status === "completed";
                      const canToggle =
                        isCompleted
                          ? Boolean(assignment.rights?.can_update_status)
                          : Boolean(assignment.rights?.can_mark_complete || assignment.rights?.can_update_status);
                      const nextStatus: ProfileAssignmentStatus = isCompleted ? "in_progress" : "completed";
                      return (
                        <View
                          key={`${assignment.source}-${assignment.id}`}
                          style={[styles.assignmentCard, isCompleted ? styles.assignmentCardCompleted : null]}
                        >
                          {/* Type · Status merged line */}
                          <Text style={styles.assignmentTypeStatusLine}>
                            <Text style={styles.assignmentTypeText}>{assignmentTypeLabel(assignment.type)}</Text>
                            <Text style={styles.assignmentSeparator}> · </Text>
                            <Text style={isCompleted ? styles.assignmentStatusDone : styles.assignmentStatusOpen}>
                              {assignmentStatusLabel(assignment.status, isCompleted)}
                            </Text>
                          </Text>
                          <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                          {assignment.description ? (
                            <Text style={styles.assignmentDescription}>{assignment.description}</Text>
                          ) : null}
                          <View style={styles.assignmentMetaRow}>
                            <View style={styles.assignmentMetaPill}>
                              <MaterialCommunityIcons name="calendar-month-outline" size={13} color="#64748b" />
                              <Text style={styles.assignmentMetaText}>{formatShortDate(assignment.due_at)}</Text>
                            </View>
                            {assignment.assignee_name ? (
                              <View style={styles.assignmentMetaPill}>
                                <MaterialCommunityIcons name="account-outline" size={13} color="#64748b" />
                                <Text style={styles.assignmentMetaText}>{assignment.assignee_name}</Text>
                              </View>
                            ) : null}
                            {canToggle ? (
                              <TouchableOpacity
                                disabled={actionBusyId === assignment.id}
                                onPress={() => void updateAssignmentStatus(assignment, nextStatus)}
                                style={styles.assignmentToggleWrap}
                              >
                                <Text style={[styles.assignmentToggleLink, actionBusyId === assignment.id ? { opacity: 0.5 } : null]}>
                                  {actionBusyId === assignment.id ? "Updating…" : isCompleted ? "Reopen" : "Complete"}
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      );
                    })
                  : null}
              </ScrollView>
            </>
          ) : null}

          {/* ── Identity Editor Modal ── */}
          <Modal visible={identityModalVisible} transparent animationType="fade" onRequestClose={() => setIdentityModalVisible(false)}>
            <Pressable style={styles.innerOverlay} onPress={() => setIdentityModalVisible(false)}>
              <Pressable style={styles.dialogCard} onPress={() => {}}>
                <Text style={styles.dialogTitle}>Edit Profile</Text>
                <Text style={styles.dialogSub}>Update your name, avatar, and theme.</Text>
                <Text style={styles.fieldLabel}>Display Name</Text>
                <TextInput
                  value={identityDraftName}
                  onChangeText={setIdentityDraftName}
                  style={styles.fieldInput}
                  placeholder="Your full name"
                />
                <TouchableOpacity
                  style={[styles.secondaryActionBtn, identityUploading ? styles.dialogPrimaryBtnDisabled : null]}
                  onPress={() => void handleUploadAvatar()}
                  disabled={identityUploading}
                >
                  <MaterialCommunityIcons name="camera-outline" size={16} color="#6366F1" />
                  <Text style={styles.secondaryActionText}>{identityUploading ? "Uploading…" : "Change Photo"}</Text>
                </TouchableOpacity>
                <Text style={styles.fieldLabel}>Theme</Text>
                <View style={styles.presetGrid}>
                  {AVATAR_PRESETS.map((preset) => {
                    const isActive = identityDraftAvatarPresetId === preset.id;
                    return (
                      <TouchableOpacity
                        key={preset.id}
                        style={[styles.presetCard, isActive ? styles.presetCardActive : null]}
                        onPress={() => setIdentityDraftAvatarPresetId(preset.id)}
                      >
                        <View style={[styles.presetSwatch, { backgroundColor: preset.tone }]}>
                          <Text style={styles.presetSwatchText}>{initialsFromName(identityDraftName || member?.name || "")}</Text>
                        </View>
                        <Text style={[styles.presetCardText, isActive ? styles.presetCardTextActive : null]}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {identityError ? <Text style={styles.formError}>{identityError}</Text> : null}
                <View style={styles.dialogActionRow}>
                  <TouchableOpacity
                    style={styles.dialogSecondaryBtn}
                    onPress={() => {
                      setIdentityModalVisible(false);
                      if (member) {
                        setIdentityDraftName(member.name);
                        setIdentityDraftAvatarUrl(member.avatarUrl ?? "");
                        setIdentityDraftAvatarPresetId(member.avatarPresetId ?? AVATAR_PRESETS[0].id);
                      }
                      setIdentityError(null);
                    }}
                  >
                    <Text style={styles.dialogSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dialogPrimaryBtn, identityBusy ? styles.dialogPrimaryBtnDisabled : null]}
                    onPress={() => void saveIdentity()}
                    disabled={identityBusy}
                  >
                    <Text style={styles.dialogPrimaryText}>{identityBusy ? "Saving…" : "Save Profile"}</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          {/* ── Add Task Modal ── */}
          <Modal visible={taskModalVisible} transparent animationType="fade" onRequestClose={() => setTaskModalVisible(false)}>
            <Pressable style={styles.innerOverlay} onPress={() => setTaskModalVisible(false)}>
              <Pressable style={styles.dialogCard} onPress={() => {}}>
                <Text style={styles.dialogTitle}>Add Task</Text>
                <Text style={styles.dialogSub}>Create a task that stays synced with the profile and thread task contract.</Text>
                <Text style={styles.fieldLabel}>Title</Text>
                <TextInput value={taskTitle} onChangeText={setTaskTitle} style={styles.fieldInput} placeholder="Follow up with new leads" />
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  value={taskDescription}
                  onChangeText={setTaskDescription}
                  style={[styles.fieldInput, styles.fieldInputMultiline]}
                  placeholder="Add context or expected outcome"
                  multiline
                />
                <Text style={styles.fieldLabel}>Assignee</Text>
                <View style={styles.assigneeField}>
                  <MaterialCommunityIcons name="account-outline" size={16} color="#6366F1" />
                  <Text style={styles.assigneeFieldText}>{member?.name ?? "Selected user"}</Text>
                </View>
                <Text style={styles.fieldLabel}>Due Date</Text>
                <TextInput value={taskDueAt} onChangeText={setTaskDueAt} style={styles.fieldInput} placeholder="YYYY-MM-DD or ISO date" />
                {formError ? <Text style={styles.formError}>{formError}</Text> : null}
                <View style={styles.dialogActionRow}>
                  <TouchableOpacity style={styles.dialogSecondaryBtn} onPress={() => setTaskModalVisible(false)}>
                    <Text style={styles.dialogSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dialogPrimaryBtn, formBusy ? styles.dialogPrimaryBtnDisabled : null]}
                    onPress={() => void submitTask()}
                    disabled={formBusy}
                  >
                    <Text style={styles.dialogPrimaryText}>{formBusy ? "Saving…" : "Create Task"}</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          {/* ── Add Goal Modal ── */}
          <Modal visible={goalModalVisible} transparent animationType="fade" onRequestClose={() => setGoalModalVisible(false)}>
            <Pressable style={styles.innerOverlay} onPress={() => setGoalModalVisible(false)}>
              <Pressable style={styles.dialogCard} onPress={() => {}}>
                <Text style={styles.dialogTitle}>Add Goal</Text>
                <Text style={styles.dialogSub}>Create a live goal record for this profile without leaving the team workflow.</Text>
                <Text style={styles.fieldLabel}>Goal Title</Text>
                <TextInput value={goalTitle} onChangeText={setGoalTitle} style={styles.fieldInput} placeholder="Hit 8 buyer consultations this month" />
                <Text style={styles.fieldLabel}>Target Date</Text>
                <TextInput value={goalDueAt} onChangeText={setGoalDueAt} style={styles.fieldInput} placeholder="YYYY-MM-DD or ISO date" />
                {formError ? <Text style={styles.formError}>{formError}</Text> : null}
                <View style={styles.dialogActionRow}>
                  <TouchableOpacity style={styles.dialogSecondaryBtn} onPress={() => setGoalModalVisible(false)}>
                    <Text style={styles.dialogSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dialogPrimaryBtn, formBusy ? styles.dialogPrimaryBtnDisabled : null]}
                    onPress={() => void submitGoal()}
                    disabled={formBusy}
                  >
                    <Text style={styles.dialogPrimaryText}>{formBusy ? "Saving…" : "Create Goal"}</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          {/* ── Journey Picker Modal ── */}
          {availableJourneys != null && (
            <Modal
              visible={journeyPickerVisible}
              transparent
              animationType="slide"
              onRequestClose={() => setJourneyPickerVisible(false)}
            >
              <Pressable style={styles.innerOverlay} onPress={() => setJourneyPickerVisible(false)}>
                <Pressable style={[styles.dialogCard, { maxHeight: '80%' }]} onPress={() => {}}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
                      Journeys
                    </Text>
                    <TouchableOpacity onPress={() => setJourneyPickerVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ fontSize: 20, color: '#94A3B8', lineHeight: 22 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                    {member?.name}
                  </Text>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                    {availableJourneys.map((aj) => {
                      const isEnrolled = (member?.journeys ?? []).includes(aj.id) || (member?.journeys ?? []).includes(aj.title);
                      const isBusy = journeyActionBusy === aj.id;
                      return (
                        <View
                          key={aj.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 12,
                            borderBottomWidth: 1,
                            borderBottomColor: '#F1F5F9',
                            gap: 12,
                          }}
                        >
                          {/* Enrollment indicator */}
                          <View style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            borderWidth: 2,
                            borderColor: isEnrolled ? '#6366F1' : '#CBD5E1',
                            backgroundColor: isEnrolled ? '#6366F1' : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {isEnrolled && <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                          </View>
                          <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: '#1E293B' }} numberOfLines={2}>
                            {aj.title}
                          </Text>
                          {isBusy ? (
                            <ActivityIndicator size="small" color="#6366F1" />
                          ) : isEnrolled ? (
                            <TouchableOpacity
                              onPress={async () => {
                                if (!onUnenrollJourney) return;
                                setJourneyActionBusy(aj.id);
                                try { await onUnenrollJourney(aj.id); } finally { setJourneyActionBusy(null); }
                              }}
                              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#FEE2E2' }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: '#EF4444' }}>Remove</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              onPress={async () => {
                                if (!onEnrollJourney) return;
                                setJourneyActionBusy(aj.id);
                                try { await onEnrollJourney(aj.id); } finally { setJourneyActionBusy(null); }
                              }}
                              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#EEF2FF' }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: '#6366F1' }}>Enroll</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>
                </Pressable>
              </Pressable>
            </Modal>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /* ── Outer shell ── */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: "#FBFCFE",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 14,
  },

  /* ── Header ── */
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 12,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { fontSize: 17, fontWeight: "700", color: "#1E293B" },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FBFCFE",
  },
  identityCopy: { flex: 1, gap: 4 },
  name: { fontSize: 21, lineHeight: 26, fontWeight: "700", color: "#0F172A" },
  roleChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: "#EEF2FF",
  },
  roleChipText: { fontSize: 11, fontWeight: "600", color: "#6366F1" },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },

  /* ── Header actions ── */
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  messageBtnText: { color: "#6366F1", fontSize: 13, fontWeight: "600" },
  overflowBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  /* ── Overflow action menu ── */
  actionMenu: {
    marginTop: 4,
    marginHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 4,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  actionMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionMenuItemText: { fontSize: 14, fontWeight: "500", color: "#1E293B" },
  actionMenuDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 2,
    marginHorizontal: 10,
  },
  actionMenuDangerText: { fontSize: 14, fontWeight: "500", color: "#DC2626" },

  /* ── Tabs ── */
  enrolledSection: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8edf3',
    gap: 6,
  },
  enrolledLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  enrolledRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  enrolledDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6366F1',
  },
  enrolledText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#1E293B',
    flex: 1,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 10,
    paddingVertical: 8,
    backgroundColor: "transparent",
  },
  tabBtnActive: { backgroundColor: "#EEF2FF" },
  tabText: { color: "#64748B", fontSize: 13, fontWeight: "500" },
  tabTextActive: { color: "#6366F1", fontWeight: "600" },
  tabCountPill: {
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  tabCountPillActive: { backgroundColor: "#C7D2FE" },
  tabCountText: { color: "#94A3B8", fontSize: 11, fontWeight: "600" },
  tabCountTextActive: { color: "#4338CA" },

  /* ── Scroll area ── */
  scrollArea: { paddingHorizontal: 20, paddingBottom: 24 },

  /* ── Context card ── */
  contextCard: {
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  contextMetaLine: { fontSize: 12, fontWeight: "600", color: "#475569" },
  contextSub: { fontSize: 13, lineHeight: 18, color: "#64748B" },

  /* ── State/empty cards ── */
  stateCard: {
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },
  stateCardError: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  stateText: { fontSize: 13, lineHeight: 18, color: "#475569", textAlign: "center" },
  emptyCard: {
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 20,
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: "#1E293B" },
  emptySub: { fontSize: 13, lineHeight: 18, color: "#64748B", textAlign: "center" },

  /* ── Assignment cards ── */
  assignmentCard: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 6,
    marginBottom: 10,
  },
  assignmentCardCompleted: {
    backgroundColor: "#F8FAFC",
    opacity: 0.65,
  },
  assignmentTypeStatusLine: { fontSize: 12, fontWeight: "500" },
  assignmentTypeText: { color: "#6366F1" },
  assignmentSeparator: { color: "#CBD5E1" },
  assignmentStatusOpen: { color: "#16A34A" },
  assignmentStatusDone: { color: "#94A3B8" },
  assignmentTitle: { fontSize: 15, lineHeight: 20, fontWeight: "600", color: "#0F172A" },
  assignmentDescription: { fontSize: 13, lineHeight: 18, color: "#64748B" },
  assignmentMetaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
  assignmentMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  assignmentMetaText: { fontSize: 11, color: "#64748B", fontWeight: "500" },
  assignmentToggleWrap: { marginLeft: "auto" },
  assignmentToggleLink: { fontSize: 12, fontWeight: "600", color: "#6366F1" },

  /* ── Dialog modals (shared) ── */
  innerOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  dialogCard: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 20,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 12,
  },
  dialogTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  dialogSub: { fontSize: 13, lineHeight: 18, color: "#64748B", marginBottom: 2 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 2 },
  fieldInput: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0F172A",
  },
  fieldInputMultiline: { minHeight: 96, textAlignVertical: "top" },
  assigneeField: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  assigneeFieldText: { fontSize: 14, color: "#6366F1", fontWeight: "600" },
  formError: { color: "#DC2626", fontSize: 13, lineHeight: 18 },
  dialogActionRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  dialogSecondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dialogSecondaryText: { color: "#475569", fontSize: 14, fontWeight: "500" },
  dialogPrimaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366F1",
  },
  dialogPrimaryBtnDisabled: { opacity: 0.5 },
  dialogPrimaryText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },

  /* ── Identity editor (in modal) ── */
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryActionText: { color: "#6366F1", fontSize: 14, fontWeight: "600" },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  presetCard: {
    width: "47%",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10,
  },
  presetCardActive: { borderColor: "#6366F1", backgroundColor: "#EEF2FF" },
  presetSwatch: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  presetSwatchText: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  presetCardText: { fontSize: 12, fontWeight: "500", color: "#64748B" },
  presetCardTextActive: { color: "#6366F1" },
});
