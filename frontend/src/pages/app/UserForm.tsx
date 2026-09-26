import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft, Loader2, ShieldCheck, UserCog } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldRules } from "@/lib/formValidation";
import { PageHeader } from "@/components/shared/PageHeader";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/context/SettingsContext";
import { CUSTOMER_PORTAL_ENABLED } from "@/config/features";
import { RBAC_MODULES } from "@/config/defaultRbac";
import { api, type BackendCustomer } from "@/lib/api";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import {
  parseUserPermissions,
  type PermissionLevel,
  type PermissionMode,
} from "@/lib/userPermissions";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const userSchema = z.object({
  name: fieldRules.requiredString("Full name"),
  username: fieldRules.requiredString("Username"),
  email: fieldRules.email(true),
  phone: fieldRules.phone(false),
  password: z.string(),
  selectedRoles: z.array(z.string()),
  primaryRole: z.string(),
  isActive: z.boolean(),
  accessMode: z.enum(["crud", "read"]),
});

const multiAssignableRoles: Role[] = [
  "admin",
  "coordinator",
  "inspector",
  "estimator",
  "sales",
  "engineer",
  "inventory",
  "billing",
  "qa",
];

const roleHints: Partial<Record<Role, string>> = {
  sales: "Record sales, bill and download sale invoices, manage customers, and view service tickets.",
  estimator: "Build and send service estimates from tickets and the catalog, and review inspection reports.",
  billing: "Service-ticket invoices after jobs complete, plus sale invoice billing.",
  inspector: "Run assigned inspections, update tickets, and scan equipment QR.",
  engineer: "Execute assigned jobs, request parts, and scan equipment.",
  inventory: "Manage stock, purchases, transfers, and fulfill sale deliveries.",
  coordinator: "Own service intake, assignments, jobs, QA, and approvals.",
  admin: "Full system access including users, settings, and permission sets.",
  qa: "Perform quality assurance, validate inspections, and approve service tickets.",
};

type FormState = {
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  selectedRoles: Role[];
  primaryRole: Role;
  isActive: boolean;
  accessMode: PermissionMode;
  moduleLevels: Record<string, PermissionLevel>;
  customerId: string;
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
  accessMode: "crud",
  moduleLevels: {},
  customerId: "",
};

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

/** Primary modules that must open when a staff role is selected (never stay Hidden by default). */
const ROLE_CORE_MODULES: Partial<Record<Role, string[]>> = {
  estimator: ["Estimates", "Service Catalog", "Service Tickets", "Customers", "Inspections"],
  qa: ["Service Jobs", "Projects", "Service Tickets", "Inspections", "Equipment"],
  inspector: ["Inspections", "Service Tickets", "Equipment"],
  engineer: ["Service Jobs", "Service Tickets", "Equipment", "Inventory"],
  sales: ["Sales", "Customers", "Service Tickets"],
  billing: ["Billing", "Finance", "Estimates", "Customers", "Purchase"],
  inventory: ["Inventory", "Suppliers", "Purchase"],
  coordinator: ["Service Tickets", "Projects", "Service Jobs", "Customers", "Purchase"],
  admin: ["Dashboard", "Users", "Settings"],
};

