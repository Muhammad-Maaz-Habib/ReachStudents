import { prisma } from "@/lib/prisma";
import { csvFilename, csvResponse, toCsv } from "@/lib/reports/csv";

export async function exportMedicationsCsv(sessionId: string, sessionName: string) {
  const logs = await prisma.medicationLog.findMany({
    where: { medicalProfile: { student: { sessionId } } },
    include: {
      medicalProfile: {
        include: { student: { select: { firstName: true, lastName: true } } },
      },
      administeredBy: { select: { name: true, email: true } },
    },
    orderBy: { administeredAt: "desc" },
  });

  const csv = toCsv(
    [
      "student",
      "medication",
      "dosage",
      "notes",
      "administered_at",
      "administered_by",
    ],
    logs.map((log) => [
      `${log.medicalProfile.student.firstName} ${log.medicalProfile.student.lastName}`,
      log.medicationName,
      log.dosage ?? "",
      log.notes ?? "",
      log.administeredAt.toISOString(),
      log.administeredBy.name ?? log.administeredBy.email ?? "",
    ]),
  );

  return csvResponse(csv, csvFilename("medications", sessionName));
}

export async function exportFormsCsv(sessionId: string, sessionName: string) {
  const [forms, students] = await Promise.all([
    prisma.form.findMany({
      where: { sessionId, isActive: true },
      select: { id: true, title: true, type: true, deadline: true },
      orderBy: { title: "asc" },
    }),
    prisma.student.findMany({
      where: { sessionId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        team: { select: { name: true } },
        formSubmissions: { select: { formId: true, submittedAt: true, signerName: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const rows: string[][] = [];
  for (const student of students) {
    for (const form of forms) {
      const submission = student.formSubmissions.find((row) => row.formId === form.id);
      rows.push([
        `${student.firstName} ${student.lastName}`,
        student.team?.name ?? "",
        form.title,
        form.type,
        submission ? "completed" : "pending",
        submission?.submittedAt.toISOString() ?? "",
        submission?.signerName ?? "",
        form.deadline?.toISOString() ?? "",
      ]);
    }
  }

  const csv = toCsv(
    [
      "student",
      "team",
      "form_title",
      "form_type",
      "status",
      "submitted_at",
      "signer_name",
      "deadline",
    ],
    rows,
  );

  return csvResponse(csv, csvFilename("forms", sessionName));
}

export async function exportCommunicationsCsv(
  organizationId: string,
  sessionId: string,
  sessionName: string,
) {
  const [announcements, chatMessages, parentMessages] = await Promise.all([
    prisma.announcement.findMany({
      where: { organizationId, OR: [{ sessionId }, { sessionId: null }] },
      include: {
        sender: { select: { name: true, email: true } },
        _count: { select: { reads: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.chatMessage.findMany({
      where: { channel: { organizationId, OR: [{ sessionId }, { sessionId: null }] } },
      include: {
        sender: { select: { name: true, email: true } },
        channel: { select: { name: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.parentMessage.findMany({
      where: { thread: { organizationId, student: { sessionId } } },
      include: {
        sender: { select: { name: true, email: true, role: true } },
        thread: {
          select: {
            subject: true,
            topic: true,
            student: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  const rows: string[][] = [];

  for (const row of announcements) {
    rows.push([
      "announcement",
      row.title,
      row.body.slice(0, 500),
      row.channels.join("; "),
      row.sender.name ?? row.sender.email ?? "",
      String(row._count.reads),
      row.createdAt.toISOString(),
      "",
    ]);
  }

  for (const row of chatMessages) {
    rows.push([
      "staff_chat",
      row.channel.name,
      row.body.slice(0, 500),
      row.channel.type,
      row.sender.name ?? row.sender.email ?? "",
      "",
      row.createdAt.toISOString(),
      "",
    ]);
  }

  for (const row of parentMessages) {
    rows.push([
      "parent_message",
      row.thread.subject ?? row.thread.topic,
      row.body.slice(0, 500),
      row.thread.topic,
      row.sender.name ?? row.sender.email ?? "",
      row.thread.student
        ? `${row.thread.student.firstName} ${row.thread.student.lastName}`
        : "",
      row.createdAt.toISOString(),
      row.sentVia.join("; "),
    ]);
  }

  rows.sort((a, b) => (a[6] < b[6] ? 1 : -1));

  const csv = toCsv(
    [
      "kind",
      "title_or_channel",
      "body_preview",
      "topic_or_channels",
      "sender",
      "reads_or_student",
      "created_at",
      "delivery",
    ],
    rows,
  );

  return csvResponse(csv, csvFilename("communications", sessionName));
}

export async function exportAttendanceCsv(sessionId: string, sessionName: string) {
  const checkIns = await prisma.checkIn.findMany({
    where: {
      student: { sessionId },
      checkedOutAt: null,
    },
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
          team: { select: { name: true } },
        },
      },
      activity: { select: { name: true, location: true } },
      staff: { select: { name: true } },
    },
    orderBy: { checkedInAt: "desc" },
  });

  const csv = toCsv(
    ["student", "team", "activity", "location", "checked_in_at", "checked_in_by"],
    checkIns.map((checkIn) => [
      `${checkIn.student.firstName} ${checkIn.student.lastName}`,
      checkIn.student.team?.name ?? "",
      checkIn.activity?.name ?? "General campus",
      checkIn.activity?.location ?? "",
      checkIn.checkedInAt.toISOString(),
      checkIn.staff?.name ?? "",
    ]),
  );

  return csvResponse(csv, csvFilename("attendance", sessionName));
}

export async function exportIncidentsCsv(sessionId: string, sessionName: string) {
  const incidents = await prisma.incidentReport.findMany({
    where: { sessionId },
    include: {
      reportedBy: { select: { name: true, email: true } },
      students: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const csv = toCsv(
    [
      "id",
      "title",
      "severity",
      "status",
      "location",
      "reported_by",
      "students",
      "created_at",
    ],
    incidents.map((incident) => [
      incident.id,
      incident.title,
      incident.severity,
      incident.status,
      incident.location ?? "",
      incident.reportedBy.name ?? incident.reportedBy.email ?? "",
      incident.students
        .map((student) => `${student.firstName} ${student.lastName}`)
        .join("; "),
      incident.createdAt.toISOString(),
    ]),
  );

  return csvResponse(csv, csvFilename("incidents", sessionName));
}
