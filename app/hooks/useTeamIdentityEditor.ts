/**
 * useTeamIdentityEditor — State-management hook for the team identity
 * card (avatar, background, name editing).
 *
 * Owns the visual-identity state, the draft-editor state, and the
 * PATCH-save handler.  The host screen still reads the committed
 * avatar/background for rendering the identity card.
 */

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { API_URL } from '../lib/supabase';

// Re-use the project-level error helper already imported by the dashboard.
// The dashboard passes getApiErrorMessage via closure; we inline a thin copy
// here so the hook stays self-contained.
function getApiErrorMessageLocal(
  body: unknown,
  fallback: string,
): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const e = (body as Record<string, unknown>).error;
    if (typeof e === 'string' && e.trim().length > 0) return e;
  }
  return fallback;
}

export type TeamIdentityAvatarCategory = 'power' | 'animals' | 'nature' | 'sports' | 'symbols';

export interface TeamIdentityEditorState {
  avatar: string;
  background: string;
  editOpen: boolean;
  draftName: string;
  draftAvatar: string;
  draftBackground: string;
  avatarCategory: TeamIdentityAvatarCategory;
  saveBusy: boolean;
  controlsOpen: boolean;
}

export interface TeamIdentityEditorActions {
  setAvatar: (v: string) => void;
  setBackground: (v: string) => void;
  setEditOpen: (v: boolean) => void;
  setDraftName: (v: string) => void;
  setDraftAvatar: (v: string) => void;
  setDraftBackground: (v: string) => void;
  setAvatarCategory: (v: TeamIdentityAvatarCategory) => void;
  setControlsOpen: (v: boolean) => void;
  /**
   * Open the identity-edit sheet, pre-filling draft fields from the
   * current committed values + the supplied team name.
   */
  openEditor: (teamName: string) => void;
  /** Cancel editing (no-op while save is in flight). */
  cancelEditor: () => void;
  /**
   * Save identity edits via PATCH /teams/:teamId.
   * Calls `onNameSaved` if the server confirms a new name.
   */
  saveEdits: (opts: {
    teamName: string;
    resolveTeamId: () => string | null;
    onNameSaved: (name: string) => void;
  }) => Promise<void>;
}

export function useTeamIdentityEditor(
  accessToken: string | null,
  _teamId: string | null, // reserved for future direct use
): TeamIdentityEditorState & TeamIdentityEditorActions {
  const [avatar, setAvatar] = useState('🛡️');
  const [background, setBackground] = useState('#dff0da');
  const [editOpen, setEditOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftAvatar, setDraftAvatar] = useState('🛡️');
  const [draftBackground, setDraftBackground] = useState('#dff0da');
  const [avatarCategory, setAvatarCategory] = useState<TeamIdentityAvatarCategory>('power');
  const [saveBusy, setSaveBusy] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);

  const openEditor = useCallback(
    (teamName: string) => {
      setDraftName(teamName);
      setDraftAvatar(avatar);
      setDraftBackground(background);
      setAvatarCategory('power');
      setEditOpen(true);
    },
    [avatar, background],
  );

  const cancelEditor = useCallback(() => {
    if (saveBusy) return;
    setEditOpen(false);
  }, [saveBusy]);

  const saveEdits = useCallback(
    async (opts: {
      teamName: string;
      resolveTeamId: () => string | null;
      onNameSaved: (name: string) => void;
    }) => {
      const token = accessToken;
      const teamId = opts.resolveTeamId();
      const normalizedName = draftName.trim();
      if (!normalizedName) {
        Alert.alert('Team name required', 'Enter a team name before saving.');
        return;
      }
      if (!token || !teamId) {
        Alert.alert('Unable to save', 'Team context is unavailable. Refresh and try again.');
        return;
      }
      setSaveBusy(true);
      setAvatar(draftAvatar);
      setBackground(draftBackground);
      try {
        const response = await fetch(`${API_URL}/teams/${encodeURIComponent(teamId)}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: normalizedName,
            identity_avatar: draftAvatar,
            identity_background: draftBackground,
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          team?: {
            name?: string | null;
            identity_avatar?: string | null;
            identity_background?: string | null;
          };
        };
        if (!response.ok) {
          const fallback = `Team update failed (${response.status})`;
          const message = getApiErrorMessageLocal(payload, fallback);
          Alert.alert('Unable to save team identity', message);
          return;
        }
        const savedName = String(payload.team?.name ?? normalizedName).trim();
        opts.onNameSaved(savedName || normalizedName);
        setAvatar(String(payload.team?.identity_avatar ?? draftAvatar).trim() || '🛡️');
        setBackground(String(payload.team?.identity_background ?? draftBackground).trim() || '#dff0da');
        setEditOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save team identity';
        Alert.alert('Unable to save team identity', message);
      } finally {
        setSaveBusy(false);
      }
    },
    [accessToken, draftAvatar, draftBackground, draftName],
  );

  return {
    avatar,
    background,
    editOpen,
    draftName,
    draftAvatar,
    draftBackground,
    avatarCategory,
    saveBusy,
    controlsOpen,
    setAvatar,
    setBackground,
    setEditOpen,
    setDraftName,
    setDraftAvatar,
    setDraftBackground,
    setAvatarCategory,
    setControlsOpen,
    openEditor,
    cancelEditor,
    saveEdits,
  };
}
