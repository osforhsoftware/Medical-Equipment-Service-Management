import { z } from "zod";

export const createJobSchema = z.object({
  serviceRequestId: z.string().min(1, "Service request is required"),
  engineerId: z.string().min(1, "Engineer is required"),
  scheduledFor: z.string().min(1, "Scheduled date is required"),
  status: z.enum(["scheduled", "inProgress", "partsPending", "review", "completed"]).optional().default("scheduled"),
  progress: z.coerce.number().min(0).max(100).optional().default(0),
});

export const updateJobSchema = z.object({
  engineerId: z.string().min(1).optional(),
  scheduledFor: z.string().optional(),
  status: z.enum(["scheduled", "inProgress", "partsPending", "review", "completed"]).optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
});
