import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2, ShoppingCart } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { INVENTORY_WRITE_ROLES } from "@/config/roles";
import { ApiError, api, type BackendStockPurchaseRequest } from "@/lib/api";
import { defaultDatePlusDays, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

const convertSchema = z.object({
  expectedDate: fieldRules.requiredString("Expected date"),
  unitCost: z.string().refine((v) => !v.trim() || (!Number.isNaN(Number(v)) && Number(v) >= 0), "Unit cost cannot be negative."),
});

export default function StockPurchaseRequests() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canConvert = hasRole(INVENTORY_WRITE_ROLES);
  const rowsQuery = useQuery({
    queryKey: ["stock-purchase-requests"],
    queryFn: () => api.listStockPurchaseRequests(),
  });
  const rows = rowsQuery.data ?? [];
  const [selected, setSelected] = useState<BackendStockPurchaseRequest | null>(null);
  const [expectedDate, setExpectedDate] = useState(defaultDatePlusDays(7));
  const [unitCost, setUnitCost] = useState("");
  const [saving, setSaving] = useState(false);
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
    fieldOrder: ["expectedDate", "unitCost"],
    schema: convertSchema,
  });

  const formValues = () => ({ expectedDate, unitCost });

  const convert = async () => {
    if (!selected) return;
    if (!validateAll(formValues(), undefined, dialogRef.current)) return;
    setSaving(true);
    try {
      await api.convertStockPurchaseRequest(selected.id, {
        expectedDate,
        unitCost: unitCost ? Number(unitCost) : undefined,
      });
      toast({ title: "Converted to purchase order" });
      setSelected(null);
      resetValidation();
      await queryClient.invalidateQueries({ queryKey: ["stock-purchase-requests"] });
    } catch (err) {
      if (!applyApiErrors(err, dialogRef.current)) {
        toast({
          title: "Convert failed",
          description: err instanceof ApiError ? err.message : "Unable to convert",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendStockPurchaseRequest>[] = [
    {
      key: "inventoryItem",
      header: "Item",
      render: (r) => (
        <div>
          <p className="font-medium">{r.inventoryItem?.name ?? r.inventoryItemId}</p>
          <p className="font-mono text-xs text-muted-foreground">{r.inventoryItem?.sku}</p>
        </div>
      ),
    },
    { key: "quantity", header: "Qty", render: (r) => <span>{r.quantity}</span> },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge variant={r.status === "open" ? "default" : "secondary"}>{r.status}</Badge>,
    },
    { key: "note", header: "Note", render: (r) => <span className="text-sm text-muted-foreground">{r.note ?? "—"}</span> },
    { key: "createdAt", header: "Requested", render: (r) => <span className="text-sm">{formatDate(r.createdAt)}</span> },
    {
      key: "actions" as keyof BackendStockPurchaseRequest,
      header: "",
      render: (r) =>
        canConvert && r.status === "open" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              resetValidation();
              setUnitCost(String(r.inventoryItem?.unitCost ?? ""));
              setSelected(r);
            }}
          >
            Convert to PO
          </Button>
        ) : null,
    },
  ];

  return (
    <RoleGuard roles={["admin", "inventory", "inspector", "engineer"]}>
      <div className="space-y-6">
        <PageHeader
          title="Stock Purchase Requests"
          description="Shortage requests raised by inspectors/engineers. Inventory staff converts them into purchase orders."
        />
        {rowsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <DataTable
            data={rows}
            columns={columns}
            searchKeys={["note"]}
            emptyMessage="No stock purchase requests."
            onRowClick={(r) => navigate(`/app/stock-purchase-requests/${r.id}`)}
          />
        )}

        <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { resetValidation(); setSelected(null); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Convert to Purchase Order
              </DialogTitle>
            </DialogHeader>
            <form noValidate onSubmit={(e) => { e.preventDefault(); void convert(); }}>
              <div ref={dialogRef} className="grid gap-3 py-2">
                <p className="text-sm text-muted-foreground">
                  {selected?.inventoryItem?.name} × {selected?.quantity}
                </p>
                <div className="grid gap-2" data-field="expectedDate">
                  <Label htmlFor="spr-expected-date" className={shouldShow("expectedDate") ? "text-destructive" : undefined}>
                    Expected date
                    <RequiredMark />
                  </Label>
                  <Input
                    id="spr-expected-date"
                    name="expectedDate"
                    type="date"
                    value={expectedDate}
                    className={fieldErrorClass(shouldShow("expectedDate"))}
                    {...fieldAria("expectedDate", shouldShow("expectedDate") ? errors.expectedDate : null)}
                    onChange={(e) => {
                      setExpectedDate(e.target.value);
                      handleChange("expectedDate", { expectedDate: e.target.value, unitCost });
                    }}
                    onBlur={() => handleBlur("expectedDate", formValues())}
                  />
                  {shouldShow("expectedDate") && <FormFieldError field="expectedDate" message={errors.expectedDate} />}
                </div>
                <div className="grid gap-2" data-field="unitCost">
                  <Label htmlFor="spr-unit-cost" className={shouldShow("unitCost") ? "text-destructive" : undefined}>Unit cost</Label>
                  <Input
                    id="spr-unit-cost"
                    name="unitCost"
                    type="number"
                    min={0}
                    value={unitCost}
                    className={fieldErrorClass(shouldShow("unitCost"))}
                    {...fieldAria("unitCost", shouldShow("unitCost") ? errors.unitCost : null)}
                    onChange={(e) => {
                      setUnitCost(e.target.value);
                      handleChange("unitCost", { expectedDate, unitCost: e.target.value });
                    }}
                    onBlur={() => handleBlur("unitCost", formValues())}
                  />
                  {shouldShow("unitCost") && <FormFieldError field="unitCost" message={errors.unitCost} />}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
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
