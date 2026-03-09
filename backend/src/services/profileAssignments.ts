import {
  buildLinkedTaskRights,
  canMutateLinkedTask,
  type LinkedTaskStatus,
  type LinkedTaskType,
  normalizeTaskStatus,
  parseTaskAssignmentRef,
} from "./channelMessageTasks";

type DataClientLike = {
  from: (table: string) => any;
};

export type UnifiedAssignmentItem = {
  id: string;
  type: "personal_goal" | "team_leader_goal" | "coach_goal" | "personal_task" | "coach_task";
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed";
  due_at: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  source: "goals" | "message_linked";
  created_at: string;
  created_by: string | null;
  channel_id: string | null;
  source_message_id: string | null;
  last_thread_event_at: string | null;
  thread_read_state: "unread" | "read" | "unknown";
  rights: {
    can_edit_fields: boolean;
    can_update_status: boolean;
    can_mark_complete: boolean;
    can_reassign: boolean;
  };
};

export type ProfileAssignmentsCapabilities = {
  can_view: boolean;
  can_create_task: boolean;
  can_create_goal: boolean;
  can_manage_items: boolean;
  relationship_scope: "self" | "shared_team" | "coach_scope" | "admin_scope" | "none";
};

type EvaluateRoleScopeForChannel = (
  viewerUserId: string,
  channelId: string
) => Promise<
  | { ok: true; result: { allowed: boolean; role: string | null; reason?: string } }
  | { ok: false; status: number; error: string }
>;

export function normalizeGoalStatus(raw: string): "pending" | "in_progress" | "completed" {
  const value = String(raw || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (value === "completed" || value === "done") return "completed";
  if (value === "in_progress" || value === "active") return "in_progress";
  return "pending";
}

export function validateProfileGoalCreatePayload(body: unknown):
  | { ok: true; payload: { title: string; due_at: string | null } }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Record<string, unknown>;
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  if (!title) return { ok: false, status: 422, error: "title is required" };
  if (title.length > 160) return { ok: false, status: 422, error: "title is too long (max 160 chars)" };
  const dueAt = normalizeIsoDateOrNull(candidate.due_at);
  return { ok: true, payload: { title, due_at: dueAt } };
}

export function validateProfileGoalPatchPayload(body: unknown):
  | { ok: true; payload: { title?: string; due_at?: string | null; status?: "pending" | "in_progress" | "completed" } }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Record<string, unknown>;
  const payload: { title?: string; due_at?: string | null; status?: "pending" | "in_progress" | "completed" } = {};
  if (candidate.title !== undefined) {
    if (typeof candidate.title !== "string" || !candidate.title.trim()) {
      return { ok: false, status: 422, error: "title must be a non-empty string when provided" };
    }
    payload.title = candidate.title.trim();
  }
  if (candidate.due_at !== undefined) {
    payload.due_at = candidate.due_at === null ? null : normalizeIsoDateOrNull(candidate.due_at);
  }
  if (candidate.status !== undefined) {
    payload.status = normalizeGoalStatus(String(candidate.status));
  }
  if (Object.keys(payload).length === 0) {
    return { ok: false, status: 422, error: "At least one goal field must be provided" };
  }
  return { ok: true, payload };
}

export function validateProfileTaskCreatePayload(body: unknown):
  | { ok: true; payload: { title: string; description: string | null; due_at: string | null; assignee_id: string | null } }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Record<string, unknown>;
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  if (!title) return { ok: false, status: 422, error: "title is required" };
  if (title.length > 160) return { ok: false, status: 422, error: "title is too long (max 160 chars)" };
  const descriptionRaw = candidate.description;
  const description =
    descriptionRaw === null ? null : typeof descriptionRaw === "string" ? descriptionRaw.trim() || null : null;
  const dueAt = normalizeIsoDateOrNull(candidate.due_at);
  const assigneeId = typeof candidate.assignee_id === "string" && candidate.assignee_id.trim()
    ? candidate.assignee_id.trim()
    : null;
  return { ok: true, payload: { title, description, due_at: dueAt, assignee_id: assigneeId } };
}

export function validateProfileTaskPatchPayload(body: unknown):
  | { ok: true; payload: { status: LinkedTaskStatus; channel_id: string } }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Record<string, unknown>;
  const channelId = typeof candidate.channel_id === "string" ? candidate.channel_id.trim() : "";
  if (!channelId) return { ok: false, status: 422, error: "channel_id is required" };
  return {
    ok: true,
    payload: {
      channel_id: channelId,
      status: normalizeTaskStatus(candidate.status),
    },
  };
}

