export type CheckInEventType = "check_in" | "check_out";

export type OfflineCheckInEvent = {
  clientEventId: string;
  type: CheckInEventType;
  studentId: string;
  activityId: string | null;
  staffId: string;
  method: "tap" | "qr";
  clientTimestamp: string;
};

export type OpenCheckIn = {
  id: string;
  studentId: string;
  activityId: string | null;
  checkedInAt: Date;
};

export type SyncConflictCode =
  | "duplicate_event"
  | "already_checked_in"
  | "not_checked_in";

export type SyncConflict = {
  clientEventId: string;
  code: SyncConflictCode;
  message: string;
};

export function activityScopeKey(activityId: string | null) {
  return activityId ?? "__general__";
}

export function findOpenCheckInForScope(
  openCheckIns: OpenCheckIn[],
  studentId: string,
  activityId: string | null,
) {
  const scope = activityScopeKey(activityId);
  return openCheckIns.find(
    (checkIn) =>
      checkIn.studentId === studentId &&
      activityScopeKey(checkIn.activityId) === scope,
  );
}

export type ApplyEventResult =
  | { status: "applied"; openCheckIns: OpenCheckIn[] }
  | { status: "idempotent"; openCheckIns: OpenCheckIn[] }
  | { status: "conflict"; conflict: SyncConflict; openCheckIns: OpenCheckIn[] };

/**
 * Pure handler for applying one offline event against current open check-ins.
 * Used by server sync and unit tests.
 */
export function applyOfflineCheckInEvent(
  openCheckIns: OpenCheckIn[],
  event: OfflineCheckInEvent,
  existingClientEventIds: Set<string>,
  serverCheckInId?: string,
): ApplyEventResult {
  if (existingClientEventIds.has(event.clientEventId)) {
    return { status: "idempotent", openCheckIns };
  }

  const open = findOpenCheckInForScope(
    openCheckIns,
    event.studentId,
    event.activityId,
  );

  if (event.type === "check_in") {
    if (open) {
      return {
        status: "conflict",
        conflict: {
          clientEventId: event.clientEventId,
          code: "already_checked_in",
          message: "Student is already checked in for this location",
        },
        openCheckIns,
      };
    }

    const id = serverCheckInId ?? `local-${event.clientEventId}`;
    return {
      status: "applied",
      openCheckIns: [
        ...openCheckIns,
        {
          id,
          studentId: event.studentId,
          activityId: event.activityId,
          checkedInAt: new Date(event.clientTimestamp),
        },
      ],
    };
  }

  if (!open) {
    return {
      status: "conflict",
      conflict: {
        clientEventId: event.clientEventId,
        code: "not_checked_in",
        message: "Student is not checked in for this location",
      },
      openCheckIns,
    };
  }

  return {
    status: "applied",
    openCheckIns: openCheckIns.filter((checkIn) => checkIn.id !== open.id),
  };
}

export function sortEventsForSync(events: OfflineCheckInEvent[]) {
  return [...events].sort(
    (a, b) =>
      new Date(a.clientTimestamp).getTime() -
      new Date(b.clientTimestamp).getTime(),
  );
}
