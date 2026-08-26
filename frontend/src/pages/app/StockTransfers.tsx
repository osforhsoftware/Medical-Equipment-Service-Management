import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";
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
import { api, type BackendStockTransfer } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

type Line = { inventoryItemId: string; quantity: number };
const blankLine = (): Line => ({ inventoryItemId: "", quantity: 1 });

const headerSchema = z.object({
  fromBranchId: fieldRules.selectRequired("a source branch"),
  toBranchId: fieldRules.selectRequired("a destination branch"),
});

function validateLines(lines: Line[]): FieldErrors {
  if (lines.some((line) => !line.inventoryItemId || line.quantity < 1)) {
    return { lines: "Each line needs an item and a quantity of at least 1." };
  }
  return {};
}

export default function StockTransfers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rowsQuery = useQuery({
    queryKey: ["stock-transfers"],
    queryFn: () => api.listDomainStockTransfers(),
  });
  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.listBranches(),
  });
  const inventoryQuery = useQuery({
    queryKey: ["inventory", "options"],
    queryFn: () => api.listInventory({ limit: 100, page: 1 }).then((r) => r.data),
  });

  const rows = rowsQuery.data ?? [];
  const branches = branchesQuery.data ?? [];
  const inventory = inventoryQuery.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const {
    errors,
    shouldShow,
    validateAll,
    handleChange,
    applyApiErrors,
    reset: resetValidation,
  } = useFormValidation<{ fromBranchId: string; toBranchId: string; lines: Line[] }>({
    fieldOrder: ["fromBranchId", "toBranchId", "lines"],
    schema: headerSchema,
    validate: (values) => {
      if (values.fromBranchId && values.toBranchId && values.fromBranchId === values.toBranchId) {
        return { toBranchId: "Source and destination must be different." };
      }
      return validateLines(values.lines);
    },
  });

  const sourceItems = inventory.filter((item) => !fromBranchId || item.branchId === fromBranchId);
  const formValues = () => ({ fromBranchId, toBranchId, lines });

  const create = async () => {
    if (!validateAll(formValues(), undefined, dialogRef.current)) return;
    setSaving(true);
    try {
      await api.createDomainStockTransfer({ fromBranchId, toBranchId, lines });
      setCreateOpen(false);
      setFromBranchId("");
      setToBranchId("");
      setLines([blankLine()]);
      resetValidation();
      await queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
      toast({ title: "Stock transfer created" });
    } catch (error) {
      if (!applyApiErrors(error, dialogRef.current)) {
        toast.apiError(error, { fallback: "Transfer failed" });
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendStockTransfer>[] = useMemo(() => [
    { key: "reference", header: "Transfer", render: (row) => <div className="flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 text-primary" /><span className="font-mono font-medium">{row.reference}</span></div> },
    { key: "route", header: "Route", render: (row) => <span>{row.fromBranch} → {row.toBranch}</span> },
    { key: "items", header: "Lines", render: (row) => <span>{row.items}</span> },
    { key: "createdAt", header: "Created", render: (row) => <span>{formatDate(row.createdAt)}</span> },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  ], []);

  return (
    <RoleGuard roles={["admin", "inventory"]}>
      <div className="space-y-6">
        <PageHeader
          title="Stock Transfers"
          description="Move inventory between branches. Dispatch from source, then receive at destination."
          actions={<Button variant="brand" onClick={() => { resetValidation(); setCreateOpen(true); }}><Plus className="mr-1 h-4 w-4" /> New transfer</Button>}
        />
        <DataTable
          data={rows}
          columns={columns}
          searchKeys={["reference", "fromBranch", "toBranch"]}
          emptyMessage="No stock transfers."
          loading={rowsQuery.isLoading}
          error={rowsQuery.error as Error | null}
          onRetry={() => void rowsQuery.refetch()}
          onRowClick={(row) => navigate(`/app/stock-transfers/${row.id}`)}
        />
        <Dialog open={createOpen} onOpenChange={(open) => { if (!open) resetValidation(); setCreateOpen(open); }}>
          <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>New stock transfer</DialogTitle></DialogHeader>
            <form noValidate onSubmit={(e) => { e.preventDefault(); void create(); }}>
              <div ref={dialogRef} className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2" data-field="fromBranchId">
                    <Label className={shouldShow("fromBranchId") ? "text-destructive" : undefined}>From branch<RequiredMark /></Label>
                    <Select value={fromBranchId} onValueChange={(value) => { setFromBranchId(value); setLines([blankLine()]); handleChange("fromBranchId", { fromBranchId: value, toBranchId, lines: [blankLine()] }); }}>
                      <SelectTrigger className={fieldErrorClass(shouldShow("fromBranchId"))} {...fieldAria("fromBranchId", shouldShow("fromBranchId") ? errors.fromBranchId : null)}>
                        <SelectValue placeholder="Source" />
                      </SelectTrigger>
                      <SelectContent>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {shouldShow("fromBranchId") && <FormFieldError field="fromBranchId" message={errors.fromBranchId} />}
                  </div>
                  <div className="grid gap-2" data-field="toBranchId">
                    <Label className={shouldShow("toBranchId") ? "text-destructive" : undefined}>To branch<RequiredMark /></Label>
                    <Select value={toBranchId} onValueChange={(value) => { setToBranchId(value); handleChange("toBranchId", { fromBranchId, toBranchId: value, lines }); }}>
                      <SelectTrigger className={fieldErrorClass(shouldShow("toBranchId"))} {...fieldAria("toBranchId", shouldShow("toBranchId") ? errors.toBranchId : null)}>
                        <SelectValue placeholder="Destination" />
                      </SelectTrigger>
                      <SelectContent>{branches.filter((branch) => branch.id !== fromBranchId).map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {shouldShow("toBranchId") && <FormFieldError field="toBranchId" message={errors.toBranchId} />}
                  </div>
                </div>
                {shouldShow("lines") && <FormFieldError field="lines" message={errors.lines} />}
                <div className="space-y-3" data-field="lines">
                  <div className="flex justify-between">
                    <Label>Items</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setLines((current) => [...current, blankLine()])}><Plus className="mr-1 h-3.5 w-3.5" /> Line</Button>
                  </div>
                  {lines.map((line, index) => (
                    <div key={index} className="flex gap-2">
                      <Select value={line.inventoryItemId} onValueChange={(id) => setLines((current) => current.map((row, i) => i === index ? { ...row, inventoryItemId: id } : row))}>
                        <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>{sourceItems.map((item) => <SelectItem key={item.id} value={item.id}>{item.sku} · {item.name} ({item.inStock})</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" min={1} className="w-24" value={line.quantity} onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, quantity: Number(event.target.value) } : row))} />
                      <Button type="button" size="icon" variant="ghost" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>Create transfer</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
