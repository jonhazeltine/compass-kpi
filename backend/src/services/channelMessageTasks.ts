export type MuxLifecycleStatus =
  | "queued_for_upload"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"
  | "deleted";

export type LinkedTaskType = "personal_task" | "coach_task";
export type LinkedTaskStatus = "pending" | "in_progress" | "completed";
export type LinkedTaskAction = "create" | "update" | "complete";

export type ChannelMessagePayload = {
  body?: string;
  message_type?: "message" | "media_attachment";
  media_attachment?: {
    media_id: string;
    caption?: string;
  };
  message_kind?: "text" | LinkedTaskType;
  task_action?: LinkedTaskAction;
  task_card_draft?: {
    task_type?: LinkedTaskType;
    task_id?: string;
    title?: string;
    description?: string | null;
    due_at?: string | null;
    assignee_id?: string;
    status?: LinkedTaskStatus;
  };
};

export type LinkedTaskRights = {
  can_edit_fields: boolean;
  can_update_status: boolean;
  can_mark_complete: boolean;
  can_reassign: boolean;
};

export type LinkedTaskMutationPermission = {
  allowed: boolean;
  can_edit_fields: boolean;
  can_update_status: boolean;
  can_mark_complete: boolean;
  can_reassign: boolean;
  reason?: string;
};

export type LinkedTaskCard = {
  task_id: string;
  task_type: LinkedTaskType;
  title: string;
  description: string | null;
  status: LinkedTaskStatus;
  due_at: string | null;
  assignee: { id: string | null; display_name: string };
  created_by: { id: string | null; role: string | null };
  source: "message_linked";
  source_message_id: string;
  channel_id: string;
  thread_sync: {
    included_in_assignments_feed: boolean;
    last_synced_at: string | null;
  };
  rights: LinkedTaskRights;
};

export type ChannelMessageReadModel = {
  id: string;
  channel_id: string;
  sender_user_id: string;
  body: string;
  message_type: string;
  created_at: string | null;
  message_kind?: "text" | LinkedTaskType;
  linked_task_card?: LinkedTaskCard;
  media_attachment?: {
    media_id: string;
    caption?: string;
    lifecycle?: {
      processing_status: MuxLifecycleStatus;
      playback_ready: boolean;
    } | null;
    file_url?: string;
    content_type?: string;
  };
};

export type NormalizedTaskAssignmentRef = {
  id: string;
  task_type: LinkedTaskType;
  title: string;
  description: string | null;
  status: LinkedTaskStatus;
  due_at: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  created_by: string | null;
  created_by_role: string | null;
  source: "message_linked";
  source_message_id: string | null;
  channel_id: string | null;
  last_thread_event_at: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeIsoDateOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function normalizeTaskStatus(raw: unknown): LinkedTaskStatus {
  const normalized = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized === "completed" || normalized === "done") return "completed";
  if (normalized === "in_progress" || normalized === "active" || normalized === "blocked") return "in_progress";
  return "pending";
}

export function canAuthorCoachTask(role: string | null | undefined): boolean {
  return role === "coach" || role === "team_leader" || role === "admin" || role === "super_admin";
}

export function buildLinkedTaskRights(input: {
  taskType: LinkedTaskType;
  viewerUserId: string | null | undefined;
  viewerRole: string | null | undefined;
  assigneeId: string | null | undefined;
}): LinkedTaskRights {
  const isAssignee = Boolean(input.viewerUserId) && String(input.viewerUserId) === String(input.assigneeId ?? "");
  if (input.taskType === "personal_task") {
    return {
      can_edit_fields: isAssignee,
      can_update_status: isAssignee,
      can_mark_complete: isAssignee,
      can_reassign: false,
    };
  }
  const canManage = canAuthorCoachTask(input.viewerRole);
  return {
    can_edit_fields: canManage,
    can_update_status: isAssignee || canManage,
    can_mark_complete: isAssignee || canManage,
    can_reassign: canManage,
  };
}

