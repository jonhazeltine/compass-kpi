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
};

type DrawerTab = "tasks" | "goals" | "completed";

const TAB_ORDER: DrawerTab[] = ["tasks", "goals", "completed"];

function formatShortDate(value: string | null | undefined) {
  if (!value) return "No due date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No due date";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Recently";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently";
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
  const [identityEditorOpen, setIdentityEditorOpen] = useState(false);
  const [identityDraftName, setIdentityDraftName] = useState("");
  const [identityDraftAvatarUrl, setIdentityDraftAvatarUrl] = useState("");
  const [identityDraftAvatarPresetId, setIdentityDraftAvatarPresetId] = useState(AVATAR_PRESETS[0].id);
  const [identityBusy, setIdentityBusy] = useState(false);
  const [identityUploading, setIdentityUploading] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : "Failed to load tasks and goals.");
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
      setIdentityEditorOpen(false);
      setIdentityError(null);
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

  const summaryPills = [
    { icon: "clipboard-text-outline", label: `${counts.tasks} open tasks` },
    { icon: "target", label: `${counts.goals} active goals` },
    { icon: "check-decagram-outline", label: `${counts.completed} completed` },
  ];

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
      setIdentityEditorOpen(false);
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          {member ? (
            <>
              <View style={styles.header}>
                <View style={styles.identityRow}>
                  <TouchableOpacity
                    activeOpacity={isSelfProfile ? 0.9 : 1}
                    disabled={!isSelfProfile}
                    style={[styles.avatarWrap, { backgroundColor: isSelfProfile ? identityAvatarTone : member.avatarTone }]}
                    onPress={() => {
                      if (!isSelfProfile) return;
                      setIdentityEditorOpen((prev) => !prev);
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
                    <View style={styles.identityMetaRow}>
                      <View style={styles.roleChip}>
                        <Text style={styles.roleChipText}>{member.roleLabel}</Text>
                      </View>
                      {isSelfProfile ? (
                        <TouchableOpacity
                          style={styles.editIdentityChip}
                          onPress={() => setIdentityEditorOpen((prev) => !prev)}
                        >
                          <MaterialCommunityIcons name="pencil-outline" size={13} color="#324056" />
                          <Text style={styles.editIdentityChipText}>{identityEditorOpen ? "Done" : "Edit"}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Text style={styles.relationshipText}>
                      {isSelfProfile ? "Your operational profile" : "Profile tasks, goals, and completions"}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                    <MaterialCommunityIcons name="close" size={20} color="#324056" />
                  </TouchableOpacity>
                </View>

                {isSelfProfile && identityEditorOpen ? (
                  <View style={styles.identityEditorCard}>
                    <View style={styles.identityEditorHeader}>
                      <Text style={styles.identityEditorTitle}>Identity</Text>
                      <Text style={styles.identityEditorSub}>Update your avatar and theme without leaving the operational drawer.</Text>
                    </View>
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
                      <MaterialCommunityIcons name="camera-outline" size={16} color="#2158d5" />
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
                              <Text style={styles.presetSwatchText}>{initialsFromName(identityDraftName || member.name)}</Text>
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
                          setIdentityEditorOpen(false);
                          setIdentityDraftName(member.name);
                          setIdentityDraftAvatarUrl(member.avatarUrl ?? "");
                          setIdentityDraftAvatarPresetId(member.avatarPresetId ?? AVATAR_PRESETS[0].id);
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
                  </View>
                ) : null}

                <View style={styles.contactRow}>
                  <View style={styles.contactPill}>
                    <MaterialCommunityIcons name="email-outline" size={14} color="#64748b" />
                    <Text style={styles.contactText} numberOfLines={1}>{member.email}</Text>
                  </View>
                  <View style={styles.contactPill}>
                    <MaterialCommunityIcons name="phone-outline" size={14} color="#64748b" />
                    <Text style={styles.contactText}>{member.phone}</Text>
                  </View>
                </View>

                <View style={styles.summaryRow}>
                  {summaryPills.map((pill) => (
                    <View key={pill.label} style={styles.summaryPill}>
                      <MaterialCommunityIcons name={pill.icon as any} size={14} color="#2158d5" />
                      <Text style={styles.summaryPillText}>{pill.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.primaryActionRow}>
                  <TouchableOpacity style={styles.messageBtn} onPress={onMessage}>
                    <MaterialCommunityIcons name="message-text-outline" size={16} color="#ffffff" />
                    <Text style={styles.messageBtnText}>Message</Text>
                  </TouchableOpacity>
                  {capabilities?.can_create_task ? (
                    <TouchableOpacity
                      style={styles.secondaryActionBtn}
                      onPress={() => {
                        resetTaskForm();
                        setTaskModalVisible(true);
                      }}
                    >
                      <MaterialCommunityIcons name="clipboard-plus-outline" size={16} color="#2158d5" />
                      <Text style={styles.secondaryActionText}>Add Task</Text>
                    </TouchableOpacity>
                  ) : null}
                  {capabilities?.can_create_goal ? (
                    <TouchableOpacity
                      style={styles.secondaryActionBtn}
                      onPress={() => {
                        resetGoalForm();
                        setGoalModalVisible(true);
                      }}
                    >
                      <MaterialCommunityIcons name="target" size={16} color="#2158d5" />
                      <Text style={styles.secondaryActionText}>Add Goal</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {canRemoveMember && onRemoveMember ? (
                  <TouchableOpacity
                    style={[styles.removeBtn, removeBusy ? styles.removeBtnDisabled : null]}
                    onPress={onRemoveMember}
                    disabled={removeBusy}
                  >
                    <MaterialCommunityIcons name="account-remove-outline" size={16} color="#b9383d" />
                    <Text style={styles.removeBtnText}>{removeBusy ? "Removing…" : "Remove Member"}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

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

              <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                <View style={styles.contextCard}>
                  <Text style={styles.contextTitle}>Profile context</Text>
                  <View style={styles.contextMetaRow}>
                    <View style={styles.contextMetaChip}>
                      <Text style={styles.contextMetaChipText}>{member.cohorts.length} cohorts</Text>
                    </View>
                    <View style={styles.contextMetaChip}>
                      <Text style={styles.contextMetaChipText}>{member.journeys.length} journeys</Text>
                    </View>
                    <View style={styles.contextMetaChip}>
                      <Text style={styles.contextMetaChipText}>{member.kpiGoals.length} KPI goals</Text>
                    </View>
                  </View>
                  {member.coachingGoals.length > 0 ? (
                    <Text style={styles.contextSub} numberOfLines={2}>
                      {member.coachingGoals.join(" • ")}
                    </Text>
                  ) : (
                    <Text style={styles.contextSub}>
                      Tasks and goals update live here. Existing coaching context and enrollments stay attached to the profile.
                    </Text>
                  )}
                </View>

                {loading ? (
                  <View style={styles.stateCard}>
                    <ActivityIndicator color="#2158d5" />
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
                          <View style={styles.assignmentTopRow}>
                            <View style={styles.assignmentTypePill}>
                              <Text style={styles.assignmentTypePillText}>
                                {assignment.type.includes("task")
                                  ? assignment.type === "coach_task"
                                    ? "Coach Task"
                                    : "Task"
                                  : assignment.type === "coach_goal"
                                    ? "Coach Goal"
                                    : assignment.type === "team_leader_goal"
                                      ? "Leader Goal"
                                      : "Goal"}
                              </Text>
                            </View>
                            <View style={[styles.statusPill, isCompleted ? styles.statusPillDone : styles.statusPillOpen]}>
                              <Text style={[styles.statusPillText, isCompleted ? styles.statusPillTextDone : styles.statusPillTextOpen]}>
                                {isCompleted ? "Completed" : assignment.status === "in_progress" ? "In Progress" : "Open"}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                          {assignment.description ? (
                            <Text style={styles.assignmentDescription}>{assignment.description}</Text>
                          ) : null}
                          <View style={styles.assignmentMetaRow}>
                            <View style={styles.assignmentMetaPill}>
                              <MaterialCommunityIcons name="calendar-month-outline" size={14} color="#64748b" />
                              <Text style={styles.assignmentMetaText}>{formatShortDate(assignment.due_at)}</Text>
                            </View>
                            {assignment.assignee_name ? (
                              <View style={styles.assignmentMetaPill}>
                                <MaterialCommunityIcons name="account-outline" size={14} color="#64748b" />
                                <Text style={styles.assignmentMetaText}>{assignment.assignee_name}</Text>
                              </View>
                            ) : null}
                            <View style={styles.assignmentMetaPill}>
                              <MaterialCommunityIcons name="clock-outline" size={14} color="#64748b" />
                              <Text style={styles.assignmentMetaText}>{formatTimestamp(assignment.last_thread_event_at ?? assignment.created_at)}</Text>
                            </View>
                          </View>
                          {canToggle ? (
                            <TouchableOpacity
                              style={[styles.assignmentActionBtn, actionBusyId === assignment.id ? styles.assignmentActionBtnDisabled : null]}
                              disabled={actionBusyId === assignment.id}
                              onPress={() => void updateAssignmentStatus(assignment, nextStatus)}
                            >
                              <Text style={styles.assignmentActionText}>
                                {actionBusyId === assignment.id
                                  ? "Updating…"
                                  : isCompleted
                                    ? "Reopen"
                                    : "Complete"}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      );
                    })
                  : null}
              </ScrollView>
            </>
          ) : null}

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
                  <MaterialCommunityIcons name="account-outline" size={16} color="#2158d5" />
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: "#f7f9fc",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    overflow: "hidden",
  },
  handle: {
    width: 54,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#d6dce8",
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { fontSize: 20, fontWeight: "800", color: "#23314d" },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2158d5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#f7f9fc",
  },
  identityCopy: { flex: 1, gap: 4 },
  identityMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { fontSize: 24, lineHeight: 28, fontWeight: "800", color: "#162033" },
  roleChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#e9eefb",
  },
  roleChipText: { fontSize: 12, fontWeight: "700", color: "#2158d5" },
  editIdentityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d7e0ef",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editIdentityChipText: { fontSize: 12, fontWeight: "700", color: "#324056" },
  relationshipText: { fontSize: 13, lineHeight: 18, color: "#6b7890" },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2f8",
  },
  identityEditorCard: {
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfe5ef",
    padding: 16,
    gap: 10,
  },
  identityEditorHeader: { gap: 4 },
  identityEditorTitle: { fontSize: 16, fontWeight: "800", color: "#162033" },
  identityEditorSub: { fontSize: 13, lineHeight: 18, color: "#6b7890" },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  presetCard: {
    width: "47%",
    borderRadius: 18,
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "#d9e1ee",
    padding: 12,
    gap: 10,
  },
  presetCardActive: { borderColor: "#2158d5", backgroundColor: "#edf3ff" },
  presetSwatch: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  presetSwatchText: { fontSize: 14, fontWeight: "800", color: "#22314c" },
  presetCardText: { fontSize: 12, fontWeight: "700", color: "#526175" },
  presetCardTextActive: { color: "#2158d5" },
  contactRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  contactPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfe5ef",
  },
  contactText: { maxWidth: 150, fontSize: 12, color: "#526175", fontWeight: "600" },
  summaryRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#edf3ff",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  summaryPillText: { fontSize: 12, color: "#2158d5", fontWeight: "700" },
  primaryActionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#1f4fd5",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d7e0ef",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryActionText: { color: "#2158d5", fontSize: 14, fontWeight: "800" },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    borderRadius: 14,
    backgroundColor: "#fff1f1",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  removeBtnDisabled: { opacity: 0.6 },
  removeBtnText: { color: "#b9383d", fontSize: 13, fontWeight: "800" },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    paddingVertical: 12,
    backgroundColor: "#eef2f8",
  },
  tabBtnActive: { backgroundColor: "#2158d5" },
  tabText: { color: "#596779", fontSize: 14, fontWeight: "800" },
  tabTextActive: { color: "#ffffff" },
  tabCountPill: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#d9e2f2",
    alignItems: "center",
  },
  tabCountPillActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  tabCountText: { color: "#425066", fontSize: 11, fontWeight: "800" },
  tabCountTextActive: { color: "#ffffff" },
  scrollArea: { paddingHorizontal: 20, paddingBottom: 24 },
  contextCard: {
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfe5ef",
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  contextTitle: { fontSize: 14, fontWeight: "800", color: "#22314c" },
  contextMetaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  contextMetaChip: {
    borderRadius: 999,
    backgroundColor: "#f1f5fb",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  contextMetaChipText: { fontSize: 12, color: "#526175", fontWeight: "700" },
  contextSub: { fontSize: 13, lineHeight: 18, color: "#6b7890" },
  stateCard: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfe5ef",
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  stateCardError: { backgroundColor: "#fff5f5", borderColor: "#f1d4d7" },
  stateText: { fontSize: 13, lineHeight: 18, color: "#526175", textAlign: "center" },
  emptyCard: {
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfe5ef",
    padding: 20,
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#22314c" },
  emptySub: { fontSize: 13, lineHeight: 18, color: "#6b7890", textAlign: "center" },
  assignmentCard: {
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfe5ef",
    padding: 16,
    gap: 10,
    marginBottom: 12,
  },
  assignmentCardCompleted: {
    backgroundColor: "#f3f6fb",
  },
  assignmentTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  assignmentTypePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#ecf2ff",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  assignmentTypePillText: { fontSize: 11, fontWeight: "800", color: "#2158d5" },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillOpen: { backgroundColor: "#eef7e9" },
  statusPillDone: { backgroundColor: "#e8edf5" },
  statusPillText: { fontSize: 11, fontWeight: "800" },
  statusPillTextOpen: { color: "#2f9f56" },
  statusPillTextDone: { color: "#5e6e82" },
  assignmentTitle: { fontSize: 18, lineHeight: 22, fontWeight: "800", color: "#162033" },
  assignmentDescription: { fontSize: 14, lineHeight: 20, color: "#536178" },
  assignmentMetaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  assignmentMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#f4f7fb",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  assignmentMetaText: { fontSize: 12, color: "#5f6f84", fontWeight: "700" },
  assignmentActionBtn: {
    alignSelf: "flex-start",
    borderRadius: 14,
    backgroundColor: "#e8f0ff",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  assignmentActionBtnDisabled: { opacity: 0.65 },
  assignmentActionText: { fontSize: 13, fontWeight: "800", color: "#2158d5" },
  innerOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  dialogCard: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 20,
    gap: 10,
  },
  dialogTitle: { fontSize: 20, fontWeight: "800", color: "#162033" },
  dialogSub: { fontSize: 13, lineHeight: 18, color: "#6b7890", marginBottom: 2 },
  fieldLabel: { fontSize: 12, fontWeight: "800", color: "#526175", marginTop: 2 },
  fieldInput: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d9e1ee",
    backgroundColor: "#f8fbff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#162033",
  },
  fieldInputMultiline: { minHeight: 96, textAlignVertical: "top" },
  assigneeField: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#edf3ff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  assigneeFieldText: { fontSize: 14, color: "#2158d5", fontWeight: "700" },
  formError: { color: "#b9383d", fontSize: 13, lineHeight: 18 },
  dialogActionRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  dialogSecondaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2f8",
  },
  dialogSecondaryText: { color: "#526175", fontSize: 14, fontWeight: "800" },
  dialogPrimaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2158d5",
  },
  dialogPrimaryBtnDisabled: { opacity: 0.6 },
  dialogPrimaryText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
});
