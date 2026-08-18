import type { AuditLog } from "@prisma/client";
import { prisma } from "@/db/prisma";
import {
  formatAuditAction,
  formatAuditEntity,
  isLikelyUserId,
} from "@/utils/auditActionLabels";
import { getRoleLabel } from "@/utils/roleLabels";

export interface EnrichedAuditLog extends AuditLog {
  actorName: string;
  roleName: string;
  actionLabel: string;
  entityLabel: string;
}

export class AuditLogsService {
  async enrichLogs(logs: AuditLog[], tenantId: string): Promise<EnrichedAuditLog[]> {
    const actorIds = [...new Set(logs.map((log) => log.actor).filter(isLikelyUserId))];
    const users = actorIds.length
      ? await prisma.user.findMany({
          where: { tenantId, id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userById = new Map(users.map((user) => [user.id, user]));

    return logs.map((log) => {
      const matchedUser = userById.get(log.actor);
      const actorName = matchedUser?.name ?? log.actor;

      return {
        ...log,
        actorName,
        roleName: getRoleLabel(log.role),
        actionLabel: formatAuditAction(log.action, log.entity),
        entityLabel: formatAuditEntity(log.entity),
      };
    });
  }
}

export const auditLogsService = new AuditLogsService();
