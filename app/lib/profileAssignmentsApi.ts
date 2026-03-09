import { API_URL } from "./supabase";

export type ProfileAssignmentType =
  | "personal_goal"
  | "team_leader_goal"
  | "coach_goal"
  | "personal_task"
  | "coach_task";

export type ProfileAssignmentStatus = "pending" | "in_progress" | "completed";

export type ProfileAssignment = {
  id: string;
  type: ProfileAssignmentType;
  title: string;
  description?: string | null;
  status: ProfileAssignmentStatus;
  due_at?: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  source: "goals" | "message_linked";
  created_at: string;
  created_by?: string | null;
  channel_id?: string | null;
  source_message_id?: string | null;
  last_thread_event_at?: string | null;
  thread_read_state?: "unread" | "read" | "unknown";
  rights?: {
    can_edit_fields?: boolean;
    can_update_status?: boolean;
    can_mark_complete?: boolean;
    can_reassign?: boolean;
  } | null;
};

export type ProfileAssignmentsCapabilities = {
  can_view: boolean;
  can_create_task: boolean;
  can_create_goal: boolean;
  can_manage_items: boolean;
  relationship_scope: "self" | "shared_team" | "coach_scope" | "admin_scope" | "none";
};

export type ProfileAssignmentsResponse = {
  assignments?: ProfileAssignment[];
  total?: number;
  empty_state?: { code: string; message: string } | null;
  viewer_capabilities?: ProfileAssignmentsCapabilities;
  error?: string;
};

type AssignmentWriteResponse = {
  assignment?: ProfileAssignment;
  error?: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function authHeaders(token: string, contentType = true) {
  return {
    Authorization: `Bearer ${token}`,
    ...(contentType ? { "Content-Type": "application/json" } : {}),
  };
}

export async function fetchProfileAssignments(token: string, userId: string) {
  const response = await fetch(`${API_URL}/api/coaching/users/${encodeURIComponent(userId)}/assignments`, {
    headers: authHeaders(token, false),
  });
  const body = await parseJson<ProfileAssignmentsResponse>(response);
  if (!response.ok) {
    throw new Error(String(body.error ?? `Profile assignments request failed (${response.status})`));
  }
  return {
    assignments: Array.isArray(body.assignments) ? body.assignments : [],
    capabilities: body.viewer_capabilities ?? null,
    emptyState: body.empty_state ?? null,
  };
}

export async function createProfileGoal(
  token: string,
  userId: string,
  payload: { title: string; due_at?: string | null }
) {
  const response = await fetch(`${API_URL}/api/coaching/users/${encodeURIComponent(userId)}/goals`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<AssignmentWriteResponse>(response);
  if (!response.ok) throw new Error(String(body.error ?? `Goal create failed (${response.status})`));
  return body.assignment ?? null;
}

export async function updateProfileGoal(
  token: string,
  userId: string,
  goalId: string,
  payload: { status?: ProfileAssignmentStatus; title?: string; due_at?: string | null }
) {
  const response = await fetch(
    `${API_URL}/api/coaching/users/${encodeURIComponent(userId)}/goals/${encodeURIComponent(goalId)}`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }
  );
  const body = await parseJson<AssignmentWriteResponse>(response);
  if (!response.ok) throw new Error(String(body.error ?? `Goal update failed (${response.status})`));
  return body.assignment ?? null;
}

export async function createProfileTask(
  token: string,
  userId: string,
  payload: { title: string; description?: string | null; due_at?: string | null; assignee_id?: string | null }
) {
  const response = await fetch(`${API_URL}/api/coaching/users/${encodeURIComponent(userId)}/tasks`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<AssignmentWriteResponse>(response);
  if (!response.ok) throw new Error(String(body.error ?? `Task create failed (${response.status})`));
  return body.assignment ?? null;
}

export async function updateProfileTask(
  token: string,
  userId: string,
  taskId: string,
  payload: { status: ProfileAssignmentStatus; channel_id: string }
) {
  const response = await fetch(
    `${API_URL}/api/coaching/users/${encodeURIComponent(userId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }
  );
  const body = await parseJson<AssignmentWriteResponse>(response);
  if (!response.ok) throw new Error(String(body.error ?? `Task update failed (${response.status})`));
  return body.assignment ?? null;
}
