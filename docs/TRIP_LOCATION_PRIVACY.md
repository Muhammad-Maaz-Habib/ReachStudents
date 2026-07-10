# Off-site trip location check-ins — privacy & retention

## What it is

Staff can record a **one-time GPS ping** for a student on an off-site field trip (`/emergency` → Off-site trip location). This is **not** continuous tracking. It requires:

1. Staff to tap "Record location now"
2. Browser location permission on the staff device

## Parent / guardian disclosure

Location pings are disclosed to parents through the **Activity permission slip** form template (`PERMISSION_SLIP`), which every off-campus trip should use:

- Checkbox: *"I understand camp staff may record one-time GPS location check-ins during off-site trips for safety purposes (not continuous tracking). Location data is deleted within 24 hours."* (`trip_location_ack`)

Camps should send a permission slip tied to the specific trip (activity name + date) before departure. The general liability waiver does **not** cover trip GPS — use the permission slip.

Staff UI on `/emergency` links to this policy and states that a signed permission slip should be on file for the student.

## Data retention

| Layer | Behavior |
|-------|----------|
| **UI** | Only shows pings from the last 24 hours |
| **Database** | Pings older than 24 hours are **hard-deleted** (not soft-deleted) |

### Cleanup mechanisms

1. **Scheduled job** — `GET /api/cron/purge-trip-locations` (hourly via Vercel Cron when deployed). Requires `CRON_SECRET` env var; request must send `Authorization: Bearer <CRON_SECRET>`.
2. **On read/write** — Trip check-in API runs purge before listing or after creating a ping.
3. **Manual** — `npx tsx scripts/purge-trip-locations.ts` (or add to your own scheduler).

## Compliance notes

- Pings are tied to `studentId`, `sessionId`, and `recordedById` for accountability while retained.
- No parent-facing map or live tracking UI in v1.
- Audit logging for health/incidents is separate; trip pings are ephemeral by design.
