# Changelog

## Stage 11 — PWA, offline, accessibility, performance (2026-07-10)

### PWA
- Web manifest, dynamic app icon, service worker shell cache for `/checkin`
- See `docs/STAGE11_VERIFICATION.md` for manual device/network checklist

### Check-in UX
- WCAG-oriented labels: search, student list, actions, `aria-live` status
- Performance: deferred search filter, non-blocking missing-alert fetch

### Stage 10.1 additions (pre–Stage 11 polish)
- Audit `view` events: fire-and-forget + scoped to sensitive access only (`docs/AUDIT_LOG.md`)
- Audit log append-only (GET only)
- CSV exports: medications, forms, communications
- Session data retention policy on `/settings` + daily cron

---

## Stage 10 — Reports, audit log, settings (2026-07-10)

### Audit log (retrofitted — was not capturing before)
- `AuditLog` now stores `organizationId` + `resource` for compliance queries
- **Health records** — view on `/health`, `/api/health`, student profile; create medication/wellness; update medical profile
- **Confidential notes** — view/write via API and student profile (Session Admin + Nurse)
- **Incidents** — list, create, update; CSV export logged
- **Settings** — permission matrix edits
- Viewer at `/reports` with resource filter; `GET /api/audit-logs`

### Reports
- CSV export: open check-ins (attendance), incident reports — `GET /api/reports/export?type=...`

### Settings
- Visual **permission matrix editor** (role tabs, view/edit toggles) — `PATCH /api/settings/permissions`
- Super Admin remains full-access (not editable in matrix)

---

## Stage 9.1 — Protocol editor & trip GPS privacy (2026-07-10)

### Protocol editing
- Inline editor on `/emergency` for Session Admin / Super Admin (title + steps, reorder/add/remove)

### Trip location privacy
- **Parent disclosure** — Activity permission slip (`trip_location_ack` checkbox) documents one-time GPS pings and 24h deletion
- **Retention** — pings hard-deleted after 24h (not UI-only): purge on trip-checkin API read/write + daily cron (04:00 UTC) + `npm run cron:purge-trip-locations`
- Documented in `docs/TRIP_LOCATION_PRIVACY.md`

---

## Stage 9 — Emergency & safety (2026-07-10)

### Certification expiry (pre-Stage 9)
- **Proactive cert alerts** on `/staff` for Session Admin / Super Admin — expired + expiring within configurable window (default 14 days)
- `GET /api/staff/certifications/expiring?days=14`

### Emergency tools
- **`/emergency`** — one-tap protocol launcher (lost student, medical, weather, lockdown), trip location check-in (opt-in GPS ping)
- **Emergency roll-call mode** — `/checkin/whos-here?mode=rollcall` extends Who's Here with expected-vs-present headcount, missing-student flags, 15s auto-refresh
- **Admin-editable protocols** — per-organization steps stored in DB; sensible defaults seed on first load (not hardcoded-only)

### APIs
- `GET /api/emergency/protocols`, `PATCH /api/emergency/protocols/[type]`
- `GET /api/emergency/roll-call`
- `GET/POST /api/emergency/trip-checkin`

---

## Stage 5.1 — Messaging hardening (2026-07-09)

### Changed
- **Sensitive parent threads** (`INCIDENT` / `HEALTH` topics) send notification-only SMS/email (link to app, no message body)
- **Missing-student alert escalation** — `initial` at threshold, `reminder` at 30 min (urgent re-notify), `admin` at 60 min (Session Admin/Super Admin); 30-min dedupe per escalation level
- **Parent messaging access** — only team-assigned staff + Session Admin/Super Admin can start/reply (scoped via `canAccessStudentMessaging`)
- **Parents can initiate threads** from `/parent/messages` (“New message to staff”)

---

## Stage 6.1 — Health spec gaps (2026-07-09)

