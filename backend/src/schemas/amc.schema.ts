import { z } from "zod";

const amcFields = {
  reference: z.string().trim().min(1).max(40).optional(),
  customerName: z.string().trim().min(2).max(200),
  equipmentCount: z.coerce.number().int().min(0).optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  value: z.coerce.number().min(0).optional(),
  visitsPerYear: z.coerce.number().int().min(0).optional(),
  visitsDone: z.coerce.number().int().min(0).optional(),
  status: z.enum(["active", "expiring", "expired", "none"]).optional(),
};

export const createAmcSchema = z.object(amcFields);
export const updateAmcSchema = z.object(amcFields).partial();
