import { API_URL } from './supabase';

export type AdminUserRow = {
  id: string;
  role: 'agent' | 'team_leader' | 'admin' | 'super_admin' | string;
  tier: 'free' | 'basic' | 'teams' | 'enterprise' | string;
  account_status: 'active' | 'deactivated' | string;
  last_activity_timestamp?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminUserCalibrationRow = {
  user_id: string;
  kpi_id: string;
  kpi_name?: string | null;
  kpi_type?: string | null;
  multiplier?: number | null;
  sample_size?: number | null;
  rolling_error_ratio?: number | null;
  rolling_abs_pct_error?: number | null;
  last_calibrated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminUserCalibrationSnapshot = {
  user_id: string;
  diagnostics?: Record<string, unknown> | null;
  rows: AdminUserCalibrationRow[];
};

export type AdminUserCalibrationEvent = {
  id: string;
  user_id: string;
  actual_log_id?: string | null;
  close_timestamp?: string | null;
  actual_gci?: number | null;
  predicted_gci_window?: number | null;
  error_ratio?: number | null;
  attribution_payload?: Record<string, unknown> | null;
  created_at?: string | null;
};

async function fetchAdminJson<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === 'string' && body.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

async function sendAdminJson<T>(
  path: string,
  accessToken: string,
  method: 'PUT' | 'POST' | 'PATCH',
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error) message = payload.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function fetchAdminUsers(accessToken: string): Promise<AdminUserRow[]> {
  const data = await fetchAdminJson<{ users?: AdminUserRow[] }>('/admin/users', accessToken);
  return data.users ?? [];
}

export async function updateAdminUserRole(
  accessToken: string,
  userId: string,
  role: AdminUserRow['role']
): Promise<AdminUserRow> {
  const data = await sendAdminJson<{ user: AdminUserRow }>(`/admin/users/${userId}/role`, accessToken, 'PUT', { role });
  return data.user;
}

export async function updateAdminUserTier(
  accessToken: string,
  userId: string,
  tier: AdminUserRow['tier']
): Promise<AdminUserRow> {
  const data = await sendAdminJson<{ user: AdminUserRow }>(`/admin/users/${userId}/tier`, accessToken, 'PUT', { tier });
  return data.user;
}

export async function updateAdminUserStatus(
  accessToken: string,
  userId: string,
  accountStatus: AdminUserRow['account_status']
): Promise<AdminUserRow> {
  const data = await sendAdminJson<{ user: AdminUserRow }>(`/admin/users/${userId}/status`, accessToken, 'PUT', {
    account_status: accountStatus,
  });
  return data.user;
}

export async function fetchAdminUserCalibration(
  accessToken: string,
  userId: string
): Promise<AdminUserCalibrationSnapshot> {
  return await fetchAdminJson<AdminUserCalibrationSnapshot>(`/admin/users/${userId}/kpi-calibration`, accessToken);
}

export async function resetAdminUserCalibration(
  accessToken: string,
  userId: string
): Promise<{ user_id: string; rows: AdminUserCalibrationRow[] }> {
  return await sendAdminJson<{ user_id: string; rows: AdminUserCalibrationRow[] }>(
    `/admin/users/${userId}/kpi-calibration/reset`,
    accessToken,
    'POST'
  );
}

export async function reinitializeAdminUserCalibrationFromOnboarding(
  accessToken: string,
  userId: string
): Promise<{ user_id: string; reinitialized_rows: number }> {
  return await sendAdminJson<{ user_id: string; reinitialized_rows: number }>(
    `/admin/users/${userId}/kpi-calibration/reinitialize-from-onboarding`,
    accessToken,
    'POST'
  );
}

export async function fetchAdminUserCalibrationEvents(
  accessToken: string,
  userId: string
): Promise<AdminUserCalibrationEvent[]> {
  const data = await fetchAdminJson<{ user_id: string; events?: AdminUserCalibrationEvent[] }>(
    `/admin/users/${userId}/kpi-calibration/events`,
    accessToken
  );
  return data.events ?? [];
}
