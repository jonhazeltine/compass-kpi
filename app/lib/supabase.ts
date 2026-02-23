import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl = extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config. Create app/.env with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo with: npx expo start -c'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const getExpoHostIp = (): string | null => {
  const expoConfigHost = (Constants.expoConfig as { hostUri?: unknown } | null)?.hostUri;
  const manifest2Host = (
    Constants as typeof Constants & {
      manifest2?: { extra?: { expoClient?: { hostUri?: unknown } } };
      manifest?: { debuggerHost?: unknown };
    }
  ).manifest2?.extra?.expoClient?.hostUri;
  const debuggerHost = (
    Constants as typeof Constants & { manifest?: { debuggerHost?: unknown } }
  ).manifest?.debuggerHost;

  const hostUri = [expoConfigHost, manifest2Host, debuggerHost].find(
    (value): value is string => typeof value === 'string' && value.length > 0
  );
  if (!hostUri) return null;
  const host = hostUri.split(':')[0]?.trim();
  return host || null;
};

const resolveApiUrl = (): string => {
  const raw = String(extra.apiUrl ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000');
  const usesLocalhost =
    raw.includes('://localhost:') || raw.includes('://127.0.0.1:') || raw.startsWith('http://localhost') || raw.startsWith('http://127.0.0.1');
  if (!usesLocalhost) return raw;
  const expoHostIp = getExpoHostIp();
  if (!expoHostIp) return raw;
  return raw.replace('://localhost', `://${expoHostIp}`).replace('://127.0.0.1', `://${expoHostIp}`);
};

export const API_URL = resolveApiUrl();
