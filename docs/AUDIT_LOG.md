# Audit log policy

## Append-only

`AuditLog` has **no update or delete API**. The only route is `GET /api/audit-logs` (read). Rows are inserted via `logAudit()` only.

## Performance: fire-and-forget + narrow view scope

**Current approach (both):**

1. **Non-blocking writes** — `logAudit()` returns immediately; the Prisma `create` runs in the background (`void …catch`). Request handlers do not `await` audit inserts.

2. **Narrow view logging** — `view` actions are logged only for **sensitive-field access**, not every page load:
   - Confidential notes (API GET + student profile)
   - Medical profile on student profile (when `medicalProfile` exists)
   - **Not** logged: health dashboard page load, `/api/health` list fetch, incident list fetch

**Still logged (create/update/export):** medication logs, wellness checks, profile updates, incident create/update, permission matrix saves, CSV exports, protocol edits.
