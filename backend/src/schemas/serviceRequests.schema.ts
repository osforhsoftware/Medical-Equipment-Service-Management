import { z } from "zod";

export const createServiceRequestSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  equipmentId: z.string().optional(),
  equipmentIds: z.array(z.string()).optional(),
  type: z.enum(["Repair", "Maintenance", "Calibration", "Inspection", "Installation"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(500),
  assignedTo: z.string().min(1).optional(),
  assignedName: z.string().optional(),
  slaDue: z.string().optional(),
});

export const updateServiceRequestSchema = z.object({
  status: z.enum(["new", "inspection", "estimate", "approval", "inProgress", "completed", "invoiced"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  assignedTo: z.string().nullable().optional(),
  assignedName: z.string().nullable().optional(),
  description: z.string().trim().min(1).max(500).optional(),
  timelineNote: z.string().trim().max(1000).optional(),
});

export const assignServiceRequestSchema = z.object({
  assignedTo: z.string().min(1, "Staff user ID is required"),
  note: z.string().trim().max(500).optional(),
});

export const workflowServiceRequestSchema = z.object({
  status: z.enum(["new", "inspection", "estimate", "approval", "inProgress", "completed", "invoiced"]),
  note: z.string().trim().min(1, "Note is required").max(1000),
});
