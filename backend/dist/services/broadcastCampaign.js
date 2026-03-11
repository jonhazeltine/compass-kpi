"use strict";
/**
 * broadcastCampaign.ts — Broadcast Campaign Service
 *
 * Orchestrates multi-content-type broadcast campaigns that resolve audience
 * from channels, teams, and cohorts, deduplicate by user_id, and deliver
 * individualized DM messages to each recipient.
 *
 * Content types: message | video | live | task
 * Target scopes: channel | team | cohort (cohorts are teams)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBroadcastCampaignPayload = validateBroadcastCampaignPayload;
exports.resolveAudienceUserIds = resolveAudienceUserIds;
exports.getAudiencePreview = getAudiencePreview;
exports.findOrCreateDmChannel = findOrCreateDmChannel;
exports.executeBroadcastCampaign = executeBroadcastCampaign;
exports.publishReplayToCampaignRecipients = publishReplayToCampaignRecipients;
exports.checkCampaignRateLimit = checkCampaignRateLimit;
const crypto = __importStar(require("crypto"));
const channelMessageTasks_1 = require("./channelMessageTasks");
const muxLiveService_1 = require("./muxLiveService");
const tenantScope_1 = require("./tenantScope");
/* ================================================================
   VALIDATION
   ================================================================ */
const CONTENT_TYPES = ["message", "video", "live", "task"];
const SCOPE_TYPES = ["channel", "team", "cohort"];
function validateBroadcastCampaignPayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const b = body;
    const contentType = String(b.content_type ?? "");
    if (!CONTENT_TYPES.includes(contentType)) {
        return { ok: false, status: 422, error: `content_type must be one of: ${CONTENT_TYPES.join(", ")}` };
    }
    if (!Array.isArray(b.targets) || b.targets.length === 0) {
        return { ok: false, status: 422, error: "targets must be a non-empty array" };
    }
    if (b.targets.length > 20) {
        return { ok: false, status: 422, error: "targets cannot exceed 20 entries" };
    }
    const targets = [];
    for (const t of b.targets) {
        if (!t || typeof t !== "object") {
            return { ok: false, status: 422, error: "Each target must be an object with scope_type and scope_id" };
        }
        const tt = t;
        const scopeType = String(tt.scope_type ?? "");
        const scopeId = String(tt.scope_id ?? "").trim();
        if (!SCOPE_TYPES.includes(scopeType) || !scopeId) {
            return { ok: false, status: 422, error: `Each target must have scope_type (${SCOPE_TYPES.join("/")}) and a non-empty scope_id` };
        }
        targets.push({
            scope_type: scopeType,
            scope_id: scopeId,
            label: typeof tt.label === "string" ? tt.label.trim() : undefined,
        });
    }
    const bodyText = typeof b.body === "string" ? b.body.trim() : undefined;
    if (bodyText && bodyText.length > 4000) {
        return { ok: false, status: 422, error: "body is too long (max 4000 chars)" };
    }
    const idempotencyKey = typeof b.idempotency_key === "string" ? b.idempotency_key.trim() : "";
    if (!idempotencyKey) {
        return { ok: false, status: 422, error: "idempotency_key is required" };
    }
    // Content-type-specific validation
    if (contentType === "message") {
        if (!bodyText) {
            return { ok: false, status: 422, error: "body is required for message broadcasts" };
        }
    }
    if (contentType === "video") {
        const mediaId = typeof b.media_id === "string" ? b.media_id.trim() : "";
        if (!mediaId) {
            return { ok: false, status: 422, error: "media_id is required for video broadcasts" };
        }
        return {
            ok: true,
            payload: {
                content_type: "video",
                targets,
                body: bodyText,
                media_id: mediaId,
                idempotency_key: idempotencyKey,
            },
        };
    }
    if (contentType === "live") {
        const liveTitle = typeof b.live_title === "string" ? b.live_title.trim() : "";
        if (!liveTitle) {
            return { ok: false, status: 422, error: "live_title is required for live broadcasts" };
        }
        return {
            ok: true,
            payload: {
                content_type: "live",
                targets,
                body: bodyText,
                live_title: liveTitle,
                idempotency_key: idempotencyKey,
            },
        };
    }
    if (contentType === "task") {
        if (!b.task_draft || typeof b.task_draft !== "object") {
            return { ok: false, status: 422, error: "task_draft is required for task broadcasts" };
        }
        const td = b.task_draft;
        const taskType = td.task_type === "personal_task" || td.task_type === "coach_task" ? td.task_type : null;
        if (!taskType) {
            return { ok: false, status: 422, error: "task_draft.task_type must be personal_task or coach_task" };
        }
        const title = typeof td.title === "string" ? td.title.trim() : "";
        if (!title) {
            return { ok: false, status: 422, error: "task_draft.title is required" };
        }
        const description = typeof td.description === "string" ? td.description.trim() : null;
        const dueAt = typeof td.due_at === "string" && td.due_at.trim() ? td.due_at.trim() : null;
        return {
            ok: true,
            payload: {
                content_type: "task",
                targets,
                body: bodyText,
                task_draft: { task_type: taskType, title, description, due_at: dueAt },
                idempotency_key: idempotencyKey,
            },
        };
    }
    // message content_type
    return {
        ok: true,
        payload: {
            content_type: "message",
            targets,
            body: bodyText,
            idempotency_key: idempotencyKey,
        },
    };
}
/* ================================================================
   AUDIENCE RESOLUTION
   ================================================================ */
