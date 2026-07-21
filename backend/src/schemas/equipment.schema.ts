import { z } from "zod";

export const amcStatusSchema = z.enum(["active", "expiring", "expired", "none"]);
export const conditionSchema = z.enum(["operational", "needsService", "down"]);

export const createEquipmentSchema = z.object({
  assetTag: z.string().min(2, "Asset tag is required").max(64),
  name: z.string().min(2, "Name is required").max(200),
  model: z.string().min(1, "Model is required").max(120),
  manufacturer: z.string().min(1, "Manufacturer is required").max(120),
  category: z.string().min(1, "Category is required").max(80),
  serialNumber: z.string().min(1, "Serial number is required").max(120),
  customerId: z.string().min(1, "Customer is required"),
  branchId: z.string().optional(),
  location: z.string().min(1, "Location is required").max(200),
  installDate: z.string().min(1, "Install date is required"),
  warrantyEnd: z.string().min(1, "Warranty end date is required"),
  amcStatus: amcStatusSchema.optional().default("none"),
  condition: conditionSchema.optional().default("operational"),
  lastServiceDate: z.string().optional(),
});

export const updateEquipmentSchema = createEquipmentSchema.partial();