function defaultModuleLevels(
  roles: Role[],
  rbacMatrix: Record<string, Role[]>,
  mode: PermissionMode,
  existing?: Record<string, PermissionLevel>,
  previousRoles?: Role[],
): Record<string, PermissionLevel> {
  const next: Record<string, PermissionLevel> = {};
  const defaultLevel: PermissionLevel = mode === "read" ? "read" : "crud";

  for (const module of RBAC_MODULES) {
    const roleAllows = roles.some((role) => (rbacMatrix[module] ?? []).includes(role));
    if (!roleAllows) {
      next[module] = "none";
      continue;
    }

    const prev = existing?.[module];
    const wasAllowed =
      previousRoles === undefined
        ? Boolean(prev && prev !== "none")
        : previousRoles.some((role) => (rbacMatrix[module] ?? []).includes(role));

    // Newly granted by a role change — never keep a stale Hidden/None from a prior role set.
    if (!wasAllowed) {
      next[module] = defaultLevel;
      continue;
    }

    if (prev === "none") {
      next[module] = "none";
      continue;
    }
    if (mode === "read") {
      next[module] = "read";
    } else if (prev === "read" || prev === "crud") {
      next[module] = prev;
    } else {
      next[module] = defaultLevel;
    }
  }

  // When a role is newly added, force its core desk modules open.
  const addedRoles =
    previousRoles === undefined
      ? roles
      : roles.filter((role) => !previousRoles.includes(role));
  for (const role of addedRoles) {
    for (const module of ROLE_CORE_MODULES[role] ?? []) {
      const allowed = roles.some((entry) => (rbacMatrix[module] ?? []).includes(entry));
      if (allowed) next[module] = defaultLevel;
    }
  }

  return next;
}

