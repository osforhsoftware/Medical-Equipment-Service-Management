import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Building2, Loader2, Plus } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { fieldRules } from "@/lib/formValidation";
import { EMPTY_PAGINATION_META } from "@/lib/listing";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { api, type BackendCustomer } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { userCanAccessModule } from "@/lib/userRoles";
import { navItems } from "@/config/nav";
import { activeTerms, termLabel } from "@/lib/taxonomy";

const customerSchema = z
  .object({
    name: fieldRules.requiredString("Customer name"),
    type: fieldRules.selectRequired("a customer type"),
    contactPerson: fieldRules.optionalString(),
    email: fieldRules.email(false),
    phone: fieldRules.phone(true),
    address: fieldRules.requiredString("Site address"),
    city: fieldRules.optionalString(),
    country: fieldRules.optionalString(),
    licenseGst: fieldRules.optionalString(),
    note: z.string().trim().max(5000).optional(),
    status: z.string(),
  });

type FormState = {
  name: string;
  type: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  licenseGst: string;
  note: string;
  status: string;
};

const emptyForm: FormState = {
  name: "",
  type: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  licenseGst: "",
  note: "",
  status: "active",
};

export default function Customers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { rbacMatrix } = useSettings();
  const canManageMasterData = Boolean(
    user && userCanAccessModule(
      user,
      "Master Data",
      rbacMatrix,
      navItems.find((item) => item.label === "Master Data")?.roles,
    ),
  );
  const {
    search,
    setSearch,
    filters,
    setFilter,
    listParams,
    setPage,
    setLimit,
  } = useListingUrlState({ filterKeys: ["status", "type"] });

  const debouncedSearch = useDebouncedValue(search);
  const queryParams = useMemo(
    () => ({ ...listParams, search: debouncedSearch || undefined }),
    [listParams, debouncedSearch],
  );

  const customersQuery = usePaginatedQuery({
    queryKey: "customers",
    params: queryParams,
    queryFn: (params) => api.listCustomers(params),
  });

  const typesQuery = useQuery({
    queryKey: ["taxonomy", "customer_type"],
    queryFn: () => api.listTaxonomy({ type: "customer_type" }),
    staleTime: 30_000,
  });

  const customers = customersQuery.data?.data ?? [];
  const pagination = customersQuery.data?.meta ?? EMPTY_PAGINATION_META;
  const typeTerms = typesQuery.data ?? [];
  const activeTypes = activeTerms(typeTerms);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

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
    fieldOrder: ["name", "type", "email", "phone", "address", "city", "country", "note"],
    schema: customerSchema,
  });

  const loadCustomers = () => void queryClient.invalidateQueries({ queryKey: ["customers"] });

  const typeFilterOptions = typeTerms.map((t) => ({ label: t.name, value: t.slug }));
  const defaultType = activeTypes.find((t) => t.slug === "Hospital")?.slug ?? activeTypes[0]?.slug ?? "";

  const openCreate = () => {
    setForm({ ...emptyForm, type: defaultType });
    resetValidation();
    setDialogOpen(true);
  };

  const saveCustomer = async () => {
    if (!validateAll(form, undefined, dialogRef.current)) return;

    setSaving(true);
    try {
      await api.createCustomer({
        name: form.name.trim(),
        type: form.type,
        contactPerson: form.contactPerson.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        licenseGst: form.licenseGst.trim() || null,
        note: form.note.trim() || null,
        status: form.status,
      });
      toast.success("Customer created successfully", {
        description: `${form.name.trim()} was added successfully.`,
      });
      setDialogOpen(false);
      resetValidation();
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (err) {
      if (!applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to save customer" });
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendCustomer>[] = [
    {
      key: "name",
      header: "Customer",
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.contactPerson}</p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (c) => <span className="text-sm">{termLabel(typeTerms, c.type, c.typeOther)}</span>,
    },
    {
      key: "city",
      header: "Site",
      render: (c) => (
        <div className="text-sm text-muted-foreground">
          <p>{[c.city, c.country].filter(Boolean).join(", ") || "—"}</p>
          {c.address ? <p className="text-xs truncate max-w-[180px]">{c.address}</p> : null}
        </div>
      ),
    },
    {
      key: "email",
      header: "Contact",
      render: (c) => (
        <div className="text-sm">
          <p>{c.email}</p>
          <p className="text-xs text-muted-foreground">{c.phone}</p>
        </div>
      ),
    },
    {
      key: "equipmentCount",
      header: "Equipment",
      render: (c) => <span className="font-medium">{c.equipmentCount}</span>,
    },
    {
      key: "activeJobs",
      header: "Active Jobs",
      render: (c) => <span className="font-medium">{c.activeJobs}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (c) => <StatusBadge status={c.status as "active" | "inactive"} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Parties for product sales and service work."
        actions={
          <Button onClick={openCreate} variant="brand">
            <Plus className="mr-1 h-4 w-4" /> Add Customer
          </Button>
        }
      />

      <DataTable
        mode="server"
        data={customers}
        columns={columns}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search customers…"
        emptyMessage="No customers yet. Add your first customer to get started."
        emptyHint="Try changing your search or filters."
        filterValues={filters}
        onFilterChange={setFilter}
        filters={[
          {
            key: "type",
            label: "Type",
            options: typeFilterOptions,
          },
          {
            key: "status",
            label: "Status",
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
          },
        ]}
        pagination={pagination}
        onPageChange={setPage}
        onLimitChange={setLimit}
        loading={customersQuery.isLoading}
        isFetching={customersQuery.isFetching}
        error={customersQuery.error as Error | null}
        onRetry={() => loadCustomers()}
        onRowClick={(c) => navigate(`/app/customers/${c.id}`)}
      />

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetValidation(); setDialogOpen(open); }}>
        <DialogContent ref={dialogRef} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Add Customer
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2" data-field="name">
              <Label htmlFor="customer-name" className={shouldShow("name") ? "text-destructive" : undefined}>
                Customer name
                <RequiredMark />
              </Label>
              <Input
                id="customer-name"
                value={form.name}
                onChange={(e) => {
                  const next = { ...form, name: e.target.value };
                  setForm(next);
                  handleChange("name", next);
                }}
                onBlur={() => handleBlur("name", form)}
                aria-invalid={shouldShow("name") || undefined}
                aria-describedby={shouldShow("name") ? "name-error" : undefined}
                className={cn(shouldShow("name") && "border-destructive focus-visible:ring-destructive")}
                placeholder="St. Mary's Hospital"
              />
              {shouldShow("name") && <FormFieldError field="name" message={errors.name} />}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2" data-field="type">
                <div className="flex items-center justify-between gap-2">
                  <Label className={shouldShow("type") ? "text-destructive" : undefined}>
                    Type
                    <RequiredMark />
                  </Label>
                  {canManageMasterData ? (
                    <Link to="/app/master-data?type=customer_type" className="text-xs text-primary hover:underline">
                      Manage
                    </Link>
                  ) : null}
                </div>
                <Select
                  value={form.type}
                  onValueChange={(value) => {
                    const next = { ...form, type: value };
                    setForm(next);
                    clearError("type");
                    handleChange("type", next);
                  }}
                >
                  <SelectTrigger
                    id="type"
                    className={cn(shouldShow("type") && "border-destructive focus:ring-destructive")}
                    aria-invalid={shouldShow("type") || undefined}
                  >
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTypes.map((t) => (
                      <SelectItem key={t.id} value={t.slug}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {shouldShow("type") && <FormFieldError field="type" message={errors.type} />}
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-person">Contact person</Label>
              <Input
                id="contact-person"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                placeholder="Dr. Ellen Park"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2" data-field="email">
                <Label htmlFor="email">Email</Label>
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
                  placeholder="facilities@hospital.org"
                />
                {shouldShow("email") && <FormFieldError field="email" message={errors.email} />}
              </div>
              <div className="grid gap-2" data-field="phone">
                <Label htmlFor="phone" className={shouldShow("phone") ? "text-destructive" : undefined}>
                  Phone
                  <RequiredMark />
                </Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => {
                    const next = { ...form, phone: e.target.value };
                    setForm(next);
                    handleChange("phone", next);
                  }}
                  onBlur={() => handleBlur("phone", form)}
                  aria-invalid={shouldShow("phone") || undefined}
                  className={cn(shouldShow("phone") && "border-destructive focus-visible:ring-destructive")}
                  placeholder="+1 512-555-2010"
                />
                {shouldShow("phone") && <FormFieldError field="phone" message={errors.phone} />}
              </div>
            </div>
            <div className="grid gap-2" data-field="address">
              <Label htmlFor="site-address" className={shouldShow("address") ? "text-destructive" : undefined}>
                Site address
                <RequiredMark />
              </Label>
              <Input
                id="site-address"
                value={form.address}
                onChange={(e) => {
                  const next = { ...form, address: e.target.value };
                  setForm(next);
                  handleChange("address", next);
                }}
                onBlur={() => handleBlur("address", form)}
                aria-invalid={shouldShow("address") || undefined}
                className={cn(shouldShow("address") && "border-destructive focus-visible:ring-destructive")}
                placeholder="1200 Medical Center Dr"
              />
              {shouldShow("address") && <FormFieldError field="address" message={errors.address} />}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2" data-field="city">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => {
                    const next = { ...form, city: e.target.value };
                    setForm(next);
                    handleChange("city", next);
                  }}
                  onBlur={() => handleBlur("city", form)}
                  aria-invalid={shouldShow("city") || undefined}
                  className={cn(shouldShow("city") && "border-destructive focus-visible:ring-destructive")}
                  placeholder="Austin"
                />
                {shouldShow("city") && <FormFieldError field="city" message={errors.city} />}
              </div>
              <div className="grid gap-2" data-field="country">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => {
                    const next = { ...form, country: e.target.value };
                    setForm(next);
                    handleChange("country", next);
                  }}
                  onBlur={() => handleBlur("country", form)}
                  aria-invalid={shouldShow("country") || undefined}
                  className={cn(shouldShow("country") && "border-destructive focus-visible:ring-destructive")}
                  placeholder="United States"
                />
                {shouldShow("country") && <FormFieldError field="country" message={errors.country} />}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="license-gst">License / GST number</Label>
              <Input
                id="license-gst"
                value={form.licenseGst}
                onChange={(e) => setForm({ ...form, licenseGst: e.target.value })}
                placeholder="Optional — GST, trade license, or local tax ID"
              />
              <p className="text-xs text-muted-foreground">
                Optional. Use whichever ID applies for this country (GST, license, VAT, etc.).
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customer-note">Note</Label>
              <Textarea
                id="customer-note"
                value={form.note}
                onChange={(e) => {
                  const next = { ...form, note: e.target.value };
                  setForm(next);
                  handleChange("note", next);
                }}
                onBlur={() => handleBlur("note", form)}
                aria-invalid={shouldShow("note") || undefined}
                className={cn(shouldShow("note") && "border-destructive focus-visible:ring-destructive")}
                placeholder="Add any notes or message for this customer (optional)"
                rows={3}
              />
              {shouldShow("note") && <FormFieldError field="note" message={errors.note} />}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCustomer} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
