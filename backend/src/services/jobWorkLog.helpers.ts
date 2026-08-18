import type { Prisma } from "@prisma/client";

type WorkLogClient = Prisma.TransactionClient | typeof import("@/db/prisma").prisma;

function workLogMinutes(startedAt: Date, endedAt: Date) {
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
}

export async function findOpenWorkLog(
  db: WorkLogClient,
  tenantId: string,
  jobId: string,
  userId: string,
) {
  return db.jobWorkLog.findFirst({
    where: { tenantId, jobId, userId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
}

export async function startWorkLog(
  db: WorkLogClient,
  tenantId: string,
  jobId: string,
  userId: string,
  workPerformed: string,
) {
  const open = await findOpenWorkLog(db, tenantId, jobId, userId);
  if (open) return open;
  return db.jobWorkLog.create({
    data: { tenantId, jobId, userId, startedAt: new Date(), workPerformed, minutes: 0 },
  });
}

export async function closeWorkLog(
  db: WorkLogClient,
  tenantId: string,
  jobId: string,
  userId: string,
  appendNote?: string,
) {
  const open = await findOpenWorkLog(db, tenantId, jobId, userId);
  if (!open) return null;
  const endedAt = new Date();
  const workPerformed = appendNote?.trim()
    ? `${open.workPerformed}\n${appendNote.trim()}`
    : open.workPerformed;
  return db.jobWorkLog.update({
    where: { id: open.id },
    data: { endedAt, minutes: workLogMinutes(open.startedAt, endedAt), workPerformed },
  });
}

export async function closeAllOpenWorkLogs(
  db: WorkLogClient,
  tenantId: string,
  jobId: string,
  appendNote?: string,
) {
  const openLogs = await db.jobWorkLog.findMany({
    where: { tenantId, jobId, endedAt: null },
    orderBy: { startedAt: "asc" },
  });
  const endedAt = new Date();
  await Promise.all(
    openLogs.map((log) => {
      const workPerformed = appendNote?.trim()
        ? `${log.workPerformed}\n${appendNote.trim()}`
        : log.workPerformed;
      return db.jobWorkLog.update({
        where: { id: log.id },
        data: { endedAt, minutes: workLogMinutes(log.startedAt, endedAt), workPerformed },
      });
    }),
  );
}

export function resolveWorkLogUserId(job: { engineerId: string | null }, actorId?: string) {
  return actorId ?? job.engineerId ?? null;
}
