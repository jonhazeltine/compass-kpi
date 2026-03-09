type UserIdentitySummary = {
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  avatar_preset_id: string | null;
};

type DataClientLike = {
  from: (table: string) => any;
  auth?: {
    admin?: {
      getUserById?: (userId: string) => Promise<{ data?: { user?: { user_metadata?: unknown } | null } | null; error?: unknown }>;
    };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseAvatarPresetId(userMetadata: unknown): string | null {
  if (!isRecord(userMetadata)) return null;
  const raw = userMetadata.avatar_preset_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function loadTeamMemberIdentitySummaries(
  dataClient: DataClientLike,
  memberUserIds: string[]
) {
  const profiles = new Map<string, UserIdentitySummary>();
  if (memberUserIds.length === 0) return { ok: true as const, profiles };

  const { data: memberProfiles, error: memberProfilesError } = await dataClient
    .from("users")
    .select("id,full_name,avatar_url")
    .in("id", memberUserIds);
  if (memberProfilesError) {
    return { ok: false as const, error: memberProfilesError };
  }

  for (const row of memberProfiles ?? []) {
    const id = String((row as { id?: unknown }).id ?? "");
    if (!id) continue;
    profiles.set(id, {
      full_name: typeof (row as { full_name?: unknown }).full_name === "string"
        ? String((row as { full_name?: unknown }).full_name)
        : null,
      avatar_url: typeof (row as { avatar_url?: unknown }).avatar_url === "string"
        ? String((row as { avatar_url?: unknown }).avatar_url)
        : null,
      email: null,
      avatar_preset_id: null,
    });
  }

  const getUserById = dataClient.auth?.admin?.getUserById;
  if (!getUserById) {
    return { ok: true as const, profiles };
  }

  const metadataRows = await Promise.all(
    memberUserIds.map(async (userId) => {
      try {
        const result = await getUserById(userId);
        if (result?.error) return { userId, avatarPresetId: null };
        return {
          userId,
          avatarPresetId: parseAvatarPresetId(result.data?.user?.user_metadata ?? null),
        };
      } catch {
        return { userId, avatarPresetId: null };
      }
    })
  );

  for (const row of metadataRows) {
    const existing = profiles.get(row.userId);
    if (!existing) continue;
    existing.avatar_preset_id = row.avatarPresetId;
  }

  return { ok: true as const, profiles };
}
