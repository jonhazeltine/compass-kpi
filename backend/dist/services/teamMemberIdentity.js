"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTeamMemberIdentitySummaries = loadTeamMemberIdentitySummaries;
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function parseAvatarPresetId(userMetadata) {
    if (!isRecord(userMetadata))
        return null;
    const raw = userMetadata.avatar_preset_id;
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}
async function loadTeamMemberIdentitySummaries(dataClient, memberUserIds) {
    const profiles = new Map();
    if (memberUserIds.length === 0)
        return { ok: true, profiles };
    const { data: memberProfiles, error: memberProfilesError } = await dataClient
        .from("users")
        .select("id,full_name,avatar_url")
        .in("id", memberUserIds);
    if (memberProfilesError) {
        return { ok: false, error: memberProfilesError };
    }
    for (const row of memberProfiles ?? []) {
        const id = String(row.id ?? "");
        if (!id)
            continue;
        profiles.set(id, {
            full_name: typeof row.full_name === "string"
                ? String(row.full_name)
                : null,
            avatar_url: typeof row.avatar_url === "string"
                ? String(row.avatar_url)
                : null,
            email: null,
            avatar_preset_id: null,
        });
    }
    const getUserById = dataClient.auth?.admin?.getUserById;
    if (!getUserById) {
        return { ok: true, profiles };
    }
    const metadataRows = await Promise.all(memberUserIds.map(async (userId) => {
        try {
            const result = await getUserById(userId);
            if (result?.error)
                return { userId, avatarPresetId: null };
            return {
                userId,
                avatarPresetId: parseAvatarPresetId(result.data?.user?.user_metadata ?? null),
            };
        }
        catch {
            return { userId, avatarPresetId: null };
        }
    }));
    for (const row of metadataRows) {
        const existing = profiles.get(row.userId);
        if (!existing)
            continue;
        existing.avatar_preset_id = row.avatarPresetId;
    }
    return { ok: true, profiles };
}
