import { z } from "zod";

export const studentFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().optional(),
  grade: z.string().optional(),
  teamId: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
  conditions: z.string().optional(),
  guardianName: z.string().optional(),
  guardianEmail: z.string().email("Invalid guardian email").optional().or(z.literal("")),
  guardianPhone: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
});

export type StudentFormInput = z.infer<typeof studentFormSchema>;

export const rosterQuerySchema = z.object({
  q: z.string().optional(),
  teamId: z.string().optional(),
  grade: z.string().optional(),
  hasAllergy: z.enum(["true", "false"]).optional(),
  staffId: z.string().optional(),
});

export type RosterQuery = z.infer<typeof rosterQuerySchema>;
