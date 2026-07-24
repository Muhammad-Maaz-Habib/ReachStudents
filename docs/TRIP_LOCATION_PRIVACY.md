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

1. **Scheduled job** — `GET /api/cron/purge-trip-locations` (daily at 04:00 UTC via Vercel Cron on Hobby). Requires `CRON_SECRET` env var; request must send `Authorization: Bearer <CRON_SECRET>`. This is a **safety net** for rows that never see another trip-checkin API call.
2. **On read/write** — Trip check-in API runs purge on every GET (before list) and POST (after create). Opening `/emergency` triggers GET, so normal staff usage keeps the DB near the 24h target.
3. **Manual** — `npm run cron:purge-trip-locations` (or `npx tsx scripts/purge-trip-locations.ts`).

### Retention vs. daily cron

| Scenario | DB retention | UI exposure |
|----------|--------------|-------------|
| Staff use `/emergency` or trip-checkin API at least occasionally | Hard-delete within ~24h of `createdAt` (purge on GET/POST) | Never shows pings older than 24h (query filter) |
| **No** trip-checkin traffic after a ping; only daily cron | Worst case **~25–48h** in DB (ping created just after 04:00 UTC may survive until the next day’s run) | Still hidden from UI after 24h |

The 24-hour privacy promise for **what staff can see** holds even when cron is the only cleanup. The **database** may briefly exceed 24h only if nobody hits the trip-checkin endpoints before the next 04:00 UTC run.

## Compliance notes

- Pings are tied to `studentId`, `sessionId`, and `recordedById` for accountability while retained.
- Optional `excursionId` links a ping to a catalogued Excursion (Emergency UI picker); free-text `tripLabel` remains for ad-hoc labels.
- No parent-facing map or live tracking UI in v1.
- Audit logging for health/incidents is separate; trip pings are ephemeral by design.
