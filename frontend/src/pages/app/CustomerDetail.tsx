import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Building2, FileText, Loader2, Mail, MapPin, Pencil, Phone, RotateCcw, Trash2, User } from "lucide-react";
import { z } from "zod";
import {
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { CustomerAdditionalFieldsEditor } from "@/components/customers/CustomerAdditionalFieldsEditor";
import { CustomerContactsPanel } from "@/components/customers/CustomerContactsPanel";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { CUSTOMER_WRITE_ROLES, ESTIMATE_WRITE_ROLES, SALES_WRITE_ROLES, SERVICE_BILLING_ROLES } from "@/config/roles";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { userCanAccessPath } from "@/lib/userRoles";
import { useFormValidation } from "@/hooks/useFormValidation";
import { api, ApiError, type BackendCustomer, type BackendEquipment, type BackendEstimate, type BackendInvoice, type BackendServiceJob, type BackendServiceRequest } from "@/lib/api";
import { parseCustomerAdditionalFields, sanitizeCustomerAdditionalFields, type CustomerAdditionalField } from "@/lib/customerFields";
import { fieldRules } from "@/lib/formValidation";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { activeTerms, termLabel } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

const editSchema = z.object({
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

type EditForm = {
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

function customerToForm(customer: BackendCustomer): EditForm {
  const fields = parseCustomerAdditionalFields(customer.additionalFields);
  return {
    name: customer.name ?? "",
    type: customer.type ?? "",
    contactPerson: customer.contactPerson ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    address: customer.address?.trim() || customer.deliveryAddress?.trim() || "",
    city: customer.city ?? "",
    country: customer.country ?? "",
    licenseGst: customer.licenseGst ?? "",
    paymentTerms: customer.paymentTerms ?? "",
    creditLimit: customer.creditLimit == null ? "" : String(customer.creditLimit),
    priceCategory: customer.priceCategory ?? "",
    deliveryAddress: customer.address?.trim() || customer.deliveryAddress?.trim() || "",
    note: customer.note ?? "",
    restrictions: customer.restrictions ?? "",
    status: customer.status ?? "active",
    additionalFields: fields.length ? fields : [{ label: "", value: "" }],
  };
}

export default function CustomerDetail() {
  const { hasRole, user } = useAuth();
  const { rbacMatrix } = useSettings();
  const canQuote = hasRole(ESTIMATE_WRITE_ROLES);
  const canSell = hasRole(SALES_WRITE_ROLES);
  const canEdit = hasRole(CUSTOMER_WRITE_ROLES);
  const canAccessBilling =
    Boolean(user) &&
    (hasRole(SERVICE_BILLING_ROLES) || userCanAccessPath(user!, "/app/billing", rbacMatrix));
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customer, setCustomer] = useState<BackendCustomer | null>(null);
  const [equipment, setEquipment] = useState<BackendEquipment[]>([]);
  const [tickets, setTickets] = useState<BackendServiceRequest[]>([]);
  const [jobs, setJobs] = useState<BackendServiceJob[]>([]);
  const [estimates, setEstimates] = useState<BackendEstimate[]>([]);
  const [invoices, setInvoices] = useState<BackendInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const tab = searchParams.get("tab") ?? "overview";
  const shouldOpenEdit = searchParams.get("edit") === "1";
  const typesQuery = useQuery({
    queryKey: ["taxonomy", "customer_type"],
    queryFn: () => api.listTaxonomy({ type: "customer_type" }),
    staleTime: 60_000,
  });
  const conditionsQuery = useQuery({
    queryKey: ["taxonomy", "equipment_condition"],
    queryFn: () => api.listTaxonomy({ type: "equipment_condition" }),
    staleTime: 60_000,
  });
  const customerTypeName = termLabel(typesQuery.data, customer?.type, customer?.typeOther);
  const activeTypes = activeTerms(typesQuery.data ?? []);
  const additionalFields = parseCustomerAdditionalFields(customer?.additionalFields);

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
    schema: editSchema,
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const record = await api.getCustomer(id);
      setCustomer(record);
      const [eq, sr, jb, est, inv] = await Promise.all([
        api.listEquipment({ customerId: id, limit: 100, page: 1 }).then((r) => r.data).catch(() => [] as BackendEquipment[]),
        api.listServiceRequests({ customerId: id, limit: 100, page: 1 }).then((r) => r.data).catch(() => [] as BackendServiceRequest[]),
        api.listJobs({ customerId: id, limit: 100, page: 1 }).then((r) => r.data).catch(() => [] as BackendServiceJob[]),
        api.listEstimates({ customerId: id, limit: 100, page: 1 }).then((r) => r.data).catch(() => [] as BackendEstimate[]),
        api.listInvoices().catch(() => [] as BackendInvoice[]),
      ]);
      setEquipment(eq);
      setTickets(sr.filter((r) => r.customerId === id || r.customerName === record.name));
      setJobs(jb.filter((j) => j.customerId === id || j.customerName === record.name));
      setEstimates(est.filter((e) => e.customerId === id || e.customerName === record.name));
      setInvoices(inv.filter((i) => i.customerId === id || i.customerName === record.name));
    } catch (err) {
      setCustomer(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load customer" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!customer || !canEdit || !shouldOpenEdit || editOpen) return;
    setForm(customerToForm(customer));
    resetValidation();
    setEditOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  }, [customer, canEdit, shouldOpenEdit, editOpen, resetValidation, searchParams, setSearchParams]);

  const openEdit = () => {
    if (!customer || !canEdit) return;
    setForm(customerToForm(customer));
    resetValidation();
    setEditOpen(true);
  };

  const openDelete = () => {
    if (!customer || !canEdit || customer.status === "inactive") return;
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!customer) return;
    setDeleting(true);
    try {
      const removed = await api.deleteCustomer(customer.id);
      setCustomer(removed);
      setDeleteOpen(false);
      toast.success("Customer removed", {
        description: "Marked inactive. Related equipment and jobs remain available for history.",
      });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to remove customer" });
    } finally {
      setDeleting(false);
    }
  };

  const restoreCustomer = async () => {
    if (!customer || !canEdit) return;
    setRestoring(true);
    try {
      const restored = await api.restoreCustomer(customer.id);
      setCustomer(restored);
      toast.success("Customer restored", {
        description: `${restored.name} is active again.`,
      });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to restore customer" });
    } finally {
      setRestoring(false);
    }
  };

  const saveEdit = async () => {
    if (!customer || !form) return;
    if (!validateAll(form, undefined, dialogRef.current)) return;
    setSaving(true);
    try {
      const creditLimitValue = form.creditLimit.trim();
      const updated = await api.updateCustomer(customer.id, {
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
      setCustomer(updated);
      setEditOpen(false);
      toast.success("Customer updated");
    } catch (err) {
      if (!applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to update customer" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <RecordDetailLayout
        backTo="/app/customers"
        backLabel="Back to Customers"
        title={customer?.name ?? "Customer"}
        subtitle={customer ? (
          <>
            <span className="font-mono text-xs">{customer.reference}</span>
            {" · "}
            {customerTypeName}
            {" · "}
            {[customer.city, customer.country].filter(Boolean).join(", ") || "No location"}
          </>
        ) : undefined}
        status={customer?.status}
        meta={customer ? [
          { label: "Customer ID", value: customer.reference },
          { label: "Contact", value: customer.contactPerson },
          { label: "Equipment", value: String(customer.equipmentCount) },
          { label: "Active jobs", value: String(customer.activeJobs) },
        ] : undefined}
        loading={loading}
        error={error}
        notFound={!loading && !error && !customer}
        notFoundTitle="Customer not found"
        notFoundDescription="The requested customer could not be found."
        actions={
          customer ? (
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <Button variant="outline" onClick={openEdit}>
                  <Pencil className="mr-1 h-4 w-4" /> Edit
                </Button>
              ) : null}
              {canEdit && customer.status !== "inactive" ? (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={openDelete}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Remove
                </Button>
              ) : null}
              {canEdit && customer.status === "inactive" ? (
                <Button variant="outline" onClick={() => void restoreCustomer()} disabled={restoring}>
                  {restoring ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1 h-4 w-4" />
                  )}
                  Restore
                </Button>
              ) : null}
              {canSell ? (
                <Button asChild>
                  <Link to="/app/sales?new=1">
                    <FileText className="mr-1 h-4 w-4" /> New sale
                  </Link>
                </Button>
              ) : null}
              {canQuote ? (
                <Button variant={canSell || canEdit ? "outline" : "default"} asChild>
                  <Link to="/app/estimates">
                    <FileText className="mr-1 h-4 w-4" /> Service estimate
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
        onRetry={() => void load()}
        activeTab={tab}
        onTabChange={(value) => setSearchParams(value === "overview" ? {} : { tab: value })}
        tabs={customer ? [
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="space-y-4">
                <DetailSection title="Contact">
                  <div className="space-y-2 text-sm">
                    <Row icon={User} label="Contact person" value={customer.contactPerson} />
                    <Row icon={Mail} label="Email" value={customer.email} />
                    <Row icon={Phone} label="Phone" value={customer.phone} />
                  </div>
                </DetailSection>
                <DetailSection title="Addresses">
                  <div className="space-y-2 text-sm">
                    <Row
                      icon={MapPin}
                      label="Billing & delivery addresses"
                      value={customer.address || customer.deliveryAddress?.trim() || "—"}
                    />
                    <Row icon={MapPin} label="City" value={customer.city || "—"} />
                    <Row icon={MapPin} label="Country" value={customer.country || "—"} />
                    <Row icon={Building2} label="License / GST / VAT" value={customer.licenseGst?.trim() || "—"} />
                  </div>
                </DetailSection>
                <DetailSection title="Commercial terms">
                  <DetailInfoGrid
                    items={[
                      { label: "Payment terms", value: customer.paymentTerms?.trim() || "—" },
                      { label: "Price category", value: customer.priceCategory?.trim() || "—" },
                      {
                        label: "Credit limit",
                        value: customer.creditLimit == null ? "—" : formatCurrency(customer.creditLimit),
                      },
                      {
                        label: "Outstanding",
                        value: formatCurrency(customer.outstandingBalance ?? 0),
                      },
                    ]}
                  />
                </DetailSection>
                {additionalFields.length ? (
                  <DetailSection title="Additional fields">
                    <DetailInfoGrid
                      items={additionalFields.map((field) => ({
                        label: field.label,
                        value: field.value || "—",
                      }))}
                    />
                  </DetailSection>
                ) : null}
                {customer.restrictions?.trim() ? (
                  <DetailSection title="Service restrictions">
                    <p className="whitespace-pre-wrap text-sm">{customer.restrictions}</p>
                  </DetailSection>
                ) : null}
                {customer.note?.trim() ? (
                  <DetailSection title="Note">
                    <p className="whitespace-pre-wrap text-sm">{customer.note}</p>
                  </DetailSection>
                ) : null}
                <DetailSection title="Record">
                  <DetailInfoGrid
                    items={[
                      { label: "Added", value: formatDate(customer.createdAt) },
                      { label: "Last updated", value: formatDate(customer.updatedAt) },
                      { label: "Type", value: customerTypeName },
                      { label: "Status", value: customer.status },
                    ]}
                  />
                </DetailSection>
              </div>
            ),
          },
          {
            id: "contacts",
            label: "Contacts",
            content: (
              <DetailSection title="Contacts">
                <CustomerContactsPanel customerId={customer.id} canEdit={canEdit} />
              </DetailSection>
            ),
          },
          {
            id: "equipment",
            label: "Equipment",
            content: (
              <DetailSection title="Equipment">
                {equipment.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No equipment linked.</p>
                ) : (
                  <div className="space-y-2">
                    {equipment.map((e) => (
                      <Link key={e.id} to={`/app/equipment/${e.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-secondary/40">
                        <div>
                          <p className="font-medium">{e.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{e.assetTag}</p>
                        </div>
                        <StatusBadge status={e.condition} label={termLabel(conditionsQuery.data, e.condition)} />
                      </Link>
                    ))}
                  </div>
                )}
              </DetailSection>
            ),
          },
          {
            id: "tickets",
            label: "Tickets",
            content: (
              <DetailSection title="Service tickets">
                {tickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tickets.</p>
                ) : (
                  <div className="space-y-2">
                    {tickets.map((r) => (
                      <Link key={r.id} to={`/app/service-tickets/${r.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-secondary/40">
                        <div>
                          <p className="font-mono font-medium">{r.reference}</p>
                          <p className="text-xs text-muted-foreground">{r.equipmentName}</p>
                        </div>
                        <StatusBadge status={r.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </DetailSection>
            ),
          },
          {
            id: "jobs",
            label: "Jobs",
            content: (
              <DetailSection title="Service jobs">
                {jobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No jobs.</p>
                ) : (
                  <div className="space-y-2">
                    {jobs.map((j) => (
                      <Link key={j.id} to={`/app/jobs/${j.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-secondary/40">
                        <div>
                          <p className="font-mono font-medium">{j.reference}</p>
                          <p className="text-xs text-muted-foreground">{j.equipmentName}</p>
                        </div>
                        <StatusBadge status={j.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </DetailSection>
            ),
          },
          {
            id: "estimates",
            label: "Estimates",
            content: (
              <DetailSection title="Estimates">
                {estimates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No estimates.</p>
                ) : (
                  <div className="space-y-2">
                    {estimates.map((e) => (
                      <Link key={e.id} to={`/app/estimates/${e.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-secondary/40">
                        <div>
                          <p className="font-mono font-medium">{e.reference}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(e.total)}</p>
                        </div>
                        <StatusBadge status={e.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </DetailSection>
            ),
          },
          {
            id: "invoices",
            label: "Invoices",
            content: (
              <DetailSection title="Invoices">
                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices.</p>
                ) : (
                  <div className="space-y-2">
                    {invoices.map((i) =>
                      canAccessBilling ? (
                        <Link key={i.id} to={`/app/billing/invoices/${i.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-secondary/40">
                          <div>
                            <p className="font-mono font-medium">{i.reference}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(Number(i.total))}</p>
                          </div>
                          <StatusBadge status={i.status} />
                        </Link>
                      ) : (
                        <div key={i.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                          <div>
                            <p className="font-mono font-medium">{i.reference}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(Number(i.total))}</p>
                          </div>
                          <StatusBadge status={i.status} />
                        </div>
                      ),
                    )}
                  </div>
                )}
              </DetailSection>
            ),
          },
        ] : undefined}
        sidebar={customer ? (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">At a glance</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Equipment</span><span>{equipment.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tickets</span><span>{tickets.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Jobs</span><span>{jobs.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Estimates</span><span>{estimates.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Invoices</span><span>{invoices.length}</span></div>
              {customer.paymentTerms?.trim() ? (
                <div className="flex justify-between gap-2 border-t pt-2">
                  <span className="text-muted-foreground">Payment</span>
                  <span className="text-right">{customer.paymentTerms}</span>
                </div>
              ) : null}
              {customer.priceCategory?.trim() ? (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Price category</span>
                  <span className="text-right">{customer.priceCategory}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : undefined}
      />

      <Dialog open={Boolean(canEdit && editOpen && form)} onOpenChange={(open) => { if (!open) resetValidation(); setEditOpen(open); }}>
        <DialogContent ref={dialogRef} className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2" data-field="name">
                <Label className={shouldShow("name") ? "text-destructive" : undefined}>
                  Customer name
                  <RequiredMark />
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const next = { ...form, name: e.target.value };
                    setForm(next);
                    handleChange("name", next);
                  }}
                  onBlur={() => handleBlur("name", form)}
                  className={cn(shouldShow("name") && "border-destructive focus-visible:ring-destructive")}
                />
                {shouldShow("name") && <FormFieldError field="name" message={errors.name} />}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2" data-field="type">
                  <Label>Type</Label>
                  <Select
                    value={form.type || "__none__"}
                    onValueChange={(value) => {
                      const next = { ...form, type: value === "__none__" ? "" : value };
                      setForm(next);
                      clearError("type");
                      handleChange("type", next);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not specified</SelectItem>
                      {activeTypes.map((t) => (
                        <SelectItem key={t.id} value={t.slug}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Contact person</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2" data-field="email">
                  <Label>Email</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => {
                      const next = { ...form, email: e.target.value };
                      setForm(next);
                      handleChange("email", next);
                    }}
                    onBlur={() => handleBlur("email", form)}
                    className={cn(shouldShow("email") && "border-destructive focus-visible:ring-destructive")}
                  />
                  {shouldShow("email") && <FormFieldError field="email" message={errors.email} />}
                </div>
                <div className="grid gap-2" data-field="phone">
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => {
                      const next = { ...form, phone: e.target.value };
                      setForm(next);
                      handleChange("phone", next);
                    }}
                    onBlur={() => handleBlur("phone", form)}
                    className={cn(shouldShow("phone") && "border-destructive focus-visible:ring-destructive")}
                  />
                  {shouldShow("phone") && <FormFieldError field="phone" message={errors.phone} />}
                </div>
              </div>
              <div className="grid gap-2" data-field="address">
                <Label>Billing & delivery addresses</Label>
                <Input
                  value={form.address}
                  onChange={(e) => {
                    const next = { ...form, address: e.target.value, deliveryAddress: e.target.value };
                    setForm(next);
                    handleChange("address", next);
                  }}
                  placeholder="1200 Medical Center Dr"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2" data-field="city">
                  <Label>City</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="grid gap-2" data-field="country">
                  <Label>Country</Label>
                  <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>License / GST / VAT</Label>
                <Input value={form.licenseGst} onChange={(e) => setForm({ ...form, licenseGst: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2" data-field="paymentTerms">
                  <Label>Payment terms</Label>
                  <Input value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} placeholder="Net 30" />
                </div>
                <div className="grid gap-2" data-field="priceCategory">
                  <Label>Price category</Label>
                  <Input value={form.priceCategory} onChange={(e) => setForm({ ...form, priceCategory: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2" data-field="creditLimit">
                <Label>Credit limit</Label>
                <Input
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
                  className={cn(shouldShow("creditLimit") && "border-destructive focus-visible:ring-destructive")}
                />
                {shouldShow("creditLimit") && <FormFieldError field="creditLimit" message={errors.creditLimit} />}
              </div>
              <CustomerAdditionalFieldsEditor
                value={form.additionalFields}
                onChange={(additionalFields) => setForm({ ...form, additionalFields })}
                disabled={saving}
              />
              <div className="grid gap-2" data-field="note">
                <Label>Note</Label>
                <Textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid gap-2" data-field="restrictions">
                <Label>Service restrictions</Label>
                <Textarea
                  value={form.restrictions}
                  onChange={(e) => setForm({ ...form, restrictions: e.target.value })}
                  rows={3}
                  placeholder="Site rules the technician must follow"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveEdit()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (deleting) return;
          setDeleteOpen(open);
        }}
        title="Remove customer?"
        description={
          <div className="space-y-2">
            <p>
              This soft-removes{" "}
              <span className="font-medium text-foreground">{customer?.name}</span> ({customer?.reference}
              ). The record is marked inactive — not permanently erased.
            </p>
            <p>
              Related work stays linked for history
              {customer
                ? `: ${customer.equipmentCount} equipment · ${customer.activeJobs} active jobs`
                : ""}
              . Existing jobs, estimates, invoices, and sales are not deleted.
            </p>
          </div>
        }
        confirmLabel="Remove customer"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/70 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
