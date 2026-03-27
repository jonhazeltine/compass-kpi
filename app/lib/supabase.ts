import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl = extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config. Create app/.env with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo with: npx expo start -c'
  );
}

const secureStoreKeyPrefix = 'compass_kpi_auth_v1_';
const sanitizeSecureStoreKeyPart = (value: string): string => {
  const normalized = String(value ?? '').trim();
  const sanitized = normalized.replace(/[^a-zA-Z0-9._-]/g, '_');
  const bounded = sanitized.slice(0, 96);
  return bounded.length > 0 ? bounded : 'default';
};
const secureStoreKeyFor = (key: string): string => `${secureStoreKeyPrefix}${sanitizeSecureStoreKeyPart(key)}`;

// Patch SecureStore globally so any internal callers also get valid iOS-safe keys.
const secureStoreAny = SecureStore as any;
if (!secureStoreAny.__compassKeyPatchApplied) {
  const originalGetItemAsync = secureStoreAny.getItemAsync?.bind(SecureStore);
  const originalSetItemAsync = secureStoreAny.setItemAsync?.bind(SecureStore);
  const originalDeleteItemAsync = secureStoreAny.deleteItemAsync?.bind(SecureStore);
  const sanitizeDirectKey = (key: string): string => sanitizeSecureStoreKeyPart(String(key ?? ''));
  if (typeof originalGetItemAsync === 'function') {
    secureStoreAny.getItemAsync = (key: string, options?: any) => originalGetItemAsync(sanitizeDirectKey(key), options);
  }
  if (typeof originalSetItemAsync === 'function') {
    secureStoreAny.setItemAsync = (key: string, value: string, options?: any) =>
      originalSetItemAsync(sanitizeDirectKey(key), value, options);
  }
  if (typeof originalDeleteItemAsync === 'function') {
    secureStoreAny.deleteItemAsync = (key: string, options?: any) => originalDeleteItemAsync(sanitizeDirectKey(key), options);
  }
  secureStoreAny.__compassKeyPatchApplied = true;
}

const secureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const safeKey = secureStoreKeyFor(key);
    try {
      return await SecureStore.getItemAsync(safeKey);
    } catch (error) {
      throw new Error(
        `SecureStore getItem failed (raw="${String(key)}" safe="${safeKey}"): ${
          error instanceof Error ? error.message : 'unknown'
        }`
      );
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const safeKey = secureStoreKeyFor(key);
    try {
      await SecureStore.setItemAsync(safeKey, value);
    } catch (error) {
      throw new Error(
        `SecureStore setItem failed (raw="${String(key)}" safe="${safeKey}"): ${
          error instanceof Error ? error.message : 'unknown'
        }`
      );
    }
  },
  removeItem: async (key: string): Promise<void> => {
    const safeKey = secureStoreKeyFor(key);
    try {
      await SecureStore.deleteItemAsync(safeKey);
    } catch (error) {
      throw new Error(
        `SecureStore removeItem failed (raw="${String(key)}" safe="${safeKey}"): ${
          error instanceof Error ? error.message : 'unknown'
        }`
      );
    }
  },
};

const webStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(key);
  },
};

const authStorageAdapter = Platform.OS === 'web' ? webStorageAdapter : secureStoreAdapter;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorageAdapter,
    storageKey: 'compass_kpi_auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

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

const DEV_LAN_FALLBACK_IP = '192.168.86.32';

const resolveApiUrl = (): string => {
  const raw = String(extra.apiUrl ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000');
  const usesLocalhost =
    raw.includes('://localhost:') || raw.includes('://127.0.0.1:') || raw.startsWith('http://localhost') || raw.startsWith('http://127.0.0.1');
  if (!usesLocalhost) return raw;
  // Web browsers and iOS *simulator* can reach host services on localhost directly.
  // Physical iOS devices (Constants.isDevice === true) cannot — rewrite to LAN IP just like Android.
  if (Platform.OS === 'web') return raw;
  if (Platform.OS === 'ios' && !Constants.isDevice) return raw;
  const expoHost = getExpoHostIp();
  // If the Expo host looks like a tunnel hostname (not a numeric IP), ignore it and use the LAN fallback.
  const looksLikeIp = expoHost != null && /^\d+\.\d+\.\d+\.\d+$/.test(expoHost);
  const expoHostIp = looksLikeIp ? expoHost : DEV_LAN_FALLBACK_IP;
  const resolved = raw.replace('://localhost', `://${expoHostIp}`).replace('://127.0.0.1', `://${expoHostIp}`);
  // eslint-disable-next-line no-console
  console.log(`[API_URL] platform=${Platform.OS} isDevice=${Constants.isDevice} expoHost=${expoHost} lanIp=${expoHostIp} → ${resolved}`);
  return resolved;
};

export const API_URL = resolveApiUrl();
// eslint-disable-next-line no-console
console.log(`[API_URL] platform=${Platform.OS} isDevice=${Constants.isDevice} raw=${String(extra.apiUrl ?? '(none)')} → ${API_URL}`);

const extraWithDev = extra as {
  enableDevTools?: boolean | string;
  defaultPersonaKey?: string;
  appVariant?: string;
  personaCredentials?: Record<string, { email: string; password: string }>;
};

export const DEV_TOOLS_ENABLED =
  __DEV__ || extraWithDev.enableDevTools === true || String(extraWithDev.enableDevTools ?? '').toLowerCase() === 'true';

/** Show debug banners, notification surfaces, AI draft buttons, limited-data chips. Off by default even in dev. */
export const DEV_DEBUG_UI_ENABLED = false;

export const DEFAULT_PERSONA_KEY = String(extraWithDev.defaultPersonaKey ?? '').trim().toLowerCase();

export const APP_VARIANT = String(extraWithDev.appVariant ?? 'default').trim().toLowerCase();

export const PERSONA_CREDENTIALS: Record<string, { email: string; password: string }> =
  extraWithDev.personaCredentials ?? {};
