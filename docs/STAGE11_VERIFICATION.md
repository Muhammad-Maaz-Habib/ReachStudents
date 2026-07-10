# Stage 11 verification guide

What was implemented in code vs. what requires manual verification on real devices and networks.

## PWA installability

### Implemented (automated / code review)
- Web app manifest (`src/app/manifest.ts`) — `standalone`, theme colors, `/checkin` start URL
- App icon route (`src/app/icon.tsx`)
- Service worker (`public/sw.js`) — precaches `/checkin`, fallback navigation when offline
- SW registration (`RegisterServiceWorker` in providers)

### Manual verification required
- [ ] Chrome Android: “Install app” / Add to Home Screen appears
- [ ] iOS Safari: Share → Add to Home Screen; icon and splash look correct
- [ ] Installed app opens to `/checkin` and shows standalone chrome (no browser URL bar)
- [ ] Service worker updates after deploy (hard refresh / close-reopen installed app)

## Offline check-in flow

### Implemented (automated tests)
- `src/lib/checkin/sync.test.ts` — offline event application, idempotency, scope conflicts, sort order
- Dexie queue (`src/lib/offline/checkin-queue.ts`) — pending/conflict/synced states
- `useCheckInActions` — queues when `navigator.onLine` is false, syncs on `online` event

### Manual verification required
- [ ] Enable airplane mode on phone/tablet → check in student → see offline banner + optimistic UI
- [ ] Re-enable network → pending sync toast + data appears on Who’s Here
- [ ] Duplicate check-in conflict surfaces warning after sync
- [ ] Activity-scoped vs general campus scopes behave independently offline
- [ ] SW navigation fallback: offline open of installed PWA still reaches check-in shell (API calls will fail until online — expected)

## Accessibility (WCAG 2.1 AA target)

### Implemented (code review)
- Check-in search: visible label (`sr-only`), `type="search"`, `role="search"`
- Student list: semantic `<ul>/<li>`, `aria-pressed`, descriptive `aria-label` per student
- Primary action: `aria-label` includes student name + in/out action
- Status announcements: `aria-live="polite"` region for check-in/out confirmations
- Offline banner: `role="status"`, sync button `aria-label`
- Reports audit table: `<caption class="sr-only">`, `scope="col"`, `<time dateTime>`
- Touch targets: `min-h-12` / `min-h-14` on primary check-in controls

### Manual verification required
- [ ] Keyboard-only: Tab through location select → search → student list → check-in button
- [ ] Screen reader (VoiceOver / NVDA): student name, status, and action announced correctly
- [ ] 200% zoom / large text: layout does not clip primary check-in button
- [ ] Color contrast audit with browser DevTools or axe — especially amber offline banner and team badges
- [ ] High contrast / forced-colors mode spot check

## Performance (check-in under slow network)

### Implemented (code)
- `useDeferredValue` on student search filter — typing stays responsive while list filters
- Missing-student alerts fetch deferred (`setTimeout(0)`) so initial paint is not blocked
- Alert polling reduced to background interval after first load

### Manual verification required
- [ ] Chrome DevTools → Network → Slow 3G: search and student tap remain responsive
- [ ] Check-in POST may take several seconds — optimistic UI should update immediately; confirm server catch-up on success
- [ ] Offline path on Slow 3G: queue should still feel instant (no waiting on network)
- [ ] Lighthouse performance score on `/checkin` (mobile) — run locally; target ≥ 80 as guidance, not a CI gate

## Stage 10 additions (this pass)

### Audit log
- **Approach:** fire-and-forget **and** narrow `view` scope (see `docs/AUDIT_LOG.md`)
- **Append-only:** confirmed — only `GET /api/audit-logs`; no PATCH/DELETE routes

### New CSV exports (`/reports`)
- Medications, forms, communications (+ existing attendance, incidents)

### Data retention (`/settings`)
- Policy: NONE / ARCHIVE / DELETE, days after session end
- Cron: `GET /api/cron/session-retention` (daily 03:00 UTC in `vercel.json`)
- **Manual:** set policy to ARCHIVE with 0 days on a test session past end date; confirm cron or call endpoint with `CRON_SECRET`
