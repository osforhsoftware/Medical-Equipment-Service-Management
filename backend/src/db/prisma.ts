import { PrismaClient } from "@prisma/client";
import { env } from "@/config/env";

declare global {
  // Prevent multiple Prisma Client instances in development (hot reload)
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (env.NODE_ENV === "development") {
  global.__prisma = prisma;
}

/** Graceful shutdown — close Prisma connection on process exit. */
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
