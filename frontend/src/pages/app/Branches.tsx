import { useEffect, useState } from "react";
import { Building2, Loader2, MapPin, Phone, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RoleGuard } from "@/components/auth/RoleGuard";
import { api, ApiError, type BackendBranch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type FormState = { name: string; city: string; phone: string };
const emptyForm: FormState = { name: "", city: "", phone: "" };

export default function Branches() {
  const [branches, setBranches] = useState<BackendBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listBranches();
      setBranches(data);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load branches";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const json = await response.json() as { success: boolean; message: string };
      if (!json.success) throw new Error(json.message);
      toast({ title: "Branch created", description: `${form.name} added.` });
      setDialogOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to create branch";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard roles={["admin"]}>
      <div className="space-y-6">
        <PageHeader
          title="Branch Management"
          description="Multi-branch operations under one tenant."
          actions={
            <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }} variant="brand">
              <Plus className="mr-1 h-4 w-4" /> Add Branch
            </Button>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading branches…
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {branches.map((b) => (
              <Card key={b.id} className="shadow-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{b.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" /> {b.city}
                  </p>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" /> {b.phone}
                  </p>
                  <p className="text-xs text-muted-foreground pt-1">
                    Created {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
            {branches.length === 0 && (
              <p className="col-span-3 py-10 text-center text-sm text-muted-foreground">No branches found.</p>
            )}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Branch</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Branch Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main HQ" />
            </div>
            <div className="grid gap-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Mumbai" />
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 99999 00000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
