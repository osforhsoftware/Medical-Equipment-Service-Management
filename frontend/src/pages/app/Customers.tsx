import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Mail, MapPin, Phone, Plus, User } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useBranch } from "@/context/BranchContext";
import { ApiError } from "@/lib/api";
import { api, type BackendBranch, type BackendCustomer } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const CUSTOMER_TYPES = [
  { value: "Hospital", label: "Hospital" },
  { value: "Clinic", label: "Clinic" },
  { value: "DiagnosticLab", label: "Diagnostic Lab" },
  { value: "Research", label: "Research" },
  { value: "Dental", label: "Dental" },
] as const;

function formatCustomerType(type: string) {
  return CUSTOMER_TYPES.find((t) => t.value === type)?.label ?? type;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type FormState = {
  name: string;
  type: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  branchId: string;
  status: string;
};

const emptyForm: FormState = {
  name: "",
  type: "Hospital",
  contactPerson: "",
  email: "",
  phone: "",
  city: "",
  branchId: "",
  status: "active",
};

export default function Customers() {
  const { branchId } = useBranch();
  const [customers, setCustomers] = useState<BackendCustomer[]>([]);
  const [branches, setBranches] = useState<BackendBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<BackendCustomer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listCustomers(branchId);
      setCustomers(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load customers";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  const loadBranches = useCallback(async () => {
    try {
      const data = await api.listBranches();
      setBranches(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load branches";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  const openCreate = () => {
    setForm({
      ...emptyForm,
      branchId: branchId !== "all" ? branchId : branches[0]?.id ?? "",
    });
    setDialogOpen(true);
  };

  const saveCustomer = async () => {
    setSaving(true);
    try {
      await api.createCustomer({
        name: form.name.trim(),
        type: form.type,
        contactPerson: form.contactPerson.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        branchId: form.branchId,
        status: form.status,
      });
      toast({ title: "Customer created", description: `${form.name.trim()} was added successfully.` });
      setDialogOpen(false);
      await loadCustomers();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.errors?.join(", ") || err.message
          : "Unable to save customer";
      toast({ title: "Save failed", description: message, variant: "destructive" });
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
      render: (c) => <span className="text-sm">{formatCustomerType(c.type)}</span>,
    },
    {
      key: "city",
      header: "City",
      render: (c) => <span className="text-sm text-muted-foreground">{c.city}</span>,
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

  const typeOptions = CUSTOMER_TYPES.map((t) => ({ label: t.label, value: t.value }));

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
  const selectedBranch = selected ? branches.find((b) => b.id === selected.branchId) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Hospitals, clinics, labs and facilities you service."
        actions={
          <Button
            onClick={openCreate}
            disabled={branches.length === 0}
            variant="brand"
          >
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
          searchKeys={["name", "contactPerson", "email", "city"]}
          searchPlaceholder="Search customers…"
          emptyMessage="No customers yet. Add your first customer to get started."
          filters={[
            {
              label: "Type",
              options: typeOptions,
              predicate: (c, v) => c.type === v,
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
          onRowClick={setSelected}
        />
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SheetTitle>{selected.name}</SheetTitle>
                  <StatusBadge status={selected.status as "active" | "inactive"} />
                </div>
                <SheetDescription>
                  {formatCustomerType(selected.type)} · {selected.city}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 space-y-5 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Equipment" value={String(selected.equipmentCount)} />
                  <Info label="Active jobs" value={String(selected.activeJobs)} />
                  <Info label="Type" value={formatCustomerType(selected.type)} />
                  <Info label="Branch" value={branchName(selected.branchId)} />
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Contact</p>
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <DetailRow icon={User} label="Contact person" value={selected.contactPerson} />
                    <DetailRow icon={Mail} label="Email" value={selected.email} />
                    <DetailRow icon={Phone} label="Phone" value={selected.phone} />
                    <DetailRow icon={MapPin} label="City" value={selected.city} />
                    {selectedBranch && (
                      <DetailRow
                        icon={Building2}
                        label="Branch office"
                        value={`${selectedBranch.name} · ${selectedBranch.city}`}
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Info label="Added" value={formatDate(selected.createdAt)} />
                  <Info label="Last updated" value={formatDate(selected.updatedAt)} />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

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
                <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_TYPES.map((t) => (
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
                <Label>Branch</Label>
                <Select value={form.branchId} onValueChange={(value) => setForm({ ...form, branchId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCustomer} disabled={saving || !form.branchId}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium break-words">{value}</p>
      </div>
    </div>
  );
}
