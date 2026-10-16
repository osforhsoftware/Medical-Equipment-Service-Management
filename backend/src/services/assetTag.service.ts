import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { syncEquipmentNameSnapshots } from "@/lib/equipmentLabel";
import {
  ASSET_TAG_SEQUENCE_START,
  claimNextSequence,
  companyNameToAssetTagPrefix,
  formatAssetTag,
  isValidAssetTagPrefix,
  nextSequenceFromExisting,
  normalizeAssetTagPrefix,
  sequenceFromAssetTag,
} from "@/lib/assetTag";
import { AppError } from "@/middleware/errorHandler";
import { settingsRepository } from "@/repositories/settings.repository";

type Db = Prisma.TransactionClient | typeof prisma;

export type AssetTagConfig = {
  assetTagPrefix: string;
  suggestedAssetTagPrefix: string;
  assetTagNextSequence: number;
  assetTagPreview: string;
};

export type AssetTagReport = {
  companyName: string;
  prefix: string;
  prefixSource: "stored" | "suggested-from-company-name";
  nextSequence: number;
  preview: string;
  equipmentCount: number;
  blank: { id: string; name: string; assetTag: string }[];
  duplicates: { assetTag: string; count: number }[];
  preservedCount: number;
  renamesApplied: 0;
  notes: string[];
};

function prefixFromSettingsRow(row: { assetTagPrefix?: string | null; asset_tag_prefix?: string | null } | undefined) {
  return (row?.assetTagPrefix ?? row?.asset_tag_prefix ?? "").trim();
}

export function assertAssetTagPrefix(raw: string): string {
  const prefix = normalizeAssetTagPrefix(raw);
  if (!isValidAssetTagPrefix(prefix)) {
    throw new AppError(
      "Asset tag prefix must be 2–20 characters using letters, numbers, and hyphens.",
      422,
    );
  }
  return prefix;
}

/** Persist a prefix derived from the company name only when one has not been saved yet. */
export async function ensureAssetTagPrefix(tenantId: string): Promise<string> {
  const settings = await settingsRepository.ensureDefaults(tenantId);
  if (settings.assetTagPrefix?.trim()) return settings.assetTagPrefix.trim();
  const companyName = await settingsRepository.getTenantName(tenantId);
  const prefix = companyNameToAssetTagPrefix(companyName);
  await prisma.tenantSettings.update({
    where: { tenantId },
    data: { assetTagPrefix: prefix },
  });
  return prefix;
}

async function peekNextSequence(tenantId: string, prefix: string, db: Db = prisma): Promise<number> {
  const row = await db.assetTagSequence.findUnique({
    where: { tenantId_prefix: { tenantId, prefix } },
  });
  if (row) return Math.max(ASSET_TAG_SEQUENCE_START, row.nextSequence);
  const tags = await db.equipment.findMany({
    where: { tenantId, assetTag: { startsWith: `${prefix}-` } },
    select: { assetTag: true },
  });
  return nextSequenceFromExisting(
    prefix,
    tags.map((tag) => tag.assetTag),
  );
}

export async function getAssetTagConfig(tenantId: string): Promise<AssetTagConfig> {
  const companyName = await settingsRepository.getTenantName(tenantId);
  const prefix = await ensureAssetTagPrefix(tenantId);
  const nextSequence = await peekNextSequence(tenantId, prefix);
  return {
    assetTagPrefix: prefix,
    suggestedAssetTagPrefix: companyNameToAssetTagPrefix(companyName),
    assetTagNextSequence: nextSequence,
    assetTagPreview: formatAssetTag(prefix, nextSequence),
  };
}

async function ensurePrefixLocked(tenantId: string, tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ assetTagPrefix: string | null; asset_tag_prefix?: string | null }>>`
    SELECT asset_tag_prefix AS assetTagPrefix
    FROM tenant_settings
    WHERE tenant_id = ${tenantId}
    FOR UPDATE
  `;
  if (!rows.length) throw new AppError("Company settings are not configured", 500);

  const current = prefixFromSettingsRow(rows[0]);
  if (current) return current;

  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  const prefix = companyNameToAssetTagPrefix(tenant?.name ?? "");
  await tx.tenantSettings.update({
    where: { tenantId },
    data: { assetTagPrefix: prefix },
  });
  return prefix;
}

/**
 * Allocate the next asset tag inside the caller's transaction.
 * The counter update commits only if that transaction commits.
 */
