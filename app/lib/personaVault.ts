import * as SecureStore from 'expo-secure-store';
import type { Session } from '@supabase/supabase-js';
import { DEV_TOOLS_ENABLED, PERSONA_CREDENTIALS, supabase } from './supabase';

export type PersonaKey = string;

export type PersonaTokenPair = {
  access_token: string;
  refresh_token: string;
};

const PERSONA_SESSION_KEY_PREFIX = 'persona_session:';
const personaSessionStorageKey = (personaKey: PersonaKey) =>
  `${PERSONA_SESSION_KEY_PREFIX}${personaKey.trim().toLowerCase()}`;

const DEV_PERSONA_DEFAULTS: PersonaKey[] = ['solo', 'member', 'leader', 'coach', 'sponsor', 'admin'];

export const getKnownPersonaKeys = (): PersonaKey[] => {
  const dynamic = Object.keys(PERSONA_CREDENTIALS).map((key) => key.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set([...DEV_PERSONA_DEFAULTS, ...dynamic]));
};

const assertDevToolsEnabled = () => {
  if (!DEV_TOOLS_ENABLED) {
    throw new Error('Developer persona tools are disabled outside dev/staging runtime.');
  }
};

const extractSessionTokens = (session: Session | null | undefined): PersonaTokenPair | null => {
  if (!session?.access_token || !session?.refresh_token) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  };
};

export async function getCachedPersonaTokens(personaKey: PersonaKey): Promise<PersonaTokenPair | null> {
  const raw = await SecureStore.getItemAsync(personaSessionStorageKey(personaKey));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersonaTokenPair;
    if (!parsed?.access_token || !parsed?.refresh_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function cacheCurrentSession(personaKey: PersonaKey): Promise<PersonaTokenPair> {
  assertDevToolsEnabled();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const tokens = extractSessionTokens(data.session);
  if (!tokens) throw new Error('No active session available to cache.');
  await SecureStore.setItemAsync(personaSessionStorageKey(personaKey), JSON.stringify(tokens));
  return tokens;
}

const resolvePersonaCredential = (personaKey: PersonaKey): { email: string; password: string } | null => {
  const normalized = personaKey.trim().toLowerCase();
  const cred = PERSONA_CREDENTIALS[normalized];
  if (!cred?.email || !cred?.password) return null;
  return cred;
};

export async function signInAndCache(personaKey: PersonaKey): Promise<void> {
  assertDevToolsEnabled();
  const credential = resolvePersonaCredential(personaKey);
  if (!credential) {
    throw new Error(`Missing dev credentials for persona "${personaKey}".`);
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: credential.email,
    password: credential.password,
  });
  if (error) throw error;
  await cacheCurrentSession(personaKey);
}

export async function switchToPersona(
  personaKey: PersonaKey,
  options?: { onSwitched?: () => Promise<void> | void }
): Promise<void> {
  assertDevToolsEnabled();
  const tokens = await getCachedPersonaTokens(personaKey);
  if (!tokens) throw new Error(`No cached session for "${personaKey}". Use Sign in + Cache first.`);
  const { error } = await supabase.auth.setSession(tokens);
  if (error) throw error;
  if (options?.onSwitched) {
    await options.onSwitched();
  }
}

export async function clearPersonaVault(personaKeys: PersonaKey[] = getKnownPersonaKeys()): Promise<void> {
  await Promise.all(personaKeys.map((key) => SecureStore.deleteItemAsync(personaSessionStorageKey(key))));
}
