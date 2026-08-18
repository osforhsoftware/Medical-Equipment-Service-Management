import { z } from "zod";
import { TAXONOMY_TYPES } from "@/config/taxonomyDefaults";

export const taxonomyTypeSchema = z.enum(TAXONOMY_TYPES);

export const listTaxonomyQuerySchema = z.object({
  type: taxonomyTypeSchema,
  activeOnly: z.enum(["true", "false", "1", "0"]).optional(),
});

export const createTaxonomySchema = z.object({
  type: taxonomyTypeSchema,
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateTaxonomySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120).optional(),
  slug: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});
