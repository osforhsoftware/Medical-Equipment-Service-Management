import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  FileText,
  DollarSign,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { InventoryProductSelect } from "@/components/shared/InventoryProductSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { api, type BackendInventoryItem, type BackendSupplier } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatInventoryItemClass } from "@/lib/inventoryItemClass";
import { toast } from "@/lib/toast";

export interface RFQLine {
  description: string;
  quantity: number;
  unitCostEstimate?: number;
  /** UI-only: optional inventory link used to prefill description / estimate */
  inventoryItemId?: string;
}

function blankRfqLine(): RFQLine {
  return { description: "", quantity: 1, unitCostEstimate: 0, inventoryItemId: "" };
}

export interface SupplierQuoteLine {
  rfqLineIndex: number;
  description?: string;
  quantity: number;
  unitPrice: number;
  deliveryDays?: number;
  notes?: string;
}

export interface SupplierQuoteData {
  id: string;
  validUntil?: string | null;
  notes?: string | null;
  lines: SupplierQuoteLine[];
  createdAt: string;
}

export interface SupplierRFQData {
  id: string;
  reference: string;
  supplierId?: string | null;
  supplierName: string;
  status: "draft" | "sent" | "quoted" | "closed" | "cancelled";
  notes?: string | null;
  dueDate?: string | null;
  lines: RFQLine[];
  createdBy: string;
  createdAt: string;
  quotes?: SupplierQuoteData[];
}

