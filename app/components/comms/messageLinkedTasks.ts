export type LinkedTaskType = 'personal_task' | 'coach_task';
export type LinkedTaskStatus = 'pending' | 'in_progress' | 'completed';
export type LinkedTaskAction = 'create' | 'update' | 'complete';

export type LinkedTaskRights = {
  can_edit_fields: boolean;
  can_update_status: boolean;
  can_mark_complete: boolean;
  can_reassign: boolean;
};

export type LinkedTaskCard = {
  task_id: string;
  task_type: LinkedTaskType;
  title: string;
  description?: string | null;
  status: LinkedTaskStatus;
  due_at?: string | null;
  assignee?: { id: string | null; display_name: string };
  created_by?: { id: string | null; role: string | null };
  source?: 'message_linked';
  source_message_id?: string;
  channel_id?: string;
  thread_sync?: {
    included_in_assignments_feed: boolean;
    last_synced_at: string | null;
  };
  rights?: LinkedTaskRights;
};

export type MediaAttachment = {
  media_id: string;
  caption?: string;
  lifecycle?: { processing_status: string; playback_ready: boolean } | null;
  file_url?: string;
  content_type?: string;
};

export type ThreadMessageRow = {
  id: string;
  channel_id: string;
  body: string;
  message_kind?: 'text' | LinkedTaskType | string;
  linked_task_card?: LinkedTaskCard | null;
  media_attachment?: MediaAttachment;
};

export type ThreadSendPayload = {
  body?: string;
  message_type?: 'message' | 'media_attachment';
  media_attachment?: {
    media_id: string;
    caption?: string;
  };
  message_kind?: 'text' | LinkedTaskType;
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

export type ParsedAttachment = { name: string; kind: string };
export type ParsedLegacyTaskCard = { taskId: string; title: string; owner: string | null; due: string | null; status: string };
export type ParsedLegacyTaskUpdate = { taskId: string; status: string; note: string | null };
export type ParsedThreadMessage = {
  text: string;
  attachments: ParsedAttachment[];
  linkedTaskCard: LinkedTaskCard | null;
  legacyTaskCard: ParsedLegacyTaskCard | null;
  legacyTaskUpdate: ParsedLegacyTaskUpdate | null;
  mediaAttachment: MediaAttachment | null;
};

export type TaskAssigneeDirectoryRow = {
  id: string;
  name: string;
  role?: string;
};

const META_RE = /(\w+)="([^"]*)"/g;
export const ATTACH_MARKER = '[attach]';
export const TASK_CARD_MARKER = '[task-card]';
export const TASK_UPDATE_MARKER = '[task-update]';

function parseMeta(line: string) {
  const out: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = META_RE.exec(line))) {
    out[match[1]] = match[2];
  }
  return out;
}

export function encodeLegacyMetaValue(value: string) {
  return String(value).replace(/"/g, "'");
}

export function normalizeTaskStatus(raw: string | null | undefined): LinkedTaskStatus {
  const normalized = String(raw ?? '').trim().toLowerCase();
  if (normalized === 'done' || normalized === 'complete' || normalized === 'completed') return 'completed';
  if (normalized === 'blocked' || normalized === 'active' || normalized === 'in_progress') return 'in_progress';
  return 'pending';
}

export function parseThreadMessage(message: ThreadMessageRow): ParsedThreadMessage {
  const lines = String(message.body ?? '').split('\n');
  const textParts: string[] = [];
  const attachments: ParsedAttachment[] = [];
  let legacyTaskCard: ParsedLegacyTaskCard | null = null;
  let legacyTaskUpdate: ParsedLegacyTaskUpdate | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith(ATTACH_MARKER)) {
      const meta = parseMeta(line);
      attachments.push({
        name: meta.name ?? 'Attachment',
        kind: meta.kind ?? 'file',
      });
      continue;
    }
    if (line.startsWith(TASK_CARD_MARKER)) {
      const meta = parseMeta(line);
      legacyTaskCard = {
        taskId: meta.task_id ?? `task-${message.id}`,
        title: meta.title ?? 'Task',
        owner: meta.owner ?? null,
        due: meta.due ?? null,
        status: meta.status ?? 'open',
      };
      continue;
    }
    if (line.startsWith(TASK_UPDATE_MARKER)) {
      const meta = parseMeta(line);
      legacyTaskUpdate = {
        taskId: meta.task_id ?? '',
        status: meta.status ?? 'open',
        note: meta.note ?? null,
      };
      continue;
    }
    textParts.push(raw);
  }

  return {
    text: textParts.join('\n').trim(),
    attachments,
    linkedTaskCard: message.linked_task_card ?? null,
    legacyTaskCard,
    legacyTaskUpdate,
    mediaAttachment: message.media_attachment ?? null,
  };
}

export function buildLegacyTaskStatusMap(rows: Array<{ parsed: ParsedThreadMessage }>) {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.parsed.legacyTaskCard) {
      map.set(row.parsed.legacyTaskCard.taskId, row.parsed.legacyTaskCard.status || 'open');
    }
    if (row.parsed.legacyTaskUpdate?.taskId) {
      map.set(row.parsed.legacyTaskUpdate.taskId, row.parsed.legacyTaskUpdate.status || 'open');
    }
  }
  return map;
}

function resolveAssigneeByName(ownerRaw: string | null | undefined, directory: TaskAssigneeDirectoryRow[]) {
  const target = String(ownerRaw ?? '').trim().toLowerCase();
  if (!target) return null;
  return directory.find((row) => row.id === ownerRaw || row.name.trim().toLowerCase() === target)
    ?? directory.find((row) => row.name.trim().toLowerCase().includes(target));
}