### Fixed / added
- **Medication log accountability** — `medicationName` per dose; `administeredBy` + `administeredAt` on every entry; visible administration log
- **Confidential notes** — `MedicalProfile.confidentialNotes`, Session Admin + Nurse only (separate from general medical profile)
- **Wellness UX** — emoji tap check-in (search student → tap mood), not a dropdown form
- **Incident severity** — documented as **manual-only** in v1; HIGH pre-checks "notify parent" as suggestion; **confirmation dialog** if filing HIGH without notify

---

## Stage 6.2 — HIGH severity confirm (2026-07-10)

### Added
- Filing a **HIGH** severity incident with "Notify parent" unchecked shows a one-tap confirmation before submit (does not block)

---

## Stage 8 — Staff tools (2026-07-10)

### Shift swap approval model
- **Peer confirm + auto-apply** when both staff accept and `validateSwapCoverage()` passes (certifications, no double-booking)
- **Session Admin queue** when coverage fails (e.g. lifeguard cert gap) — admin can approve override or reject

### Added
- **Duty roster** (`/staff` → Duty roster) — session shifts with required certifications
- **Staff directory** — contact info, team assignments, certification badges
- **Shift swaps** — request, accept, auto-swap or escalate to admin
- **Resource library** — internal links/docs by category

### APIs
- `GET /api/staff/directory`, `GET/POST /api/staff/shifts`
- `GET/POST /api/staff/swaps`, `POST /api/staff/swaps/[id]` (accept/approve/reject/cancel)
- `GET/POST /api/staff/resources`

---

## Stage 7 — Forms & consent (2026-07-09)

### Approach
**Template-based forms** (permission slip, medical consent, photo release, liability waiver) with structured fields per type — not a dynamic arbitrary field builder in v1.

### Added
- Staff `/forms` — create from template, completion tracking, reminder SMS/email
- Parent `/parent/forms` — e-signature pad, structured field fill, submission tracking
- APIs: `GET/POST /api/forms`, `POST /api/forms/[id]/submit`, `POST /api/forms/reminders`, `GET /api/parent/forms`

---

## Stage 6 — Health & wellness (2026-07-09)

### Added
- **Health dashboard** (`/health`) — medical flags list, medication log, wellness check-ins
- **Incident reports** (`/incidents`) — file with severity, students, optional parent thread
- **Incident ↔ parent thread links** — `sourceParentThreadId`, `sourceParentMessageId` on `IncidentReport`; threads use `topic` + `incidentId` / `medicalProfileId`

### APIs
- `GET/POST /api/health`, `PATCH /api/health/profiles/[id]`
- `GET/POST /api/incidents`, `PATCH /api/incidents/[id]`
- `GET /api/parent/students`

---

## Stage 5 — Communication hub (2026-07-09)

### Added
- **Announcements** (`/announcements`) — create broadcasts, mark read, read counts; optional email/SMS blast
- **Staff chat** (`/messages` → Staff chat) — auto-created all-staff + per-team channels; **Pusher** realtime when configured
- **Parent messaging** — moderated threads; staff replies delivered via **SMS + email** to guardian on file (full message body, not notification-only)
- **Missing-student alert dispatch** — `POST /api/alerts/missing/notify` sends SMS/email to on-duty staff + Pusher push; 30-min dedupe per activity; wired from dashboard + check-in poll

### Realtime & delivery
- **Pusher** for staff chat and in-app org events (not self-hosted WebSockets — fits Vercel serverless)
- **Twilio** SMS + **Resend** email (env-gated; logs to console when unset)

### APIs
- `GET/POST /api/announcements`, `POST /api/announcements/[id]/read`
- `GET /api/chat/channels`, `GET/POST /api/chat/channels/[id]/messages`
- `GET/POST /api/parent/threads`, `GET/POST /api/parent/threads/[id]/messages`
- `POST /api/pusher/auth`, `POST /api/alerts/missing/notify`

### Also in this release
- **Recurring series form** on `/schedule` — days, time, duration, date range, overdue threshold → `POST /api/activities/series`
- UI note: drag-reschedule edits **one instance only** (series-wide edit deferred)

---

## Stage 4 — Scheduling & activities (2026-07-09)

