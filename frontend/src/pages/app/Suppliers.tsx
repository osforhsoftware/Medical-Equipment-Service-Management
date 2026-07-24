import { useEffect, useState } from "react";
import { Loader2, Plus, Star, Trash2, Truck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApiError } from "@/lib/api";
import { api, type BackendSupplier } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type FormState = { name: string; contact: string; email: string; phone: string; category: string; rating: string };
const emptyForm: FormState = { name: "", contact: "", email: "", phone: "", category: "", rating: "0" };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<BackendSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BackendSupplier | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listSuppliers();
      setSuppliers(data);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load suppliers";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.createSupplier({
        name: form.name,
        contact: form.contact,
        email: form.email,
        phone: form.phone,
        category: form.category,
        rating: parseFloat(form.rating) || 0,
      });
      toast({ title: "Supplier added", description: `${form.name} has been added.` });
      setDialogOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Unable to save supplier";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteSupplier(deleteTarget.id);
      toast({ title: "Supplier removed", description: `${deleteTarget.name} deleted.` });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Unable to delete";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const columns: Column<BackendSupplier>[] = [
    {
      key: "name",
      header: "Supplier",
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Truck className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">{s.name}</p>
            <p className="text-xs text-muted-foreground">{s.category}</p>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (s) => (
        <div className="text-sm">
          <p>{s.contact}</p>
          <p className="text-xs text-muted-foreground">{s.email}</p>
        </div>
      ),
    },
    { key: "phone", header: "Phone", render: (s) => <span className="text-sm text-muted-foreground">{s.phone}</span> },
    {
      key: "rating",
      header: "Rating",
      render: (s) => (
        <span className="inline-flex items-center gap-1 text-sm font-medium">
          <Star className="h-3.5 w-3.5 fill-warning text-warning" /> {Number(s.rating).toFixed(1)}
        </span>
      ),
    },
    { key: "openOrders", header: "Open POs", render: (s) => <span className="font-medium">{s.openOrders}</span> },
    {
      key: "actions" as keyof BackendSupplier,
      header: "",
      render: (s) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <div className="space-y-6">
        <PageHeader
          title="Suppliers"
          description="Parts vendors and OEM suppliers."
          actions={
            <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }} variant="brand">
              <Plus className="mr-1 h-4 w-4" /> Add Supplier
            </Button>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading suppliers…
          </div>
        ) : (
          <DataTable
            data={suppliers}
            columns={columns}
            searchKeys={["name", "contact", "email", "category"]}
            searchPlaceholder="Search suppliers…"
            onRowClick={(s) => toast({ title: s.name, description: `${s.category} · ${s.email}` })}
          />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Supplier</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Company Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Contact Person</Label>
                <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Medical Parts" />
              </div>
              <div className="grid gap-2">
                <Label>Rating (0–5)</Label>
                <Input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Add Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleGuard>
  );
}
