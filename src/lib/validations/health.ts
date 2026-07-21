import { z } from "zod";

export const medicationLogSchema = z.object({
  medicalProfileId: z.string().min(1),
  medicationName: z.string().min(1),
  dosage: z.string().optional(),
  notes: z.string().optional(),
});

export const wellnessCheckSchema = z.object({
  studentId: z.string().min(1),
  mood: z.string().min(1),
  energy: z.string().optional(),
  notes: z.string().optional(),
});

export const incidentSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  actionTaken: z.string().optional(),
  location: z.string().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  studentIds: z.array(z.string()).min(1),
  sourceParentThreadId: z.string().optional(),
  sourceParentMessageId: z.string().optional(),
  notifyParent: z.boolean().optional(),
  parentMessageBody: z.string().optional(),
  /** Free-text emails (comma/space separated) beyond the linked guardian. */
  additionalNotifyEmails: z.string().optional(),
});

export const incidentUpdateSchema = z.object({
  status: z.enum(["OPEN", "UNDER_REVIEW", "CLOSED"]).optional(),
  actionTaken: z.string().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

export const medicalProfileUpdateSchema = z.object({
  allergies: z.string().optional(),
  medications: z.string().optional(),
  conditions: z.string().optional(),
  notes: z.string().optional(),
});

export const confidentialNotesSchema = z.object({
  confidentialNotes: z.string(),
});
