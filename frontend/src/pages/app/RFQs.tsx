import { useState } from "react";
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
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RoleGuard } from "@/components/auth/RoleGuard";
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
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

export interface RFQLine {
  description: string;
  quantity: number;
  unitCostEstimate?: number;
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<SupplierRFQData | null>(null);
  const [expandedRfqs, setExpandedRfqs] = useState<Record<string, boolean>>({});

  // New RFQ form state
  const [rfqForm, setRfqForm] = useState({
    supplierName: "",
    dueDate: "",
    notes: "",
    lines: [{ description: "", quantity: 1, unitCostEstimate: 0 }],
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

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["supplier-rfqs"] });

  const toggleExpand = (id: string) => {
    setExpandedRfqs((p) => ({ ...p, [id]: !p[id] }));
  };

  const handleAddLine = () => {
    setRfqForm((p) => ({
      ...p,
      lines: [...p.lines, { description: "", quantity: 1, unitCostEstimate: 0 }],
    }));
  };

  const handleRemoveLine = (idx: number) => {
    if (rfqForm.lines.length <= 1) return;
    setRfqForm((p) => ({
      ...p,
      lines: p.lines.filter((_, i) => i !== idx),
    }));
  };

  const handleCreateRfq = async () => {
    if (!rfqForm.supplierName.trim()) {
      toast.error("Supplier name required");
      return;
    }
    if (rfqForm.lines.some((l) => !l.description.trim())) {
      toast.error("All item lines require a description");
      return;
    }
    try {
      await api.post("/rfqs", rfqForm);
      toast.success("RFQ created successfully");
      setCreateOpen(false);
      setRfqForm({
        supplierName: "",
        dueDate: "",
        notes: "",
        lines: [{ description: "", quantity: 1, unitCostEstimate: 0 }],
      });
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
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                  <Label>Supplier Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. MedTech Supplies Ltd"
                    value={rfqForm.supplierName}
                    onChange={(e) => setRfqForm((p) => ({ ...p, supplierName: e.target.value }))}
                  />
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

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Line Items</Label>
                  <Button type="button" size="sm" variant="ghost" onClick={handleAddLine}>
                    + Add Line
                  </Button>
                </div>
                {rfqForm.lines.map((l, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Item description"
                      className="flex-1"
                      value={l.description}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRfqForm((p) => {
                          const updated = [...p.lines];
                          updated[idx].description = val;
                          return { ...p, lines: updated };
                        });
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      className="w-20"
                      min={1}
                      value={l.quantity}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 1;
                        setRfqForm((p) => {
                          const updated = [...p.lines];
                          updated[idx].quantity = val;
                          return { ...p, lines: updated };
                        });
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Est. Unit Cost"
                      className="w-28"
                      value={l.unitCostEstimate || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setRfqForm((p) => {
                          const updated = [...p.lines];
                          updated[idx].unitCostEstimate = val;
                          return { ...p, lines: updated };
                        });
                      }}
                    />
                    {rfqForm.lines.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveLine(idx)}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
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
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
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