export function canMutateLinkedTask(input: {
  taskType: LinkedTaskType;
  action: LinkedTaskAction;
  actorUserId: string;
  actorRole: string | null | undefined;
  assigneeId: string | null | undefined;
  proposedAssigneeId?: string | null | undefined;
  proposedTitle?: string | null | undefined;
  proposedDescription?: string | null | undefined;
  proposedDueAt?: string | null | undefined;
  currentTitle?: string | null | undefined;
  currentDescription?: string | null | undefined;
  currentDueAt?: string | null | undefined;
}): LinkedTaskMutationPermission {
  const rights = buildLinkedTaskRights({
    taskType: input.taskType,
    viewerUserId: input.actorUserId,
    viewerRole: input.actorRole,
    assigneeId: input.assigneeId,
  });
  const isAssignee = String(input.actorUserId) === String(input.assigneeId ?? "");

  if (input.action === "complete") {
    return rights.can_mark_complete
      ? { allowed: true, ...rights }
      : { allowed: false, ...rights, reason: "Caller cannot complete this task" };
  }

  if (input.taskType === "personal_task") {
    if (!isAssignee) {
      return { allowed: false, ...rights, reason: "personal_task is self-managed only" };
    }
    const proposedAssignee = input.proposedAssigneeId ?? input.assigneeId ?? null;
    if (proposedAssignee !== input.actorUserId) {
      return { allowed: false, ...rights, reason: "personal_task assignee must remain the caller" };
    }
    return { allowed: true, ...rights };
  }

  if (rights.can_edit_fields) {
    return { allowed: true, ...rights };
  }

  if (!rights.can_update_status) {
    return { allowed: false, ...rights, reason: "Caller cannot update this coach_task" };
  }

  const proposedAssignee = input.proposedAssigneeId ?? input.assigneeId ?? null;
  const proposedTitle = input.proposedTitle ?? input.currentTitle ?? null;
  const proposedDescription = input.proposedDescription ?? input.currentDescription ?? null;
  const proposedDueAt = input.proposedDueAt ?? input.currentDueAt ?? null;
  const currentTitle = input.currentTitle ?? null;
  const currentDescription = input.currentDescription ?? null;
  const currentDueAt = input.currentDueAt ?? null;

  if (proposedAssignee !== (input.assigneeId ?? null)) {
    return { allowed: false, ...rights, reason: "Only coach-scope authoring roles can reassign coach_task" };
  }
  if (proposedTitle !== currentTitle || proposedDescription !== currentDescription || proposedDueAt !== currentDueAt) {
    return { allowed: false, ...rights, reason: "Assignee can only update status on coach_task" };
  }

  return { allowed: true, ...rights };
}

