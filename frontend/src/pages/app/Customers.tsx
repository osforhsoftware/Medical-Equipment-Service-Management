import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Building2, Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { EquipmentFormDialog } from "@/components/equipment/EquipmentFormDialog";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { GuidedNextStepDialog } from "@/components/shared/GuidedNextStepDialog";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { CustomerAdditionalFieldsEditor } from "@/components/customers/CustomerAdditionalFieldsEditor";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { fieldRules } from "@/lib/formValidation";
import { sanitizeCustomerAdditionalFields, type CustomerAdditionalField } from "@/lib/customerFields";
import { EMPTY_PAGINATION_META } from "@/lib/listing";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
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
import { api, type BackendCustomer, type BackendEquipment } from "@/lib/api";
import {
  customerSiteLocation,
  isGuidedSetupEnabled,
  serviceTicketPrefillPath,
  ticketDescriptionFromEquipment,
} from "@/lib/guidedSetup";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { CUSTOMER_WRITE_ROLES, TICKET_CREATE_ROLES } from "@/config/roles";
import { userCanAccessModule } from "@/lib/userRoles";
import { navItems } from "@/config/nav";
import { activeTerms, termLabel } from "@/lib/taxonomy";

const customerSchema = z
  .object({
    name: fieldRules.requiredString("Customer name"),
    type: fieldRules.optionalString(),
    contactPerson: fieldRules.optionalString(),
    email: fieldRules.email(false),
    phone: fieldRules.phone(false),
    address: fieldRules.optionalString(),
    city: fieldRules.optionalString(),
    country: fieldRules.optionalString(),
    licenseGst: fieldRules.optionalString(),
    paymentTerms: fieldRules.optionalString(),
    creditLimit: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || (!Number.isNaN(Number(value)) && Number(value) >= 0), "Enter a valid credit limit"),
    priceCategory: fieldRules.optionalString(),
    deliveryAddress: fieldRules.optionalString(),
    note: z.string().trim().max(5000).optional(),
    restrictions: z.string().trim().max(5000).optional(),
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
  paymentTerms: string;
  creditLimit: string;
  priceCategory: string;
  deliveryAddress: string;
  note: string;
  restrictions: string;
  status: string;
  additionalFields: CustomerAdditionalField[];
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
  paymentTerms: "",
  creditLimit: "",
  priceCategory: "",
  deliveryAddress: "",
  note: "",
  restrictions: "",
  status: "active",
  additionalFields: [{ label: "", value: "" }],
};