async function resolveUserIdsForTarget(target, dc) {
    if (target.scope_type === "channel") {
        const { data: rows } = await dc
            .from("channel_memberships")
            .select("user_id")
            .eq("channel_id", target.scope_id);
        const userIds = (rows ?? []).map((r) => String(r.user_id ?? "")).filter(Boolean);
        // Try to get channel name
        const { data: ch } = await dc
            .from("channels")
            .select("name")
            .eq("id", target.scope_id)
            .maybeSingle();
        const label = target.label || (ch ? String(ch.name ?? "") : target.scope_id);
        return { userIds, label };
    }
    // team and cohort both resolve from team_memberships (cohorts ARE teams)
    const { data: rows } = await dc
        .from("team_memberships")
        .select("user_id")
        .eq("team_id", target.scope_id);
    const userIds = (rows ?? []).map((r) => String(r.user_id ?? "")).filter(Boolean);
    const { data: tm } = await dc
        .from("teams")
        .select("name")
        .eq("id", target.scope_id)
        .maybeSingle();
    const label = target.label || (tm ? String(tm.name ?? "") : target.scope_id);
    return { userIds, label };
}
async function resolveAudienceUserIds(targets, senderUserId, dc) {
    const results = await Promise.all(targets.map((t) => resolveUserIdsForTarget(t, dc)));
    const perTarget = results.map((r, i) => ({
        scope_type: targets[i].scope_type,
        scope_id: targets[i].scope_id,
        label: r.label,
        count: r.userIds.length,
    }));
    const allUserIds = new Set();
    for (const r of results) {
        for (const uid of r.userIds)
            allUserIds.add(uid);
    }
    allUserIds.delete(senderUserId);
    return { recipientUserIds: Array.from(allUserIds), perTarget };
}
async function getAudiencePreview(targets, senderUserId, dc) {
    const { recipientUserIds, perTarget } = await resolveAudienceUserIds(targets, senderUserId, dc);
    const totalRaw = perTarget.reduce((sum, t) => sum + t.count, 0);
    // totalRaw includes sender in each target, recipientUserIds excludes sender + dedupes
    const overlapRemoved = totalRaw - recipientUserIds.length - (totalRaw > recipientUserIds.length ? 0 : 0);
    return {
        total_unique_recipients: recipientUserIds.length,
        per_target: perTarget,
        overlap_removed: Math.max(0, totalRaw - recipientUserIds.length),
    };
}
/* ================================================================
   DM CHANNEL RESOLUTION
   ================================================================ */
