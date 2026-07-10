import type { EmergencyProtocolType } from "@/generated/prisma/client";

export type ProtocolStep = {
  id: string;
  text: string;
  order: number;
};

export type DefaultProtocol = {
  type: EmergencyProtocolType;
  title: string;
  steps: ProtocolStep[];
  sortOrder: number;
};

export const DEFAULT_EMERGENCY_PROTOCOLS: DefaultProtocol[] = [
  {
    type: "LOST_STUDENT",
    title: "Lost / missing student",
    sortOrder: 1,
    steps: [
      { id: "1", order: 1, text: "Confirm last known location and who saw the student last." },
      { id: "2", order: 2, text: "Notify Session Admin and search assigned zone immediately." },
      { id: "3", order: 3, text: "Check activity roster and buddy pairs; radio other teams." },
      { id: "4", order: 4, text: "If not located within 10 minutes, escalate to director and begin full-campus search." },
      { id: "5", order: 5, text: "Contact guardians only per camp policy after admin approval." },
    ],
  },
  {
    type: "MEDICAL",
    title: "Medical emergency",
    sortOrder: 2,
    steps: [
      { id: "1", order: 1, text: "Ensure scene safety; do not move student unless immediate danger." },
      { id: "2", order: 2, text: "Send runner for nurse/on-call; call 911 if life-threatening." },
      { id: "3", order: 3, text: "Retrieve medical profile and EpiPen/meds if indicated." },
      { id: "4", order: 4, text: "Session Admin documents incident and notifies guardians per policy." },
    ],
  },
  {
    type: "WEATHER",
    title: "Severe weather",
    sortOrder: 3,
    steps: [
      { id: "1", order: 1, text: "Sound alert and recall all outdoor groups to shelter building." },
      { id: "2", order: 2, text: "Account for all students by team in designated shelter zones." },
      { id: "3", order: 3, text: "Hold in place until all-clear from Session Admin." },
      { id: "4", order: 4, text: "Resume activities only after headcount verified." },
    ],
  },
  {
    type: "LOCKDOWN",
    title: "Lockdown",
    sortOrder: 4,
    steps: [
      { id: "1", order: 1, text: "Move students indoors; lock doors and silence phones." },
      { id: "2", order: 2, text: "Take roll silently; report missing to Session Admin via radio." },
      { id: "3", order: 3, text: "Stay in place until law enforcement or director releases lockdown." },
    ],
  },
];

export async function ensureDefaultProtocols(
  organizationId: string,
  upsert: (data: {
    organizationId: string;
    type: EmergencyProtocolType;
    title: string;
    steps: ProtocolStep[];
    sortOrder: number;
  }) => Promise<unknown>,
) {
  for (const protocol of DEFAULT_EMERGENCY_PROTOCOLS) {
    await upsert({
      organizationId,
      type: protocol.type,
      title: protocol.title,
      steps: protocol.steps,
      sortOrder: protocol.sortOrder,
    });
  }
}
