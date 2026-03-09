"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeGoalStatus = normalizeGoalStatus;
exports.validateProfileGoalCreatePayload = validateProfileGoalCreatePayload;
exports.validateProfileGoalPatchPayload = validateProfileGoalPatchPayload;
exports.validateProfileTaskCreatePayload = validateProfileTaskCreatePayload;
exports.validateProfileTaskPatchPayload = validateProfileTaskPatchPayload;
exports.buildProfileAssignmentCapabilities = buildProfileAssignmentCapabilities;
exports.listUnifiedAssignmentsForUser = listUnifiedAssignmentsForUser;
exports.resolveProfileTaskMutation = resolveProfileTaskMutation;
const channelMessageTasks_1 = require("./channelMessageTasks");
function normalizeGoalStatus(raw) {
    const value = String(raw || "").toLowerCase().replace(/[\s-]+/g, "_");
    if (value === "completed" || value === "done")
        return "completed";
    if (value === "in_progress" || value === "active")
        return "in_progress";
    return "pending";
}
function validateProfileGoalCreatePayload(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
    if (!title)
        return { ok: false, status: 422, error: "title is required" };
    if (title.length > 160)
        return { ok: false, status: 422, error: "title is too long (max 160 chars)" };
    const dueAt = normalizeIsoDateOrNull(candidate.due_at);
    return { ok: true, payload: { title, due_at: dueAt } };
}
function validateProfileGoalPatchPayload(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    const payload = {};
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
function validateProfileTaskCreatePayload(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
    if (!title)
        return { ok: false, status: 422, error: "title is required" };
    if (title.length > 160)
        return { ok: false, status: 422, error: "title is too long (max 160 chars)" };
    const descriptionRaw = candidate.description;
    const description = descriptionRaw === null ? null : typeof descriptionRaw === "string" ? descriptionRaw.trim() || null : null;
    const dueAt = normalizeIsoDateOrNull(candidate.due_at);
    const assigneeId = typeof candidate.assignee_id === "string" && candidate.assignee_id.trim()
        ? candidate.assignee_id.trim()
        : null;
    return { ok: true, payload: { title, description, due_at: dueAt, assignee_id: assigneeId } };
}
function validateProfileTaskPatchPayload(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    const channelId = typeof candidate.channel_id === "string" ? candidate.channel_id.trim() : "";
    if (!channelId)
        return { ok: false, status: 422, error: "channel_id is required" };
    return {
        ok: true,
        payload: {
            channel_id: channelId,
            status: (0, channelMessageTasks_1.normalizeTaskStatus)(candidate.status),
        },
    };
}
function buildProfileAssignmentCapabilities(input) {
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
async function listUnifiedAssignmentsForUser(input) {
    const assignments = [];
    const { data: goalRows, error: goalRowsError } = await input.dataClient
        .from("goals")
        .select("id,title,status,due_at,assignee_id,created_by,created_at,goal_type")
        .or(`assignee_id.eq.${input.targetUserId},created_by.eq.${input.targetUserId}`)
        .order("due_at", { ascending: true, nullsFirst: false });
    if (goalRowsError && !isRecoverableAssignmentSourceGap(goalRowsError)) {
        return { ok: false, status: 500, error: "Failed to fetch goal assignments" };
    }
    for (const g of goalRows ?? []) {
        const goalType = String(g.goal_type ?? "personal");
        let assignmentType = "personal_goal";
        if (goalType === "coach")
            assignmentType = "coach_goal";
        else if (goalType === "team_leader")
            assignmentType = "team_leader_goal";
        const createdBy = String(g.created_by ?? "") || null;
        const assigneeId = String(g.assignee_id ?? "") || null;
        const isOwner = createdBy === input.viewerUserId;
        const isAssignee = assigneeId === input.viewerUserId;
        assignments.push({
            id: String(g.id ?? ""),
            type: assignmentType,
            title: String(g.title ?? "Untitled Goal"),
            description: null,
            status: normalizeGoalStatus(String(g.status ?? "")),
            due_at: typeof g.due_at === "string" ? String(g.due_at) : null,
            assignee_id: assigneeId,
            assignee_name: null,
            source: "goals",
            created_at: typeof g.created_at === "string"
                ? String(g.created_at)
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
    const viewerChannelIds = (viewerMemberships ?? [])
        .map((row) => String(row.channel_id ?? ""))
        .filter(Boolean);
    const { data: targetMemberships, error: targetMembershipError } = await input.dataClient
        .from("channel_memberships")
        .select("channel_id")
        .eq("user_id", input.targetUserId);
    if (targetMembershipError) {
        return { ok: false, status: 500, error: "Failed to fetch target channel scope for assignments" };
    }
    const targetChannelIds = (targetMemberships ?? [])
        .map((row) => String(row.channel_id ?? ""))
        .filter(Boolean);
    const allowedChannelIds = input.canViewAllTargetChannels
        ? targetChannelIds
        : targetChannelIds.filter((channelId) => viewerChannelIds.includes(channelId));
    const { data: taskRows, error: taskRowsError } = await input.dataClient
        .from("channel_messages")
        .select("id,channel_id,message_kind,assignment_ref,created_at")
        .in("message_kind", ["coach_task", "personal_task"])
        .in("channel_id", allowedChannelIds.length > 0 ? allowedChannelIds : ["00000000-0000-0000-0000-000000000000"])
        .order("created_at", { ascending: false });
    if (taskRowsError && !isRecoverableAssignmentSourceGap(taskRowsError)) {
        return { ok: false, status: 500, error: "Failed to fetch message-linked assignments" };
    }
    const seenTaskIds = new Set();
    for (const row of taskRows ?? []) {
        const ref = (0, channelMessageTasks_1.parseTaskAssignmentRef)(row.assignment_ref);
        if (!ref)
            continue;
        const taskId = ref.id || String(row.id ?? "");
        if (!taskId || seenTaskIds.has(taskId))
            continue;
        const isTargetRelated = ref.assignee_id === input.targetUserId || ref.created_by === input.targetUserId;
        if (!isTargetRelated)
            continue;
        const channelId = String(row.channel_id ?? "");
        let viewerRole = input.viewerRole ?? null;
        if (!input.canViewAllTargetChannels) {
            const scope = await input.evaluateRoleScopeForChannel(input.viewerUserId, channelId);
            if (!scope.ok)
                return { ok: false, status: scope.status, error: scope.error };
            if (!scope.result.allowed)
                continue;
            viewerRole = scope.result.role;
        }
        seenTaskIds.add(taskId);
        const taskType = String(row.message_kind) === "coach_task" ? "coach_task" : "personal_task";
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
            created_at: typeof row.created_at === "string"
                ? String(row.created_at)
                : new Date().toISOString(),
            created_by: ref.created_by ?? null,
            channel_id: channelId || null,
            source_message_id: ref.source_message_id ?? (String(row.id ?? "") || null),
            last_thread_event_at: ref.last_thread_event_at ?? (typeof row.created_at === "string"
                ? String(row.created_at)
                : null),
            thread_read_state: "unknown",
            rights: (0, channelMessageTasks_1.buildLinkedTaskRights)({
                taskType: taskType,
                viewerUserId: input.viewerUserId,
                viewerRole,
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
function resolveProfileTaskMutation(input) {
    return (0, channelMessageTasks_1.canMutateLinkedTask)({
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
function normalizeIsoDateOrNull(value) {
    if (value === null)
        return null;
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
function isRecoverableAssignmentSourceGap(error) {
    const code = String(error?.code ?? "");
    if (!code)
        return false;
    return code === "PGRST116" || code === "42P01" || code === "42703";
}
function sortAssignments(a, b) {
    const aCompleted = a.status === "completed";
    const bCompleted = b.status === "completed";
    if (aCompleted !== bCompleted)
        return aCompleted ? 1 : -1;
    if (a.due_at && b.due_at)
        return a.due_at.localeCompare(b.due_at);
    if (a.due_at && !b.due_at)
        return -1;
    if (!a.due_at && b.due_at)
        return 1;
    return b.created_at.localeCompare(a.created_at);
}
