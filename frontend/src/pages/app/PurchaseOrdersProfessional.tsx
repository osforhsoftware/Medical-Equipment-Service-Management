import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules, type FieldErrors } from "@/lib/formValidation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { api, type BackendPurchaseOrder } from "@/lib/api";
import { defaultDatePlusDays, formatCurrency, formatDate } from "@/lib/format";
import { EMPTY_PAGINATION_META } from "@/lib/listing";
import { toast } from "@/lib/toast";

type Line = { inventoryItemId?: string; sku: string; description: string; quantityOrdered: number; unitCost: number; taxRate: number };
const blankLine = (): Line => ({ sku: "", description: "", quantityOrdered: 1, unitCost: 0, taxRate: 0 });

const poHeaderSchema = z.object({
  supplierId: fieldRules.selectRequired("a supplier"),
  expectedDate: fieldRules.requiredString("Expected date"),
});

function validatePoLines(lines: Line[]): FieldErrors {
  if (lines.some((line) => !line.sku.trim() || !line.description.trim() || line.quantityOrdered < 1)) {
    return { lines: "Each line needs SKU, description, and quantity of at least 1." };
  }
  return {};
}

export default function PurchaseOrdersProfessional() {
  const navigate = useNavigate();
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

  const ordersQuery = usePaginatedQuery({
    queryKey: "purchase-orders",
    params: queryParams,
    queryFn: (params) => api.listPurchaseOrders(params),
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "options"],
    queryFn: () => api.listSuppliers({ limit: 100, page: 1 }).then((r) => r.data),
    staleTime: 60_000,
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", "options"],
    queryFn: () => api.listInventory({ limit: 100, page: 1 }).then((r) => r.data),
    staleTime: 60_000,
  });

  const orders = ordersQuery.data?.data ?? [];
  const pagination = ordersQuery.data?.meta ?? EMPTY_PAGINATION_META;
  const suppliers = suppliersQuery.data ?? [];
  const inventory = inventoryQuery.data ?? [];

  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState(defaultDatePlusDays(7));
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const {
    errors,
    shouldShow,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
    reset: resetValidation,
  } = useFormValidation<{ supplierId: string; expectedDate: string; lines: Line[] }>({
    fieldOrder: ["supplierId", "lines", "expectedDate"],
    schema: poHeaderSchema,
    validate: (values) => validatePoLines(values.lines),
  });

  const formValues = () => ({ supplierId, expectedDate, lines });

  const create = async () => {
    const values = formValues();
    if (!validateAll(values, undefined, dialogRef.current)) return;
    const supplier = suppliers.find((row) => row.id === supplierId);
    if (!supplier) return;
    setSaving(true);
    try {
      await api.createItemizedPurchaseOrder({ supplierId, supplier: supplier.name, expectedDate, lines });
      setCreateOpen(false);
      setSupplierId("");
      setLines([blankLine()]);
      resetValidation();
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast({ title: "Itemized purchase order created" });
    } catch (error) {
      if (!applyApiErrors(error, dialogRef.current)) {
        toast.apiError(error, { fallback: "Request failed" });
      }
    }
    finally { setSaving(false); }
  };

  const updateLines = (updater: (current: Line[]) => Line[]) => {
    setLines((current) => {
      const next = updater(current);
      handleChange("lines", { ...formValues(), lines: next });
      return next;
    });
  };

  const columns: Column<BackendPurchaseOrder>[] = [
    { key: "reference", header: "PO", render: (order) => <div className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" /><span className="font-mono font-medium">{order.reference}</span></div> },
    { key: "supplier", header: "Supplier", render: (order) => <span>{order.supplier}</span> },
    { key: "items", header: "Lines", render: (order) => <span>{order.items}</span> },
    { key: "total", header: "Total", render: (order) => <span className="font-semibold">{formatCurrency(order.total)}</span> },
    { key: "expectedDate", header: "Expected", render: (order) => <span>{formatDate(order.expectedDate)}</span> },
    { key: "status", header: "Status", render: (order) => <StatusBadge status={order.status} /> },
  ];

  return <RoleGuard roles={["admin", "inventory"]}><div className="space-y-6">
    <PageHeader title="Purchase Orders" description="Line-item procurement and partial receiving into inventory." actions={<Button variant="brand" onClick={() => { resetValidation(); setCreateOpen(true); }}><Plus className="mr-1 h-4 w-4" /> New PO</Button>} />
    <DataTable
      mode="server"
      data={orders}
      columns={columns}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search purchase orders…"
      emptyMessage="No purchase orders."
      emptyHint="Try changing your search."
      pagination={pagination}
      onPageChange={setPage}
      onLimitChange={setLimit}
      loading={ordersQuery.isLoading}
      isFetching={ordersQuery.isFetching}
      error={ordersQuery.error as Error | null}
      onRetry={() => void ordersQuery.refetch()}
      onRowClick={(order) => navigate(`/app/purchase-orders/${order.id}`)}
    />
    <Dialog open={createOpen} onOpenChange={(open) => { if (!open) resetValidation(); setCreateOpen(open); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>New itemized purchase order</DialogTitle></DialogHeader>
        <form noValidate onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <div ref={dialogRef} className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2" data-field="supplierId">
                <Label className={shouldShow("supplierId") ? "text-destructive" : undefined}>Supplier<RequiredMark /></Label>
                <Select value={supplierId} onValueChange={(value) => { setSupplierId(value); handleChange("supplierId", { supplierId: value, expectedDate, lines }); }}>
                  <SelectTrigger className={fieldErrorClass(shouldShow("supplierId"))} {...fieldAria("supplierId", shouldShow("supplierId") ? errors.supplierId : null)}>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>{suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}</SelectContent>
                </Select>
                {shouldShow("supplierId") && <FormFieldError field="supplierId" message={errors.supplierId} />}
              </div>
              <div className="grid gap-2" data-field="expectedDate">
                <Label htmlFor="po-expected-date" className={shouldShow("expectedDate") ? "text-destructive" : undefined}>Expected date<RequiredMark /></Label>
                <Input id="po-expected-date" name="expectedDate" type="date" value={expectedDate} className={fieldErrorClass(shouldShow("expectedDate"))} {...fieldAria("expectedDate", shouldShow("expectedDate") ? errors.expectedDate : null)} onChange={(event) => { setExpectedDate(event.target.value); handleChange("expectedDate", { supplierId, expectedDate: event.target.value, lines }); }} onBlur={() => handleBlur("expectedDate", formValues())} />
                {shouldShow("expectedDate") && <FormFieldError field="expectedDate" message={errors.expectedDate} />}
              </div>
            </div>
            {shouldShow("lines") && <FormFieldError field="lines" message={errors.lines} />}
            <div className="space-y-3" data-field="lines">
              <div className="flex justify-between"><Label>PO lines</Label><Button type="button" size="sm" variant="outline" onClick={() => updateLines((current) => [...current, blankLine()])}><Plus className="mr-1 h-3.5 w-3.5" /> Line</Button></div>
              {lines.map((line, index) => (
                <div key={index} className="space-y-2 rounded-lg border p-3">
                  <div className="flex gap-2">
                    <Select value={line.inventoryItemId} onValueChange={(id) => { const item = inventory.find((row) => row.id === id); if (!item) return; updateLines((current) => current.map((row, i) => i === index ? { ...row, inventoryItemId: item.id, sku: item.sku, description: item.name, unitCost: Number(item.unitCost) } : row)); }}>
                      <SelectTrigger><SelectValue placeholder="Link inventory item" /></SelectTrigger>
                      <SelectContent>{inventory.map((item) => <SelectItem key={item.id} value={item.id}>{item.sku} · {item.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button type="button" size="icon" variant="ghost" disabled={lines.length === 1} onClick={() => updateLines((current) => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid grid-cols-[1fr_2fr] gap-2">
                    <Input placeholder="SKU" value={line.sku} onChange={(event) => updateLines((current) => current.map((row, i) => i === index ? { ...row, sku: event.target.value } : row))} />
                    <Input placeholder="Description" value={line.description} onChange={(event) => updateLines((current) => current.map((row, i) => i === index ? { ...row, description: event.target.value } : row))} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input aria-label="Quantity ordered" type="number" min={1} value={line.quantityOrdered} onChange={(event) => updateLines((current) => current.map((row, i) => i === index ? { ...row, quantityOrdered: Number(event.target.value) } : row))} />
                    <Input aria-label="Unit cost" type="number" min={0} value={line.unitCost} onChange={(event) => updateLines((current) => current.map((row, i) => i === index ? { ...row, unitCost: Number(event.target.value) } : row))} />
                    <Input aria-label="Tax rate" type="number" min={0} value={line.taxRate} onChange={(event) => updateLines((current) => current.map((row, i) => i === index ? { ...row, taxRate: Number(event.target.value) } : row))} />
                  </div>
                  <p className="text-xs text-muted-foreground">Quantity · Unit cost · Tax %</p>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>Create PO</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div></RoleGuard>;
}
