import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2, Plus } from "lucide-react";
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
import { CUSTOMER_TYPE_OPTIONS, formatFixedOption } from "@/lib/fixedOptions";
import { toast } from "@/lib/toast";

function formatCustomerType(type: string, typeOther?: string | null) {
  return formatFixedOption(CUSTOMER_TYPE_OPTIONS, type, typeOther);
}

function customerTypeValue(c: BackendCustomer) {
  if (c.type === "Other" && c.typeOther?.trim()) return c.typeOther.trim();
  return c.type;
}

function buildTypeOptions(customers: BackendCustomer[], addedTypes: string[]) {
  const base = CUSTOMER_TYPE_OPTIONS.filter((o) => o.value !== "Other");
  const other = CUSTOMER_TYPE_OPTIONS.find((o) => o.value === "Other")!;
  const known = new Set(base.map((o) => o.value));
  const extras = [
    ...new Set([
      ...customers.map(customerTypeValue),
      ...addedTypes,
    ]),
  ]
    .filter((t) => t && !known.has(t) && t !== "Other")
    .sort()
    .map((t) => ({ value: t, label: t }));
  return [...base, ...extras, other];
}

type FormState = {
  name: string;
  type: string;
  typeOther: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  licenseGst: string;
  status: string;
};

const emptyForm: FormState = {
  name: "",
  type: "Hospital",
  typeOther: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  licenseGst: "",
  status: "active",
};

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<BackendCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [addedTypes, setAddedTypes] = useState<string[]>([]);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listCustomers();
      setCustomers(data);
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to load customers" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const typeSelectOptions = useMemo(
    () => buildTypeOptions(customers, addedTypes),
    [customers, addedTypes],
  );

  const typeFilterOptions = useMemo(
    () => typeSelectOptions.filter((o) => o.value !== "Other").map((o) => ({ label: o.label, value: o.value })),
    [typeSelectOptions],
  );

  const resolvedType = form.type === "Other" ? "" : form.type;

  const openCreate = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const addType = () => {
    const name = form.typeOther.trim();
    if (!name) return;

    const existing = typeSelectOptions.find((o) => o.value.toLowerCase() === name.toLowerCase());
    if (existing && existing.value !== "Other") {
      setForm({ ...form, type: existing.value, typeOther: "" });
      toast.info("Type selected", { description: `"${existing.label}" is already in the list.` });
      return;
    }

    setAddedTypes((current) => [...new Set([...current, name])]);
    setForm({ ...form, type: name, typeOther: "" });
    toast.success("Type added", { description: `"${name}" is now available in the dropdown.` });
  };

  const saveCustomer = async () => {
    if (!resolvedType) {
      toast.warning("Please select or add a customer type");
      return;
    }
    setSaving(true);
    try {
      await api.createCustomer({
        name: form.name.trim(),
        type: resolvedType,
        typeOther: null,
        contactPerson: form.contactPerson.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        licenseGst: form.licenseGst.trim() || null,
        status: form.status,
      });
      toast.success("Customer created successfully", {
        description: `${form.name.trim()} was added successfully.`,
      });
      setDialogOpen(false);
      await loadCustomers();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to save customer" });
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
      render: (c) => <span className="text-sm">{formatCustomerType(customerTypeValue(c), c.type === "Other" ? c.typeOther : null)}</span>,
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
        description="Hospitals, clinics, labs and facilities you service."
        actions={
          <Button onClick={openCreate} variant="brand">
            <Plus className="mr-1 h-4 w-4" /> Add Customer
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading customers…
        </div>
      ) : (
        <DataTable
          data={customers}
          columns={columns}
          searchKeys={["name", "contactPerson", "email", "city", "country", "address", "licenseGst"]}
          searchPlaceholder="Search customers…"
          emptyMessage="No customers yet. Add your first customer to get started."
          filters={[
            {
              label: "Type",
              options: typeFilterOptions,
              predicate: (c, v) => customerTypeValue(c) === v,
            },
            {
              label: "Status",
              options: [
                { label: "Active", value: "active" },
                { label: "Inactive", value: "inactive" },
              ],
              predicate: (c, v) => c.status === v,
            },
          ]}
          onRowClick={(c) => navigate(`/app/customers/${c.id}`)}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Add Customer
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="customer-name">Customer name</Label>
              <Input
                id="customer-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="St. Mary's Hospital"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    setForm({ ...form, type: value, typeOther: value === "Other" ? form.typeOther : "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeSelectOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            {form.type === "Other" && (
              <div className="grid gap-2 rounded-lg border border-dashed border-border p-3">
                <Label htmlFor="customer-type-other">Add new type</Label>
                <div className="flex gap-2">
                  <Input
                    id="customer-type-other"
                    value={form.typeOther}
                    onChange={(e) => setForm({ ...form, typeOther: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addType();
                      }
                    }}
                    placeholder="e.g. Nursing Home, Pharmacy"
                  />
                  <Button type="button" variant="outline" disabled={!form.typeOther.trim()} onClick={addType}>
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Added types appear in the dropdown above for this and future customers.
                </p>
              </div>
            )}
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
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="facilities@hospital.org"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 512-555-2010"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="site-address">Site address</Label>
              <Input
                id="site-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="1200 Medical Center Dr"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Austin"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  placeholder="United States"
                />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveCustomer}
              disabled={
                saving ||
                !form.name.trim() ||
                !resolvedType ||
                !form.address.trim() ||
                !form.city.trim() ||
                !form.country.trim()
              }
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