export function buildProfileAssignmentCapabilities(input: {
  viewerUserId: string;
  targetUserId: string;
  canGlobalView: boolean;
  canManageTarget: boolean;
  sharedTeam: boolean;
  platformAdmin: boolean;
  coachScope: boolean;
}): ProfileAssignmentsCapabilities {
  if (input.viewerUserId === input.targetUserId) {
    return {
      can_view: true,
      can_create_task: true,
      can_create_goal: true,
      can_manage_items: true,
      relationship_scope: "self",
    };
  }
  if (input.platformAdmin) {
    return {
      can_view: true,
      can_create_task: true,
      can_create_goal: true,
      can_manage_items: true,
      relationship_scope: "admin_scope",
    };
  }
  if (input.coachScope) {
    return {
      can_view: true,
      can_create_task: true,
      can_create_goal: true,
      can_manage_items: true,
      relationship_scope: "coach_scope",
    };
  }
  if (input.canManageTarget) {
    return {
      can_view: true,
      can_create_task: true,
      can_create_goal: true,
      can_manage_items: true,
      relationship_scope: "shared_team",
    };
  }
  if (input.sharedTeam) {
    return {
      can_view: true,
      can_create_task: false,
      can_create_goal: false,
      can_manage_items: false,
      relationship_scope: "shared_team",
    };
  }
  return {
    can_view: false,
    can_create_task: false,
    can_create_goal: false,
    can_manage_items: false,
    relationship_scope: "none",
  };
}

export async function listUnifiedAssignmentsForUser(input: {
  dataClient: DataClientLike;
  targetUserId: string;
  viewerUserId: string;
  evaluateRoleScopeForChannel: EvaluateRoleScopeForChannel;
}): Promise<
  | { ok: true; assignments: UnifiedAssignmentItem[]; empty_state: { code: string; message: string } | null }
  | { ok: false; status: number; error: string }
