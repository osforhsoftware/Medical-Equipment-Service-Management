import { z } from "zod";

export const uploadJobPhotosSchema = z.object({
  photos: z
    .array(
      z.object({
        filename: z.string().min(1).max(200).optional(),
        mimeType: z.string().min(1).max(200).optional(),
        dataUrl: z.string().min(20).max(5_000_000).optional(),
        fileId: z.string().cuid().optional(),
      }).refine((p) => Boolean(p.fileId || p.dataUrl), { message: "fileId or dataUrl is required" }),
    )
    .min(1, "At least one photo is required")
    .max(10),
});

export const requestJobPartsSchema = z.object({
  notes: z.string().trim().min(3, "Describe the parts needed").max(2000),
});

export const captureJobSignatureSchema = z.object({
  customerName: z.string().trim().min(2, "Customer name is required").max(120),
  signatureData: z.string().max(500_000).optional(),
  fileId: z.string().cuid().optional(),
});

export const deductJobStockSchema = z.object({
  inventoryItemId: z.string().min(1, "Inventory item is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
});
