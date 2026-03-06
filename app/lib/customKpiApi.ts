import { API_URL } from './supabase';

export type CustomKpiRow = {
  id: string;
  name: string;
  slug?: string | null;
  type: 'Custom';
  icon_source?: 'brand_asset' | 'vector_icon' | 'emoji' | null;
  icon_name?: string | null;
  icon_emoji?: string | null;
  icon_file?: string | null;
  requires_direct_value_input?: boolean;
  is_active: boolean;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CustomKpiWritePayload = {
  name: string;
  slug?: string;
  icon_source?: 'brand_asset' | 'vector_icon' | 'emoji' | null;
  icon_name?: string | null;
  icon_emoji?: string | null;
  requires_direct_value_input?: boolean;
};

async function fetchCustomJson<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === 'string' && body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function fetchCustomKpis(accessToken: string): Promise<CustomKpiRow[]> {
  const data = await fetchCustomJson<{ custom_kpis?: CustomKpiRow[] }>('/api/custom-kpis', accessToken);
  return data.custom_kpis ?? [];
}

export async function createCustomKpi(accessToken: string, payload: CustomKpiWritePayload): Promise<CustomKpiRow> {
  const data = await fetchCustomJson<{ custom_kpi: CustomKpiRow }>('/api/custom-kpis', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.custom_kpi;
}

export async function updateCustomKpi(
  accessToken: string,
  kpiId: string,
  payload: Partial<CustomKpiWritePayload>
): Promise<CustomKpiRow> {
  const data = await fetchCustomJson<{ custom_kpi: CustomKpiRow }>(`/api/custom-kpis/${kpiId}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return data.custom_kpi;
}
