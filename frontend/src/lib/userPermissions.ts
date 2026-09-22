export type PermissionLevel = "none" | "read" | "crud";
export type PermissionMode = "crud" | "read";

export type UserPermissions = {
  mode: PermissionMode;
  modules: Record<string, PermissionLevel>;
};

const LEVELS = new Set<PermissionLevel>(["none", "read", "crud"]);

export function parseUserPermissions(value: unknown): UserPermissions {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { mode: "crud", modules: {} };
  }
  const raw = value as Record<string, unknown>;
  const mode: PermissionMode = raw.mode === "read" ? "read" : "crud";
  const modules: Record<string, PermissionLevel> = {};
  if (raw.modules && typeof raw.modules === "object" && !Array.isArray(raw.modules)) {
    for (const [key, level] of Object.entries(raw.modules as Record<string, unknown>)) {
      if (LEVELS.has(level as PermissionLevel)) {
        modules[key] = level as PermissionLevel;
      }
    }
  }
  return { mode, modules };
}

export function userMayMutate(user: { role: string; roles?: string[]; permissions?: unknown } | null | undefined): boolean {
  if (!user) return false;
  const roles = user.roles?.length ? user.roles : [user.role];
  if (roles.includes("admin")) return true;
  return parseUserPermissions(user.permissions).mode !== "read";
}

export function moduleAccessLevel(
  user: { permissions?: unknown } | null | undefined,
  module: string,
  roleAllows: boolean,
): PermissionLevel {
  if (!roleAllows) return "none";
  const parsed = parseUserPermissions(user?.permissions);
  const override = parsed.modules[module];
  if (override) {
    if (parsed.mode === "read" && override === "crud") return "read";
    return override;
  }
  return parsed.mode === "read" ? "read" : "crud";
}
