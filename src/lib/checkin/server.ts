import { prisma } from "@/lib/prisma";
import {
  applyOfflineCheckInEvent,
  sortEventsForSync,
  type OfflineCheckInEvent,
  type SyncConflict,
} from "@/lib/checkin/sync";

export async function getOpenCheckInsForSession(sessionId: string) {
  return prisma.checkIn.findMany({
    where: {
      checkedOutAt: null,
      student: { sessionId },
    },
    select: {
      id: true,
      studentId: true,
      activityId: true,
      checkedInAt: true,
    },
  });
}

export async function processCheckInSyncBatch(
  sessionId: string,
  staffId: string,
  events: OfflineCheckInEvent[],
) {
  const sorted = sortEventsForSync(events);
  const applied: string[] = [];
  const conflicts: SyncConflict[] = [];
  const idempotent: string[] = [];

  const existingIds = await prisma.checkIn.findMany({
    where: {
      clientEventId: { in: sorted.map((event) => event.clientEventId) },
    },
    select: { clientEventId: true },
  });
  const knownClientIds = new Set(
    existingIds
      .map((row) => row.clientEventId)
      .filter((id): id is string => !!id),
  );

  let openCheckIns = await getOpenCheckInsForSession(sessionId);

  for (const event of sorted) {
    if (event.staffId !== staffId) {
      conflicts.push({
        clientEventId: event.clientEventId,
        code: "duplicate_event",
        message: "Event staff does not match current user",
      });
      continue;
    }

    const simulation = applyOfflineCheckInEvent(
      openCheckIns,
      event,
      knownClientIds,
    );

    if (simulation.status === "idempotent") {
      idempotent.push(event.clientEventId);
      continue;
    }

    if (simulation.status === "conflict") {
      conflicts.push(simulation.conflict);
      continue;
    }

    if (event.type === "check_in") {
      const created = await prisma.checkIn.create({
        data: {
          studentId: event.studentId,
          activityId: event.activityId,
          staffId: event.staffId,
          clientEventId: event.clientEventId,
          method: event.method,
          checkedInAt: new Date(event.clientTimestamp),
          syncedOffline: true,
        },
      });
      openCheckIns = [
        ...openCheckIns,
        {
          id: created.id,
          studentId: created.studentId,
          activityId: created.activityId,
          checkedInAt: created.checkedInAt,
        },
      ];
    } else {
      const open = openCheckIns.find(
        (checkIn) =>
          checkIn.studentId === event.studentId &&
          (checkIn.activityId ?? null) === (event.activityId ?? null),
      );
      if (open) {
        await prisma.checkIn.update({
          where: { id: open.id },
          data: {
            checkedOutAt: new Date(event.clientTimestamp),
            syncedOffline: true,
          },
        });
      }
      openCheckIns = simulation.openCheckIns;
    }

    knownClientIds.add(event.clientEventId);
    applied.push(event.clientEventId);
  }

  return { applied, conflicts, idempotent };
}

export async function performOnlineCheckIn({
  sessionId,
  staffId,
  studentId,
  activityId,
  method,
  type,
  clientEventId,
}: {
  sessionId: string;
  staffId: string;
  studentId: string;
  activityId: string | null;
  method: "tap" | "qr";
  type: "check_in" | "check_out";
  clientEventId: string;
}) {
  const event: OfflineCheckInEvent = {
    clientEventId,
    type,
    studentId,
    activityId,
    staffId,
    method,
    clientTimestamp: new Date().toISOString(),
  };

  const result = await processCheckInSyncBatch(sessionId, staffId, [event]);

  if (result.conflicts.length > 0) {
    return { ok: false as const, conflict: result.conflicts[0] };
  }

  const checkIn = await prisma.checkIn.findFirst({
    where: { clientEventId },
    include: {
      student: { select: { firstName: true, lastName: true } },
      activity: { select: { name: true } },
    },
  });

  return { ok: true as const, checkIn, clientEventId: result.applied[0] };
}