async function findOrCreateDmChannel(senderUserId, recipientUserId, dc) {
    // Find existing direct channel between sender and recipient
    const { data: senderMemberships } = await dc
        .from("channel_memberships")
        .select("channel_id")
        .eq("user_id", senderUserId);
    const senderChannelIds = (senderMemberships ?? [])
        .map((r) => String(r.channel_id ?? ""))
        .filter(Boolean);
    if (senderChannelIds.length > 0) {
        const { data: directChannels } = await dc
            .from("channels")
            .select("id")
            .in("id", senderChannelIds)
            .eq("type", "direct")
            .eq("is_active", true);
        const directIds = (directChannels ?? []).map((r) => String(r.id ?? "")).filter(Boolean);
        if (directIds.length > 0) {
            const { data: recipientMemberships } = await dc
                .from("channel_memberships")
                .select("channel_id")
                .eq("user_id", recipientUserId)
                .in("channel_id", directIds);
            for (const rm of recipientMemberships ?? []) {
                const chId = String(rm.channel_id ?? "");
                if (chId) {
                    // Verify it's a 2-member direct channel (not a group)
                    const { data: memberCount } = await dc
                        .from("channel_memberships")
                        .select("user_id")
                        .eq("channel_id", chId);
                    const members = (memberCount ?? []).map((m) => String(m.user_id ?? ""));
                    if (members.length === 2 && members.includes(senderUserId) && members.includes(recipientUserId)) {
                        return { ok: true, channelId: chId };
                    }
                }
            }
        }
    }
    // Create new direct channel
    const { data: channel, error: channelError } = await dc
        .from("channels")
        .insert({
        type: "direct",
        name: "Direct Message",
        team_id: null,
        org_id: (await (0, tenantScope_1.ensureUserHomeOrgId)(dc, senderUserId)) ?? undefined,
        context_id: recipientUserId,
        created_by: senderUserId,
    })
        .select("id")
        .single();
    if (channelError || !channel) {
        return { ok: false, error: `Failed to create DM channel: ${channelError?.message ?? "unknown"}` };
    }
    const channelId = String(channel.id ?? "");
    const nowIso = new Date().toISOString();
    const { error: membershipError } = await dc
        .from("channel_memberships")
        .upsert([
        { channel_id: channelId, user_id: senderUserId, role: "admin" },
        { channel_id: channelId, user_id: recipientUserId, role: "member" },
    ], { onConflict: "channel_id,user_id" });
    if (membershipError) {
        return { ok: false, error: `Failed to create DM memberships: ${membershipError.message}` };
    }
    const { error: unreadError } = await dc
        .from("message_unreads")
        .upsert([
        { channel_id: channelId, user_id: senderUserId, unread_count: 0, last_seen_at: nowIso, updated_at: nowIso },
        { channel_id: channelId, user_id: recipientUserId, unread_count: 0, last_seen_at: nowIso, updated_at: nowIso },
    ], { onConflict: "channel_id,user_id" });
    if (unreadError) {
        return { ok: false, error: `Failed to init DM unreads: ${unreadError.message}` };
    }
    return { ok: true, channelId };
}
/* ================================================================
   DM DELIVERY (per-recipient, content-type-specific)
   ================================================================ */
