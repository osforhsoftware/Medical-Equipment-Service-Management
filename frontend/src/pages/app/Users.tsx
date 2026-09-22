import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { api, type BackendUser } from "@/lib/api";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { parseUserPermissions } from "@/lib/userPermissions";
import { toast } from "@/lib/toast";

const filterRoles: (Role | "all")[] = [
  "all",
  "admin",
  "coordinator",
  "inspector",
  "estimator",
  "sales",
  "engineer",
  "inventory",
  "billing",
];

function userMatchesRoleFilter(user: BackendUser, roleFilter: Role): boolean {
  const roles = user.roles?.length ? user.roles : [user.role];
  return roles.includes(roleFilter);
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<BackendUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to load users" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteUser(deleteTarget.id);
      toast.success("User deleted successfully", {
        description: `${deleteTarget.name} was removed.`,
      });
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to delete item" });
    } finally {
      setDeleting(false);
    }
  };

  const filtered =
    roleFilter === "all" ? users : users.filter((user) => userMatchesRoleFilter(user, roleFilter));

  return (
    <RoleGuard roles={["admin"]}>
      <div className="space-y-6">
        <PageHeader
          title="User Management"
          description="Create and manage staff accounts. Assign roles and CRUD or read-only permission sets."
          actions={
            <Button asChild variant="brand">
              <Link to="/app/users/new">
                <Plus className="mr-1 h-4 w-4" /> Add User
              </Link>
            </Button>
          }
        />

        <div className="flex flex-wrap gap-2">
          {filterRoles.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                roleFilter === r
                  ? "bg-primary-light text-primary"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "all" ? "All Roles" : roleLabels[r as Role]}
            </button>
          ))}
        </div>

        <Card className="shadow-card">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading users…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-primary/[0.045] text-left">
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Contact</th>
                      <th className="px-4 py-3 font-medium">Job Roles</th>
                      <th className="px-4 py-3 font-medium">Permissions</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => {
                      const displayRoles = (u.roles?.length ? u.roles : [u.role]) as Role[];
                      const accessMode = parseUserPermissions(u.permissions).mode;
                      return (
                        <tr key={u.id} className="border-b border-border last:border-0 transition-colors hover:bg-secondary/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                                style={{ backgroundColor: `hsl(${u.avatarColor})` }}
                              >
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium">{u.name}</p>
                                <p className="font-mono text-xs text-muted-foreground">{u.username}</p>
                                {currentUser?.id === u.id && (
                                  <Badge variant="secondary" className="mt-0.5 text-[10px]">
                                    You
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm">{u.email}</p>
                            {u.phone && (
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" /> {u.phone}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {displayRoles.map((role) => (
                                <Badge
                                  key={role}
                                  variant={role === u.role ? "outline" : "secondary"}
                                  title={role === u.role ? "Primary login role" : undefined}
                                >
                                  {roleLabels[role] ?? role}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={accessMode === "read" ? "secondary" : "outline"}>
                              {accessMode === "read" ? "Read only" : "Full (CRUD)"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={u.isActive ? "active" : "inactive"} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" asChild>
                                <Link to={`/app/users/${u.id}/edit`}>
                                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                                </Link>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={currentUser?.id === u.id}
                                onClick={() => setDeleteTarget(u)}
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          No users found for this role.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete user?"
        description={
          <p>
            This will permanently remove{" "}
            <span className="font-medium text-foreground">{deleteTarget?.name}</span> (
            {deleteTarget?.username}).
          </p>
        }
        confirmLabel="Delete user"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </RoleGuard>
  );
}
