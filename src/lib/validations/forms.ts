import { z } from "zod";

export const createFormSchema = z.object({
  templateType: z.enum([
    "PERMISSION_SLIP",
    "MEDICAL_CONSENT",
    "PHOTO_RELEASE",
    "LIABILITY_WAIVER",
  ]),
  title: z.string().optional(),
  description: z.string().optional(),
  deadline: z.string().optional(),
});

export const formSubmissionSchema = z.object({
  studentId: z.string().min(1),
  responses: z.record(z.string(), z.union([z.string(), z.boolean()])),
  signerName: z.string().min(1),
  signerEmail: z.string().email().optional(),
  signatureDataUrl: z.string().min(1),
});

export const formReminderSchema = z.object({
  formId: z.string().min(1),
  studentIds: z.array(z.string()).optional(),
});