async function fanOutUnreadForDm(channelId, senderUserId, dc) {
    const { data: members } = await dc
        .from("channel_memberships")
        .select("user_id")
        .eq("channel_id", channelId);
    const nowIso = new Date().toISOString();
    for (const m of members ?? []) {
        const uid = String(m.user_id ?? "");
        if (!uid)
            continue;
        if (uid === senderUserId) {
            await dc.from("message_unreads").upsert({ channel_id: channelId, user_id: uid, unread_count: 0, last_seen_at: nowIso, updated_at: nowIso }, { onConflict: "channel_id,user_id" });
        }
        else {
            // Fetch current, increment
            const { data: existing } = await dc
                .from("message_unreads")
                .select("unread_count")
                .eq("channel_id", channelId)
                .eq("user_id", uid)
                .maybeSingle();
            const current = typeof existing?.unread_count === "number"
                ? existing.unread_count
                : 0;
            await dc.from("message_unreads").upsert({ channel_id: channelId, user_id: uid, unread_count: current + 1, updated_at: nowIso }, { onConflict: "channel_id,user_id" });
        }
    }
}
async function deliverMessage(dmChannelId, senderUserId, body, dc) {
    const { data, error } = await dc
        .from("channel_messages")
        .insert({
        channel_id: dmChannelId,
        sender_user_id: senderUserId,
        body,
        message_type: "message",
        message_kind: "text",
    })
        .select("id")
        .single();
    if (error)
        return { messageId: null, error: error.message };
    await fanOutUnreadForDm(dmChannelId, senderUserId, dc);
    return { messageId: String(data.id ?? "") };
}
async function deliverVideo(dmChannelId, senderUserId, mediaId, caption, dc) {
    // Resolve media asset
    const { data: asset } = await dc
        .from("coaching_media_assets")
        .select("id,mux_playback_id,file_url,content_type,processing_status")
        .eq("id", mediaId)
        .maybeSingle();
    const playbackId = asset ? String(asset.mux_playback_id ?? "") : "";
    const fileUrl = asset ? String(asset.file_url ?? "") : "";
    const contentType = asset ? String(asset.content_type ?? "video/mp4") : "video/mp4";
    const status = asset ? String(asset.processing_status ?? "ready") : "ready";
    const serializedBody = (0, channelMessageTasks_1.serializeChannelMessageBody)({
        body: caption || "Shared video",
        message_type: "media_attachment",
        media_attachment: { media_id: mediaId, caption },
        lifecycle: { processing_status: status, playback_ready: status === "ready" },
        file_url: fileUrl || undefined,
        playback_id: playbackId || undefined,
        content_type: contentType || undefined,
    });
    const { data, error } = await dc
        .from("channel_messages")
        .insert({
        channel_id: dmChannelId,
        sender_user_id: senderUserId,
        body: serializedBody,
        message_type: "media_attachment",
        message_kind: "text",
    })
        .select("id")
        .single();
    if (error)
        return { messageId: null, error: error.message };
    await fanOutUnreadForDm(dmChannelId, senderUserId, dc);
    return { messageId: String(data.id ?? "") };
}
async function deliverLiveCard(dmChannelId, senderUserId, session, dc) {
    const body = JSON.stringify({
        text: `Live: ${session.title}`,
        live_session: {
            session_id: session.session_id,
            title: session.title,
            status: session.status,
            join_url: session.join_url,
            playback_url: session.playback_url,
        },
    });
    const { data, error } = await dc
        .from("channel_messages")
        .insert({
        channel_id: dmChannelId,
        sender_user_id: senderUserId,
        body,
        message_type: "message",
        message_kind: "text",
    })
        .select("id")
        .single();
    if (error)
        return { messageId: null, error: error.message };
    await fanOutUnreadForDm(dmChannelId, senderUserId, dc);
    return { messageId: String(data.id ?? "") };
}
async function deliverTask(dmChannelId, senderUserId, senderRole, recipientUserId, draft, note, dc) {
    const taskId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    // Resolve recipient name for assignment ref
    const { data: recipientRow } = await dc
        .from("users")
        .select("full_name")
        .eq("id", recipientUserId)
        .maybeSingle();
    const recipientName = recipientRow
        ? String(recipientRow.full_name ?? "Member")
        : "Member";
    const assignmentRef = (0, channelMessageTasks_1.buildTaskAssignmentRef)({
        taskId,
        taskType: draft.task_type,
        title: draft.title,
        description: draft.description ?? null,
        status: "pending",
        dueAt: draft.due_at ?? null,
        assigneeId: recipientUserId,
        assigneeName: recipientName,
        createdById: senderUserId,
        createdByRole: senderRole,
        channelId: dmChannelId,
        createdAt: nowIso,
    });
    const body = (0, channelMessageTasks_1.buildTaskMessageBody)({
        taskAction: "create",
        title: draft.title,
        description: draft.description,
        note: note ?? null,
    });
    const { data, error } = await dc
        .from("channel_messages")
        .insert({
        channel_id: dmChannelId,
        sender_user_id: senderUserId,
        body,
        message_type: "message",
        message_kind: draft.task_type,
        assignment_ref: assignmentRef,
    })
        .select("id")
        .single();
    if (error)
        return { messageId: null, error: error.message };
    await fanOutUnreadForDm(dmChannelId, senderUserId, dc);
    return { messageId: String(data.id ?? "") };
}
/* ================================================================
   CAMPAIGN ORCHESTRATOR
   ================================================================ */
