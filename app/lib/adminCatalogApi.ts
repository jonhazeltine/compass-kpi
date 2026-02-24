import { API_URL } from './supabase';

export type AdminKpiRow = {
  id: string;
  name: string;
  slug?: string | null;
  type: string;
  requires_direct_value_input?: boolean;
  is_active: boolean;
  pc_weight?: number | null;
  ttc_days?: number | null;
  ttc_definition?: string | null;
  delay_days?: number | null;
  hold_days?: number | null;
  decay_days?: number | null;
  gp_value?: number | null;
  vp_value?: number | null;
  updated_at?: string | null;
};

export type AdminChallengeTemplateRow = {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  updated_at?: string | null;
};

async function fetchAdminJson<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === 'string' && body.error) message = body.error;
    } catch {
      // ignore body parse failures
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

async function sendAdminJson<T>(
  path: string,
  accessToken: string,
  method: 'POST' | 'PUT' | 'DELETE',
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
      // noop
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function fetchAdminKpis(accessToken: string): Promise<AdminKpiRow[]> {
  const data = await fetchAdminJson<{ kpis?: AdminKpiRow[] }>('/admin/kpis', accessToken);
  return data.kpis ?? [];
}

export async function fetchAdminChallengeTemplates(accessToken: string): Promise<AdminChallengeTemplateRow[]> {
  const data = await fetchAdminJson<{ challenge_templates?: AdminChallengeTemplateRow[] }>(
    '/admin/challenge-templates',
    accessToken
  );
  return data.challenge_templates ?? [];
}

export type AdminKpiWritePayload = {
  name: string;
  type: 'PC' | 'GP' | 'VP' | 'Actual' | 'Pipeline_Anchor' | 'Custom';
  slug?: string;
  requires_direct_value_input?: boolean;
  pc_weight?: number | null;
  ttc_definition?: string | null;
  delay_days?: number | null;
  hold_days?: number | null;
  ttc_days?: number | null;
  decay_days?: number | null;
  gp_value?: number | null;
  vp_value?: number | null;
  is_active?: boolean;
};

export type AdminChallengeTemplateWritePayload = {
  name: string;
  description?: string;
  is_active?: boolean;
};

export async function createAdminKpi(accessToken: string, payload: AdminKpiWritePayload): Promise<AdminKpiRow> {
  const data = await sendAdminJson<{ kpi: AdminKpiRow }>('/admin/kpis', accessToken, 'POST', payload);
  return data.kpi;
}

export async function updateAdminKpi(
  accessToken: string,
  kpiId: string,
  payload: Partial<AdminKpiWritePayload>
): Promise<AdminKpiRow> {
  const data = await sendAdminJson<{ kpi: AdminKpiRow }>(`/admin/kpis/${kpiId}`, accessToken, 'PUT', payload);
  return data.kpi;
}

export async function deactivateAdminKpi(accessToken: string, kpiId: string): Promise<AdminKpiRow> {
  const data = await sendAdminJson<{ kpi: AdminKpiRow }>(`/admin/kpis/${kpiId}`, accessToken, 'DELETE');
  return data.kpi;
}

export async function createAdminChallengeTemplate(
  accessToken: string,
  payload: AdminChallengeTemplateWritePayload
): Promise<AdminChallengeTemplateRow> {
  const data = await sendAdminJson<{ challenge_template: AdminChallengeTemplateRow }>(
    '/admin/challenge-templates',
    accessToken,
    'POST',
    payload
  );
  return data.challenge_template;
}

export async function updateAdminChallengeTemplate(
  accessToken: string,
  templateId: string,
  payload: Partial<AdminChallengeTemplateWritePayload>
): Promise<AdminChallengeTemplateRow> {
  const data = await sendAdminJson<{ challenge_template: AdminChallengeTemplateRow }>(
    `/admin/challenge-templates/${templateId}`,
    accessToken,
    'PUT',
    payload
  );
  return data.challenge_template;
}

export async function deactivateAdminChallengeTemplate(
  accessToken: string,
  templateId: string
): Promise<AdminChallengeTemplateRow> {
  const data = await sendAdminJson<{ challenge_template: AdminChallengeTemplateRow }>(
    `/admin/challenge-templates/${templateId}`,
    accessToken,
    'DELETE'
  );
  return data.challenge_template;
}
