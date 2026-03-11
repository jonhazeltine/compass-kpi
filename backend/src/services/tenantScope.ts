import type { SupabaseClient } from "@supabase/supabase-js";

type DataClientLike = SupabaseClient;

const tenancySupportCache = new WeakMap<object, boolean>();

function isRecoverableSchemaGap(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  if (code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205") {
    return true;
  }
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("could not find");
}

export async function supportsTenantOrgScope(dataClient: DataClientLike): Promise<boolean> {
  const cached = tenancySupportCache.get(dataClient as object);
  if (typeof cached === "boolean") return cached;

  const { error } = await dataClient.from("users").select("org_id").limit(1);
  const supported = !isRecoverableSchemaGap(error as { message?: string; code?: string } | null | undefined);
  tenancySupportCache.set(dataClient as object, supported);
  return supported;
}

async function createOrganization(input: {
  dataClient: DataClientLike;
  name: string;
  orgType: "personal" | "team" | "sponsor" | "recovery";
  ownerUserId?: string | null;
}): Promise<string> {
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
  return String((data as { id?: unknown }).id ?? "");
}

export async function getUserOrgId(dataClient: DataClientLike, userId: string): Promise<string | null> {
  if (!(await supportsTenantOrgScope(dataClient))) return null;
  const { data, error } = await dataClient.from("users").select("org_id").eq("id", userId).maybeSingle();
  if (isRecoverableSchemaGap(error as { message?: string; code?: string } | null | undefined)) return null;
  if (error) {
    throw new Error(`Failed to load user org scope: ${error.message ?? "unknown error"}`);
  }
  return typeof (data as { org_id?: unknown } | null)?.org_id === "string"
    ? String((data as { org_id?: unknown }).org_id)
    : null;
}

export async function getTeamOrgId(dataClient: DataClientLike, teamId: string): Promise<string | null> {
  if (!(await supportsTenantOrgScope(dataClient))) return null;
  const { data, error } = await dataClient.from("teams").select("org_id").eq("id", teamId).maybeSingle();
  if (isRecoverableSchemaGap(error as { message?: string; code?: string } | null | undefined)) return null;
  if (error) {
    throw new Error(`Failed to load team org scope: ${error.message ?? "unknown error"}`);
  }
  return typeof (data as { org_id?: unknown } | null)?.org_id === "string"
    ? String((data as { org_id?: unknown }).org_id)
    : null;
}

export async function listTeamOrgIdsForUser(dataClient: DataClientLike, userId: string): Promise<string[]> {
  if (!(await supportsTenantOrgScope(dataClient))) return [];
  const { data: memberships, error: membershipError } = await dataClient
    .from("team_memberships")
    .select("team_id")
    .eq("user_id", userId);
  if (membershipError) {
    throw new Error(`Failed to load user team scope: ${membershipError.message ?? "unknown error"}`);
  }
  const teamIds = Array.from(
    new Set(
      (memberships ?? [])
        .map((row) => String((row as { team_id?: unknown }).team_id ?? ""))
        .filter(Boolean)
    )
  );
  if (teamIds.length === 0) return [];

  const { data: teams, error: teamsError } = await dataClient.from("teams").select("id,org_id").in("id", teamIds);
  if (teamsError) {
    throw new Error(`Failed to load team org mappings: ${teamsError.message ?? "unknown error"}`);
  }
  return Array.from(
    new Set(
      (teams ?? [])
        .map((row) => String((row as { org_id?: unknown }).org_id ?? ""))
        .filter(Boolean)
    )
  );
}

export async function ensureUserHomeOrgId(dataClient: DataClientLike, userId: string): Promise<string | null> {
  if (!(await supportsTenantOrgScope(dataClient))) return null;

  const { data: userRow, error: userError } = await dataClient
    .from("users")
    .select("id,org_id,full_name")
    .eq("id", userId)
    .maybeSingle();
  if (userError) {
    throw new Error(`Failed to load user row for tenancy binding: ${userError.message ?? "unknown error"}`);
  }
  if (typeof (userRow as { org_id?: unknown } | null)?.org_id === "string") {
    return String((userRow as { org_id?: unknown }).org_id);
  }

  const createdTeam = await dataClient
    .from("teams")
    .select("org_id")
    .eq("created_by", userId)
    .not("org_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!createdTeam.error && typeof (createdTeam.data as { org_id?: unknown } | null)?.org_id === "string") {
    const orgId = String((createdTeam.data as { org_id?: unknown }).org_id);
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

  const displayName = typeof (userRow as { full_name?: unknown } | null)?.full_name === "string"
    ? String((userRow as { full_name?: unknown }).full_name).trim()
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

export async function resolveResourceOrgId(input: {
  dataClient: DataClientLike;
  ownerUserId?: string | null;
  teamId?: string | null;
  sponsorId?: string | null;
  journeyId?: string | null;
  channelId?: string | null;
}): Promise<string | null> {
  if (!(await supportsTenantOrgScope(input.dataClient))) return null;
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
    return typeof (data as { org_id?: unknown } | null)?.org_id === "string"
      ? String((data as { org_id?: unknown }).org_id)
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
    return typeof (data as { org_id?: unknown } | null)?.org_id === "string"
      ? String((data as { org_id?: unknown }).org_id)
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
    return typeof (data as { org_id?: unknown } | null)?.org_id === "string"
      ? String((data as { org_id?: unknown }).org_id)
      : null;
  }
  return null;
}