async function executeBroadcastCampaign(input) {
    const { payload, senderUserId, senderRole, dc } = input;
    // 1. Resolve audience
    const { recipientUserIds, perTarget } = await resolveAudienceUserIds(payload.targets, senderUserId, dc);
    if (recipientUserIds.length === 0) {
        return { ok: false, status: 422, error: "No recipients resolved from selected targets" };
    }
    // 2. For live broadcasts: create one Mux live session
    let liveSession = null;
    const senderOrgId = await (0, tenantScope_1.ensureUserHomeOrgId)(dc, senderUserId);
    if (payload.content_type === "live") {
        const liveResult = await (0, muxLiveService_1.createSession)({
            userId: senderUserId,
            payload: {
                channel_id: payload.targets[0]?.scope_id ?? "broadcast",
                title: payload.live_title,
                idempotency_key: `bc_live_${payload.idempotency_key}`,
            },
        });
        if (!liveResult.ok) {
            return { ok: false, status: 500, error: "Failed to create live session" };
        }
        const rec = liveResult.session;
        const playbackUrl = rec.mux_playback_id
            ? `https://stream.mux.com/${rec.mux_playback_id}.m3u8`
            : rec.join_url ?? "";
        liveSession = {
            session_id: rec.session_id,
            title: rec.title,
            status: rec.status,
            join_url: rec.join_url ?? "",
            playback_url: playbackUrl,
        };
    }
    // 3. Create campaign audit row
    const campaignId = crypto.randomUUID();
    await dc.from("broadcast_campaigns").insert({
        id: campaignId,
        actor_user_id: senderUserId,
        org_id: senderOrgId ?? undefined,
        content_type: payload.content_type,
        targets: payload.targets,
        payload: { ...payload, task_draft: payload.task_draft ?? null },
        total_recipients: recipientUserIds.length,
        delivered: 0,
        failed: 0,
        live_session_id: liveSession?.session_id ?? null,
        replay_published: false,
        idempotency_key: payload.idempotency_key,
    });
    // 4. Deliver to each recipient
    const outcomes = [];
    let delivered = 0;
    let failed = 0;
    for (const recipientId of recipientUserIds) {
        const dmResult = await findOrCreateDmChannel(senderUserId, recipientId, dc);
        if (!dmResult.ok) {
            outcomes.push({ recipient_user_id: recipientId, dm_channel_id: null, message_id: null, status: "dm_create_failed", error: dmResult.error });
            failed++;
            continue;
        }
        const dmChannelId = dmResult.channelId;
        let deliveryResult;
        switch (payload.content_type) {
            case "message":
                deliveryResult = await deliverMessage(dmChannelId, senderUserId, payload.body, dc);
                break;
            case "video":
                deliveryResult = await deliverVideo(dmChannelId, senderUserId, payload.media_id, payload.body, dc);
                break;
            case "live":
                deliveryResult = await deliverLiveCard(dmChannelId, senderUserId, liveSession, dc);
                break;
            case "task":
                deliveryResult = await deliverTask(dmChannelId, senderUserId, senderRole, recipientId, payload.task_draft, payload.body, dc);
                break;
            default:
                deliveryResult = { messageId: null, error: `Unknown content_type: ${payload.content_type}` };
        }
        if (deliveryResult.error) {
            outcomes.push({ recipient_user_id: recipientId, dm_channel_id: dmChannelId, message_id: null, status: "message_insert_failed", error: deliveryResult.error });
            failed++;
        }
        else {
            outcomes.push({ recipient_user_id: recipientId, dm_channel_id: dmChannelId, message_id: deliveryResult.messageId, status: "delivered" });
            delivered++;
        }
    }
    // 5. Batch-insert delivery outcomes
    if (outcomes.length > 0) {
        await dc.from("broadcast_deliveries").insert(outcomes.map((o) => ({
            campaign_id: campaignId,
            org_id: senderOrgId ?? undefined,
            recipient_user_id: o.recipient_user_id,
            dm_channel_id: o.dm_channel_id,
            message_id: o.message_id,
            status: o.status,
            error_detail: o.error ?? null,
        })));
    }
    // 6. Update campaign totals
    await dc
        .from("broadcast_campaigns")
        .update({ delivered, failed })
        .eq("id", campaignId);
    return {
        ok: true,
        result: {
            campaign_id: campaignId,
            content_type: payload.content_type,
            total_recipients: recipientUserIds.length,
            delivered,
            failed,
            live_session_id: liveSession?.session_id ?? null,
        },
    };
}
/* ================================================================
   REPLAY FAN-OUT (for live broadcasts)
   ================================================================ */
