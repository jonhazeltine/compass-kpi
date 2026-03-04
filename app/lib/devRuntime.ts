import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const USER_SCOPED_ASYNC_PREFIXES = [
  'compass:',
  'coach:',
  'team:',
  'challenge:',
  'comms:',
  'logs:',
  'reports:',
  'kpi:',
];

export async function resetUserScopedRuntime(): Promise<void> {
  // Realtime channels are user-scoped; always drop them on persona switch.
  supabase.removeAllChannels();

  // Clear local user-scoped app caches to prevent stale identity/UI data bleed.
  const keys = await AsyncStorage.getAllKeys();
  const targetKeys = keys.filter((key) => USER_SCOPED_ASYNC_PREFIXES.some((prefix) => key.startsWith(prefix)));
  if (targetKeys.length > 0) {
    await AsyncStorage.multiRemove(targetKeys);
  }
}
