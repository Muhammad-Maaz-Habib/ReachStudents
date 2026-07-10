import { describe, expect, it } from "vitest";
import {
  applyOfflineCheckInEvent,
  findOpenCheckInForScope,
  sortEventsForSync,
} from "./sync";
import type { OfflineCheckInEvent, OpenCheckIn } from "./sync";

const baseEvent = (
  overrides: Partial<OfflineCheckInEvent> = {},
): OfflineCheckInEvent => ({
  clientEventId: crypto.randomUUID(),
  type: "check_in",
  studentId: "student-1",
  activityId: null,
  staffId: "staff-1",
  method: "tap",
  clientTimestamp: new Date().toISOString(),
  ...overrides,
});

describe("applyOfflineCheckInEvent", () => {
  it("applies check-in when student is not checked in", () => {
    const event = baseEvent();
    const result = applyOfflineCheckInEvent([], event, new Set());

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.openCheckIns).toHaveLength(1);
      expect(result.openCheckIns[0].studentId).toBe("student-1");
    }
  });

  it("rejects duplicate check-in for same activity scope", () => {
    const open: OpenCheckIn[] = [
      {
        id: "ci-1",
        studentId: "student-1",
        activityId: null,
        checkedInAt: new Date(),
      },
    ];
    const event = baseEvent({ clientEventId: "evt-2" });
    const result = applyOfflineCheckInEvent(open, event, new Set());

    expect(result.status).toBe("conflict");
    if (result.status === "conflict") {
      expect(result.conflict.code).toBe("already_checked_in");
    }
  });

  it("is idempotent for duplicate clientEventId", () => {
    const event = baseEvent({ clientEventId: "evt-dup" });
    const result = applyOfflineCheckInEvent([], event, new Set(["evt-dup"]));
    expect(result.status).toBe("idempotent");
  });

  it("applies check-out and removes open check-in", () => {
    const open: OpenCheckIn[] = [
      {
        id: "ci-1",
        studentId: "student-1",
        activityId: null,
        checkedInAt: new Date(),
      },
    ];
    const event = baseEvent({
      clientEventId: "evt-out",
      type: "check_out",
    });
    const result = applyOfflineCheckInEvent(open, event, new Set());

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.openCheckIns).toHaveLength(0);
    }
  });

  it("conflicts on check-out when not checked in", () => {
    const event = baseEvent({ type: "check_out", clientEventId: "evt-out-2" });
    const result = applyOfflineCheckInEvent([], event, new Set());
    expect(result.status).toBe("conflict");
  });

  it("treats different activity scopes independently", () => {
    const open: OpenCheckIn[] = [
      {
        id: "ci-1",
        studentId: "student-1",
        activityId: "activity-a",
        checkedInAt: new Date(),
      },
    ];
    const event = baseEvent({
      activityId: "activity-b",
      clientEventId: "evt-b",
    });
    const result = applyOfflineCheckInEvent(open, event, new Set());
    expect(result.status).toBe("applied");
  });
});

describe("sortEventsForSync", () => {
  it("orders events by client timestamp ascending", () => {
    const events = [
      baseEvent({
        clientEventId: "b",
        clientTimestamp: "2026-06-15T10:00:00.000Z",
      }),
      baseEvent({
        clientEventId: "a",
        clientTimestamp: "2026-06-15T09:00:00.000Z",
      }),
    ];
    const sorted = sortEventsForSync(events);
    expect(sorted[0].clientEventId).toBe("a");
  });
});

describe("findOpenCheckInForScope", () => {
  it("matches general scope when activityId is null", () => {
    const open: OpenCheckIn[] = [
      {
        id: "ci-1",
        studentId: "student-1",
        activityId: null,
        checkedInAt: new Date(),
      },
    ];
    expect(findOpenCheckInForScope(open, "student-1", null)?.id).toBe("ci-1");
  });
});