function resolveDefaultCoachTaskAssignee(input: {
  selectedChannelName?: string | null;
  currentUserId?: string | null;
  directory: TaskAssigneeDirectoryRow[];
}) {
  const preferredName = String(input.selectedChannelName ?? '').trim().toLowerCase();
  if (!preferredName) return null;
  return input.directory.find((row) => row.id !== input.currentUserId && row.name.trim().toLowerCase() === preferredName)
    ?? input.directory.find((row) => row.id !== input.currentUserId && preferredName.includes(row.name.trim().toLowerCase()));
}

function findStructuredTaskCard(taskId: string, messages: ThreadMessageRow[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const card = messages[index]?.linked_task_card;
    if (card?.task_id === taskId) {
      return card;
    }
  }
  return null;
}

export function resolveThreadSendPayload(input: {
  draft: string;
  personaVariant: 'coach' | 'team_leader' | 'sponsor' | 'member' | 'solo';
  currentUserId: string | null;
  selectedChannelName?: string | null;
  directory: TaskAssigneeDirectoryRow[];
  messages: ThreadMessageRow[];
  pendingAttachments: Array<{ name: string; kind: string }>;
  roleCanBroadcast: boolean;
}) {
  const trimmed = input.draft.trim();
  let encodedBody = trimmed;

  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('/broadcast')) {
      return input.roleCanBroadcast
        ? { action: 'open_broadcast' as const }
        : { action: 'error' as const, error: 'Broadcast command is not available for this role.' };
    }

    if (trimmed.startsWith('/task-update')) {
      if (input.personaVariant === 'sponsor') {
        return { action: 'error' as const, error: 'Task update commands are not available for this role.' };
      }
      const raw = trimmed.replace('/task-update', '').trim();
      const [left, right] = raw.split('|').map((value) => value.trim());
      const [taskId, statusRaw] = left.split(/\s+/);
      if (!taskId || !statusRaw) {
        return { action: 'error' as const, error: 'Use: /task-update task_id done|open|blocked | optional note' };
      }
      const status = normalizeTaskStatus(statusRaw);
      const linkedCard = findStructuredTaskCard(taskId, input.messages);
      if (!linkedCard) {
        encodedBody = `${TASK_UPDATE_MARKER} task_id="${encodeLegacyMetaValue(taskId)}" status="${encodeLegacyMetaValue(statusRaw)}"${
          right ? ` note="${encodeLegacyMetaValue(right)}"` : ''
        }`;
      } else {
        return {
          action: 'send' as const,
          payload: {
            body: right || undefined,
            message_kind: linkedCard.task_type,
            task_action: status === 'completed' ? ('complete' as const) : ('update' as const),
            task_card_draft: {
              task_type: linkedCard.task_type,
              task_id: linkedCard.task_id,
              status,
            },
          },
        };
      }
    } else if (trimmed.startsWith('/task')) {
      if (input.personaVariant === 'sponsor') {
        return { action: 'error' as const, error: 'Task commands are not available for this role.' };
      }
      const raw = trimmed.replace('/task', '').trim();
      const [titleRaw, ownerRaw, dueRaw] = raw.split('|').map((value) => value.trim());
      if (!titleRaw) {
        return { action: 'error' as const, error: 'Use: /task title | owner | due YYYY-MM-DD' };
      }
      const messageKind: LinkedTaskType = input.personaVariant === 'coach' || input.personaVariant === 'team_leader'
        ? 'coach_task'
        : 'personal_task';
      let assigneeId = input.currentUserId;
      if (messageKind === 'coach_task') {
        const ownerMatch = resolveAssigneeByName(ownerRaw, input.directory)
          ?? resolveDefaultCoachTaskAssignee({
            selectedChannelName: input.selectedChannelName,
            currentUserId: input.currentUserId,
            directory: input.directory,
          });
        assigneeId = ownerMatch?.id ?? null;
      }
      if (!assigneeId) {
        return { action: 'error' as const, error: 'Coach task requires an assignee from this thread or roster.' };
      }
      return {
        action: 'send' as const,
        payload: {
          message_kind: messageKind,
          task_action: 'create' as const,
          task_card_draft: {
            task_type: messageKind,
            title: titleRaw,
            assignee_id: assigneeId,
            due_at: dueRaw || undefined,
            status: 'pending' as const,
          },
        },
      };
    } else if (trimmed.startsWith('/help')) {
      const help = input.personaVariant === 'sponsor'
        ? (input.roleCanBroadcast ? '/broadcast' : 'No slash commands available for your role')
        : `/task, /task-update${input.roleCanBroadcast ? ', /broadcast' : ''}`;
      return { action: 'send' as const, payload: { body: help } };
    } else {
      return { action: 'error' as const, error: 'Unknown command. Use /help.' };
    }
  }

  if (input.pendingAttachments.length > 0) {
    const attachmentLines = input.pendingAttachments.map(
      (attachment) => `${ATTACH_MARKER} name="${encodeLegacyMetaValue(attachment.name)}" kind="${encodeLegacyMetaValue(attachment.kind)}"`
    );
    encodedBody = `${encodedBody || 'Attachment'}\n${attachmentLines.join('\n')}`;
  }

  if (!encodedBody.trim()) {
    return { action: 'error' as const, error: 'Enter a message, slash command, or attachment.' };
  }

  return { action: 'send' as const, payload: { body: encodedBody } };
}