export default function RFQs() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole(["admin", "inventory", "coordinator"]);
  const canManageSuppliers = hasRole(["admin", "inventory"]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<SupplierRFQData | null>(null);
  const [expandedRfqs, setExpandedRfqs] = useState<Record<string, boolean>>({});

  // New RFQ form state
  const [rfqForm, setRfqForm] = useState({
    supplierId: "",
    supplierName: "",
    dueDate: "",
    notes: "",
    lines: [blankRfqLine()],
  });

  // Quote form state
  const [quoteForm, setQuoteForm] = useState<{
    validUntil: string;
    notes: string;
    lines: SupplierQuoteLine[];
  }>({
    validUntil: "",
    notes: "",
    lines: [],
  });

  const { data: rfqs = [], isLoading } = useQuery<SupplierRFQData[]>({
    queryKey: ["supplier-rfqs"],
    queryFn: async () => {
      const res = await api.get<SupplierRFQData[]>("/rfqs");
      return res.data;
    },
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "options"],
    queryFn: () => api.listSuppliers({ limit: 100, page: 1 }).then((r) => r.data),
    staleTime: 60_000,
    enabled: createOpen,
    retry: 1,
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", "options"],
    queryFn: () => api.listInventory({ limit: 100, page: 1 }).then((r) => r.data),
    staleTime: 60_000,
    enabled: createOpen,
  });

  const suppliers: BackendSupplier[] = suppliersQuery.data ?? [];
  const inventory: BackendInventoryItem[] = inventoryQuery.data ?? [];

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["supplier-rfqs"] });

  const resetRfqForm = () => {
    setRfqForm({
      supplierId: "",
      supplierName: "",
      dueDate: "",
      notes: "",
      lines: [blankRfqLine()],
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedRfqs((p) => ({ ...p, [id]: !p[id] }));
  };

  const updateLines = (updater: (current: RFQLine[]) => RFQLine[]) => {
    setRfqForm((p) => ({ ...p, lines: updater(p.lines) }));
  };

  const handleAddLine = () => {
    updateLines((current) => [...current, blankRfqLine()]);
  };

  const handleRemoveLine = (idx: number) => {
    if (rfqForm.lines.length <= 1) return;
    updateLines((current) => current.filter((_, i) => i !== idx));
  };

  const estimatedTotal = useMemo(
    () =>
      rfqForm.lines.reduce(
        (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCostEstimate) || 0),
        0,
      ),
    [rfqForm.lines],
  );

  const handleCreateRfq = async () => {
    if (!rfqForm.supplierId.trim() || !rfqForm.supplierName.trim()) {
      toast.error("Select a supplier");
      return;
    }
    if (rfqForm.lines.some((l) => !l.description.trim())) {
      toast.error("All item lines require a description");
      return;
    }
    if (rfqForm.lines.some((l) => !(Number(l.quantity) > 0))) {
      toast.error("Quantity must be at least 1 on every line");
      return;
    }
    try {
      await api.post("/rfqs", {
        supplierId: rfqForm.supplierId,
        supplierName: rfqForm.supplierName,
        dueDate: rfqForm.dueDate || null,
        notes: rfqForm.notes || null,
        lines: rfqForm.lines.map(({ description, quantity, unitCostEstimate }) => ({
          description: description.trim(),
          quantity: Number(quantity) || 1,
          unitCostEstimate: Number(unitCostEstimate) || 0,
        })),
      });
      toast.success("RFQ created successfully");
      setCreateOpen(false);
      resetRfqForm();
      refetch();
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to create RFQ" });
    }
  };

  const handleOpenQuoteDialog = (rfq: SupplierRFQData) => {
    setSelectedRfq(rfq);
    const initialLines: SupplierQuoteLine[] = (rfq.lines || []).map((l, i) => ({
      rfqLineIndex: i,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitCostEstimate || 0,
      deliveryDays: 3,
      notes: "",
    }));
    setQuoteForm({
      validUntil: "",
      notes: "",
      lines: initialLines,
    });
    setQuoteDialogOpen(true);
  };

  const handleSubmitQuote = async () => {
    if (!selectedRfq) return;
    try {
      await api.post(`/rfqs/${selectedRfq.id}/quotes`, {
        rfqId: selectedRfq.id,
        ...quoteForm,
      });
      toast.success("Supplier quote recorded");
      setQuoteDialogOpen(false);
      refetch();
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to submit quote" });
    }
  };

  const filtered = rfqs.filter((r) => {
    const matchSearch =
      !search ||
      r.reference.toLowerCase().includes(search.toLowerCase()) ||
      r.supplierName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: rfqs.length,
    draft: rfqs.filter((r) => r.status === "draft").length,
    quoted: rfqs.filter((r) => r.status === "quoted").length,
    closed: rfqs.filter((r) => r.status === "closed").length,
  };

  return (
    <RoleGuard roles={["admin", "inventory", "coordinator", "billing"]}>
      <div className="space-y-5">
        <PageHeader
          title="Supplier RFQs & Quotes"
          subtitle="Request quotations from suppliers and compare pricing"
          icon={<Truck className="h-6 w-6" />}
          actions={
            canManage ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                New RFQ
              </Button>
            ) : undefined
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-border">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold tabular-nums text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total RFQs</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold tabular-nums text-amber-600">{stats.draft}</p>
              <p className="text-xs text-muted-foreground">Draft</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold tabular-nums text-blue-600">{stats.quoted}</p>
              <p className="text-xs text-muted-foreground">Quoted</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold tabular-nums text-green-600">{stats.closed}</p>
              <p className="text-xs text-muted-foreground">Closed</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search reference or supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="quoted">Quoted</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* RFQ List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Truck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">No RFQs found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((rfq) => {
              const isExpanded = !!expandedRfqs[rfq.id];
              return (
                <Card key={rfq.id} className="border-border">
                  <CardHeader className="py-3 px-4 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleExpand(rfq.id)}>
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{rfq.reference}</span>
                          <Badge variant={rfq.status === "quoted" ? "default" : "outline"} className="capitalize">
                            {rfq.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Supplier: <span className="font-medium text-foreground">{rfq.supplierName}</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Created: {formatDate(rfq.createdAt)}</span>
                      {canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenQuoteDialog(rfq);
                          }}
                        >
                          <DollarSign className="mr-1 h-3.5 w-3.5" />
                          Record Quote
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="px-4 pb-4 pt-1 border-t bg-muted/10 space-y-4">
                      {/* Lines */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Requested Items</p>
                        <div className="rounded-md border bg-background overflow-hidden text-sm">
                          <table className="w-full text-left">
                            <thead className="bg-muted/50 text-xs text-muted-foreground">
                              <tr>
                                <th className="p-2">Description</th>
                                <th className="p-2 text-right">Qty</th>
                                <th className="p-2 text-right">Est. Unit Cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(rfq.lines || []).map((l, i) => (
                                <tr key={i} className="border-t">
                                  <td className="p-2">{l.description}</td>
                                  <td className="p-2 text-right tabular-nums">{l.quantity}</td>
                                  <td className="p-2 text-right tabular-nums">{l.unitCostEstimate ? formatCurrency(l.unitCostEstimate) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Quotes Received */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Supplier Quotes Received ({rfq.quotes?.length || 0})
                        </p>
                        {(!rfq.quotes || rfq.quotes.length === 0) ? (
                          <p className="text-xs text-muted-foreground italic">No quotes recorded yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {rfq.quotes.map((q) => {
                              const total = (q.lines || []).reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);
                              return (
                                <div key={q.id} className="p-3 rounded-md border bg-background text-sm flex flex-col gap-2">
                                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <span>Submitted: {formatDate(q.createdAt)}</span>
                                    {q.validUntil && <span>Valid until: {formatDate(q.validUntil)}</span>}
                                    <span className="font-bold text-foreground text-sm">Total Quote: {formatCurrency(total)}</span>
                                  </div>
                                  <div className="text-xs space-y-1">
                                    {(q.lines || []).map((ql, idx) => (
                                      <div key={idx} className="flex justify-between border-b border-muted py-1">
                                        <span>Item #{ql.rfqLineIndex + 1} ({ql.quantity} pcs)</span>
                                        <span className="tabular-nums font-mono">{formatCurrency(ql.unitPrice)} / unit</span>
                                      </div>
                                    ))}
                                  </div>
                                  {q.notes && <p className="text-xs text-muted-foreground italic">Notes: {q.notes}</p>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Create RFQ Dialog */}
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) resetRfqForm();
          }}
        >
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Create Supplier Request for Quotation (RFQ)
              </DialogTitle>
              <DialogDescription>
                Send a structured RFQ to vendor for required parts or equipment.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label>
                      Supplier <RequiredMark />
                    </Label>
                    {canManageSuppliers ? (
                      <Link to="/app/suppliers" className="text-xs text-primary hover:underline">
                        Manage
                      </Link>
                    ) : null}
                  </div>
                  <Select
                    value={rfqForm.supplierId || undefined}
                    onValueChange={(value) => {
                      const supplier = suppliers.find((row) => row.id === value);
                      setRfqForm((p) => ({
                        ...p,
                        supplierId: value,
                        supplierName: supplier?.name ?? "",
                      }));
                    }}
                    disabled={suppliersQuery.isLoading || suppliersQuery.isError}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          suppliersQuery.isLoading
                            ? "Loading suppliers…"
                            : suppliersQuery.isError
                              ? "Could not load suppliers"
                              : "Select supplier"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {suppliersQuery.isError ? (
                    <p className="text-xs text-destructive">
                      Unable to load suppliers. Try again or ask an inventory admin to add vendors.
                    </p>
                  ) : !suppliersQuery.isLoading && suppliers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No suppliers found.
                      {canManageSuppliers ? (
                        <>
                          {" "}
                          <Link to="/app/suppliers" className="text-primary hover:underline">
                            Add a supplier
                          </Link>{" "}
                          first.
                        </>
                      ) : (
                        " Ask an inventory admin to add vendors first."
                      )}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label>Response Due Date</Label>
                  <Input
                    type="date"
                    value={rfqForm.dueDate}
                    onChange={(e) => setRfqForm((p) => ({ ...p, dueDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>Line Items</Label>
                  <Button type="button" size="sm" variant="outline" onClick={handleAddLine}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add Line
                  </Button>
                </div>
                {rfqForm.lines.map((line, idx) => (
                  <div key={idx} className="space-y-2 rounded-lg border border-border p-3">
                    <div className="flex gap-2">
                      <InventoryProductSelect
                        items={inventory}
                        value={line.inventoryItemId || ""}
                        onValueChange={(_id, item) => {
                          updateLines((current) =>
                            current.map((row, i) =>
                              i === idx
                                ? {
                                    ...row,
                                    inventoryItemId: item.id,
                                    description: item.name,
                                    unitCostEstimate: Number(item.unitCost) || 0,
                                  }
                                : row,
                            ),
                          );
                        }}
                        placeholder="Link inventory item (optional)"
                        getOptionLabel={(item) =>
                          `${formatInventoryItemClass(item.itemClass)} · ${item.sku} · ${item.name}`
                        }
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={rfqForm.lines.length <= 1}
                        onClick={() => handleRemoveLine(idx)}
                        aria-label={`Remove line ${idx + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_5.5rem_7.5rem]">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <Input
                          placeholder="Item description"
                          value={line.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateLines((current) =>
                              current.map((row, i) =>
                                i === idx ? { ...row, description: val } : row,
                              ),
                            );
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 1;
                            updateLines((current) =>
                              current.map((row, i) =>
                                i === idx ? { ...row, quantity: val } : row,
                              ),
                            );
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Est. Unit Cost</Label>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={line.unitCostEstimate || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            updateLines((current) =>
                              current.map((row, i) =>
                                i === idx ? { ...row, unitCostEstimate: val } : row,
                              ),
                            );
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Line estimate:{" "}
                      {formatCurrency(
                        (Number(line.quantity) || 0) * (Number(line.unitCostEstimate) || 0),
                      )}
                    </p>
                  </div>
                ))}
                <div className="flex justify-end text-sm font-medium tabular-nums">
                  Estimated total: {formatCurrency(estimatedTotal)}
                </div>
              </div>

              <div className="space-y-1">
                <Label>Notes / Specifications</Label>
                <Textarea
                  placeholder="Payment terms, delivery requirements..."
                  value={rfqForm.notes}
                  onChange={(e) => setRfqForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRfq}>Create RFQ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Record Quote Dialog */}
        <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Record Supplier Quotation for {selectedRfq?.reference}
              </DialogTitle>
              <DialogDescription>
                Enter prices received from {selectedRfq?.supplierName}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Quote Validity Date</Label>
                <Input
                  type="date"
                  value={quoteForm.validUntil}
                  onChange={(e) => setQuoteForm((p) => ({ ...p, validUntil: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Quoted Unit Prices</Label>
                {quoteForm.lines.map((ql, idx) => (
                  <div key={idx} className="p-2 border rounded-md space-y-1 text-sm bg-muted/20">
                    <p className="font-semibold">{ql.description || `Item #${idx + 1}`}</p>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Unit Price (₹)</Label>
                        <Input
                          type="number"
                          value={ql.unitPrice}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setQuoteForm((p) => {
                              const updated = [...p.lines];
                              updated[idx].unitPrice = val;
                              return { ...p, lines: updated };
                            });
                          }}
                        />
                      </div>
                      <div className="w-28">
                        <Label className="text-xs text-muted-foreground">Delivery (Days)</Label>
                        <Input
                          type="number"
                          value={ql.deliveryDays || 0}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setQuoteForm((p) => {
                              const updated = [...p.lines];
                              updated[idx].deliveryDays = val;
                              return { ...p, lines: updated };
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <Label>Quote Notes</Label>
                <Textarea
                  placeholder="Warranty terms, tax inclusion..."
                  value={quoteForm.notes}
                  onChange={(e) => setQuoteForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setQuoteDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitQuote}>Save Supplier Quote</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
