import { useEffect, useState } from "react";
import { Loader2, Pencil, Phone, Plus, Trash2, UserCog } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { api, type BackendUser } from "@/lib/api";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { toast } from "@/lib/toast";

const staffRoles: Role[] = ["admin", "coordinator", "inspector", "estimator", "engineer", "inventory", "billing", "customer"];
const filterRoles: (Role | "all")[] = ["all", "admin", "coordinator", "inspector", "estimator", "engineer", "inventory", "billing"];
const multiAssignableRoles: Role[] = ["admin", "coordinator", "inspector", "estimator", "engineer", "inventory", "billing"];

type FormState = {
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  selectedRoles: Role[];
  primaryRole: Role;
  isActive: boolean;
};

const emptyForm: FormState = {
  name: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  selectedRoles: ["coordinator"],
  primaryRole: "coordinator",
  isActive: true,
};

function userMatchesRoleFilter(user: BackendUser, roleFilter: Role): boolean {
  const roles = user.roles?.length ? user.roles : [user.role];
  return roles.includes(roleFilter);
}

function toggleRoleSelection(current: Role[], role: Role): Role[] {
  if (role === "customer") {
    return current.includes("customer") ? [] : ["customer"];
  }

  const withoutCustomer = current.filter((entry) => entry !== "customer");
  if (withoutCustomer.includes(role)) {
    const next = withoutCustomer.filter((entry) => entry !== role);
    return next.length ? next : withoutCustomer;
  }
  return [...withoutCustomer, role];
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BackendUser | null>(null);
  const [editing, setEditing] = useState<BackendUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (target: BackendUser) => {
    const selectedRoles = (target.roles?.length ? target.roles : [target.role]) as Role[];
    setEditing(target);
    setForm({
      name: target.name,
      username: target.username,
      email: target.email,
      phone: target.phone ?? "",
      password: "",
      selectedRoles,
      primaryRole: target.role as Role,
      isActive: target.isActive,
    });
    setDialogOpen(true);
  };

  const updateSelectedRoles = (role: Role, checked: boolean) => {
    setForm((prev) => {
      const nextRoles = checked
        ? toggleRoleSelection(prev.selectedRoles, role)
        : prev.selectedRoles.filter((entry) => entry !== role);
      const safeRoles = nextRoles.length ? nextRoles : prev.selectedRoles;
      const primaryRole = safeRoles.includes(prev.primaryRole) ? prev.primaryRole : safeRoles[0];
      return { ...prev, selectedRoles: safeRoles, primaryRole };
    });
  };

  const saveUser = async () => {
    if (form.selectedRoles.length === 0) {
      toast.warning("Please select at least one role");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        username: form.username,
        email: form.email,
        phone: form.phone || null,
        role: form.primaryRole,
        roles: form.selectedRoles,
        primaryRole: form.primaryRole,
        isActive: form.isActive,
      };

      if (editing) {
        await api.updateUser(editing.id, {
          ...payload,
          ...(form.password ? { password: form.password } : {}),
        });
        toast.success("User updated successfully", {
          description: `${form.name} was updated successfully.`,
        });
      } else {
        await api.createUser({
          ...payload,
          phone: form.phone || undefined,
          password: form.password,
        });
        toast.success("User added successfully", {
          description: `${form.name} can now sign in.`,
        });
      }
      setDialogOpen(false);
      await loadUsers();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to save user" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteUser(deleteTarget.id);
      toast.success("User deleted successfully", {
        description: `${deleteTarget.name} was removed.`,
      });
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to delete item" });
    }
  };

  const filtered =
    roleFilter === "all" ? users : users.filter((user) => userMatchesRoleFilter(user, roleFilter));

  const isCustomerOnly = form.selectedRoles.length === 1 && form.selectedRoles[0] === "customer";

  return (
    <RoleGuard roles={["admin"]}>
      <div className="space-y-6">
        <PageHeader
          title="User Management"
          description="Create and manage staff accounts. Assign one or more job roles per person — e.g. Service Coordinator + Estimate Staff."
          actions={
            <Button onClick={openCreate} variant="brand">
              <Plus className="mr-1 h-4 w-4" /> Add User
            </Button>
          }
        />

        <div className="flex flex-wrap gap-2">
          {filterRoles.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                roleFilter === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
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
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-primary/[0.045] text-left">
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Contact</th>
                      <th className="px-4 py-3 font-medium">Job Roles</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => {
                      const displayRoles = (u.roles?.length ? u.roles : [u.role]) as Role[];
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
                                <p className="text-xs text-muted-foreground font-mono">{u.username}</p>
                                {currentUser?.id === u.id && (
                                  <Badge variant="secondary" className="mt-0.5 text-[10px]">You</Badge>
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
                            <StatusBadge status={u.isActive ? "active" : "inactive"} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
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
                        <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" /> {editing ? "Edit User" : "Add User"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 99999 00000"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Job roles</p>
                <p className="text-xs text-muted-foreground">
                  Select all roles this staff member can perform. Example: Service Coordinator + Estimate Staff.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {multiAssignableRoles.map((role) => (
                  <label key={role} className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.selectedRoles.includes(role)}
                      onCheckedChange={(checked) => updateSelectedRoles(role, checked === true)}
                    />
                    <span>{roleLabels[role]}</span>
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm">
                <Checkbox
                  checked={form.selectedRoles.includes("customer")}
                  onCheckedChange={(checked) => updateSelectedRoles("customer", checked === true)}
                />
                <span>{roleLabels.customer} (portal only — cannot combine with staff roles)</span>
              </label>
            </div>

            {!isCustomerOnly && form.selectedRoles.length > 1 ? (
              <div className="grid gap-2">
                <Label htmlFor="primaryRole">Primary login role</Label>
                <Select
                  value={form.primaryRole}
                  onValueChange={(value) => setForm({ ...form, primaryRole: value as Role })}
                >
                  <SelectTrigger id="primaryRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {form.selectedRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabels[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used for the profile label and default dashboard view. All selected roles still grant module access.
                </p>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="password">{editing ? "New password (optional)" : "Password"}</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editing}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Active Account</p>
                <p className="text-xs text-muted-foreground">Inactive users cannot log in</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveUser} disabled={saving || form.selectedRoles.length === 0}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.name}</strong> ({deleteTarget?.username}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleGuard>
  );
}
