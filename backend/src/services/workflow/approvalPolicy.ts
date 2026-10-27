import { shouldSkipApprovals } from "@/lib/userPermissions";
import { settingsRepository } from "@/repositories/settings.repository";
import { usersRepository } from "@/repositories/users.repository";

export { shouldSkipApprovals };

/** Tenant simple mode or this actor's bypass flag. */
export async function actorSkipsApprovals(tenantId: string, actorId?: string | null): Promise<boolean> {
  if (await settingsRepository.getSkipApprovals(tenantId)) return true;
  if (!actorId) return false;
  const user = await usersRepository.findById(actorId, tenantId);
  return shouldSkipApprovals(false, user?.permissions);
}
