/**
 * Read-only asset tag migration report.
 *
 * Take a full database backup before applying migrations or assigning tags.
 * This script does not rename existing assets.
 *
 *   npm run asset-tag:report
 *   npm run asset-tag:report -- --assign-blank
 *   npm run asset-tag:report -- --assign-blank --confirm
 */
import { prisma } from "@/db/prisma";
import { assignMissingAssetTags, buildAssetTagReport } from "@/services/assetTag.service";

async function main() {
  const args = new Set(process.argv.slice(2));
  const assign = args.has("--assign-blank");
  const confirm = args.has("--confirm");

  console.log("Take a full database backup before migrating or assigning asset tags.");
  console.log("Existing asset tags are left unchanged unless --assign-blank --confirm is set.");
  console.log("Blank records are the only ones that can receive a new tag, and each assignment is audited.");

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  let problems = 0;

  for (const tenant of tenants) {
    const report = await buildAssetTagReport(tenant.id);
    console.log(JSON.stringify({ tenantId: tenant.id, tenantName: tenant.name, ...report }, null, 2));
    if (report.blank.length > 0 || report.duplicates.length > 0) problems += 1;

    if (report.duplicates.length > 0) {
      console.error(
        `Tenant ${tenant.name} has duplicate asset tags. Resolve them explicitly. Nothing was renamed.`,
      );
      continue;
    }

    if (!assign || report.blank.length === 0) continue;
    if (!confirm) {
      console.log(
        `Tenant ${tenant.name} has ${report.blank.length} blank asset tag(s). Re-run with --assign-blank --confirm after a backup to assign numbers. No changes were made.`,
      );
      continue;
    }

    const assigned = await assignMissingAssetTags(tenant.id, {
      name: "asset-tag-migration-report",
      role: "admin",
      ip: "migration-script",
    });
    console.log(JSON.stringify({ tenantId: tenant.id, assigned }, null, 2));
  }

  if (problems && !(assign && confirm)) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