function normalizeTaskCardDraft(raw: unknown): ChannelMessagePayload["task_card_draft"] {
  if (!isRecord(raw)) return undefined;
  const taskType = raw.task_type === "personal_task" || raw.task_type === "coach_task" ? raw.task_type : undefined;
  const title = typeof raw.title === "string" ? raw.title.trim() : undefined;
  const description = typeof raw.description === "string" ? raw.description.trim() : raw.description === null ? null : undefined;
  const dueAt = normalizeIsoDateOrNull(raw.due_at);
  const assigneeId = typeof raw.assignee_id === "string" && raw.assignee_id.trim() ? raw.assignee_id.trim() : undefined;
  const taskId = typeof raw.task_id === "string" && raw.task_id.trim() ? raw.task_id.trim() : undefined;
  const status = normalizeTaskStatus(raw.status);
  return {
    ...(taskType ? { task_type: taskType } : {}),
    ...(title ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(dueAt ? { due_at: dueAt } : raw.due_at === null ? { due_at: null } : {}),
    ...(assigneeId ? { assignee_id: assigneeId } : {}),
    ...(taskId ? { task_id: taskId } : {}),
    ...(status ? { status } : {}),
  };
}

export function validateChannelMessagePayload(body: unknown):
  | { ok: true; payload: ChannelMessagePayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<ChannelMessagePayload>;
  const messageType = candidate.message_type ?? "message";
  if (messageType !== "message" && messageType !== "media_attachment") {
    return { ok: false, status: 422, error: "message_type must be one of: message, media_attachment" };
  }

  const bodyTextRaw = typeof candidate.body === "string" ? candidate.body.trim() : "";
  if (bodyTextRaw.length > 4000) {
    return { ok: false, status: 422, error: "body is too long (max 4000 chars)" };
  }

  if (messageType === "media_attachment") {
    if (!isRecord(candidate.media_attachment)) {
      return { ok: false, status: 422, error: "media_attachment is required when message_type=media_attachment" };
    }
    if (typeof candidate.media_attachment.media_id !== "string" || !candidate.media_attachment.media_id.trim()) {
      return { ok: false, status: 422, error: "media_attachment.media_id is required" };
    }
    const captionRaw =
      typeof candidate.media_attachment.caption === "string" ? candidate.media_attachment.caption.trim() : undefined;
    if (captionRaw && captionRaw.length > 4000) {
      return { ok: false, status: 422, error: "media_attachment.caption is too long (max 4000 chars)" };
    }
    const normalizedText = bodyTextRaw || captionRaw || "Shared media attachment";
    return {
      ok: true,
      payload: {
        body: normalizedText,
        message_type: "media_attachment",
        media_attachment: {
          media_id: candidate.media_attachment.media_id.trim(),
          ...(captionRaw ? { caption: captionRaw } : {}),
        },
      },
    };
  }

  const messageKind = candidate.message_kind ?? "text";
  const taskAction = candidate.task_action;
  const taskDraft = normalizeTaskCardDraft(candidate.task_card_draft);
  const isTaskLinked = messageKind === "personal_task" || messageKind === "coach_task" || Boolean(taskAction);

  if (!isTaskLinked) {
    if (!bodyTextRaw) {
      return { ok: false, status: 422, error: "body is required" };
    }
    return { ok: true, payload: { body: bodyTextRaw, message_type: "message", message_kind: "text" } };
  }

  if (messageKind !== "personal_task" && messageKind !== "coach_task") {
    return { ok: false, status: 422, error: "message_kind must be personal_task or coach_task for task-linked messages" };
  }
  if (taskAction !== "create" && taskAction !== "update" && taskAction !== "complete") {
    return { ok: false, status: 422, error: "task_action must be one of: create, update, complete" };
  }
  if (!taskDraft) {
    return { ok: false, status: 422, error: "task_card_draft is required for task-linked messages" };
  }
  if ((taskDraft.task_type ?? messageKind) !== messageKind) {
    return { ok: false, status: 422, error: "task_card_draft.task_type must match message_kind" };
  }
  if (taskAction === "create") {
    if (!taskDraft.title) return { ok: false, status: 422, error: "task_card_draft.title is required for task create" };
    if (!taskDraft.assignee_id) {
      return { ok: false, status: 422, error: "task_card_draft.assignee_id is required for task create" };
    }
  }
  if (taskAction === "update" || taskAction === "complete") {
    if (!taskDraft.task_id) {
      return { ok: false, status: 422, error: "task_card_draft.task_id is required for task update/complete" };
    }
  }

  return {
    ok: true,
    payload: {
      body: bodyTextRaw || undefined,
      message_type: "message",
      message_kind: messageKind,
      task_action: taskAction,
      task_card_draft: {
        ...taskDraft,
        task_type: messageKind,
        status: taskAction === "complete" ? "completed" : normalizeTaskStatus(taskDraft.status),
      },
    },
  };
}

export function serializeChannelMessageBody(payload: ChannelMessagePayload & {
  lifecycle?: {
    processing_status: MuxLifecycleStatus;
    playback_ready: boolean;
  };
  file_url?: string;
  content_type?: string;
}): string {
  const text = payload.body?.trim() || "";
  if (payload.message_type !== "media_attachment" || !payload.media_attachment) {
    return text;
  }
  return JSON.stringify({
    text,
    media_attachment: payload.media_attachment,
    lifecycle: payload.lifecycle ?? null,
    ...(payload.file_url ? { file_url: payload.file_url } : {}),
    ...(payload.content_type ? { content_type: payload.content_type } : {}),
  });
}

export function parseTaskAssignmentRef(raw: unknown): NormalizedTaskAssignmentRef | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "";
  const taskType = raw.task_type === "coach_task" ? "coach_task" : raw.task_type === "personal_task" ? "personal_task" : null;
  if (!id || !taskType) return null;
  return {
    id,
    task_type: taskType,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Task",
    description: typeof raw.description === "string" ? raw.description : raw.description === null ? null : null,
    status: normalizeTaskStatus(raw.status),
    due_at: normalizeIsoDateOrNull(raw.due_at),
    assignee_id: typeof raw.assignee_id === "string" && raw.assignee_id.trim() ? raw.assignee_id.trim() : null,
    assignee_name: typeof raw.assignee_name === "string" && raw.assignee_name.trim() ? raw.assignee_name.trim() : null,
    created_by: typeof raw.created_by === "string" && raw.created_by.trim() ? raw.created_by.trim() : null,
    created_by_role: typeof raw.created_by_role === "string" && raw.created_by_role.trim() ? raw.created_by_role.trim() : null,
    source: "message_linked",
    source_message_id: typeof raw.source_message_id === "string" && raw.source_message_id.trim() ? raw.source_message_id.trim() : null,
    channel_id: typeof raw.channel_id === "string" && raw.channel_id.trim() ? raw.channel_id.trim() : null,
    last_thread_event_at: normalizeIsoDateOrNull(raw.last_thread_event_at),
  };
}

export function buildTaskAssignmentRef(input: {
  taskId: string;
  taskType: LinkedTaskType;
  title: string;
  description: string | null;
  status: LinkedTaskStatus;
  dueAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string;
  createdByRole: string;
  channelId: string;
  messageId?: string | null;
  createdAt?: string | null;
}): NormalizedTaskAssignmentRef {
  return {
    id: input.taskId,
    task_type: input.taskType,
    title: input.title,
    description: input.description,
    status: input.status,
    due_at: input.dueAt,
    assignee_id: input.assigneeId,
    assignee_name: input.assigneeName,
    created_by: input.createdById,
    created_by_role: input.createdByRole,
    source: "message_linked",
    source_message_id: input.messageId ?? null,
    channel_id: input.channelId,
    last_thread_event_at: input.createdAt ?? null,
  };
}

