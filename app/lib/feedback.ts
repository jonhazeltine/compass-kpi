import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';

type FeedbackCue = 'logTap' | 'growthTap' | 'vitalityTap' | 'logSuccess' | 'logError' | 'locked' | 'swipe';
type HapticCue = 'tap' | 'success' | 'error' | 'warning';
type KpiType = 'PC' | 'GP' | 'VP' | 'Actual' | 'Pipeline_Anchor' | 'Custom';

type FeedbackConfig = {
  audioEnabled: boolean;
  hapticsEnabled: boolean;
  volume: number;
};

type AudioCueSource = number | string;

const config: FeedbackConfig = {
  audioEnabled: true,
  hapticsEnabled: true,
  volume: 0.75,
};

const cueSources = new Map<FeedbackCue, AudioCueSource>();
const cuePlayers = new Map<FeedbackCue, ReturnType<typeof createAudioPlayer>>();
let audioPrimed = false;
let audioPrimeAttempted = false;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function getFeedbackConfig() {
  return { ...config };
}

export function setFeedbackConfig(next: Partial<FeedbackConfig>) {
  if (typeof next.audioEnabled === 'boolean') config.audioEnabled = next.audioEnabled;
  if (typeof next.hapticsEnabled === 'boolean') config.hapticsEnabled = next.hapticsEnabled;
  if (typeof next.volume === 'number') config.volume = clamp01(next.volume);
}

export async function primeFeedbackAudioAsync() {
  if (audioPrimed || audioPrimeAttempted) return;
  audioPrimeAttempted = true;
  try {
    await setAudioModeAsync({
      // For M3b game-feel testing, SFX should still play when the iPhone silent switch is on.
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
    await setIsAudioActiveAsync(true);
    audioPrimed = true;
  } catch {
    // Audio is optional during M3b; keep haptics and UI behavior working.
  }
}

export function registerFeedbackCueSource(cue: FeedbackCue, source: AudioCueSource | null) {
  const existingPlayer = cuePlayers.get(cue);
  if (existingPlayer) {
    existingPlayer.remove();
    cuePlayers.delete(cue);
  }
  if (source == null) {
    cueSources.delete(cue);
    return;
  }
  cueSources.set(cue, source);
}

function getCuePlayer(cue: FeedbackCue) {
  const existing = cuePlayers.get(cue);
  if (existing) return existing;
  const source = cueSources.get(cue);
  if (!source) return null;
  try {
    const player = createAudioPlayer(source, { keepAudioSessionActive: true });
    player.volume = config.volume;
    cuePlayers.set(cue, player);
    return player;
  } catch {
    return null;
  }
}

export async function playFeedbackCueAsync(cue: FeedbackCue) {
  if (!config.audioEnabled) return false;
  if (audioPrimed) {
    // Hot path for tap/gameplay cues: avoid extra async hops once the session is primed.
  } else {
    void primeFeedbackAudioAsync();
  }
  const player = getCuePlayer(cue);
  if (!player) return false;
  try {
    player.volume = config.volume;
    // Fire-and-forget seek reduces perceived latency on repeated rapid taps.
    void player.seekTo(0);
    player.play();
    return true;
  } catch {
    return false;
  }
}

export async function triggerHapticAsync(cue: HapticCue) {
  if (!config.hapticsEnabled) return;
  try {
    if (cue === 'tap') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      return;
    }
    if (cue === 'success') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    if (cue === 'error') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Ignore unsupported environments (web/simulator).
  }
}

export async function playKpiTypeCueAsync(kpiType: KpiType) {
  const cueByType: Partial<Record<KpiType, FeedbackCue>> = {
    PC: 'logTap',
    GP: 'growthTap',
    VP: 'vitalityTap',
  };
  const cue = cueByType[kpiType];
  if (!cue) return;
  await playFeedbackCueAsync(cue);
}

export async function preloadFeedbackCuesAsync(
  cues: FeedbackCue[] = ['logTap', 'growthTap', 'vitalityTap', 'logSuccess', 'logError', 'locked', 'swipe']
) {
  await primeFeedbackAudioAsync();
  for (const cue of cues) {
    const player = getCuePlayer(cue);
    if (player) {
      try {
        player.volume = config.volume;
      } catch {
        // Ignore optional audio backend failures.
      }
    }
  }
}
