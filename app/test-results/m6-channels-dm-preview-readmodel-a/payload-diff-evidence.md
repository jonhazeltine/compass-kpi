# M6-CHANNELS-DM-PREVIEW-READMODEL-A — Payload Diff Evidence

## Date
2026-03-02

## Endpoint
`GET /api/channels`

## Changes Made
Backend `src/index.ts` — augmented GET /api/channels response with three new fields per channel row.

## Payload Before (per channel object)
```json
{
  "id": "uuid",
  "type": "direct",
  "name": "Direct Message",
  "team_id": null,
  "context_id": null,
  "is_active": true,
  "created_at": "2026-...",
  "my_role": "admin",
  "unread_count": 2,
  "last_seen_at": "2026-...",
  "packaging_read_model": { ... },
  "provider": "stream",
  "provider_channel_id": "...",
  "provider_sync_status": "synced",
  "provider_sync_updated_at": null,
  "provider_error_code": null,
  "provider_trace_id": null
}
```

## Payload After (per channel object — new fields highlighted)
```json
{
  "id": "uuid",
  "type": "direct",
  "name": "Direct Message",
  "team_id": null,
  "context_id": null,
  "is_active": true,
  "created_at": "2026-...",
  "my_role": "admin",
  "unread_count": 2,
  "last_seen_at": "2026-...",
  "dm_display_name": "Jane Smith",           // NEW — counterpart user full_name for direct channels; null for non-direct
  "last_message_preview": "Hey, can we ...", // NEW — truncated to 120 chars; fallback for empty channels
  "last_message_at": "2026-03-01T15:30:00Z", // NEW — ISO timestamp of last message; null if no messages
  "packaging_read_model": { ... },
  "provider": "stream",
  "provider_channel_id": "...",
  "provider_sync_status": "synced",
  "provider_sync_updated_at": null,
  "provider_error_code": null,
  "provider_trace_id": null
}
```

## New Fields Summary

| Field | Type | Source | Behavior |
|-------|------|--------|----------|
| `dm_display_name` | `string \| null` | `users.full_name` via `channel_memberships` counterpart lookup | Non-null only for `type === "direct"` channels. Resolves to the non-self participant's full name. |
| `last_message_preview` | `string` | `channel_messages.body` (most recent) | Truncated to 120 chars with `...` suffix. Deterministic fallback: `"No messages yet — say hello!"` for empty DMs, `"No messages yet"` for other channel types. |
| `last_message_at` | `string \| null` | `channel_messages.created_at` (most recent) | ISO 8601 timestamp or `null` if no messages exist. |

## DM Name Resolution Algorithm
1. Filter channels with `type === "direct"`
2. Fetch all `channel_memberships` rows for those channel IDs
3. For each DM channel, identify the counterpart user (member whose `user_id !== auth.user.id`)
4. Batch-fetch counterpart user names from `users.full_name`
5. Map channel → counterpart display name

## Last Message Resolution Algorithm
1. Fetch recent `channel_messages` for all user channel IDs, ordered by `created_at DESC`, limit `channelIds.length * 3`
2. Deduplicate: first message per channel ID wins (most recent)
3. Truncate body to 120 chars max
4. Fallback text for channels with zero messages

## Empty Channel Fallback
- Direct channels: `"No messages yet — say hello!"`
- All other types: `"No messages yet"`
- `last_message_at` is `null` in both cases

## Validation
- `npm run -s build` — **PASS** (clean, no errors)
- `npm run -s test:backend-mvp` — Pre-existing failure (`Cannot read properties of undefined (reading 'id')`) — confirmed same failure exists on baseline without this change. **No regression introduced.**

## Constraints Verified
- No new endpoint families
- No schema/table changes
- No permission boundary regressions (same auth, same role scope evaluation)
- Existing table reads only: `channels`, `channel_memberships`, `channel_messages`, `users`, `message_unreads`
