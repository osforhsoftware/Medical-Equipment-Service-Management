import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Image, Loader2, Database, Trash2 } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Check, X, UserCog } from "lucide-react";
import { Link } from "react-router-dom";
import { RoleGuard } from "@/components/auth/RoleGuard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type DemoSeedStatus, type BackendUser } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import { RBAC_MODULES, RBAC_ROLES, buildDefaultRbacMatrix } from "@/config/defaultRbac";
import { navItems } from "@/config/nav";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

const DEMO_MODULE_ROWS: { label: string; countKey: keyof DemoSeedStatus["counts"] }[] = [
  { label: "Customers", countKey: "customers" },
  { label: "Equipment & Machines", countKey: "equipment" },
  { label: "Service Requests", countKey: "serviceRequests" },
  { label: "MRI Scanner (Siemens)", countKey: "equipment" },
  { label: "Estimates & Approvals", countKey: "estimates" },
  { label: "Service Jobs", countKey: "serviceJobs" },
  { label: "Inventory", countKey: "inventory" },
  { label: "Suppliers", countKey: "suppliers" },
  { label: "Purchase Orders", countKey: "purchaseOrders" },
  { label: "Stock Transfers", countKey: "stockTransfers" },
  { label: "Billing & Invoicing", countKey: "invoices" },
  { label: "Audit Logs", countKey: "auditLogs" },
  { label: "User Management", countKey: "users" },
];

const AUTOMATION_KEYS = [
  { key: "lowStockAlerts" as const, title: "Low-stock alerts", desc: "Alert when items hit reorder level" },
  { key: "autoReserveOnApproval" as const, title: "Auto-reserve on approval", desc: "Reserve inventory when estimate is approved" },
  { key: "autoGenerateReport" as const, title: "Auto-generate service report", desc: "Create PDF report on job completion" },
];

const NONE = "__none__";

function staffForRole(users: BackendUser[], role: Role) {
  return users.filter((user) => user.role === role || user.roles?.includes(role));
}

const orgSchema = z.object({
  companyName: fieldRules.requiredString("Company name"),
  supportEmail: fieldRules.email(true),
  defaultTaxRate: z.string().refine(
    (v) => !Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100,
    "Enter a tax rate between 0 and 100.",
  ),
});

