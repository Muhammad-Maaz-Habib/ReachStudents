import { z } from "zod";

export const leaveRequestCreateSchema = z
  .object({
    reason: z.string().trim().min(1).max(2000),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    activityIds: z.array(z.string().min(1)).optional().default([]),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startsAt);
    const end = new Date(data.endsAt);
    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({
        code: "custom",
        path: ["startsAt"],
        message: "Invalid start time",
      });
    }
    if (Number.isNaN(end.getTime())) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Invalid end time",
      });
    }
    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      end <= start
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "End must be after start",
      });
    }
  });

export const leaveRequestReviewSchema = z.object({
  decision: z.enum(["APPROVED", "DENIED"]),
  reviewNote: z.string().trim().max(1000).optional().nullable(),
});
