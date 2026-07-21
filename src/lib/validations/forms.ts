import { z } from "zod";

export const formFieldDefinitionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z.enum([
      "text",
      "textarea",
      "number",
      "date",
      "select",
      "multiselect",
      "yesno",
      "checkbox",
      "signature",
    ]),
    required: z.boolean().optional(),
    helpText: z.string().optional(),
    options: z.array(z.string().min(1)).optional(),
  })
  .superRefine((field, ctx) => {
    if (
      (field.type === "select" || field.type === "multiselect") &&
      (!field.options || field.options.length < 2)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${field.label || field.id}: select fields need at least 2 options`,
        path: ["options"],
      });
    }
  });

export const createFormSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("template"),
    templateType: z.enum([
      "PERMISSION_SLIP",
      "MEDICAL_CONSENT",
      "PHOTO_RELEASE",
      "LIABILITY_WAIVER",
    ]),
    title: z.string().optional(),
    description: z.string().optional(),
    deadline: z.string().optional(),
  }),
  z.object({
    source: z.literal("custom"),
    title: z.string().min(1),
    description: z.string().optional(),
    fields: z.array(formFieldDefinitionSchema).min(1),
    deadline: z.string().optional(),
    /** Persist as org-level reusable template (sessionId null). Default true. */
    saveAsTemplate: z.boolean().optional().default(true),
    /** Also publish a copy to the active camp session. Default true. */
    publishToSession: z.boolean().optional().default(true),
  }),
  z.object({
    source: z.literal("publish_custom"),
    templateId: z.string().min(1),
    title: z.string().optional(),
    deadline: z.string().optional(),
  }),
]);

export const formSubmissionSchema = z.object({
  studentId: z.string().min(1),
  responses: z.record(
    z.string(),
    z.union([z.string(), z.boolean(), z.array(z.string())]),
  ),
  signerName: z.string().min(1),
  signerEmail: z.string().email().optional(),
  signatureDataUrl: z.string().optional(),
});

export const formReminderSchema = z.object({
  formId: z.string().min(1),
  studentIds: z.array(z.string()).optional(),
});
