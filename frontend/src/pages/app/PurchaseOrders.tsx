import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, ShoppingCart, Loader2 } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
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
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { api, type BackendPurchaseOrder } from "@/lib/api";
import { defaultDatePlusDays, formatDate, formatCurrency } from "@/lib/format";
import { EMPTY_PAGINATION_META } from "@/lib/listing";
import { toast } from "@/lib/toast";

const poSchema = z.object({
  supplier: fieldRules.requiredString("Supplier"),
  items: z.string().refine((v) => Number(v) >= 1, "Enter at least 1 line item."),
  total: z.string().refine((v) => v.trim() !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0, "Enter a valid total."),
  expectedDate: fieldRules.requiredString("Expected date"),
  status: fieldRules.requiredString("Status"),
});

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    search,
    setSearch,
    filters,
    setFilter,
    listParams,
    setPage,
    setLimit,
  } = useListingUrlState({ filterKeys: ["status"] });

  const debouncedSearch = useDebouncedValue(search);
  const queryParams = useMemo(
    () => ({ ...listParams, search: debouncedSearch || undefined }),
    [listParams, debouncedSearch],
  );

  const ordersQuery = usePaginatedQuery({
    queryKey: "purchase-orders",
    params: queryParams,
    queryFn: (params) => api.listPurchaseOrders(params),
  });

  const orders = ordersQuery.data?.data ?? [];
  const pagination = ordersQuery.data?.meta ?? EMPTY_PAGINATION_META;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier: "",
    items: "1",
    total: "",
    expectedDate: defaultDatePlusDays(7),
    status: "draft",
  });
  const dialogRef = useRef<HTMLDivElement>(null);
  const {
    errors,
    shouldShow,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
    reset: resetValidation,
  } = useFormValidation({
    fieldOrder: ["supplier", "items", "total", "expectedDate"],
    schema: poSchema,
  });

  const loadOrders = () => void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });

  const saveOrder = async () => {
    if (!validateAll(form, undefined, dialogRef.current)) return;
    setSaving(true);
    try {
      await api.createPurchaseOrder({
        supplier: form.supplier.trim(),
        items: Number(form.items) || 1,
        total: Number(form.total) || 0,
        expectedDate: form.expectedDate,
        status: form.status,
      });
      toast({ title: "Purchase order created", description: "PO saved to the database." });
      setDialogOpen(false);
      setForm({ supplier: "", items: "1", total: "", expectedDate: defaultDatePlusDays(7), status: "draft" });
      resetValidation();
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    } catch (err) {
      if (!applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to save PO" });
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendPurchaseOrder>[] = [
    {
      key: "reference",
      header: "PO",
      render: (p) => (
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-medium">{p.reference}</span>
        </div>
      ),
    },
    { key: "supplier", header: "Supplier", render: (p) => <span className="text-sm">{p.supplier}</span> },
    { key: "items", header: "Items", render: (p) => <span className="font-medium">{p.items}</span> },
    { key: "total", header: "Total", render: (p) => <span className="font-semibold">{formatCurrency(p.total)}</span> },
    { key: "createdAt", header: "Created", render: (p) => <span className="text-sm text-muted-foreground">{formatDate(p.createdAt)}</span> },
    { key: "expectedDate", header: "Expected", render: (p) => <span className="text-sm text-muted-foreground">{formatDate(p.expectedDate)}</span> },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
  ];

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <div className="space-y-6">
        <PageHeader
          title="Purchase Orders"
          description="Procurement of spare parts and consumables."
          actions={
            <Button onClick={() => { resetValidation(); setDialogOpen(true); }} variant="brand">
              <Plus className="mr-1 h-4 w-4" /> New PO
            </Button>
          }
        />

        <DataTable
          mode="server"
          data={orders}
          columns={columns}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search purchase orders…"
          emptyMessage="No purchase orders yet."
          emptyHint="Try changing your search or filters."
          filterValues={filters}
          onFilterChange={setFilter}
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { label: "Draft", value: "draft" },
                { label: "Sent", value: "sent" },
                { label: "Received", value: "received" },
                { label: "Partial", value: "partial" },
                { label: "Cancelled", value: "cancelled" },
              ],
            },
          ]}
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={setLimit}
          loading={ordersQuery.isLoading}
          isFetching={ordersQuery.isFetching}
          error={ordersQuery.error as Error | null}
          onRetry={() => loadOrders()}
          onRowClick={(order) => navigate(`/app/purchase-orders/${order.id}`)}
        />

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetValidation(); setDialogOpen(open); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
            <form noValidate onSubmit={(e) => { e.preventDefault(); void saveOrder(); }}>
            <div ref={dialogRef} className="grid gap-4 py-2">
              <div className="grid gap-2" data-field="supplier">
                <Label htmlFor="supplier" className={shouldShow("supplier") ? "text-destructive" : undefined}>
                  Supplier
                  <RequiredMark />
                </Label>
                <Input
                  id="supplier"
                  name="supplier"
                  value={form.supplier}
                  className={fieldErrorClass(shouldShow("supplier"))}
                  {...fieldAria("supplier", shouldShow("supplier") ? errors.supplier : null)}
                  onChange={(e) => {
                    const next = { ...form, supplier: e.target.value };
                    setForm(next);
                    handleChange("supplier", next);
                  }}
                  onBlur={() => handleBlur("supplier", form)}
                />
                {shouldShow("supplier") && <FormFieldError field="supplier" message={errors.supplier} />}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2" data-field="items">
                  <Label htmlFor="items" className={shouldShow("items") ? "text-destructive" : undefined}>Line items</Label>
                  <Input
                    id="items"
                    name="items"
                    type="number"
                    min={1}
                    value={form.items}
                    className={fieldErrorClass(shouldShow("items"))}
                    {...fieldAria("items", shouldShow("items") ? errors.items : null)}
                    onChange={(e) => {
                      const next = { ...form, items: e.target.value };
                      setForm(next);
                      handleChange("items", next);
                    }}
                    onBlur={() => handleBlur("items", form)}
                  />
                  {shouldShow("items") && <FormFieldError field="items" message={errors.items} />}
                </div>
                <div className="grid gap-2" data-field="total">
                  <Label htmlFor="total" className={shouldShow("total") ? "text-destructive" : undefined}>Total (₹)</Label>
                  <Input
                    id="total"
                    name="total"
                    type="number"
                    min={0}
                    value={form.total}
                    className={fieldErrorClass(shouldShow("total"))}
                    {...fieldAria("total", shouldShow("total") ? errors.total : null)}
                    onChange={(e) => {
                      const next = { ...form, total: e.target.value };
                      setForm(next);
                      handleChange("total", next);
                    }}
                    onBlur={() => handleBlur("total", form)}
                  />
                  {shouldShow("total") && <FormFieldError field="total" message={errors.total} />}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2" data-field="expectedDate">
                  <Label htmlFor="expected" className={shouldShow("expectedDate") ? "text-destructive" : undefined}>
                    Expected date
                    <RequiredMark />
                  </Label>
                  <Input
                    id="expected"
                    name="expectedDate"
                    type="date"
                    value={form.expectedDate}
                    className={fieldErrorClass(shouldShow("expectedDate"))}
                    {...fieldAria("expectedDate", shouldShow("expectedDate") ? errors.expectedDate : null)}
                    onChange={(e) => {
                      const next = { ...form, expectedDate: e.target.value };
                      setForm(next);
                      handleChange("expectedDate", next);
                    }}
                    onBlur={() => handleBlur("expectedDate", form)}
                  />
                  {shouldShow("expectedDate") && <FormFieldError field="expectedDate" message={errors.expectedDate} />}
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["draft", "sent", "received", "partial", "cancelled"].map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create PO
              </Button>
            </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
