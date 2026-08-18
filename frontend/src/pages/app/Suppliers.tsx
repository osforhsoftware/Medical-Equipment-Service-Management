import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2, Plus, Star, Trash2, Truck } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
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
import { useFormValidation } from "@/hooks/useFormValidation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { api, type BackendSupplier } from "@/lib/api";
import { EMPTY_PAGINATION_META } from "@/lib/listing";
import { toast } from "@/lib/toast";

const supplierSchema = z.object({
  name: fieldRules.requiredString("Company name"),
  contact: fieldRules.optionalString(),
  email: fieldRules.email(false),
  phone: fieldRules.phone(false),
  category: fieldRules.optionalString(),
  rating: z.string().refine((v) => {
    if (!v.trim()) return true;
    const n = parseFloat(v);
    return !Number.isNaN(n) && n >= 0 && n <= 5;
  }, "Rating must be between 0 and 5."),
});

type FormState = { name: string; contact: string; email: string; phone: string; category: string; rating: string };
const emptyForm: FormState = { name: "", contact: "", email: "", phone: "", category: "", rating: "0" };

export default function Suppliers() {
  const queryClient = useQueryClient();
  const {
    search,
    setSearch,
    listParams,
    setPage,
    setLimit,
  } = useListingUrlState();

  const debouncedSearch = useDebouncedValue(search);
  const queryParams = useMemo(
    () => ({ ...listParams, search: debouncedSearch || undefined }),
    [listParams, debouncedSearch],
  );

  const suppliersQuery = usePaginatedQuery({
    queryKey: "suppliers",
    params: queryParams,
    queryFn: (params) => api.listSuppliers(params),
  });

  const suppliers = suppliersQuery.data?.data ?? [];
  const pagination = suppliersQuery.data?.meta ?? EMPTY_PAGINATION_META;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BackendSupplier | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const {
    errors,
    shouldShow,
    reset: resetValidation,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
  } = useFormValidation({
    fieldOrder: ["name", "email", "phone", "rating"],
    schema: supplierSchema,
  });

  const load = () => void queryClient.invalidateQueries({ queryKey: ["suppliers"] });

  const openCreate = () => {
    setForm(emptyForm);
    resetValidation();
    setDialogOpen(true);
  };

  const save = async () => {
    if (!validateAll(form, undefined, dialogRef.current)) return;

    setSaving(true);
    try {
      await api.createSupplier({
        name: form.name.trim(),
        contact: form.contact.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        category: form.category.trim(),
        rating: parseFloat(form.rating) || 0,
      });
      toast({ title: "Supplier added", description: `${form.name.trim()} has been added.` });
      setDialogOpen(false);
      setForm(emptyForm);
      resetValidation();
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    } catch (err) {
      if (!applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to save supplier" });
      }
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
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to delete" });
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
            <Button onClick={openCreate} variant="brand">
              <Plus className="mr-1 h-4 w-4" /> Add Supplier
            </Button>
          }
        />

        <DataTable
          mode="server"
          data={suppliers}
          columns={columns}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search suppliers…"
          emptyMessage="No suppliers found."
          emptyHint="Try changing your search."
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={setLimit}
          loading={suppliersQuery.isLoading}
          isFetching={suppliersQuery.isFetching}
          error={suppliersQuery.error as Error | null}
          onRetry={() => load()}
          onRowClick={(s) => toast({ title: s.name, description: `${s.category} · ${s.email}` })}
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetValidation(); setDialogOpen(open); }}>
        <DialogContent ref={dialogRef} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Supplier</DialogTitle>
          </DialogHeader>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="grid gap-3 py-2"
          >
            <div className="grid gap-2" data-field="name">
              <Label htmlFor="supplier-name" className={shouldShow("name") ? "text-destructive" : undefined}>
                Company Name
                <RequiredMark />
              </Label>
              <Input
                id="supplier-name"
                value={form.name}
                onChange={(e) => {
                  const next = { ...form, name: e.target.value };
                  setForm(next);
                  handleChange("name", next);
                }}
                onBlur={() => handleBlur("name", form)}
                className={fieldErrorClass(shouldShow("name"))}
                {...fieldAria("name", shouldShow("name") ? errors.name : null)}
              />
              {shouldShow("name") && <FormFieldError field="name" message={errors.name} />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="supplier-contact">Contact Person</Label>
                <Input
                  id="supplier-contact"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                />
              </div>
              <div className="grid gap-2" data-field="phone">
                <Label htmlFor="supplier-phone">Phone</Label>
                <Input
                  id="supplier-phone"
                  value={form.phone}
                  onChange={(e) => {
                    const next = { ...form, phone: e.target.value };
                    setForm(next);
                    handleChange("phone", next);
                  }}
                  onBlur={() => handleBlur("phone", form)}
                  className={fieldErrorClass(shouldShow("phone"))}
                  {...fieldAria("phone", shouldShow("phone") ? errors.phone : null)}
                />
                {shouldShow("phone") && <FormFieldError field="phone" message={errors.phone} />}
              </div>
            </div>
            <div className="grid gap-2" data-field="email">
              <Label htmlFor="supplier-email">Email</Label>
              <Input
                id="supplier-email"
                type="email"
                value={form.email}
                onChange={(e) => {
                  const next = { ...form, email: e.target.value };
                  setForm(next);
                  handleChange("email", next);
                }}
                onBlur={() => handleBlur("email", form)}
                className={fieldErrorClass(shouldShow("email"))}
                {...fieldAria("email", shouldShow("email") ? errors.email : null)}
              />
              {shouldShow("email") && <FormFieldError field="email" message={errors.email} />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="supplier-category">Category</Label>
                <Input
                  id="supplier-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Medical Parts"
                />
              </div>
              <div className="grid gap-2" data-field="rating">
                <Label htmlFor="supplier-rating">Rating (0–5)</Label>
                <Input
                  id="supplier-rating"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={form.rating}
                  onChange={(e) => {
                    const next = { ...form, rating: e.target.value };
                    setForm(next);
                    handleChange("rating", next);
                  }}
                  onBlur={() => handleBlur("rating", form)}
                  className={fieldErrorClass(shouldShow("rating"))}
                  {...fieldAria("rating", shouldShow("rating") ? errors.rating : null)}
                />
                {shouldShow("rating") && <FormFieldError field="rating" message={errors.rating} />}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Add Supplier
              </Button>
            </DialogFooter>
          </form>
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
