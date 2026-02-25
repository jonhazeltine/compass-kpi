import { API_URL } from './supabase';

export type EndpointProbeStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; bodyPreview: string }
  | { kind: 'not_implemented'; status: number }
  | { kind: 'forbidden'; status: number }
  | { kind: 'error'; message: string };

async function probeGet(path: string, accessToken: string): Promise<EndpointProbeStatus> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 404) return { kind: 'not_implemented', status: 404 };
    if (response.status === 403) return { kind: 'forbidden', status: 403 };
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const body = (await response.json()) as { error?: unknown };
        if (typeof body.error === 'string' && body.error) message = body.error;
      } catch {
        // ignore
      }
      return { kind: 'error', message };
    }

    const body = await response.json();
    const preview = JSON.stringify(body, null, 2);
    return { kind: 'ready', bodyPreview: preview.slice(0, 600) };
  } catch (error) {
    return { kind: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export function probeAdminAnalyticsOverview(accessToken: string) {
  return probeGet('/admin/analytics/overview', accessToken);
}

export function probeAdminDetailedReports(accessToken: string) {
  return probeGet('/admin/analytics/detailed-reports', accessToken);
}
