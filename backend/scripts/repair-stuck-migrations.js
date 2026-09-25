/**
 * Repair stuck Prisma migrations when the DB already has the columns/tables
 * (common after db push / partial deploy) but _prisma_migrations is behind.
 *
 * Usage (from backend/):
 *   node scripts/repair-stuck-migrations.js
 *   node scripts/repair-stuck-migrations.js --dry-run
 */
const { execSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");

const dryRun = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

function sh(cmd) {
  console.log(`> ${cmd}`);
  if (dryRun) return;
  execSync(cmd, { stdio: "inherit", env: process.env });
}

async function columnExists(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    table,
    column,
  );
  return rows.length > 0;
}

async function tableExists(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 AS ok FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    table,
  );
  return rows.length > 0;
}

async function enumHasValue(table, column, value) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    table,
    column,
  );
  if (!rows.length) return false;
  return String(rows[0].COLUMN_TYPE).includes(`'${value}'`);
}

/** Migrations that fail with "Duplicate column" when objects already exist. */
const ALREADY_APPLIED_CHECKS = {
  "20260817140000_service_ticket_workflow_v2": () =>
    columnExists("service_requests", "assigned_inspector_id"),
  "20260817180000_job_photo_caption": () => columnExists("job_photos", "caption"),
  "20260818190000_customer_note": () => columnExists("customers", "note"),
  "20260824100000_inventory_taxonomy": () => columnExists("inventory_items", "subcategory"),
  "20260824120000_product_sales_orders": () => tableExists("sales_orders"),
  "20260826153000_purchase_returns": () => tableExists("purchase_returns"),
  "20260826180000_job_extra_type": () => columnExists("job_extras", "type"),
  "20260902120000_customer_optional_fields": async () => {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COLUMN_DEFAULT FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'phone' LIMIT 1`,
    );
    return rows[0]?.COLUMN_DEFAULT === "";
  },
  "20260902123000_customer_reference": () => columnExists("customers", "reference"),
  "20260902130000_sales_role": () => enumHasValue("users", "role", "sales"),
  "20260902140000_ticket_auto_assignment": () =>
    columnExists("service_requests", "assigned_estimator_id"),
  "20260903121500_optional_service_request_type": async () => {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT IS_NULLABLE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_requests' AND COLUMN_NAME = 'type' LIMIT 1`,
    );
    return rows[0]?.IS_NULLABLE === "YES";
  },
  "20260904120000_tenant_company_fields": () =>
    columnExists("tenant_settings", "company_address"),
  "20260904123000_sync_missing_schema_objects": () =>
    columnExists("stock_transfers", "from_branch_id"),
  "20260904140000_equipment_optional_fields": async () => {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT IS_NULLABLE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'equipment' AND COLUMN_NAME = 'serial_number' LIMIT 1`,
    );
    return rows[0]?.IS_NULLABLE === "YES";
  },
  "20260918170000_service_request_completed_at": () =>
    columnExists("service_requests", "completed_at"),
  "20260918180000_user_permissions": () => columnExists("users", "permissions"),
  "20260919120000_equipment_master_fields": () =>
    columnExists("equipment", "part_number"),
  "20260919130000_inventory_part_item_master": () =>
    columnExists("inventory_items", "manufacturer"),
  "20260922160000_expense_category_taxonomy": () =>
    enumHasValue("taxonomy_terms", "type", "expense_category"),
  "20260923120000_qa_role": () => enumHasValue("users", "role", "qa"),
  "20260923140000_cancelled_status": () =>
    enumHasValue("service_requests", "status", "cancelled"),
  "20260923150000_sales_enquiries_rfqs_warranty": () => tableExists("sales_enquiries"),
  "20260923160000_guided_setup_flow": () =>
    columnExists("tenant_settings", "guided_setup_flow"),
  "20260924100000_service_warranty": () =>
    columnExists("equipment", "service_warranty_start"),
  "20260924110000_no_warranty_flags": () =>
    columnExists("equipment", "no_machine_warranty"),
  "20260925143000_purchase_order_landed_costs": () =>
    columnExists("purchase_orders", "freight_cost"),
};

async function pendingMigrations() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations
  `);
  const done = new Set(
    rows
      .filter((r) => r.finished_at && !r.rolled_back_at)
      .map((r) => r.migration_name),
  );
  const failed = rows.filter((r) => !r.finished_at && !r.rolled_back_at);

  return { done, failed, all: rows };
}

async function main() {
  const { done, failed } = await pendingMigrations();
  console.log(`Failed (blocking) migrations: ${failed.map((f) => f.migration_name).join(", ") || "(none)"}`);

  // Resolve any currently-failed migration if its objects already exist
  for (const f of failed) {
    const check = ALREADY_APPLIED_CHECKS[f.migration_name];
    if (check && (await check())) {
      console.log(`Marking failed migration as applied (objects exist): ${f.migration_name}`);
      sh(`npx prisma migrate resolve --applied "${f.migration_name}"`);
    } else {
      console.error(
        `Failed migration ${f.migration_name} does not look fully applied. Inspect logs in _prisma_migrations and fix manually.`,
      );
      process.exit(1);
    }
  }

  // Mark pending migrations whose objects already exist so deploy can skip them
  for (const [name, check] of Object.entries(ALREADY_APPLIED_CHECKS)) {
    if (done.has(name)) continue;
    // re-read after resolves
    const again = await pendingMigrations();
    if (again.done.has(name)) continue;
    if (await check()) {
      console.log(`Marking already-present migration as applied: ${name}`);
      sh(`npx prisma migrate resolve --applied "${name}"`);
    }
  }

  console.log("Running prisma migrate deploy...");
  sh("npx prisma migrate deploy");
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
