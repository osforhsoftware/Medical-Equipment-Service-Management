import { Prisma } from "@prisma/client";

export type PermissionLevel = "none" | "read" | "crud";
export type PermissionMode = "crud" | "read";

export type UserPermissions = {
  mode: PermissionMode;
  modules: Record<string, PermissionLevel>;
  /** When true, this staff member skips estimate / change / final-work / invoice approval gates. */
  bypassApprovals: boolean;
};

const LEVELS = new Set<PermissionLevel>(["none", "read", "crud"]);

export function parseUserPermissions(value: unknown): UserPermissions {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { mode: "crud", modules: {}, bypassApprovals: true };
  }
  const raw = value as Record<string, unknown>;
  const mode: PermissionMode = raw.mode === "read" ? "read" : "crud";
  const modules: Record<string, PermissionLevel> = {};
  if (raw.modules && typeof raw.modules === "object" && !Array.isArray(raw.modules)) {
    for (const [key, level] of Object.entries(raw.modules as Record<string, unknown>)) {
      if (typeof key === "string" && LEVELS.has(level as PermissionLevel)) {
        modules[key] = level as PermissionLevel;
      }
    }
  }
  return { mode, modules, bypassApprovals: raw.bypassApprovals !== false };
}

export function normalizeUserPermissions(value: unknown): Prisma.InputJsonValue {
  return parseUserPermissions(value) as Prisma.InputJsonValue;
}

/** Whether the user may create / update / delete (global mode). Admin role always may write. */
export function userMayMutate(role: string, permissions: unknown): boolean {
  if (role === "admin") return true;
  return parseUserPermissions(permissions).mode !== "read";
}

export function modulePermissionLevel(
  permissions: unknown,
  module: string,
  fallback: PermissionLevel = "crud",
): PermissionLevel {
  const parsed = parseUserPermissions(permissions);
  const override = parsed.modules[module];
  if (override) {
    if (parsed.mode === "read" && override === "crud") return "read";
    return override;
  }
  return parsed.mode === "read" ? "read" : fallback;
}

export function shouldSkipApprovals(
  tenantSkip: boolean | null | undefined,
  actorPermissions: unknown,
): boolean {
  if (tenantSkip) return true;
  return parseUserPermissions(actorPermissions).bypassApprovals;
}
