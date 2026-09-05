import dotenv from "dotenv";
import path from "path";
import {
  cleanTenantBusinessData,
  DEFAULT_SYSTEM_USERNAMES,
} from "../src/services/databaseCleanup.service";
import { prisma } from "../src/db/prisma";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const tenantId = process.env.DEFAULT_TENANT_ID ?? "tenant_medtech_01";
const confirm = process.argv.includes("--confirm");
const keepAllStaff = process.argv.includes("--keep-staff");
const allowProduction =
  process.argv.includes("--allow-production") && process.env.ALLOW_PRODUCTION_CLEAN === "1";

async function main() {
  if (process.env.NODE_ENV === "production" && !allowProduction) {
    console.error("db:clean is disabled in production.");
    console.error("To wipe business data on the server, set ALLOW_PRODUCTION_CLEAN=1");
    console.error("and pass --confirm --keep-staff --allow-production.");
    process.exit(1);
  }

  if (!confirm) {
    console.error("This command deletes business data for the default tenant.");
    if (keepAllStaff) {
      console.error("Staff accounts are kept. Customer portal users are removed.");
      console.error("Tickets, equipment, customers, inventory, invoices, and jobs are removed.");
    } else {
      console.error("Admin and default staff credentials are kept.");
      console.error("");
      console.error("Preserved accounts:");
      for (const username of DEFAULT_SYSTEM_USERNAMES) {
        console.error(`  - ${username}`);
      }
    }
    console.error("");
    console.error("Usage: npm run db:clean -- --confirm [--keep-staff] [--allow-production]");
    process.exit(1);
  }

  console.log(`Cleaning business data for tenant: ${tenantId}`);
  console.log(
    keepAllStaff
      ? "Keeping all staff accounts. Removing tickets, equipment, customers, and other operational data..."
      : "Keeping default admin and staff accounts only...",
  );

  const summary = await cleanTenantBusinessData(tenantId, {
    allowProduction,
    keepAllStaff,
  });

  console.log("");
  console.log("Database cleanup complete.");
  console.log(`  Preserved users: ${summary.preservedUsers}`);
  console.log(`  Removed users:   ${summary.removedUsers}`);
  if (!keepAllStaff) {
    console.log("");
    console.log("Admin login  — username: medical_equment / password: medical@961");
    console.log("Staff logins — coordinator1, inspector1, estimator1, sales1,");
    console.log("               engineer1, engineer2, inventory1, billing1");
    console.log("               password for all staff: demo@123");
  }
}

main()
  .catch((error) => {
    console.error("Database cleanup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