export default function UserFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { rbacMatrix } = useSettings();
  const formRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<BackendCustomer[]>([]);

  const {
    errors,
    shouldShow,
    reset: resetValidation,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
    clearError,
  } = useFormValidation({
    fieldOrder: ["name", "username", "email", "phone", "password", "selectedRoles", "customerId", "accessMode"],
    schema: userSchema,
    validate: (values) => {
      const fieldErrors: Record<string, string> = {};
      if (values.selectedRoles.length === 0) {
        fieldErrors.selectedRoles = "Select at least one role.";
      }
      if (!isEdit && !values.password.trim()) {
        fieldErrors.password = "Password is required.";
      } else if (values.password.trim() && values.password.length < 8) {
        fieldErrors.password = "Enter at least 8 characters.";
      }
      if (values.selectedRoles.includes("admin") && values.accessMode === "read") {
        fieldErrors.accessMode = "Administrator accounts cannot be read-only.";
      }
      if (values.selectedRoles.includes("customer") && !values.customerId.trim()) {
        fieldErrors.customerId = "Link this portal user to a customer record.";
      }
      return fieldErrors;
    },
  });

  useEffect(() => {
    if (!CUSTOMER_PORTAL_ENABLED) return;
    void api.listCustomers({ page: 1, limit: 200 })
      .then((result) => setCustomers(result.data))
      .catch(() => setCustomers([]));
  }, []);

  // New user: seed module levels from the default role so saves never write Hidden by accident.
  useEffect(() => {
    if (isEdit) return;
    setForm((prev) => ({
      ...prev,
      moduleLevels: defaultModuleLevels(prev.selectedRoles, rbacMatrix, prev.accessMode, prev.moduleLevels, prev.selectedRoles),
    }));
  }, [isEdit, rbacMatrix]);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const user = await api.getUser(id);
        if (cancelled) return;
        const selectedRoles = (user.roles?.length ? user.roles : [user.role]) as Role[];
        const parsed = parseUserPermissions(user.permissions);
        const accessMode = selectedRoles.includes("admin") ? "crud" : parsed.mode;
        setForm({
          name: user.name,
          username: user.username,
          email: user.email,
          phone: user.phone ?? "",
          password: "",
          selectedRoles,
          customerId: user.customerId ?? "",
          primaryRole: user.role as Role,
          isActive: user.isActive,
          accessMode,
          // Pass same roles as previous so intentional Hidden overrides are preserved on load.
          moduleLevels: defaultModuleLevels(selectedRoles, rbacMatrix, accessMode, parsed.modules, selectedRoles),
        });
        resetValidation();
      } catch (err) {
        toast.apiError(err, { fallback: "Failed to load user" });
        navigate("/app/users");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, navigate, rbacMatrix, resetValidation]);

  const isCustomerOnly = form.selectedRoles.length === 1 && form.selectedRoles[0] === "customer";
  const isAdminSelected = form.selectedRoles.includes("admin");

  const visibleModules = useMemo(
    () =>
      RBAC_MODULES.filter((module) =>
        form.selectedRoles.some((role) => (rbacMatrix[module] ?? []).includes(role)),
      ),
    [form.selectedRoles, rbacMatrix],
  );

  const updateSelectedRoles = (role: Role, checked: boolean) => {
    const previousRoles = form.selectedRoles;
    const nextRoles = checked
      ? toggleRoleSelection(previousRoles, role)
      : previousRoles.filter((entry) => entry !== role);
    const safeRoles = nextRoles.length ? nextRoles : previousRoles;
    const primaryRole = safeRoles.includes(form.primaryRole) ? form.primaryRole : safeRoles[0];
    const accessMode: PermissionMode =
      safeRoles.includes("admin") ? "crud" : form.accessMode;
    const next = {
      ...form,
      selectedRoles: safeRoles,
      primaryRole,
      accessMode,
      moduleLevels: defaultModuleLevels(safeRoles, rbacMatrix, accessMode, form.moduleLevels, previousRoles),
    };
    setForm(next);
    clearError("selectedRoles");
    clearError("accessMode");
    handleChange("selectedRoles", next);
  };

  const setAccessMode = (mode: PermissionMode) => {
    if (isAdminSelected && mode === "read") return;
    const next = {
      ...form,
      accessMode: mode,
      moduleLevels: defaultModuleLevels(
        form.selectedRoles,
        rbacMatrix,
        mode,
        form.moduleLevels,
        form.selectedRoles,
      ),
    };
    setForm(next);
    clearError("accessMode");
  };

  const setModuleLevel = (module: string, level: PermissionLevel) => {
    const effective: PermissionLevel =
      form.accessMode === "read" && level === "crud" ? "read" : level;
    setForm({
      ...form,
      moduleLevels: { ...form.moduleLevels, [module]: effective },
    });
  };

  const saveUser = async () => {
    if (!validateAll({ ...form, accessMode: form.accessMode }, undefined, formRef.current)) return;

    setSaving(true);
    try {
      const modules: Record<string, PermissionLevel> = {};
      const fallbackLevel: PermissionLevel = form.accessMode === "read" ? "read" : "crud";
      for (const module of RBAC_MODULES) {
        const roleAllows = form.selectedRoles.some((role) => (rbacMatrix[module] ?? []).includes(role));
        if (!roleAllows) {
          modules[module] = "none";
          continue;
        }
        const level = form.moduleLevels[module] ?? fallbackLevel;
        modules[module] =
          form.accessMode === "read" && level === "crud" ? "read" : level;
      }

      const payload = {
        name: form.name,
        username: form.username,
        email: form.email,
        phone: form.phone || null,
        role: form.primaryRole,
        roles: form.selectedRoles,
        primaryRole: form.primaryRole,
        isActive: form.isActive,
        customerId: isCustomerOnly ? form.customerId || undefined : null,
        permissions: {
          mode: form.accessMode,
          modules,
        },
      };

      if (isEdit && id) {
        await api.updateUser(id, {
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
      navigate("/app/users");
    } catch (err) {
      if (!applyApiErrors(err, formRef.current)) {
        toast.apiError(err, { fallback: "Unable to save user" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard roles={["admin"]}>
      <div className="space-y-6" ref={formRef}>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/users">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to users
            </Link>
          </Button>
        </div>

        <PageHeader
          title={isEdit ? "Edit User" : "Add User"}
          description="Set account details, job roles, and permission access (full CRUD or read-only)."
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading user…
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserCog className="h-4 w-4" /> Account
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2" data-field="name">
                  <Label htmlFor="name" className={shouldShow("name") ? "text-destructive" : undefined}>
                    Full name
                    <RequiredMark />
                  </Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => {
                      const next = { ...form, name: e.target.value };
                      setForm(next);
                      handleChange("name", next);
                    }}
                    onBlur={() => handleBlur("name", form)}
                    aria-invalid={shouldShow("name") || undefined}
                    className={cn(shouldShow("name") && "border-destructive focus-visible:ring-destructive")}
                  />
                  {shouldShow("name") && <FormFieldError field="name" message={errors.name} />}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2" data-field="username">
                    <Label htmlFor="username" className={shouldShow("username") ? "text-destructive" : undefined}>
                      Username
                      <RequiredMark />
                    </Label>
                    <Input
                      id="username"
                      value={form.username}
                      onChange={(e) => {
                        const next = { ...form, username: e.target.value };
                        setForm(next);
                        handleChange("username", next);
                      }}
                      onBlur={() => handleBlur("username", form)}
                      autoComplete="off"
                      aria-invalid={shouldShow("username") || undefined}
                      className={cn(shouldShow("username") && "border-destructive focus-visible:ring-destructive")}
                    />
                    {shouldShow("username") && <FormFieldError field="username" message={errors.username} />}
                  </div>
                  <div className="grid gap-2" data-field="phone">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => {
                        const next = { ...form, phone: e.target.value };
                        setForm(next);
                        handleChange("phone", next);
                      }}
                      onBlur={() => handleBlur("phone", form)}
                      placeholder="+91 99999 00000"
                    />
                    {shouldShow("phone") && <FormFieldError field="phone" message={errors.phone} />}
                  </div>
                </div>

                <div className="grid gap-2" data-field="email">
                  <Label htmlFor="email" className={shouldShow("email") ? "text-destructive" : undefined}>
                    Email
                    <RequiredMark />
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => {
                      const next = { ...form, email: e.target.value };
                      setForm(next);
                      handleChange("email", next);
                    }}
                    onBlur={() => handleBlur("email", form)}
                    aria-invalid={shouldShow("email") || undefined}
                    className={cn(shouldShow("email") && "border-destructive focus-visible:ring-destructive")}
                  />
                  {shouldShow("email") && <FormFieldError field="email" message={errors.email} />}
                </div>

                <div className="grid gap-2" data-field="password">
                  <Label htmlFor="password" className={shouldShow("password") ? "text-destructive" : undefined}>
                    {isEdit ? "New password (optional)" : "Password"}
                    {!isEdit ? <RequiredMark /> : null}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => {
                      const next = { ...form, password: e.target.value };
                      setForm(next);
                      handleChange("password", next);
                    }}
                    onBlur={() => handleBlur("password", form)}
                    aria-invalid={shouldShow("password") || undefined}
                    className={cn(shouldShow("password") && "border-destructive focus-visible:ring-destructive")}
                  />
                  {shouldShow("password") && <FormFieldError field="password" message={errors.password} />}
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Active account</p>
                    <p className="text-xs text-muted-foreground">Inactive users cannot log in</p>
                  </div>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-base">
                    Job roles
                    <RequiredMark />
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Select all roles this staff member can perform. Example: Service Coordinator + Estimate Staff.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3" data-field="selectedRoles">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {multiAssignableRoles.map((role) => (
                      <label
                        key={role}
                        className="flex items-start gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={form.selectedRoles.includes(role)}
                          onCheckedChange={(checked) => updateSelectedRoles(role, checked === true)}
                        />
                        <span>
                          <span className="block font-medium">{roleLabels[role]}</span>
                          {roleHints[role] ? (
                            <span className="block text-xs text-muted-foreground">{roleHints[role]}</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                  {CUSTOMER_PORTAL_ENABLED ? (
                    <label className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm">
                      <Checkbox
                        checked={form.selectedRoles.includes("customer")}
                        onCheckedChange={(checked) => updateSelectedRoles("customer", checked === true)}
                      />
                      <span>{roleLabels.customer} (portal only — cannot combine with staff roles)</span>
                    </label>
                  ) : null}
                  {CUSTOMER_PORTAL_ENABLED && isCustomerOnly ? (
                    <div className="grid gap-2" data-field="customerId">
                      <Label className={shouldShow("customerId") ? "text-destructive" : undefined}>
                        Linked customer <RequiredMark />
                      </Label>
                      <Select
                        value={form.customerId || undefined}
                        onValueChange={(value) => {
                          const next = { ...form, customerId: value };
                          setForm(next);
                          clearError("customerId");
                          handleChange("customerId", next);
                        }}
                      >
                        <SelectTrigger id="customerId">
                          <SelectValue placeholder="Select customer record" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name} · {customer.reference}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {shouldShow("customerId") && <FormFieldError field="customerId" message={errors.customerId} />}
                    </div>
                  ) : null}
                  {shouldShow("selectedRoles") && (
                    <FormFieldError field="selectedRoles" message={errors.selectedRoles} />
                  )}

                  {!isCustomerOnly && form.selectedRoles.length > 1 ? (
                    <div className="grid gap-2 pt-2">
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
                        Used for the profile label and default dashboard. All selected roles still grant module access.
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {!isCustomerOnly ? (
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldCheck className="h-4 w-4" /> Permission set
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Choose full CRUD (create, edit, update, delete) or read-only. Admin can set this per user.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4" data-field="accessMode">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setAccessMode("crud")}
                        className={cn(
                          "rounded-lg border px-3 py-3 text-left transition-colors",
                          form.accessMode === "crud"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/40",
                        )}
                      >
                        <p className="text-sm font-medium">Full access (CRUD)</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Create, edit, update, and delete where the role allows.
                        </p>
                      </button>
                      <button
                        type="button"
                        disabled={isAdminSelected}
                        onClick={() => setAccessMode("read")}
                        className={cn(
                          "rounded-lg border px-3 py-3 text-left transition-colors",
                          form.accessMode === "read"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/40",
                          isAdminSelected && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <p className="text-sm font-medium">Read only</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          View allowed modules; cannot create, edit, or delete.
                        </p>
                      </button>
                    </div>
                    {shouldShow("accessMode") && (
                      <FormFieldError field="accessMode" message={errors.accessMode} />
                    )}
                    {isAdminSelected ? (
                      <p className="text-xs text-muted-foreground">
                        Administrator role always keeps full access.
                      </p>
                    ) : null}

                    <div className="overflow-x-auto rounded-md border border-border">
                      <table className="w-full min-w-[420px] text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30 text-left">
                            <th className="px-3 py-2 font-medium">Module</th>
                            <th className="px-3 py-2 font-medium">Access</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleModules.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">
                                Select a staff role to see modules.
                              </td>
                            </tr>
                          ) : (
                            visibleModules.map((module) => {
                              const level = form.moduleLevels[module] ?? (form.accessMode === "read" ? "read" : "crud");
                              return (
                                <tr key={module} className="border-b border-border last:border-0">
                                  <td className="px-3 py-2">
                                    <span className="font-medium">{module}</span>
                                    {level === "none" ? (
                                      <Badge variant="secondary" className="ml-2 text-[10px]">
                                        Hidden
                                      </Badge>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Select
                                      value={level}
                                      onValueChange={(value) => setModuleLevel(module, value as PermissionLevel)}
                                    >
                                      <SelectTrigger className="h-8 w-[140px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        <SelectItem value="read">Read only</SelectItem>
                                        <SelectItem value="crud" disabled={form.accessMode === "read"}>
                                          CRUD
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Module list comes from the selected roles and Settings RBAC matrix. None hides the menu item;
                      Read only blocks create/edit/delete; CRUD allows changes.
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        )}

        {!loading ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" asChild>
              <Link to="/app/users">Cancel</Link>
            </Button>
            <Button onClick={() => void saveUser()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Save changes" : "Create user"}
            </Button>
          </div>
        ) : null}
      </div>
    </RoleGuard>
  );
}