export default function Customers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const { rbacMatrix, settings } = useSettings();
  const canCreate = hasRole(CUSTOMER_WRITE_ROLES);
  const canRegisterEquipment = hasRole(["admin", "coordinator", "inventory"]);
  const canCreateTicket = hasRole(TICKET_CREATE_ROLES);
  const guidedSetup = isGuidedSetupEnabled(settings);
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
  const [nextReference, setNextReference] = useState("");
  const [loadingReference, setLoadingReference] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BackendCustomer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [equipmentPrompt, setEquipmentPrompt] = useState<BackendCustomer | null>(null);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [equipmentPrefill, setEquipmentPrefill] = useState<{
    customerId: string;
    customerName: string;
    location: string;
  } | null>(null);
  const [ticketPrompt, setTicketPrompt] = useState<BackendEquipment | null>(null);
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
    fieldOrder: [
      "name",
      "type",
      "email",
      "phone",
      "address",
      "city",
      "country",
      "paymentTerms",
      "creditLimit",
      "priceCategory",
      "note",
      "restrictions",
    ],
    schema: customerSchema,
  });

  const loadCustomers = () => void queryClient.invalidateQueries({ queryKey: ["customers"] });

  const typeFilterOptions = typeTerms.map((t) => ({ label: t.name, value: t.slug }));

  const openCreate = async () => {
    if (!canCreate) return;
    setForm({ ...emptyForm, additionalFields: [{ label: "", value: "" }] });
    setNextReference("");
    resetValidation();
    setDialogOpen(true);
    setLoadingReference(true);
    try {
      const { reference } = await api.previewCustomerReference();
      setNextReference(reference);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to generate customer ID" });
    } finally {
      setLoadingReference(false);
    }
  };

  const saveCustomer = async () => {
    if (!validateAll(form, undefined, dialogRef.current)) return;

    setSaving(true);
    try {
      const creditLimitValue = form.creditLimit.trim();
      const created = await api.createCustomer({
        name: form.name.trim(),
        type: form.type.trim(),
        contactPerson: form.contactPerson.trim() || form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        licenseGst: form.licenseGst.trim() || null,
        paymentTerms: form.paymentTerms.trim() || null,
        creditLimit: creditLimitValue ? Number(creditLimitValue) : null,
        priceCategory: form.priceCategory.trim() || null,
        deliveryAddress: form.address.trim() || null,
        additionalFields: sanitizeCustomerAdditionalFields(form.additionalFields),
        note: form.note.trim() || null,
        restrictions: form.restrictions.trim() || null,
        status: form.status,
      });
      toast.success("Customer created successfully", {
        description: `${created.reference} · ${created.name}`,
      });
      setDialogOpen(false);
      resetValidation();
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["customers", "options"] });
      if (guidedSetup && canRegisterEquipment) {
        setEquipmentPrompt(created);
      }
    } catch (err) {
      if (!applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to save customer" });
      }
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (customer: BackendCustomer) => {
    setDeleteTarget(customer);
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteCustomer(deleteTarget.id);
      toast.success("Customer removed", {
        description: `${deleteTarget.name} is inactive. Related equipment and jobs remain available for history.`,
      });
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to remove customer" });
    } finally {
      setDeleting(false);
    }
  };

  const restoreCustomer = async (customer: BackendCustomer) => {
    setRestoringId(customer.id);
    try {
      await api.restoreCustomer(customer.id);
      toast.success("Customer restored", {
        description: `${customer.name} is active again.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to restore customer" });
    } finally {
      setRestoringId(null);
    }
  };

  const columns: Column<BackendCustomer>[] = [
    {
      key: "reference",
      header: "Customer ID",
      render: (c) => <span className="font-mono text-xs text-muted-foreground">{c.reference}</span>,
    },
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
    ...(canCreate
      ? [
          {
            key: "actions" as keyof BackendCustomer,
            header: "Actions",
            className: "w-[1%] whitespace-nowrap text-right",
            render: (c: BackendCustomer) => (
              <div
                className="flex items-center justify-end gap-1"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/app/customers/${c.id}?edit=1`)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                {c.status === "inactive" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={restoringId === c.id}
                    onClick={() => void restoreCustomer(c)}
                  >
                    {restoringId === c.id ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    )}
                    Restore
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => openDelete(c)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
            ),
          } satisfies Column<BackendCustomer>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Parties for product sales and service work."
        actions={
          canCreate ? (
            <Button onClick={openCreate} variant="brand">
              <Plus className="mr-1 h-4 w-4" /> Add Customer
            </Button>
          ) : undefined
        }
      />  

      <DataTable
        mode="server"
        data={customers}
        columns={columns}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search customers…"
        emptyMessage={canCreate ? "No customers yet. Add your first customer to get started." : "No customers yet."}
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

      <Dialog open={canCreate && dialogOpen} onOpenChange={(open) => { if (!open) resetValidation(); setDialogOpen(open); }}>
        <DialogContent ref={dialogRef} className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Add Customer
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="customer-reference">Customer ID</Label>
              <Input
                id="customer-reference"
                readOnly
                value={loadingReference ? "Generating…" : nextReference}
                className="bg-muted font-mono text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Auto-generated unique code assigned when you save.
              </p>
            </div>
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
                onBlur={(e) => handleBlur("name", { ...form, name: e.target.value })}
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
                  </Label>
                  {canManageMasterData ? (
                    <Link to="/app/master-data?type=customer_type" className="text-xs text-primary hover:underline">
                      Manage
                    </Link>
                  ) : null}
                </div>
                <Select
                  value={form.type || "__none__"}
                  onValueChange={(value) => {
                    const next = { ...form, type: value === "__none__" ? "" : value };
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
                    <SelectValue placeholder="Select type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not specified</SelectItem>
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
                Billing & delivery addresses
              </Label>
              <Input
                id="site-address"
                value={form.address}
                onChange={(e) => {
                  const next = { ...form, address: e.target.value, deliveryAddress: e.target.value };
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
              <Label htmlFor="license-gst">License / GST / VAT (TRN)</Label>
              <Input
                id="license-gst"
                value={form.licenseGst}
                onChange={(e) => setForm({ ...form, licenseGst: e.target.value })}
                placeholder="Optional — GST, trade license, VAT, TRN"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2" data-field="paymentTerms">
                <Label htmlFor="payment-terms">Payment terms</Label>
                <Input
                  id="payment-terms"
                  value={form.paymentTerms}
                  onChange={(e) => {
                    const next = { ...form, paymentTerms: e.target.value };
                    setForm(next);
                    handleChange("paymentTerms", next);
                  }}
                  onBlur={() => handleBlur("paymentTerms", form)}
                  placeholder="e.g. Net 30"
                />
              </div>
              <div className="grid gap-2" data-field="priceCategory">
                <Label htmlFor="price-category">Price category</Label>
                <Input
                  id="price-category"
                  value={form.priceCategory}
                  onChange={(e) => {
                    const next = { ...form, priceCategory: e.target.value };
                    setForm(next);
                    handleChange("priceCategory", next);
                  }}
                  onBlur={() => handleBlur("priceCategory", form)}
                  placeholder="e.g. Hospital / Dealer"
                />
              </div>
            </div>
            <div className="grid gap-2" data-field="creditLimit">
              <Label htmlFor="credit-limit">Credit limit</Label>
              <Input
                id="credit-limit"
                type="number"
                min={0}
                step="0.01"
                value={form.creditLimit}
                onChange={(e) => {
                  const next = { ...form, creditLimit: e.target.value };
                  setForm(next);
                  handleChange("creditLimit", next);
                }}
                onBlur={() => handleBlur("creditLimit", form)}
                aria-invalid={shouldShow("creditLimit") || undefined}
                className={cn(shouldShow("creditLimit") && "border-destructive focus-visible:ring-destructive")}
                placeholder="Optional"
              />
              {shouldShow("creditLimit") && <FormFieldError field="creditLimit" message={errors.creditLimit} />}
            </div>
            <CustomerAdditionalFieldsEditor
              value={form.additionalFields}
              onChange={(additionalFields) => setForm({ ...form, additionalFields })}
              disabled={saving}
            />
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
            <div className="grid gap-2">
              <Label htmlFor="customer-restrictions">Service restrictions</Label>
              <Textarea
                id="customer-restrictions"
                value={form.restrictions}
                onChange={(e) => {
                  const next = { ...form, restrictions: e.target.value };
                  setForm(next);
                  handleChange("restrictions", next);
                }}
                onBlur={() => handleBlur("restrictions", form)}
                placeholder="Site rules the technician must follow (optional)"
                rows={3}
              />
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

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) closeDelete();
        }}
        title="Remove customer?"
        description={
          <div className="space-y-2">
            <p>
              This soft-removes{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span> (
              {deleteTarget?.reference}). The record is marked inactive — not permanently erased.
            </p>
            <p>
              Related work stays linked for history
              {deleteTarget
                ? `: ${deleteTarget.equipmentCount} equipment · ${deleteTarget.activeJobs} active jobs`
                : ""}
              . Existing jobs, estimates, invoices, and sales are not deleted.
            </p>
          </div>
        }
        confirmLabel="Remove customer"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />

      <GuidedNextStepDialog
        open={Boolean(equipmentPrompt)}
        step="equipment"
        subjectName={equipmentPrompt?.name ?? "this customer"}
        onConfirm={() => {
          if (!equipmentPrompt) return;
          setEquipmentPrefill({
            customerId: equipmentPrompt.id,
            customerName: equipmentPrompt.name,
            location: customerSiteLocation(equipmentPrompt),
          });
          setEquipmentPrompt(null);
          setEquipmentDialogOpen(true);
        }}
        onSkip={() => setEquipmentPrompt(null)}
      />

      <EquipmentFormDialog
        open={equipmentDialogOpen}
        onOpenChange={(open) => {
          setEquipmentDialogOpen(open);
          if (!open) setEquipmentPrefill(null);
        }}
        defaultCustomerId={equipmentPrefill?.customerId}
        defaultCustomerName={equipmentPrefill?.customerName}
        defaultLocation={equipmentPrefill?.location}
        onSaved={(saved) => {
          void queryClient.invalidateQueries({ queryKey: ["equipment"] });
          void queryClient.invalidateQueries({ queryKey: ["customers"] });
          void queryClient.invalidateQueries({ queryKey: ["customers", "options"] });
          if (guidedSetup && canCreateTicket && saved.customerId) {
            setTicketPrompt(saved);
          }
        }}
      />

      <GuidedNextStepDialog
        open={Boolean(ticketPrompt)}
        step="ticket"
        subjectName={ticketPrompt?.name ?? "this equipment"}
        onConfirm={() => {
          if (!ticketPrompt?.customerId) {
            setTicketPrompt(null);
            return;
          }
          navigate(serviceTicketPrefillPath({
            customerId: ticketPrompt.customerId,
            equipmentIds: [ticketPrompt.id],
            description: ticketDescriptionFromEquipment(ticketPrompt),
          }));
          setTicketPrompt(null);
        }}
        onSkip={() => setTicketPrompt(null)}
      />
    </div>
  );
}