> {
  const assignments: UnifiedAssignmentItem[] = [];
  const { data: goalRows, error: goalRowsError } = await input.dataClient
    .from("goals")
    .select("id,title,status,due_at,assignee_id,created_by,created_at,goal_type")
    .or(`assignee_id.eq.${input.targetUserId},created_by.eq.${input.targetUserId}`)
    .order("due_at", { ascending: true, nullsFirst: false });
  if (goalRowsError && !isRecoverableAssignmentSourceGap(goalRowsError)) {
    return { ok: false, status: 500, error: "Failed to fetch goal assignments" };
  }

  for (const g of goalRows ?? []) {
    const goalType = String((g as { goal_type?: unknown }).goal_type ?? "personal");
    let assignmentType: UnifiedAssignmentItem["type"] = "personal_goal";
    if (goalType === "coach") assignmentType = "coach_goal";
    else if (goalType === "team_leader") assignmentType = "team_leader_goal";
    const createdBy = String((g as { created_by?: unknown }).created_by ?? "") || null;
    const assigneeId = String((g as { assignee_id?: unknown }).assignee_id ?? "") || null;
    const isOwner = createdBy === input.viewerUserId;
    const isAssignee = assigneeId === input.viewerUserId;
    assignments.push({
      id: String((g as { id?: unknown }).id ?? ""),
      type: assignmentType,
      title: String((g as { title?: unknown }).title ?? "Untitled Goal"),
      description: null,
      status: normalizeGoalStatus(String((g as { status?: unknown }).status ?? "")),
      due_at: typeof (g as { due_at?: unknown }).due_at === "string" ? String((g as { due_at?: unknown }).due_at) : null,
      assignee_id: assigneeId,
      assignee_name: null,
      source: "goals",
      created_at: typeof (g as { created_at?: unknown }).created_at === "string"
        ? String((g as { created_at?: unknown }).created_at)
        : new Date().toISOString(),
      created_by: createdBy,
      channel_id: null,
      source_message_id: null,
      last_thread_event_at: null,
      thread_read_state: "unknown",
      rights: {
        can_edit_fields: isOwner,
        can_update_status: isOwner || isAssignee,
        can_mark_complete: isOwner || isAssignee,
        can_reassign: isOwner,
      },
    });
  }

  const { data: viewerMemberships, error: viewerMembershipError } = await input.dataClient
    .from("channel_memberships")
    .select("channel_id")
    .eq("user_id", input.viewerUserId);
  if (viewerMembershipError) {
    return { ok: false, status: 500, error: "Failed to fetch channel scope for assignments" };
  }
  const allowedChannelIds = (viewerMemberships ?? [])
    .map((row: { channel_id?: unknown }) => String(row.channel_id ?? ""))
    .filter(Boolean);

  const { data: taskRows, error: taskRowsError } = await input.dataClient
    .from("channel_messages")
    .select("id,channel_id,message_kind,assignment_ref,created_at")
    .in("message_kind", ["coach_task", "personal_task"])
    .in("channel_id", allowedChannelIds.length > 0 ? allowedChannelIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });
  if (taskRowsError && !isRecoverableAssignmentSourceGap(taskRowsError)) {
    return { ok: false, status: 500, error: "Failed to fetch message-linked assignments" };
  }

  const seenTaskIds = new Set<string>();
  for (const row of taskRows ?? []) {
    const ref = parseTaskAssignmentRef((row as { assignment_ref?: unknown }).assignment_ref);
    if (!ref) continue;
    const taskId = ref.id || String((row as { id?: unknown }).id ?? "");
    if (!taskId || seenTaskIds.has(taskId)) continue;
    const isTargetRelated = ref.assignee_id === input.targetUserId || ref.created_by === input.targetUserId;
    if (!isTargetRelated) continue;

    const channelId = String((row as { channel_id?: unknown }).channel_id ?? "");
    const scope = await input.evaluateRoleScopeForChannel(input.viewerUserId, channelId);
    if (!scope.ok) return { ok: false, status: scope.status, error: scope.error };
    if (!scope.result.allowed) continue;

    seenTaskIds.add(taskId);
    const taskType = String((row as { message_kind?: unknown }).message_kind) === "coach_task" ? "coach_task" : "personal_task";
    assignments.push({
      id: taskId,
      type: taskType,
      title: ref.title || "Task",
      description: ref.description ?? null,
      status: normalizeGoalStatus(ref.status),
      due_at: ref.due_at ?? null,
      assignee_id: ref.assignee_id ?? null,
      assignee_name: ref.assignee_name ?? null,
      source: "message_linked",
      created_at: typeof (row as { created_at?: unknown }).created_at === "string"
        ? String((row as { created_at?: unknown }).created_at)
        : new Date().toISOString(),
      created_by: ref.created_by ?? null,
      channel_id: channelId || null,
      source_message_id: ref.source_message_id ?? (String((row as { id?: unknown }).id ?? "") || null),
      last_thread_event_at: ref.last_thread_event_at ?? (typeof (row as { created_at?: unknown }).created_at === "string"
        ? String((row as { created_at?: unknown }).created_at)
        : null),
      thread_read_state: "unknown",
      rights: buildLinkedTaskRights({
        taskType: taskType as LinkedTaskType,
        viewerUserId: input.viewerUserId,
        viewerRole: scope.result.role,
        assigneeId: ref.assignee_id,
      }),
    });
  }

  assignments.sort(sortAssignments);
  return {
    ok: true,
    assignments,
    empty_state: assignments.length === 0 ? { code: "no_assignments", message: "No tasks or goals yet." } : null,
  };
}

export function resolveProfileTaskMutation(input: {
  currentTask: NonNullable<ReturnType<typeof parseTaskAssignmentRef>>;
  actorUserId: string;
  actorRole: string | null | undefined;
  nextStatus: LinkedTaskStatus;
}) {
  return canMutateLinkedTask({
    taskType: input.currentTask.task_type,
    action: input.nextStatus === "completed" ? "complete" : "update",
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    assigneeId: input.currentTask.assignee_id,
    currentTitle: input.currentTask.title,
    currentDescription: input.currentTask.description,
    currentDueAt: input.currentTask.due_at,
    proposedTitle: input.currentTask.title,
    proposedDescription: input.currentTask.description,
    proposedDueAt: input.currentTask.due_at,
    proposedAssigneeId: input.currentTask.assignee_id,
  });
}

function normalizeIsoDateOrNull(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isRecoverableAssignmentSourceGap(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null)?.code ?? "");
  if (!code) return false;
  return code === "PGRST116" || code === "42P01" || code === "42703";
}

function sortAssignments(a: UnifiedAssignmentItem, b: UnifiedAssignmentItem) {
  const aCompleted = a.status === "completed";
  const bCompleted = b.status === "completed";
  if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
  if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
  if (a.due_at && !b.due_at) return -1;
  if (!a.due_at && b.due_at) return 1;
  return b.created_at.localeCompare(a.created_at);
}
