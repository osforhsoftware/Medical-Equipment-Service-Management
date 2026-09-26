import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Plus,
  Search,
  ShoppingCart,
  Clock,
  CheckCircle2,
  FileText,
  DollarSign,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  PackageCheck,
  Landmark,
  Receipt,
  Undo2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PurchaseStageNav, purchaseStageFromLocation } from "@/components/purchase/PurchaseStageNav";
import { ModuleQuickAction } from "@/components/shared/ModuleFlowStrip";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { InventoryProductSelect } from "@/components/shared/InventoryProductSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/StatCard";
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
  /** Minimum order quantity */
  moq: number;
  /** Lead time in days */
  deliveryDays: number;
  notes?: string;
}

export interface SupplierQuoteData {
  id: string;
  currency?: string | null;
  warranty?: string | null;
  incoterm?: string | null;
  shippingTerms?: string | null;
  paymentTerms?: string | null;
  countryOfOrigin?: string | null;
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const stage = purchaseStageFromLocation("/app/rfqs", searchParams.get("stage"));
  const canManage = hasRole(["admin", "inventory", "coordinator"]);
  const canConvertToPo = hasRole(["admin", "inventory"]);
  const canManageSuppliers = hasRole(["admin", "inventory"]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [convertingQuoteId, setConvertingQuoteId] = useState<string | null>(null);

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
    currency: string;
    warranty: string;
    incoterm: string;
    shippingTerms: string;
    paymentTerms: string;
    countryOfOrigin: string;
    validUntil: string;
    notes: string;
    lines: SupplierQuoteLine[];
  }>({
    currency: "INR",
    warranty: "",
    incoterm: "",
    shippingTerms: "",
    paymentTerms: "",
    countryOfOrigin: "",
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

  const openPoQuery = useQuery({
    queryKey: ["purchase-orders", "overview-open"],
    queryFn: () => api.listPurchaseOrders({ page: 1, limit: 100, status: "open" }),
    enabled: stage === "overview",
    staleTime: 60_000,
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
    queryFn: () => api.listInventory({ limit: 100, page: 1, status: "active" }).then((r) => r.data),
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
        lines: rfqForm.lines.map(({ description, quantity, unitCostEstimate, inventoryItemId }) => ({
          description: description.trim(),
          quantity: Number(quantity) || 1,
          unitCostEstimate: Number(unitCostEstimate) || 0,
          inventoryItemId: inventoryItemId || undefined,
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
      moq: l.quantity || 1,
      deliveryDays: 0,
      notes: "",
    }));
    setQuoteForm({
      currency: "INR",
      warranty: "",
      incoterm: "",
      shippingTerms: "",
      paymentTerms: "",
      countryOfOrigin: "",
      validUntil: "",
      notes: "",
      lines: initialLines,
    });
    setQuoteDialogOpen(true);
  };

  const handleSubmitQuote = async () => {
    if (!selectedRfq) return;
    if (!quoteForm.currency.trim()) {
      toast.error("Currency is required");
      return;
    }
    if (!quoteForm.validUntil) {
      toast.error("Validity of quotation is required");
      return;
    }
    if (!quoteForm.warranty.trim()) {
      toast.error("Warranty is required");
      return;
    }
    if (!quoteForm.incoterm.trim()) {
      toast.error("Incoterm is required");
      return;
    }
    if (!quoteForm.shippingTerms.trim()) {
      toast.error("Shipping terms are required");
      return;
    }
    if (!quoteForm.paymentTerms.trim()) {
      toast.error("Payment terms are required");
      return;
    }
    if (!quoteForm.countryOfOrigin.trim()) {
      toast.error("Country of origin is required");
      return;
    }
    if (quoteForm.lines.some((l) => !(Number(l.moq) > 0))) {
      toast.error("MOQ must be at least 1 on every line");
      return;
    }
    if (quoteForm.lines.some((l) => Number.isNaN(Number(l.deliveryDays)) || Number(l.deliveryDays) < 0)) {
      toast.error("Lead time is required on every line");
      return;
    }
    try {
      await api.post(`/rfqs/${selectedRfq.id}/quotes`, {
        rfqId: selectedRfq.id,
        currency: quoteForm.currency.trim(),
        warranty: quoteForm.warranty.trim(),
        incoterm: quoteForm.incoterm.trim(),
        shippingTerms: quoteForm.shippingTerms.trim(),
        paymentTerms: quoteForm.paymentTerms.trim(),
        countryOfOrigin: quoteForm.countryOfOrigin.trim(),
        validUntil: quoteForm.validUntil,
        notes: quoteForm.notes || null,
        lines: quoteForm.lines.map((l) => ({
          rfqLineIndex: l.rfqLineIndex,
          description: l.description,
          quantity: Number(l.quantity) || 1,
          unitPrice: Number(l.unitPrice) || 0,
          moq: Number(l.moq) || 1,
          deliveryDays: Number(l.deliveryDays) || 0,
          notes: l.notes,
        })),
      });
      toast.success("Supplier quote recorded");
      setQuoteDialogOpen(false);
      refetch();
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to submit quote" });
    }
  };

  const handleConvertQuote = async (rfq: SupplierRFQData, quote: SupplierQuoteData) => {
    setConvertingQuoteId(quote.id);
    try {
      const res = await api.convertSupplierQuoteToPo(rfq.id, quote.id);
      toast.success(`Purchase order ${res.purchaseOrder.reference} created`);
      refetch();
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      navigate(`/app/purchase-orders/${res.purchaseOrder.id}`);
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to convert quote to purchase order" });
    } finally {
      setConvertingQuoteId(null);
    }
  };

  const filtered = rfqs.filter((r) => {
    const matchSearch =
      !search ||
      r.reference.toLowerCase().includes(search.toLowerCase()) ||
      r.supplierName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchQuotes = stage !== "quotes" || (r.quotes?.length ?? 0) > 0;
    return matchSearch && matchStatus && matchQuotes;
  });

  useEffect(() => {
    if (stage !== "quotes") return;
    setExpandedRfqs((current) => {
      const next = { ...current };
      for (const rfq of rfqs) {
        if ((rfq.quotes?.length ?? 0) > 0) next[rfq.id] = true;
      }
      return next;
    });
  }, [stage, rfqs]);

  const stats = {
    total: rfqs.length,
    draft: rfqs.filter((r) => r.status === "draft").length,
    quoted: rfqs.filter((r) => r.status === "quoted").length,
    closed: rfqs.filter((r) => r.status === "closed").length,
    withQuotes: rfqs.filter((r) => (r.quotes?.length ?? 0) > 0).length,
  };
  const openPoCount = openPoQuery.data?.meta?.total ?? openPoQuery.data?.data?.length ?? 0;

  return (
    <RoleGuard roles={["admin", "inventory", "coordinator", "billing"]}>
      <div className="space-y-5">
        <PageHeader
          title={
            stage === "overview"
              ? "Purchase Overview"
              : stage === "quotes"
                ? "Supplier quote"
                : "RFQ"
          }
          subtitle={
            stage === "overview"
              ? "Buy desk at a glance — Purchase request → RFQ → quote → PO → shipment → customs → GRN → stock."
              : stage === "quotes"
                ? "Record supplier offers, then convert an accepted quote to a PO."
                : "Request quotes from suppliers for stock and parts."
          }
          icon={<Truck className="h-6 w-6" />}
          actions={
            canManage && (stage === "rfq" || stage === "overview") ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                New RFQ
              </Button>
            ) : undefined
          }
        />

        <PurchaseStageNav stage={stage} />

        {stage === "overview" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total RFQs" value={String(stats.total)} icon={FileText} />
              <StatCard label="Draft" value={String(stats.draft)} icon={Clock} accent="warning" />
              <StatCard label="With quotes" value={String(stats.withQuotes)} icon={Truck} accent="accent" />
              <StatCard label="Open POs" value={String(openPoCount)} icon={Receipt} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {canManage ? (
                <ModuleQuickAction title="New RFQ" hint="Request supplier pricing" icon={Plus} onClick={() => setCreateOpen(true)} />
              ) : null}
              <ModuleQuickAction title="Purchase requests" hint="Reorder / parts need" icon={PackageCheck} to="/app/stock-purchase-requests?desk=purchase" />
              <ModuleQuickAction title="RFQ list" hint={`${stats.total} request(s)`} icon={FileText} to="/app/rfqs?stage=rfq" />
              <ModuleQuickAction title="Supplier quotes" hint="Compare offers" icon={Truck} to="/app/rfqs?stage=quotes" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ModuleQuickAction title="Purchase orders" hint="Ordered qty · price · ETA" icon={ShoppingCart} to="/app/purchase-orders" />
              <ModuleQuickAction title="Shipment" hint="Freight · courier · tracking" icon={Truck} to="/app/purchase-orders?stage=shipment" />
              <ModuleQuickAction title="Customs" hint="Duty & import costs" icon={Landmark} to="/app/purchase-orders?stage=customs" />
              <ModuleQuickAction title="GRN → Stock" hint="Receive & value inventory" icon={PackageCheck} to="/app/purchase-orders?stage=grn" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ModuleQuickAction title="Stock (received)" hint="Landed-cost valued POs" icon={PackageCheck} to="/app/purchase-orders?stage=stock" />
              <ModuleQuickAction title="Purchase returns" hint="Return to supplier" icon={Undo2} to="/app/purchase-returns" />
            </div>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">Recent RFQs</CardTitle>
                  <CardDescription className="text-xs">Latest supplier requests</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild className="h-8 text-xs text-primary">
                  <Link to="/app/rfqs?stage=rfq">View all →</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : rfqs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No RFQs yet. Create your first request.</p>
                ) : (
                  rfqs.slice(0, 6).map((rfq) => (
                    <div
                      key={rfq.id}
                      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-primary">{rfq.reference}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {rfq.supplierName} · {formatDate(rfq.createdAt)}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {rfq.status}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
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
              <p className="font-medium text-muted-foreground">
                {stage === "quotes" ? "No supplier quotes recorded yet." : "No RFQs found"}
              </p>
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
                              const currency = q.currency || "INR";
                              return (
                                <div key={q.id} className="p-3 rounded-md border bg-background text-sm flex flex-col gap-2">
                                  <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-muted-foreground">
                                    <span>Submitted: {formatDate(q.createdAt)}</span>
                                    {q.validUntil && <span>Valid until: {formatDate(q.validUntil)}</span>}
                                    <span className="font-bold text-foreground text-sm">
                                      Total Quote: {formatCurrency(total)} ({currency})
                                    </span>
                                  </div>
                                  <div className="grid gap-1 text-xs sm:grid-cols-2">
                                    {q.currency && <span><span className="text-muted-foreground">Currency:</span> {q.currency}</span>}
                                    {q.incoterm && <span><span className="text-muted-foreground">Incoterm:</span> {q.incoterm}</span>}
                                    {q.shippingTerms && <span><span className="text-muted-foreground">Shipping:</span> {q.shippingTerms}</span>}
                                    {q.paymentTerms && <span><span className="text-muted-foreground">Payment:</span> {q.paymentTerms}</span>}
                                    {q.warranty && <span><span className="text-muted-foreground">Warranty:</span> {q.warranty}</span>}
                                    {q.countryOfOrigin && <span><span className="text-muted-foreground">Origin:</span> {q.countryOfOrigin}</span>}
                                  </div>
                                  <div className="text-xs space-y-1">
                                    {(q.lines || []).map((ql, idx) => (
                                      <div key={idx} className="flex flex-wrap justify-between gap-2 border-b border-muted py-1">
                                        <span>Item #{ql.rfqLineIndex + 1} ({ql.quantity} pcs)</span>
                                        <span className="tabular-nums font-mono">
                                          {formatCurrency(ql.unitPrice)} / unit
                                          {ql.moq != null ? ` · MOQ ${ql.moq}` : ""}
                                          {ql.deliveryDays != null ? ` · Lead ${ql.deliveryDays}d` : ""}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  {q.notes && <p className="text-xs text-muted-foreground italic">Notes: {q.notes}</p>}
                                  {canConvertToPo && rfq.status !== "cancelled" ? (
                                    <div className="pt-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={convertingQuoteId === q.id}
                                        onClick={() => void handleConvertQuote(rfq, q)}
                                      >
                                        {convertingQuoteId === q.id ? (
                                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                                        )}
                                        Convert to PO
                                      </Button>
                                    </div>
                                  ) : null}
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
          </>
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
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Record Supplier Quotation for {selectedRfq?.reference}
              </DialogTitle>
              <DialogDescription>
                Enter commercial terms and prices received from {selectedRfq?.supplierName}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>
                    Currency <RequiredMark />
                  </Label>
                  <Select
                    value={quoteForm.currency}
                    onValueChange={(value) => setQuoteForm((p) => ({ ...p, currency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                      <SelectItem value="CNY">CNY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>
                    Validity of quotation <RequiredMark />
                  </Label>
                  <Input
                    type="date"
                    value={quoteForm.validUntil}
                    onChange={(e) => setQuoteForm((p) => ({ ...p, validUntil: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>
                    Incoterm <RequiredMark />
                  </Label>
                  <Select
                    value={quoteForm.incoterm || undefined}
                    onValueChange={(value) => setQuoteForm((p) => ({ ...p, incoterm: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Incoterm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXW">EXW</SelectItem>
                      <SelectItem value="FCA">FCA</SelectItem>
                      <SelectItem value="FOB">FOB</SelectItem>
                      <SelectItem value="CFR">CFR</SelectItem>
                      <SelectItem value="CIF">CIF</SelectItem>
                      <SelectItem value="CPT">CPT</SelectItem>
                      <SelectItem value="CIP">CIP</SelectItem>
                      <SelectItem value="DAP">DAP</SelectItem>
                      <SelectItem value="DPU">DPU</SelectItem>
                      <SelectItem value="DDP">DDP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>
                    Country of origin <RequiredMark />
                  </Label>
                  <Input
                    placeholder="e.g. India, China, Germany"
                    value={quoteForm.countryOfOrigin}
                    onChange={(e) => setQuoteForm((p) => ({ ...p, countryOfOrigin: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>
                    Warranty <RequiredMark />
                  </Label>
                  <Input
                    placeholder="e.g. 12 months from delivery"
                    value={quoteForm.warranty}
                    onChange={(e) => setQuoteForm((p) => ({ ...p, warranty: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>
                    Payment terms <RequiredMark />
                  </Label>
                  <Input
                    placeholder="e.g. Net 30, 50% advance"
                    value={quoteForm.paymentTerms}
                    onChange={(e) => setQuoteForm((p) => ({ ...p, paymentTerms: e.target.value }))}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>
                    Shipping terms <RequiredMark />
                  </Label>
                  <Input
                    placeholder="e.g. Door delivery, freight collect"
                    value={quoteForm.shippingTerms}
                    onChange={(e) => setQuoteForm((p) => ({ ...p, shippingTerms: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Line items (unit price, MOQ, lead time)</Label>
                {quoteForm.lines.map((ql, idx) => (
                  <div key={idx} className="p-3 border rounded-md space-y-2 text-sm bg-muted/20">
                    <p className="font-semibold">{ql.description || `Item #${idx + 1}`}</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Unit price <RequiredMark />
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={ql.unitPrice}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setQuoteForm((p) => {
                              const updated = [...p.lines];
                              updated[idx] = { ...updated[idx], unitPrice: val };
                              return { ...p, lines: updated };
                            });
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          MOQ <RequiredMark />
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          value={ql.moq}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setQuoteForm((p) => {
                              const updated = [...p.lines];
                              updated[idx] = { ...updated[idx], moq: val };
                              return { ...p, lines: updated };
                            });
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Lead time (days) <RequiredMark />
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={ql.deliveryDays}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setQuoteForm((p) => {
                              const updated = [...p.lines];
                              updated[idx] = { ...updated[idx], deliveryDays: val };
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
                  placeholder="Additional remarks..."
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