### Added
- **FullCalendar schedule builder** (`/schedule`) — drag-to-create, drag-to-reschedule
- **ActivitySeries** model — recurrence rule + **generated Activity instances** (not RRULE-at-read-time)
- **Activity-scoped check-in** — location selector on check-in flow (general vs specific activity)
- **Missing-student alerts** — per-activity `overdueAlertMinutes`, dashboard + check-in banners + `GET /api/alerts/missing`
- **Who's here full list** — `/checkin/whos-here` with filters; dashboard shows "Showing 8 of N · View all"

### APIs
- `GET/POST /api/activities`, `PATCH /api/activities/[id]`, `POST /api/activities/series`

---

## Stage 2.1 — CSV import hardening (2026-07-09)

### Changed
- Duplicate detection now uses `first_name` + `last_name` + `date_of_birth`
- Name-only matches without DOB import with a **warning** (not skipped)
- Added optional `external_id` column for re-import updates
- Phone normalization/validation on `guardian_phone` and `emergency_contact_phone`

---

## Stage 3 — Check-in/out + offline queue (2026-07-09)

### Added
- **Tap check-in/out flow** at `/checkin` with student search and large action button
- **Offline queue** via Dexie (IndexedDB) — events persist across reloads
- **Auto-sync** when connectivity returns; manual "Sync now" button
- **Conflict handling**: idempotent `clientEventId`, first-sync-wins for duplicate check-ins
- **Live "who's here"** panel on dashboard
- **API**: `GET/POST /api/checkins`, `POST /api/checkins/sync`
- **Tests**: `src/lib/checkin/sync.test.ts`, `src/lib/phone.test.ts`

### Offline architecture
- **Storage**: Dexie on IndexedDB (not service worker cache)
- **Conflicts**: duplicate `clientEventId` ignored; second check-in for same student+location flagged for staff review

---

## Stage 2 — Roster & Student Profiles (2026-07-09)

### Renamed
- **Basecamp → Waypoint** across package name, UI copy, docs, and env examples

### Added
- **Student roster**: searchable, filterable list (team, grade, allergies, staff assignment)
- **Manual student entry**: dialog form with medical flags, guardian, and emergency contact
- **CSV import**: upload flow with row-level error reporting (see `docs/ROSTER_CSV_FORMAT.md`)
- **Student profile page** (`/roster/[studentId]`): guardian, emergency contacts, medical profile, forms/activity placeholders
- **Guardian fields** on `Student` model for roster display without requiring parent accounts
- **API routes**: `GET/POST /api/students`, `POST /api/students/import`, `GET/PATCH /api/students/[id]`
- **Seed data**: 3 sample students with medical flags across demo teams

### Docs
- README updated with **local `prisma dev`** and **Neon production** database setup paths
- CSV format spec and template file in `docs/`

---

## Stage 1 — Foundation (2026-07-09)

### Added
- **Project scaffold**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui
- **Database schema**: Full Prisma data model covering organizations, camp sessions, teams, users, permission matrix, and foundation models for future stages
- **Authentication**: NextAuth.js (Auth.js) with email/password credentials, JWT sessions, role in session token
- **Onboarding flow**: `/onboarding` wizard creates organization, first camp session, super admin account, and default permissions
- **Role-based routing**: Middleware protects staff vs parent routes; automatic redirects based on role
- **App shell**: Mobile-first layout with bottom nav, desktop sidebar, warm brand theme (terracotta + forest green)
- **Design system**: `StatusBadge`, `PageHeader`, `EmptyState`, `PageLoadingState`, `Logo`
- **Route shells**: Placeholder pages for all spec routes (staff + parent portal)
- **Settings preview**: Organization info, sessions list, read-only permission matrix table
- **Seed script**: Demo org with admin, counselor, and parent accounts (`npm run db:seed`)

### Defaults
- **App name**: Waypoint
- **Brand colors**: Primary `#E07A3A` (terracotta), Secondary `#2D6A4F` (forest green)
- **API style**: REST via Next.js Route Handlers
- **Database**: PostgreSQL via Prisma (local `prisma dev` or Neon)
- **Deployment model**: Single organization per instance
