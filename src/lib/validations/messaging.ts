import { z } from "zod";

export const announcementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  sessionId: z.string().optional(),
  teamId: z.string().optional(),
  channels: z.array(z.enum(["in_app", "email", "sms"])).default(["in_app"]),
});

export const chatMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});

export const parentThreadSchema = z.object({
  studentId: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
  topic: z.enum(["GENERAL", "INCIDENT", "HEALTH"]).optional(),
  incidentId: z.string().optional(),
  medicalProfileId: z.string().optional(),
});

export const parentMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});

export const studentStaffThreadSchema = z.object({
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1).max(4000),
});

export const studentStaffMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const studentLoginProvisionSchema = z.object({
  email: z.string().trim().email(),
  resetPassword: z.boolean().optional().default(false),
});
