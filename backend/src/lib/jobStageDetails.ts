import { Prisma } from "@prisma/client";

export type JobQaStage = {
  result?: "pass" | "fail";
  notes?: string | null;
  checkedAt?: string | null;
  checkedBy?: string | null;
};

export type JobDeliveryStage = {
  method?: string | null;
  note?: string | null;
  receivedBy?: string | null;
  deliveredAt?: string | null;
  confirmedBy?: string | null;
};

export type JobStageDetails = {
  qa?: JobQaStage;
  delivery?: JobDeliveryStage;
};

function trimOrNull(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

export function parseJobStageDetails(value: unknown): JobStageDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const qaRaw = raw.qa && typeof raw.qa === "object" && !Array.isArray(raw.qa) ? (raw.qa as Record<string, unknown>) : null;
  const deliveryRaw =
    raw.delivery && typeof raw.delivery === "object" && !Array.isArray(raw.delivery)
      ? (raw.delivery as Record<string, unknown>)
      : null;

  const qa: JobQaStage | undefined = qaRaw
    ? {
        result: qaRaw.result === "pass" || qaRaw.result === "fail" ? qaRaw.result : undefined,
        notes: trimOrNull(qaRaw.notes, 2000) ?? null,
        checkedAt: typeof qaRaw.checkedAt === "string" ? qaRaw.checkedAt : null,
        checkedBy: typeof qaRaw.checkedBy === "string" ? qaRaw.checkedBy : null,
      }
    : undefined;

  const delivery: JobDeliveryStage | undefined = deliveryRaw
    ? {
        method: trimOrNull(deliveryRaw.method, 80) ?? null,
        note: trimOrNull(deliveryRaw.note, 2000) ?? null,
        receivedBy: trimOrNull(deliveryRaw.receivedBy, 120) ?? null,
        deliveredAt: typeof deliveryRaw.deliveredAt === "string" ? deliveryRaw.deliveredAt : null,
        confirmedBy: typeof deliveryRaw.confirmedBy === "string" ? deliveryRaw.confirmedBy : null,
      }
    : undefined;

  return {
    ...(qa ? { qa } : {}),
    ...(delivery ? { delivery } : {}),
  };
}

export function mergeJobStageDetails(
  existing: unknown,
  patch: JobStageDetails | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (patch === null) return Prisma.JsonNull;
  if (patch === undefined) {
    const parsed = parseJobStageDetails(existing);
    return Object.keys(parsed).length ? (parsed as Prisma.InputJsonValue) : Prisma.JsonNull;
  }
  const base = parseJobStageDetails(existing);
  const next: JobStageDetails = {
    qa: patch.qa ? { ...base.qa, ...patch.qa } : base.qa,
    delivery: patch.delivery ? { ...base.delivery, ...patch.delivery } : base.delivery,
  };
  if (!next.qa && !next.delivery) return Prisma.JsonNull;
  return next as Prisma.InputJsonValue;
}
