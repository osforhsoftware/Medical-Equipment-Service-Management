import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";

export async function getDefaultBranchId(tenantId: string): Promise<string> {
  const branch = await prisma.branch.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!branch) throw new AppError("No branch configured for tenant", 500);
  return branch.id;
}