export async function allocateAssetTag(tenantId: string, tx: Prisma.TransactionClient): Promise<string> {
  const prefix = await ensurePrefixLocked(tenantId, tx);
  const existingCounter = await tx.assetTagSequence.findUnique({
    where: { tenantId_prefix: { tenantId, prefix } },
  });

  if (!existingCounter) {
    const initial = await peekNextSequence(tenantId, prefix, tx);
    await tx.$executeRaw`
      INSERT INTO asset_tag_sequences (id, tenant_id, prefix, next_sequence, created_at, updated_at)
      VALUES (${randomUUID()}, ${tenantId}, ${prefix}, ${initial}, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE tenant_id = asset_tag_sequences.tenant_id
    `;
  }

  const locked = await tx.$queryRaw<Array<{ nextSequence: bigint | number }>>`
    SELECT next_sequence AS nextSequence
    FROM asset_tag_sequences
    WHERE tenant_id = ${tenantId} AND prefix = ${prefix}
    FOR UPDATE
  `;
  const current = Number(locked[0]?.nextSequence);
  if (!Number.isFinite(current)) throw new AppError("Asset tag sequence is not configured", 500);

  const tags = await tx.equipment.findMany({
    where: { tenantId, assetTag: { startsWith: `${prefix}-` } },
    select: { assetTag: true },
  });
  const occupied = new Set(tags.map((row) => row.assetTag.trim().toUpperCase()));
  let claimed: { assetTag: string; nextSequence: number };
  try {
    claimed = claimNextSequence(current, (assetTag) => occupied.has(assetTag.toUpperCase()), prefix);
  } catch {
    throw new AppError("Unable to allocate a unique asset tag", 409);
  }

  await tx.assetTagSequence.update({
    where: { tenantId_prefix: { tenantId, prefix } },
    data: { nextSequence: claimed.nextSequence },
  });
  return claimed.assetTag;
}

export async function buildAssetTagReport(tenantId: string): Promise<AssetTagReport> {
  const settings = await settingsRepository.ensureDefaults(tenantId);
  const companyName = await settingsRepository.getTenantName(tenantId);
  const suggested = companyNameToAssetTagPrefix(companyName);
  const stored = settings.assetTagPrefix?.trim() || "";
  const prefix = stored || suggested;
  const nextSequence = await peekNextSequence(tenantId, prefix);
  const equipment = await prisma.equipment.findMany({
    where: { tenantId },
    select: { id: true, name: true, assetTag: true },
  });
  const blank = equipment.filter((row) => !row.assetTag.trim());
  const duplicatesRaw = await prisma.$queryRaw<Array<{ assetTag: string; count: bigint | number }>>`
    SELECT asset_tag AS assetTag, COUNT(*) AS count
    FROM equipment
    WHERE tenant_id = ${tenantId}
    GROUP BY asset_tag
    HAVING COUNT(*) > 1
  `;
  const preservedCount = equipment.filter(
    (row) => row.assetTag.trim() && sequenceFromAssetTag(prefix, row.assetTag) == null,
  ).length;

  return {
    companyName,
    prefix,
    prefixSource: stored ? "stored" : "suggested-from-company-name",
    nextSequence,
    preview: formatAssetTag(prefix, nextSequence),
    equipmentCount: equipment.length,
    blank: blank.map((row) => ({ id: row.id, name: row.name, assetTag: row.assetTag })),
    duplicates: duplicatesRaw.map((row) => ({ assetTag: row.assetTag, count: Number(row.count) })),
    preservedCount,
    renamesApplied: 0,
    notes: [
      "Existing asset tags were not renamed.",
      "Take a database backup before assigning tags to records that have none.",
      "Duplicate asset tags must be resolved explicitly. This report does not change them.",
      "Issued numbers stay reserved after an asset is deleted or archived.",
    ],
  };
}

export async function assignMissingAssetTags(
  tenantId: string,
  actor: { name: string; role: string; ip?: string },
): Promise<{ id: string; name: string; assetTag: string }[]> {
  const report = await buildAssetTagReport(tenantId);
  if (report.duplicates.length > 0) {
    throw new AppError("Resolve duplicate asset tags before assigning new ones. No records were changed.", 409);
  }

  const blanks = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM equipment
    WHERE tenant_id = ${tenantId} AND TRIM(asset_tag) = ''
  `;
  const assigned: { id: string; name: string; assetTag: string }[] = [];

  for (const blank of blanks) {
    const equipment = await prisma.$transaction(async (tx) => {
      const current = await tx.equipment.findFirst({ where: { id: blank.id, tenantId } });
      if (!current || current.assetTag.trim()) return null;
      const assetTag = await allocateAssetTag(tenantId, tx);
      const updated = await tx.equipment.update({
        where: { id: current.id },
        data: { assetTag },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          actor: actor.name.slice(0, 191),
          role: actor.role.slice(0, 191),
          action: `Assigned asset tag ${assetTag} to a blank record`.slice(0, 191),
          entity: `Equipment ${current.name}`.slice(0, 191),
          ip: (actor.ip || "migration").slice(0, 191),
        },
      });
      return updated;
    });
    if (!equipment) continue;
    await syncEquipmentNameSnapshots(tenantId, equipment.id, equipment);
    assigned.push({ id: equipment.id, name: equipment.name, assetTag: equipment.assetTag });
  }

  return assigned;
}