export function buildTaskMessageBody(input: {
  taskAction: LinkedTaskAction;
  title: string;
  description?: string | null;
  note?: string | null;
}): string {
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note) return note;
  if (input.taskAction === "complete") return `Completed task: ${input.title}`;
  if (input.taskAction === "update") return input.description?.trim() || `Updated task: ${input.title}`;
  return input.description?.trim() || input.title;
}

export function buildChannelMessageReadModel(row: {
  id?: unknown;
  channel_id?: unknown;
  sender_user_id?: unknown;
  body?: unknown;
  message_type?: unknown;
  message_kind?: unknown;
  assignment_ref?: unknown;
  created_at?: unknown;
}, viewer?: { userId?: string | null; role?: string | null }): ChannelMessageReadModel {
  const base: ChannelMessageReadModel = {
    id: String(row.id ?? ""),
    channel_id: String(row.channel_id ?? ""),
    sender_user_id: String(row.sender_user_id ?? ""),
    body: typeof row.body === "string" ? row.body : "",
    message_type: String(row.message_type ?? "message"),
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    message_kind: "text",
  };

  const messageKind = row.message_kind === "coach_task" || row.message_kind === "personal_task" ? row.message_kind : "text";
  const linkedTaskRef = parseTaskAssignmentRef(row.assignment_ref);
  if (linkedTaskRef && (messageKind === "coach_task" || messageKind === "personal_task")) {
    base.message_kind = messageKind;
    base.linked_task_card = {
      task_id: linkedTaskRef.id,
      task_type: linkedTaskRef.task_type,
      title: linkedTaskRef.title,
      description: linkedTaskRef.description,
      status: linkedTaskRef.status,
      due_at: linkedTaskRef.due_at,
      assignee: {
        id: linkedTaskRef.assignee_id,
        display_name: linkedTaskRef.assignee_name ?? "Member",
      },
      created_by: {
        id: linkedTaskRef.created_by,
        role: linkedTaskRef.created_by_role,
      },
      source: "message_linked",
      source_message_id: linkedTaskRef.source_message_id ?? base.id,
      channel_id: linkedTaskRef.channel_id ?? base.channel_id,
      thread_sync: {
        included_in_assignments_feed: true,
        last_synced_at: linkedTaskRef.last_thread_event_at ?? base.created_at,
      },
      rights: buildLinkedTaskRights({
        taskType: linkedTaskRef.task_type,
        viewerUserId: viewer?.userId,
        viewerRole: viewer?.role,
        assigneeId: linkedTaskRef.assignee_id,
      }),
    };
  }

  let parsed: Record<string, unknown> | null = null;
  if (typeof row.body === "string" && row.body.trim().startsWith("{")) {
    try {
      const json = JSON.parse(row.body) as unknown;
      if (isRecord(json)) parsed = json;
    } catch {
      parsed = null;
    }
  }
  const isAttachmentByType = base.message_type === "media_attachment";
  const attachmentPayload = parsed && isRecord(parsed.media_attachment) ? parsed.media_attachment : null;
  const isAttachmentByPayload = Boolean(attachmentPayload?.media_id);
  if (!isAttachmentByType && !isAttachmentByPayload) {
    return base;
  }

  if (!parsed || !attachmentPayload) {
    return {
      ...base,
      message_type: "media_attachment",
      media_attachment: {
        media_id: "",
      },
    };
  }

  const lifecycleRaw = isRecord(parsed.lifecycle) ? parsed.lifecycle : null;
  const lifecycle =
    lifecycleRaw &&
    typeof lifecycleRaw.processing_status === "string" &&
    typeof lifecycleRaw.playback_ready === "boolean"
      ? {
          processing_status: lifecycleRaw.processing_status as MuxLifecycleStatus,
          playback_ready: lifecycleRaw.playback_ready,
        }
      : null;

  const text = typeof parsed.text === "string" ? parsed.text : base.body;
  return {
    ...base,
    message_type: "media_attachment",
    body: text,
    media_attachment: {
      media_id: typeof attachmentPayload.media_id === "string" ? attachmentPayload.media_id : "",
      ...(typeof attachmentPayload.caption === "string" ? { caption: attachmentPayload.caption } : {}),
      ...(lifecycle ? { lifecycle } : {}),
      ...(typeof parsed.file_url === "string" && parsed.file_url ? { file_url: parsed.file_url } : {}),
      ...(typeof parsed.content_type === "string" && parsed.content_type ? { content_type: parsed.content_type } : {}),
    },
  };
}
