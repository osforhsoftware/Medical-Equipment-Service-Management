import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HardDrive, Loader2, Plus, QrCode } from "lucide-react";
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
  api,
  type BackendCustomer,
  type BackendEquipment,
} from "@/lib/api";
import { toast } from "@/lib/toast";

const EQUIPMENT_CATEGORIES = [
  "Imaging",
  "Life Support",
  "Diagnostics",
  "Laboratory",
  "Surgical",
  "Monitoring",
  "Other",
] as const;

const CONDITION_OPTIONS = [
  { value: "operational", label: "Operational" },
  { value: "needsService", label: "Needs Service" },
  { value: "down", label: "Down" },
] as const;

function formatCondition(condition: string) {
  return condition === "needsService" ? "needs-service" : condition;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function defaultWarrantyEnd() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

type FormState = {
  assetTag: string;
  name: string;
  model: string;
  manufacturer: string;
  category: string;
  serialNumber: string;
  customerId: string;
  location: string;
  installDate: string;
  warrantyEnd: string;
  condition: string;
  lastServiceDate: string;
};

const emptyForm = (): FormState => ({
  assetTag: "",
  name: "",
  model: "",
  manufacturer: "",
  category: "Imaging",
  serialNumber: "",
  customerId: "",
  location: "",
  installDate: todayInputValue(),
  warrantyEnd: defaultWarrantyEnd(),
  condition: "operational",
  lastServiceDate: "",
});

export default function EquipmentPage() {
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<BackendEquipment[]>([]);
  const [customers, setCustomers] = useState<BackendCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadEquipment = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listEquipment();
      setEquipment(data);
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to load equipment" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    try {
      const data = await api.listCustomers();
      setCustomers(data.filter((c) => c.status === "active"));
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to load customers" });
    }
  }, []);

  useEffect(() => {
    void loadEquipment();
  }, [loadEquipment]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const openCreate = () => {
    const firstCustomer = customers[0];
    setForm({
      ...emptyForm(),
      customerId: firstCustomer?.id ?? "",
    });
    setDialogOpen(true);
  };

  const onCustomerChange = (customerId: string) => {
    setForm((prev) => ({
      ...prev,
      customerId,
    }));
  };

  const saveEquipment = async () => {
    setSaving(true);
    try {
      await api.createEquipment({
        assetTag: form.assetTag.trim(),
        name: form.name.trim(),
        model: form.model.trim(),
        manufacturer: form.manufacturer.trim(),
        category: form.category,
        serialNumber: form.serialNumber.trim(),
        customerId: form.customerId,
        location: form.location.trim(),
        installDate: form.installDate,
        warrantyEnd: form.warrantyEnd,
        condition: form.condition,
        ...(form.lastServiceDate ? { lastServiceDate: form.lastServiceDate } : {}),
      });
      toast({
        title: "Equipment registered",
        description: `${form.name.trim()} (${form.assetTag.trim()}) was added successfully.`,
      });
      setDialogOpen(false);
      await loadEquipment();
      await loadCustomers();
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to register equipment" });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendEquipment>[] = [
    {
      key: "name",
      header: "Equipment",
      render: (e) => (
        <div>
          <p className="font-medium">{e.name}</p>
          <p className="text-xs text-muted-foreground">
            {e.manufacturer} · {e.model}
          </p>
        </div>
      ),
    },
    {
      key: "assetTag",
      header: "Asset Tag",
      render: (e) => (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs">
          <QrCode className="h-3 w-3" /> {e.assetTag}
        </span>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      render: (e) => <span className="text-sm">{e.customerName}</span>,
    },
    {
      key: "category",
      header: "Category",
      render: (e) => <span className="text-sm text-muted-foreground">{e.category}</span>,
    },
    {
      key: "location",
      header: "Location",
      render: (e) => <span className="text-sm text-muted-foreground">{e.location}</span>,
    },
    {
      key: "condition",
      header: "Condition",
      render: (e) => <StatusBadge status={formatCondition(e.condition)} />,
    },
    {
      key: "lastServiceDate",
      header: "Last Service",
      render: (e) => (
        <span className="text-sm text-muted-foreground">{formatDate(e.lastServiceDate)}</span>
      ),
    },
  ];

  const customerFilterOptions = useMemo(
    () => customers.map((c) => ({ label: c.name, value: c.id })),
    [customers],
  );

  const categoryFilterOptions = useMemo(() => {
    const fromData = [...new Set(equipment.map((e) => e.category))];
    const merged = [...new Set([...EQUIPMENT_CATEGORIES, ...fromData])];
    return merged.map((c) => ({ label: c, value: c }));
  }, [equipment]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment & Machines"
        description="QR-tracked medical devices with lifetime service history."
        actions={
          <Button
            onClick={openCreate}
            disabled={customers.length === 0}
            variant="brand"
          >
            <Plus className="mr-1 h-4 w-4" /> Register Equipment
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading equipment…
        </div>
      ) : (
        <DataTable
          data={equipment}
          columns={columns}
          searchKeys={["name", "model", "manufacturer", "assetTag", "serialNumber", "customerName", "category", "location"]}
          searchPlaceholder="Search by name, asset tag, serial, customer…"
          emptyMessage="No equipment registered yet. Register your first device to get started."
          filters={[
            {
              label: "Condition",
              options: CONDITION_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
              predicate: (e, v) => e.condition === v,
            },
            ...(customerFilterOptions.length > 0
              ? [
                  {
                    label: "Customer",
                    options: customerFilterOptions,
                    predicate: (e: BackendEquipment, v: string) => e.customerId === v,
                  },
                ]
              : []),
            {
              label: "Category",
              options: categoryFilterOptions,
              predicate: (e, v) => e.category === v,
            },
          ]}
          onRowClick={(e) => navigate(`/app/equipment/${e.id}`)}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" /> Register Equipment
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="asset-tag">Asset tag (QR)</Label>
                <Input
                  id="asset-tag"
                  value={form.assetTag}
                  onChange={(e) => setForm({ ...form, assetTag: e.target.value })}
                  placeholder="MED-AX-2207"
                  className="font-mono"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="serial-number">Serial number</Label>
                <Input
                  id="serial-number"
                  value={form.serialNumber}
                  onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                  placeholder="SN-MRI-99201"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="equipment-name">Equipment name</Label>
              <Input
                id="equipment-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="MRI Scanner"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  value={form.manufacturer}
                  onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                  placeholder="Siemens"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="Magnetom Vida"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Customer</Label>
                <Select value={form.customerId} onValueChange={onCustomerChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location at site</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Radiology Wing 2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="install-date">Install date</Label>
                <Input
                  id="install-date"
                  type="date"
                  value={form.installDate}
                  onChange={(e) => setForm({ ...form, installDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="warranty-end">Warranty end</Label>
                <Input
                  id="warranty-end"
                  type="date"
                  value={form.warrantyEnd}
                  onChange={(e) => setForm({ ...form, warrantyEnd: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Condition</Label>
                <Select value={form.condition} onValueChange={(value) => setForm({ ...form, condition: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last-service">Last service (optional)</Label>
                <Input
                  id="last-service"
                  type="date"
                  value={form.lastServiceDate}
                  onChange={(e) => setForm({ ...form, lastServiceDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveEquipment}
              disabled={saving || !form.customerId || !form.assetTag.trim() || !form.name.trim()}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Register equipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
