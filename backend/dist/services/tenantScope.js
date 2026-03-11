"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportsTenantOrgScope = supportsTenantOrgScope;
exports.getUserOrgId = getUserOrgId;
exports.getTeamOrgId = getTeamOrgId;
exports.listTeamOrgIdsForUser = listTeamOrgIdsForUser;
exports.ensureUserHomeOrgId = ensureUserHomeOrgId;
exports.resolveResourceOrgId = resolveResourceOrgId;
const tenancySupportCache = new WeakMap();
function isRecoverableSchemaGap(error) {
    if (!error)
        return false;
    const code = String(error.code ?? "");
    if (code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205") {
        return true;
    }
    const msg = String(error.message ?? "").toLowerCase();
    return msg.includes("does not exist") || msg.includes("could not find");
}
async function supportsTenantOrgScope(dataClient) {
    const cached = tenancySupportCache.get(dataClient);
    if (typeof cached === "boolean")
        return cached;
    const { error } = await dataClient.from("users").select("org_id").limit(1);
    const supported = !isRecoverableSchemaGap(error);
    tenancySupportCache.set(dataClient, supported);
    return supported;
}
async function createOrganization(input) {
    const { data, error } = await input.dataClient
        .from("organizations")
        .insert({
        name: input.name,
        org_type: input.orgType,
        owner_user_id: input.ownerUserId ?? null,
    })
        .select("id")
        .single();
    if (error || !data) {
        throw new Error(`Failed to create organization: ${error?.message ?? "unknown error"}`);
    }
    return String(data.id ?? "");
}
async function getUserOrgId(dataClient, userId) {
    if (!(await supportsTenantOrgScope(dataClient)))
        return null;
    const { data, error } = await dataClient.from("users").select("org_id").eq("id", userId).maybeSingle();
    if (isRecoverableSchemaGap(error))
        return null;
    if (error) {
        throw new Error(`Failed to load user org scope: ${error.message ?? "unknown error"}`);
    }
    return typeof data?.org_id === "string"
        ? String(data.org_id)
        : null;
}
async function getTeamOrgId(dataClient, teamId) {
    if (!(await supportsTenantOrgScope(dataClient)))
        return null;
    const { data, error } = await dataClient.from("teams").select("org_id").eq("id", teamId).maybeSingle();
    if (isRecoverableSchemaGap(error))
        return null;
    if (error) {
        throw new Error(`Failed to load team org scope: ${error.message ?? "unknown error"}`);
    }
    return typeof data?.org_id === "string"
        ? String(data.org_id)
        : null;
}
async function listTeamOrgIdsForUser(dataClient, userId) {
    if (!(await supportsTenantOrgScope(dataClient)))
        return [];
    const { data: memberships, error: membershipError } = await dataClient
        .from("team_memberships")
        .select("team_id")
        .eq("user_id", userId);
    if (membershipError) {
        throw new Error(`Failed to load user team scope: ${membershipError.message ?? "unknown error"}`);
    }
    const teamIds = Array.from(new Set((memberships ?? [])
        .map((row) => String(row.team_id ?? ""))
        .filter(Boolean)));
    if (teamIds.length === 0)
        return [];
    const { data: teams, error: teamsError } = await dataClient.from("teams").select("id,org_id").in("id", teamIds);
    if (teamsError) {
        throw new Error(`Failed to load team org mappings: ${teamsError.message ?? "unknown error"}`);
    }
    return Array.from(new Set((teams ?? [])
        .map((row) => String(row.org_id ?? ""))
        .filter(Boolean)));
}
async function ensureUserHomeOrgId(dataClient, userId) {
    if (!(await supportsTenantOrgScope(dataClient)))
        return null;
    const { data: userRow, error: userError } = await dataClient
        .from("users")
        .select("id,org_id,full_name")
        .eq("id", userId)
        .maybeSingle();
    if (userError) {
        throw new Error(`Failed to load user row for tenancy binding: ${userError.message ?? "unknown error"}`);
    }
    if (typeof userRow?.org_id === "string") {
        return String(userRow.org_id);
    }
    const createdTeam = await dataClient
        .from("teams")
        .select("org_id")
        .eq("created_by", userId)
        .not("org_id", "is", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
    if (!createdTeam.error && typeof createdTeam.data?.org_id === "string") {
        const orgId = String(createdTeam.data.org_id);
        const { error: updateError } = await dataClient.from("users").update({ org_id: orgId }).eq("id", userId);
        if (updateError) {
            throw new Error(`Failed to bind user to existing team org: ${updateError.message ?? "unknown error"}`);
        }
        return orgId;
    }
    const membershipOrgIds = await listTeamOrgIdsForUser(dataClient, userId);
    if (membershipOrgIds.length > 0) {
        const orgId = membershipOrgIds[0];
        const { error: updateError } = await dataClient.from("users").update({ org_id: orgId }).eq("id", userId);
        if (updateError) {
            throw new Error(`Failed to bind user to member team org: ${updateError.message ?? "unknown error"}`);
        }
        return orgId;
    }
    const displayName = typeof userRow?.full_name === "string"
        ? String(userRow.full_name).trim()
        : "";
    const orgName = displayName ? `${displayName} Workspace` : `User ${userId.slice(0, 8)} Workspace`;
    const orgId = await createOrganization({
        dataClient,
        name: orgName,
        orgType: "personal",
        ownerUserId: userId,
    });
    const { error: updateError } = await dataClient.from("users").update({ org_id: orgId }).eq("id", userId);
    if (updateError) {
        throw new Error(`Failed to bind user to personal org: ${updateError.message ?? "unknown error"}`);
    }
    return orgId;
}
async function resolveResourceOrgId(input) {
    if (!(await supportsTenantOrgScope(input.dataClient)))
        return null;
    if (input.teamId) {
        return getTeamOrgId(input.dataClient, input.teamId);
    }
    if (input.ownerUserId) {
        return ensureUserHomeOrgId(input.dataClient, input.ownerUserId);
    }
    if (input.sponsorId) {
        const { data, error } = await input.dataClient
            .from("sponsors")
            .select("org_id")
            .eq("id", input.sponsorId)
            .maybeSingle();
        if (error) {
            throw new Error(`Failed to resolve sponsor org scope: ${error.message ?? "unknown error"}`);
        }
        return typeof data?.org_id === "string"
            ? String(data.org_id)
            : null;
    }
    if (input.journeyId) {
        const { data, error } = await input.dataClient
            .from("journeys")
            .select("org_id")
            .eq("id", input.journeyId)
            .maybeSingle();
        if (error) {
            throw new Error(`Failed to resolve journey org scope: ${error.message ?? "unknown error"}`);
        }
        return typeof data?.org_id === "string"
            ? String(data.org_id)
            : null;
    }
    if (input.channelId) {
        const { data, error } = await input.dataClient
            .from("channels")
            .select("org_id")
            .eq("id", input.channelId)
            .maybeSingle();
        if (error) {
            throw new Error(`Failed to resolve channel org scope: ${error.message ?? "unknown error"}`);
        }
        return typeof data?.org_id === "string"
            ? String(data.org_id)
            : null;
    }
    return null;
}
