import * as ImagePicker from "expo-image-picker";
import { API_URL } from "./supabase";

export type AvatarPreset = {
  id: string;
  label: string;
  tone: string;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "preset_compass_blue", label: "Compass Blue", tone: "#dbeafe" },
  { id: "preset_compass_green", label: "Compass Green", tone: "#dcfce7" },
  { id: "preset_compass_gold", label: "Compass Gold", tone: "#fef3c7" },
  { id: "preset_compass_rose", label: "Compass Rose", tone: "#ffe4e6" },
];

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function toneForAvatarPreset(avatarPresetId: string | null | undefined, fallback = "#dbeafe") {
  return AVATAR_PRESETS.find((preset) => preset.id === avatarPresetId)?.tone ?? fallback;
}

type ProfileIdentityResponse = {
  id?: string;
  email?: string | null;
  avatar_url?: string | null;
  user_metadata?: Record<string, unknown> | null;
  error?: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

export async function saveProfileIdentity(
  token: string,
  payload: {
    full_name: string;
    avatar_url?: string | null;
    avatar_preset_id: string;
  }
) {
  const response = await fetch(`${API_URL}/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      full_name: payload.full_name.trim(),
      avatar_url: payload.avatar_url?.trim() || undefined,
      avatar_preset_id: payload.avatar_preset_id,
    }),
  });
  const body = await parseJson<ProfileIdentityResponse>(response);
  if (!response.ok) throw new Error(String(body.error ?? `Profile save failed (${response.status})`));
  return body;
}

export async function uploadProfileAvatar(token: string) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Please allow photo library access to upload an avatar.");
  }
  const selection = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.85,
  });
  if (selection.canceled || !selection.assets[0]) return null;

  const asset = selection.assets[0];
  const fileName = asset.fileName || `avatar-${Date.now()}.jpg`;
  const contentType = asset.mimeType || "image/jpeg";
  const contentLength = typeof asset.fileSize === "number" ? asset.fileSize : 0;

  const uploadSessionResponse = await fetch(`${API_URL}/api/profile/avatar/upload-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file_name: fileName,
      content_type: contentType,
      content_length_bytes: contentLength,
    }),
  });
  const uploadSessionBody = await parseJson<{ upload_url?: string; file_url?: string; error?: string }>(uploadSessionResponse);
  if (!uploadSessionResponse.ok) {
    throw new Error(uploadSessionBody.error ?? "Unable to request avatar upload URL");
  }

  const uploadUrl = String(uploadSessionBody.upload_url ?? "");
  const fileUrl = String(uploadSessionBody.file_url ?? "");
  if (!uploadUrl || !fileUrl) throw new Error("Avatar upload URL payload incomplete");

  const fileResp = await fetch(asset.uri);
  const blob = await fileResp.blob();
  const uploadResp = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: blob,
  });
  if (!uploadResp.ok) {
    throw new Error(`Avatar upload failed (${uploadResp.status})`);
  }
  return fileUrl;
}
