import bcrypt from "bcryptjs";
import { PermissionResource, StaffCertificationType, UserRole } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { seedDefaultPermissions } from "../src/lib/permissions";

async function main() {
  const passwordHash = await bcrypt.hash("campadmin123", 12);

  const organization = await prisma.organization.upsert({
    where: { slug: "demo-camp" },
    update: {},
    create: {
      name: "Demo Summer Camp",
      slug: "demo-camp",
      primaryColor: "#E07A3A",
      secondaryColor: "#2D6A4F",
    },
  });

  await seedDefaultPermissions(organization.id);

  // Ensure STAFF can edit schedules (Stage 4 intent; older seeds may have canEdit=false)
  await prisma.permissionMatrix.updateMany({
    where: {
      organizationId: organization.id,
      role: UserRole.STAFF,
      resource: PermissionResource.SCHEDULES,
    },
    data: { canView: true, canEdit: true },
  });

  const session = await prisma.campSession.upsert({
    where: { id: "seed-session-1" },
    update: {
      name: "Session 1 — Summer 2026",
      startDate: new Date("2026-06-15"),
      endDate: new Date("2026-08-15"),
      isActive: true,
    },
    create: {
      id: "seed-session-1",
      organizationId: organization.id,
      name: "Session 1 — Summer 2026",
      startDate: new Date("2026-06-15"),
      endDate: new Date("2026-08-15"),
    },
  });

  const teams = await Promise.all(
    ["Pine Cabin", "Maple Cabin", "Cedar Cabin"].map((name) =>
      prisma.team.upsert({
        where: { id: `seed-team-${name.toLowerCase().replace(/\s/g, "-")}` },
        update: {},
        create: {
          id: `seed-team-${name.toLowerCase().replace(/\s/g, "-")}`,
          sessionId: session.id,
          name,
          color: name.startsWith("Pine")
            ? "#2D6A4F"
            : name.startsWith("Maple")
              ? "#E07A3A"
              : "#457B9D",
        },
      }),
    ),
  );

  await prisma.user.upsert({
    where: { email: "admin@demo.camp" },
    update: {},
    create: {
      email: "admin@demo.camp",
      name: "Camp Director",
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      organizationId: organization.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "counselor@demo.camp" },
    update: { phone: "+15551234567" },
    create: {
      email: "counselor@demo.camp",
      name: "Alex Counselor",
      passwordHash,
      role: UserRole.STAFF,
      organizationId: organization.id,
      phone: "+15551234567",
    },
  });

  await prisma.user.upsert({
    where: { email: "parent@demo.camp" },
    update: {},
    create: {
      email: "parent@demo.camp",
      name: "Jamie Parent",
      passwordHash,
      role: UserRole.PARENT,
      organizationId: organization.id,
    },
  });

  const staff = await prisma.user.findUnique({
    where: { email: "counselor@demo.camp" },
  });

  if (staff && teams[0]) {
    await prisma.teamStaffAssignment.upsert({
      where: {
        teamId_userId: {
          teamId: teams[0].id,
          userId: staff.id,
        },
      },
      update: {},
      create: {
        teamId: teams[0].id,
        userId: staff.id,
        isLead: true,
      },
    });

    await prisma.staffCertification.upsert({
      where: { id: "seed-cert-counselor-cpr" },
      update: {},
      create: {
        id: "seed-cert-counselor-cpr",
        userId: staff.id,
        type: StaffCertificationType.CPR,
        label: "CPR / First Aid",
        expiresAt: new Date("2027-06-01"),
      },
    });
  }

  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@demo.camp" },
  });

  if (adminUser) {
    await prisma.staffCertification.upsert({
      where: { id: "seed-cert-admin-lifeguard" },
      update: {},
      create: {
        id: "seed-cert-admin-lifeguard",
        userId: adminUser.id,
        type: StaffCertificationType.LIFEGUARD,
        label: "Lifeguard",
        expiresAt: new Date("2027-08-01"),
      },
    });
  }

  if (staff && adminUser) {
    const dutyDate = new Date("2026-06-16T12:00:00.000Z");
    const poolStart = new Date("2026-06-16T13:00:00.000Z");
    const poolEnd = new Date("2026-06-16T17:00:00.000Z");

    await prisma.staffShift.upsert({
      where: { id: "seed-shift-counselor-pine" },
      update: {},
      create: {
        id: "seed-shift-counselor-pine",
        sessionId: session.id,
        userId: staff.id,
        date: dutyDate,
        dutyLabel: "Pine Cabin coverage",
        roleOnDuty: "Counselor",
        startTime: poolStart,
        endTime: poolEnd,
      },
    });

    await prisma.staffShift.upsert({
      where: { id: "seed-shift-admin-pool" },
      update: {},
      create: {
        id: "seed-shift-admin-pool",
        sessionId: session.id,
        userId: adminUser.id,
        date: dutyDate,
        dutyLabel: "Pool lifeguard",
        roleOnDuty: "Lifeguard",
        requiredCertification: StaffCertificationType.LIFEGUARD,
        startTime: poolStart,
        endTime: poolEnd,
      },
    });
  }

  await prisma.staffResource.upsert({
    where: { id: "seed-resource-emergency" },
    update: {},
    create: {
      id: "seed-resource-emergency",
      organizationId: organization.id,
      title: "Emergency procedures handbook",
      description: "Evacuation routes, incident escalation, and on-call contacts.",
      category: "Safety",
      url: "https://example.com/emergency-handbook",
    },
  });

  const sampleStudents = [
    {
      firstName: "Jordan",
      lastName: "Lee",
      dateOfBirth: new Date("2012-03-15"),
      grade: "8",
      teamId: teams[0]?.id,
      allergies: "Peanuts, tree nuts",
      medications: "EpiPen as needed",
      conditions: "Asthma",
      guardianName: "Taylor Lee",
      guardianEmail: "taylor@example.com",
      guardianPhone: "555-0100",
      emergencyName: "Chris Lee",
      emergencyPhone: "555-0101",
      emergencyRelationship: "Aunt",
    },
    {
      firstName: "Sam",
      lastName: "Patel",
      dateOfBirth: new Date("2011-07-22"),
      grade: "9",
      teamId: teams[1]?.id,
      guardianName: "Priya Patel",
      guardianEmail: "priya@example.com",
      guardianPhone: "555-0200",
    },
    {
      firstName: "Avery",
      lastName: "Chen",
      dateOfBirth: new Date("2013-01-08"),
      grade: "7",
      teamId: teams[2]?.id,
      allergies: "Dairy",
      guardianName: "Morgan Chen",
      guardianEmail: "morgan@example.com",
      guardianPhone: "555-0300",
    },
  ];

  for (const sample of sampleStudents) {
    const existing = await prisma.student.findFirst({
      where: {
        sessionId: session.id,
        firstName: sample.firstName,
        lastName: sample.lastName,
      },
    });

    if (existing) continue;

    await prisma.student.create({
      data: {
        sessionId: session.id,
        teamId: sample.teamId,
        firstName: sample.firstName,
        lastName: sample.lastName,
        dateOfBirth: sample.dateOfBirth,
        grade: sample.grade,
        guardianName: sample.guardianName,
        guardianEmail: sample.guardianEmail,
        guardianPhone: sample.guardianPhone,
        medicalProfile: sample.allergies
          ? {
              create: {
                allergies: sample.allergies,
                medications: sample.medications,
                conditions: sample.conditions,
              },
            }
          : undefined,
        emergencyContacts:
          sample.emergencyName && sample.emergencyPhone
            ? {
                create: {
                  name: sample.emergencyName,
                  phone: sample.emergencyPhone,
                  relationship: sample.emergencyRelationship,
                },
              }
            : undefined,
      },
    });
  }

  const swimStart = new Date("2026-06-16T14:00:00.000Z");
  const swimEnd = new Date("2026-06-16T15:00:00.000Z");

  const existingSwim = await prisma.activity.findFirst({
    where: { sessionId: session.id, name: "Afternoon Swim" },
  });

  if (!existingSwim && teams[0]) {
    await prisma.activity.create({
      data: {
        sessionId: session.id,
        teamId: teams[0].id,
        name: "Afternoon Swim",
        location: "Pool",
        color: "#457B9D",
        startTime: swimStart,
        endTime: swimEnd,
        overdueAlertMinutes: 10,
        schedules: { create: { teamId: teams[0].id } },
      },
    });
  }

  const chapelStart = new Date("2026-06-16T09:00:00.000Z");
  const chapelEnd = new Date("2026-06-16T10:00:00.000Z");

  const existingChapel = await prisma.activity.findFirst({
    where: { sessionId: session.id, name: "Morning Chapel" },
  });

  if (!existingChapel) {
    await prisma.activity.create({
      data: {
        sessionId: session.id,
        name: "Morning Chapel",
        location: "Main Hall",
        color: "#2D6A4F",
        startTime: chapelStart,
        endTime: chapelEnd,
        overdueAlertMinutes: 15,
        schedules: {
          create: teams.map((team) => ({ teamId: team.id })),
        },
      },
    });
  }

  console.log("Seed complete.");
  console.log("Demo logins (password: campadmin123):");
  console.log("  admin@demo.camp — Super Admin");
  console.log("  counselor@demo.camp — Staff");
  console.log("  parent@demo.camp — Parent");

  const parentUser = await prisma.user.findUnique({
    where: { email: "parent@demo.camp" },
  });
  const jordan = await prisma.student.findFirst({
    where: {
      sessionId: session.id,
      firstName: "Jordan",
      lastName: "Lee",
    },
  });

  if (parentUser && jordan) {
    await prisma.studentParent.upsert({
      where: {
        studentId_userId: { studentId: jordan.id, userId: parentUser.id },
      },
      update: {},
      create: {
        studentId: jordan.id,
        userId: parentUser.id,
        relationship: "Parent",
        isPrimary: true,
      },
    });
  }

  const admin = await prisma.user.findUnique({
    where: { email: "admin@demo.camp" },
  });
  if (admin) {
    await prisma.announcement.upsert({
      where: { id: "seed-announcement-1" },
      update: {},
      create: {
        id: "seed-announcement-1",
        organizationId: organization.id,
        sessionId: session.id,
        senderId: admin.id,
        title: "Welcome to Session 1",
        body: "Check-in opens at 8 AM. Chapel is at 9 AM in the Main Hall.",
        channels: ["in_app"],
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
