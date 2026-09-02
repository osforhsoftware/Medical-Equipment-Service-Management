import dotenv from "dotenv";
import path from "path";
import {
  cleanTenantBusinessData,
  DEFAULT_SYSTEM_USERNAMES,
} from "../src/services/databaseCleanup.service";
import { prisma } from "../src/db/prisma";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const tenantId = process.env.DEFAULT_TENANT_ID ?? "tenant_medtech_01";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("db:clean is disabled in production.");
    process.exit(1);
  }

  if (!process.argv.includes("--confirm")) {
    console.error("This command deletes all business data for the default tenant.");
    console.error("Admin and default staff credentials are kept.");
    console.error("");
    console.error("Preserved accounts:");
    for (const username of DEFAULT_SYSTEM_USERNAMES) {
      console.error(`  - ${username}`);
    }
    console.error("");
    console.error("Usage: npm run db:clean -- --confirm");
    process.exit(1);
  }

  console.log(`Cleaning business data for tenant: ${tenantId}`);
  console.log("Keeping default admin and staff accounts only...");

  const summary = await cleanTenantBusinessData(tenantId);

  console.log("");
  console.log("Database cleanup complete.");
  console.log(`  Preserved users: ${summary.preservedUsers}`);
  console.log(`  Removed users:   ${summary.removedUsers}`);
  console.log("");
  console.log("Admin login  — username: medical_equment / password: medical@961");
  console.log("Staff logins — coordinator1, inspector1, estimator1, sales1,");
  console.log("               engineer1, engineer2, inventory1, billing1");
  console.log("               password for all staff: demo@123");
}

main()
  .catch((error) => {
    console.error("Database cleanup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