export default function Settings() {
  const { settings, loading, refresh, updateLocal } = useSettings();
  const [companyName, setCompanyName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [defaultTaxRate, setDefaultTaxRate] = useState("8");
  const [rbacMatrix, setRbacMatrix] = useState<Record<string, Role[]>>(buildDefaultRbacMatrix());
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingRbac, setSavingRbac] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [staffUsers, setStaffUsers] = useState<BackendUser[]>([]);
  const [autoAssignInspectorOnCreate, setAutoAssignInspectorOnCreate] = useState(false);
  const [autoAssignCoordinatorAfterInspection, setAutoAssignCoordinatorAfterInspection] = useState(true);
  const [autoAssignEstimatorAfterInspection, setAutoAssignEstimatorAfterInspection] = useState(true);
  const [autoAssignEngineerOnApproval, setAutoAssignEngineerOnApproval] = useState(false);
  const [defaultCoordinatorUserId, setDefaultCoordinatorUserId] = useState(NONE);
  const [defaultInspectorUserId, setDefaultInspectorUserId] = useState(NONE);
  const [defaultEstimatorUserId, setDefaultEstimatorUserId] = useState(NONE);
  const [defaultEngineerUserId, setDefaultEngineerUserId] = useState(NONE);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [demoStatus, setDemoStatus] = useState<DemoSeedStatus | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(true);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [removingDemo, setRemovingDemo] = useState(false);
  const orgRef = useRef<HTMLDivElement>(null);
  const {
    errors: orgErrors,
    shouldShow: orgShouldShow,
    validateAll: validateOrg,
    handleBlur: handleOrgBlur,
    handleChange: handleOrgChange,
    applyApiErrors: applyOrgApiErrors,
  } = useFormValidation({
    fieldOrder: ["companyName", "supportEmail", "defaultTaxRate"],
    schema: orgSchema,
  });

  const orgValues = () => ({ companyName, supportEmail, defaultTaxRate });

  const loadDemoStatus = async () => {
    setLoadingDemo(true);
    try {
      const status = await api.getDemoSeedStatus();
      setDemoStatus(status);
    } catch {
      setDemoStatus(null);
    } finally {
      setLoadingDemo(false);
    }
  };

  useEffect(() => {
    void loadDemoStatus();
    void api.listUsers({ isActive: true })
      .then(setStaffUsers)
      .catch(() => setStaffUsers([]));
  }, []);

  const handleSeedDemo = async () => {
    setSeedingDemo(true);
    const loadingId = toast.loading("Seeding demo data...");
    try {
      const status = await api.seedDemoData();
      setDemoStatus(status);
      toast.success("Demo data seeded", {
        id: loadingId,
        description: "Sample records are now available across all modules.",
        force: true,
      });
    } catch (err) {
      toast.apiError(err, { id: loadingId, fallback: "Unable to seed demo data", force: true });
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleRemoveDemo = async () => {
    setRemovingDemo(true);
    const loadingId = toast.loading("Removing demo data...");
    try {
      const status = await api.removeDemoData();
      setDemoStatus(status);
      toast.success("Demo data removed", {
        id: loadingId,
        description: "All seeded sample records have been deleted.",
        force: true,
      });
    } catch (err) {
      toast.apiError(err, { id: loadingId, fallback: "Unable to remove demo data", force: true });
    } finally {
      setRemovingDemo(false);
    }
  };

  useEffect(() => {
    if (!settings) return;
    setCompanyName(settings.companyName);
    setSupportEmail(settings.supportEmail);
    setCompanyAddress(settings.companyAddress ?? "");
    setCompanyPhone(settings.companyPhone ?? "");
    setCompanyWebsite(settings.companyWebsite ?? "");
    setLogoUrl(settings.logoUrl ?? "");
    setDefaultTaxRate(String(settings.defaultTaxRate));
    setRbacMatrix(
      Object.fromEntries(
        navItems.map((item) => [
          item.label,
          (settings.rbacMatrix[item.label] ?? item.roles) as Role[],
        ]),
      ),
    );
    setAutoAssignInspectorOnCreate(settings.autoAssignInspectorOnCreate ?? false);
    setAutoAssignCoordinatorAfterInspection(settings.autoAssignCoordinatorAfterInspection ?? true);
    setAutoAssignEstimatorAfterInspection(settings.autoAssignEstimatorAfterInspection ?? true);
    setAutoAssignEngineerOnApproval(settings.autoAssignEngineerOnApproval ?? false);
    setDefaultCoordinatorUserId(settings.defaultCoordinatorUserId ?? NONE);
    setDefaultInspectorUserId(settings.defaultInspectorUserId ?? NONE);
    setDefaultEstimatorUserId(settings.defaultEstimatorUserId ?? NONE);
    setDefaultEngineerUserId(settings.defaultEngineerUserId ?? NONE);
  }, [settings]);

  const saveOrganization = async () => {
    if (!validateOrg(orgValues(), undefined, orgRef.current)) return;
    setSavingOrg(true);
    try {
      let nextLogoFileId: string | undefined;
      if (logoFile) {
        const uploaded = await api.uploadFile(logoFile);
        nextLogoFileId = uploaded.id;
      }
      const updated = await api.updateSettings({
        companyName: companyName.trim(),
        supportEmail: supportEmail.trim(),
        companyAddress: companyAddress.trim() || null,
        companyPhone: companyPhone.trim() || null,
        companyWebsite: companyWebsite.trim() || null,
        ...(nextLogoFileId ? { logoFileId: nextLogoFileId } : {}),
        defaultTaxRate: Number(defaultTaxRate) || 0,
      });
      if (nextLogoFileId && updated.logoFileId !== nextLogoFileId) {
        throw new Error("The server did not persist the tenant logo setting.");
      }
      updateLocal(updated);
      setLogoFile(null);
      toast.success("Organization saved", { description: "Company details updated." });
    } catch (err) {
      if (!applyOrgApiErrors(err, orgRef.current)) {
        toast.apiError(err, { fallback: "Unable to save organization settings" });
      }
    } finally {
      setSavingOrg(false);
    }
  };

  const toggleAutomation = async (key: typeof AUTOMATION_KEYS[number]["key"], value: boolean) => {
    if (!settings) return;
    setTogglingKey(key);
    try {
      const updated = await api.updateSettings({ [key]: value });
      updateLocal(updated);
      toast.success("Automation updated", { description: "Setting saved to the database." });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to save setting" });
    } finally {
      setTogglingKey(null);
    }
  };

  const saveAssignment = async () => {
    setSavingAssignment(true);
    try {
      const updated = await api.updateSettings({
        autoAssignInspectorOnCreate,
        autoAssignCoordinatorAfterInspection,
        autoAssignEstimatorAfterInspection,
        autoAssignEngineerOnApproval,
        defaultCoordinatorUserId: defaultCoordinatorUserId === NONE ? null : defaultCoordinatorUserId,
        defaultInspectorUserId: defaultInspectorUserId === NONE ? null : defaultInspectorUserId,
        defaultEstimatorUserId: defaultEstimatorUserId === NONE ? null : defaultEstimatorUserId,
        defaultEngineerUserId: defaultEngineerUserId === NONE ? null : defaultEngineerUserId,
      });
      updateLocal(updated);
      toast.success("Assignment settings saved", {
        description: "Auto-assign staff will be used on the next inspection, estimate, and job step.",
      });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to save assignment settings" });
    } finally {
      setSavingAssignment(false);
    }
  };

  const toggleRbac = (module: string, role: Role) => {
    setRbacMatrix((prev) => {
      const current = prev[module] ?? [];
      const next = current.includes(role)
        ? current.filter((r) => r !== role)
        : [...current, role];
      return { ...prev, [module]: next };
    });
  };

  const saveRbac = async () => {
    setSavingRbac(true);
    try {
      const updated = await api.updateSettings({ rbacMatrix });
      updateLocal(updated);
      await refresh();
      toast.success("Permissions saved", { description: "Role permissions updated for all users." });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to save permissions" });
    } finally {
      setSavingRbac(false);
    }
  };

  if (loading && !settings) {
    return (
      <RoleGuard roles={["admin"]}>
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading settings…
        </div>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard roles={["admin"]}>
      <div className="space-y-6">
        <PageHeader title="Settings" description="Tenant configuration and role-based access control." />

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Organization</CardTitle>
            <Button size="sm" type="submit" form="org-settings-form" disabled={savingOrg}>
              {savingOrg ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save organization
            </Button>
          </CardHeader>
          <CardContent>
            <form
              id="org-settings-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void saveOrganization();
              }}
            >
              <div ref={orgRef} className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-4 sm:col-span-2">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                    {logoFile ? <img src={URL.createObjectURL(logoFile)} alt="New tenant logo preview" className="h-full w-full object-contain" /> : logoUrl ? <img src={logoUrl} alt="Tenant logo" className="h-full w-full object-contain" /> : <Image className="h-7 w-7 text-muted-foreground" />}
                  </div>
                  <div className="grid flex-1 gap-2">
                    <Label htmlFor="tenant-logo">Tenant logo</Label>
                    <Input id="tenant-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)} />
                    <p className="text-xs text-muted-foreground">Used on estimates, invoices and branded service documents.</p>
                  </div>
                </div>
                <div className="grid gap-2" data-field="companyName">
                  <Label htmlFor="company-name" className={orgShouldShow("companyName") ? "text-destructive" : undefined}>
                    Company name
                    <RequiredMark />
                  </Label>
                  <Input
                    id="company-name"
                    name="companyName"
                    value={companyName}
                    className={fieldErrorClass(orgShouldShow("companyName"))}
                    {...fieldAria("companyName", orgShouldShow("companyName") ? orgErrors.companyName : null)}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCompanyName(value);
                      handleOrgChange("companyName", { companyName: value, supportEmail, defaultTaxRate });
                    }}
                    onBlur={() => handleOrgBlur("companyName", orgValues())}
                  />
                  {orgShouldShow("companyName") && <FormFieldError field="companyName" message={orgErrors.companyName} />}
                </div>
                <div className="grid gap-2">
                  <Label>Tenant ID</Label>
                  <Input readOnly value={settings?.tenantId ?? ""} className="font-mono text-muted-foreground" />
                </div>
                <div className="grid gap-2" data-field="supportEmail">
                  <Label htmlFor="support-email" className={orgShouldShow("supportEmail") ? "text-destructive" : undefined}>
                    Support email
                    <RequiredMark />
                  </Label>
                  <Input
                    id="support-email"
                    name="supportEmail"
                    type="email"
                    value={supportEmail}
                    className={fieldErrorClass(orgShouldShow("supportEmail"))}
                    {...fieldAria("supportEmail", orgShouldShow("supportEmail") ? orgErrors.supportEmail : null)}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSupportEmail(value);
                      handleOrgChange("supportEmail", { companyName, supportEmail: value, defaultTaxRate });
                    }}
                    onBlur={() => handleOrgBlur("supportEmail", orgValues())}
                  />
                  {orgShouldShow("supportEmail") && <FormFieldError field="supportEmail" message={orgErrors.supportEmail} />}
                </div>
                <div className="grid gap-2" data-field="defaultTaxRate">
                  <Label htmlFor="tax-rate" className={orgShouldShow("defaultTaxRate") ? "text-destructive" : undefined}>Default tax rate (%)</Label>
                  <Input
                    id="tax-rate"
                    name="defaultTaxRate"
                    type="number"
                    min={0}
                    max={100}
                    value={defaultTaxRate}
                    className={fieldErrorClass(orgShouldShow("defaultTaxRate"))}
                    {...fieldAria("defaultTaxRate", orgShouldShow("defaultTaxRate") ? orgErrors.defaultTaxRate : null)}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDefaultTaxRate(value);
                      handleOrgChange("defaultTaxRate", { companyName, supportEmail, defaultTaxRate: value });
                    }}
                    onBlur={() => handleOrgBlur("defaultTaxRate", orgValues())}
                  />
                  {orgShouldShow("defaultTaxRate") && <FormFieldError field="defaultTaxRate" message={orgErrors.defaultTaxRate} />}
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="company-address">Company address</Label>
                  <Input
                    id="company-address"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="Shown on invoices and estimates"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company-phone">Company phone</Label>
                  <Input
                    id="company-phone"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="Mob: 98XXXXXXXX"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company-website">Website</Label>
                  <Input
                    id="company-website"
                    value={companyWebsite}
                    onChange={(e) => setCompanyWebsite(e.target.value)}
                    placeholder="www.example.com"
                  />
                  <p className="text-xs text-muted-foreground">Printed on sale and service invoices with your logo and contact details.</p>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Automation</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {AUTOMATION_KEYS.map((s) => (
              <div key={s.key} className="flex items-center justify-between border-b border-border py-3 last:border-0">
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
                <Switch
                  checked={settings?.[s.key] ?? false}
                  disabled={togglingKey === s.key}
                  onCheckedChange={(checked) => void toggleAutomation(s.key, checked)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Service auto-assignment</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                After inspection is submitted, tickets move to Estimate and can be routed automatically to a fixed coordinator and estimate staff. After the estimate is sent, approval continues as usual.
              </p>
            </div>
            <Button size="sm" disabled={savingAssignment} onClick={() => void saveAssignment()}>
              {savingAssignment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save assignment
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {([
              { key: "autoAssignInspectorOnCreate", title: "Auto-assign inspection technician on new ticket", desc: "Use the default inspection technician when a ticket is created without an assignee", value: autoAssignInspectorOnCreate, set: setAutoAssignInspectorOnCreate },
              { key: "autoAssignCoordinatorAfterInspection", title: "Notify / route to service coordinator after inspection", desc: "When inspection is submitted, notify the default service coordinator so they can review and assign work", value: autoAssignCoordinatorAfterInspection, set: setAutoAssignCoordinatorAfterInspection },
              { key: "autoAssignEstimatorAfterInspection", title: "Auto-assign estimate staff after inspection", desc: "When inspection is submitted, assign the default estimate staff and move the ticket to Estimate", value: autoAssignEstimatorAfterInspection, set: setAutoAssignEstimatorAfterInspection },
              { key: "autoAssignEngineerOnApproval", title: "Auto-assign service engineer on estimate approval", desc: "If no engineer is picked at approval, use the default service engineer", value: autoAssignEngineerOnApproval, set: setAutoAssignEngineerOnApproval },
            ] as const).map((item) => (
              <div key={item.key} className="flex items-center justify-between border-b border-border py-3">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch checked={item.value} onCheckedChange={item.set} />
              </div>
            ))}
            <div className="grid gap-4 pt-4 sm:grid-cols-2">
              {([
                { label: "Default service coordinator", value: defaultCoordinatorUserId, set: setDefaultCoordinatorUserId, role: "coordinator" as const },
                { label: "Default inspection technician", value: defaultInspectorUserId, set: setDefaultInspectorUserId, role: "inspector" as const },
                { label: "Default estimate staff", value: defaultEstimatorUserId, set: setDefaultEstimatorUserId, role: "estimator" as const },
                { label: "Default service engineer", value: defaultEngineerUserId, set: setDefaultEngineerUserId, role: "engineer" as const },
              ]).map((field) => {
                const options = staffForRole(staffUsers, field.role);
                return (
                  <div key={field.role} className="grid gap-2">
                    <Label>{field.label}</Label>
                    <Select value={field.value} onValueChange={field.set}>
                      <SelectTrigger>
                        <SelectValue placeholder={options.length ? "Select staff" : "No staff for this role"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {options.map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {options.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No active {roleLabels[field.role]} accounts. Add one in Users first.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Demo Data</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Insert or remove sample records for testing all modules (development only).
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={seedingDemo || loadingDemo}>
                    {seedingDemo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    Seed all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Seed demo data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will insert sample customers, equipment (including MRI Scanner), service requests,
                      estimates, jobs, inventory, suppliers, purchase orders, stock transfers, invoices,
                      audit logs, and demo user accounts. Demo user password: <span className="font-mono">demo@123</span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleSeedDemo()}>Seed all modules</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={removingDemo || loadingDemo || !demoStatus?.seeded}
                  >
                    {removingDemo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Remove all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove all demo data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes all seeded sample records. Your admin account and organization
                      settings are kept.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => void handleRemoveDemo()}
                    >
                      Remove all demo data
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDemo ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading demo data status…
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant={demoStatus?.seeded ? "default" : "secondary"}>
                    {demoStatus?.seeded ? "Demo data active" : "No demo data"}
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {DEMO_MODULE_ROWS.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span>{row.label}</span>
                      <Badge variant="outline" className="font-mono">
                        {row.label === "MRI Scanner (Siemens)"
                          ? demoStatus?.seeded
                            ? "1"
                            : "0"
                          : (demoStatus?.counts[row.countKey] ?? 0)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">User Accounts</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/users">
                <UserCog className="mr-1 h-4 w-4" /> Manage users
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Add staff accounts, assign roles, reset passwords, and remove inactive users from the MySQL database.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">RBAC — Module Access Matrix</CardTitle>
            <Button variant="outline" size="sm" onClick={saveRbac} disabled={savingRbac}>
              {savingRbac ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-medium">Module</th>
                  {RBAC_ROLES.map((r) => (
                    <th key={r} className="px-2 py-2 text-center text-xs font-medium">{roleLabels[r].split(" ")[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RBAC_MODULES.map((module) => (
                  <tr key={module} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-medium">{module}</td>
                    {RBAC_ROLES.map((role) => {
                      const allowed = (rbacMatrix[module] ?? []).includes(role);
                      return (
                        <td key={role} className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRbac(module, role)}
                            className="mx-auto flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
                            aria-label={`Toggle ${role} access for ${module}`}
                          >
                            {allowed ? (
                              <Check className="h-4 w-4 text-success" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground/40" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              <Badge variant="secondary" className="mr-1">Note</Badge>
              Click cells to grant or revoke access. Changes apply to the sidebar for all users after saving.
            </p>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
