import { z } from "zod";

export const amcStatusSchema = z.enum(["active", "expiring", "expired", "none"]);
export const conditionSchema = z.string().trim().max(80);

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v == null ? "" : v),
    z.string().trim().max(max),
  );

const optionalNullableId = z.preprocess(
  (v) => (v == null || v === "" ? null : v),
  z.string().trim().nullable(),
);

const optionalNullableDate = z.preprocess(
  (v) => (v == null || v === "" ? null : v),
  z.string().trim().nullable(),
);

export const createEquipmentSchema = z.object({
  assetTag: z.string().min(2, "Asset tag is required").max(64),
  name: z.string().min(2, "Name is required").max(200),
  model: optionalText(120),
  manufacturer: optionalText(120),
  category: optionalText(80),
  serialNumber: z.string().min(1, "Serial number is required").max(120),
  customerId: optionalNullableId,
  branchId: z.string().optional(),
  location: z.string().max(200).optional(),
  installDate: optionalNullableDate,
  warrantyEnd: optionalNullableDate,
  amcStatus: amcStatusSchema.optional().default("none"),
  condition: z.preprocess(
    (v) => (v == null || v === "" ? undefined : v),
    conditionSchema.optional(),
  ),
  lastServiceDate: z.string().optional().nullable(),
});

export const updateEquipmentSchema = createEquipmentSchema.partial();