async function publishReplayToCampaignRecipients(campaignId, senderUserId, dc) {
    // Load campaign
    const { data: campaign } = await dc
        .from("broadcast_campaigns")
        .select("*")
        .eq("id", campaignId)
        .maybeSingle();
    if (!campaign) {
        return { ok: false, status: 404, error: "Campaign not found" };
    }
    const c = campaign;
    if (String(c.actor_user_id ?? "") !== senderUserId) {
        return { ok: false, status: 403, error: "Only the campaign sender can publish replay" };
    }
    if (String(c.content_type ?? "") !== "live") {
        return { ok: false, status: 422, error: "Replay publishing is only available for live campaigns" };
    }
    if (c.replay_published === true) {
        return { ok: false, status: 409, error: "Replay has already been published for this campaign" };
    }
    const liveSessionId = String(c.live_session_id ?? "");
    if (!liveSessionId) {
        return { ok: false, status: 422, error: "No live session associated with this campaign" };
    }
    // Load deliveries
    const { data: deliveries } = await dc
        .from("broadcast_deliveries")
        .select("recipient_user_id,dm_channel_id")
        .eq("campaign_id", campaignId)
        .eq("status", "delivered");
    if (!deliveries || deliveries.length === 0) {
        return { ok: false, status: 422, error: "No successful deliveries to replay to" };
    }
    // Fan out replay message to each DM
    let sent = 0;
    for (const d of deliveries) {
        const dmChannelId = String(d.dm_channel_id ?? "");
        if (!dmChannelId)
            continue;
        const replayBody = JSON.stringify({
            text: "Live session replay is available",
            live_session: {
                session_id: liveSessionId,
                title: "Replay",
                status: "ended",
                join_url: "",
                playback_url: "",
            },
        });
        await dc.from("channel_messages").insert({
            channel_id: dmChannelId,
            sender_user_id: senderUserId,
            body: replayBody,
            message_type: "message",
            message_kind: "text",
        });
        await fanOutUnreadForDm(dmChannelId, senderUserId, dc);
        sent++;
    }
    await dc.from("broadcast_campaigns").update({ replay_published: true }).eq("id", campaignId);
    return { ok: true, replays_sent: sent };
}
/* ================================================================
   RATE LIMIT CHECK
   ================================================================ */
async function checkCampaignRateLimit(senderUserId, dc, maxPerDay = 25) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await dc
        .from("broadcast_campaigns")
        .select("id")
        .eq("actor_user_id", senderUserId)
        .gte("created_at", since);
    const count = (data ?? []).length;
    return { ok: count < maxPerDay, count };
}
