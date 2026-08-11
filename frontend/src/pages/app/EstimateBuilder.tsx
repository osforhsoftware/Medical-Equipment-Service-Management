import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGuard } from "@/components/auth/RoleGuard";
import {
  ApiError,
  api,
  type BackendCatalogItem,
  type BackendEstimate,
  type BackendInventoryItem,
  type BackendServiceRequest,
  type EstimateLineInput,
} from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import { defaultDatePlusDays, formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";

const newLine = (taxRate = 0, partial?: Partial<EstimateLineInput>): EstimateLineInput => ({
  type: "service",
  description: "",
  quantity: 1,
  unitPrice: 0,
  taxRate,
  discount: 0,
  ...partial,
});

export default function EstimateBuilder() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const taxDefault = settings?.defaultTaxRate ?? 0;

  const [ticket, setTicket] = useState<BackendServiceRequest | null>(null);
  const [estimate, setEstimate] = useState<BackendEstimate | null>(null);
  const [catalog, setCatalog] = useState<BackendCatalogItem[]>([]);
  const [inventory, setInventory] = useState<BackendInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validUntil, setValidUntil] = useState(defaultDatePlusDays(14));
  const [discount, setDiscount] = useState(0);
  const [terms, setTerms] = useState("Payment due as agreed. Parts are subject to availability.");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EstimateLineInput[]>([newLine(taxDefault)]);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const [sr, estimates, services, stock] = await Promise.all([
        api.getServiceRequest(ticketId),
        api.listEstimates(),
        api.listServiceCatalog(),
        api.listInventory(),
      ]);
      setTicket(sr);
      setCatalog(services.filter((s) => s.isActive));
      setInventory(stock);

      const existing = estimates.find((e) => e.serviceRequestId === ticketId || e.requestRef === sr.reference);
      const report = await api.getInspectionReport(ticketId).catch(() => null);
      const partsReqs = (report?.recommendations ?? []).filter(
        (r) => r.inventoryItemId || r.type === "part" || r.title.toLowerCase().includes("inventory"),
      );

      if (existing) {
        const full = await api.getEstimate(existing.id);
        setEstimate(full);
        setValidUntil(full.validUntil?.slice(0, 10) || defaultDatePlusDays(14));
        setDiscount(Number(full.discount) || 0);
        setTerms(full.terms || terms);
        setNotes(full.notes || "");
        if (full.lineItems?.length) {
          setLines(
            full.lineItems.map((line) => ({
              type: line.type as EstimateLineInput["type"],
              description: line.description,
              catalogItemId: line.catalogItemId,
              inventoryItemId: line.inventoryItemId,
              partNumber: line.partNumber,
              quantity: Number(line.quantity),
              unitPrice: Number(line.unitPrice),
              taxRate: Number(line.taxRate),
              discount: Number(line.discount),
            })),
          );
        } else if (partsReqs.length) {
          setLines(
            partsReqs.map((r) => {
              const item = stock.find((i) => i.id === r.inventoryItemId);
              const delivery =
                item?.deliveryChargeType === "perUnit"
                  ? Number(item.deliveryCharge ?? 0) * Number(r.quantity)
                  : Number(item?.deliveryCharge ?? 0);
              return newLine(taxDefault, {
                type: "part",
                description: r.title,
                inventoryItemId: r.inventoryItemId,
                quantity: Number(r.quantity) || 1,
                unitPrice: Number(item?.sellingPrice ?? r.estimatedCost ?? item?.unitCost ?? 0) + delivery,
              });
            }),
          );
        }
      } else if (partsReqs.length) {
        setLines(
          partsReqs.map((r) => {
            const item = stock.find((i) => i.id === r.inventoryItemId);
            return newLine(taxDefault, {
              type: "part",
              description: r.title || item?.name || "Part",
              inventoryItemId: r.inventoryItemId,
              quantity: Number(r.quantity) || 1,
              unitPrice: Number(item?.sellingPrice ?? r.estimatedCost ?? item?.unitCost ?? 0),
            });
          }),
        );
      }
    } catch (err) {
      toast({
        title: "Unable to load estimate builder",
        description: err instanceof ApiError ? err.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [ticketId, taxDefault, terms]);

  useEffect(() => {
    void load();
  }, [load]);

  const clientSubtotal = useMemo(
    () => lines.reduce((sum, line) => sum + Math.max(0, line.quantity * line.unitPrice - (line.discount || 0)), 0),
    [lines],
  );
  const clientTax = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const net = Math.max(0, line.quantity * line.unitPrice - (line.discount || 0));
        return sum + (net * (line.taxRate || 0)) / 100;
      }, 0),
    [lines],
  );
  const clientTotal = Math.max(0, clientSubtotal - discount) + clientTax;

  const updateLine = (index: number, patch: Partial<EstimateLineInput>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const applyCatalog = (index: number, catalogId: string) => {
    const item = catalog.find((c) => c.id === catalogId);
    if (!item) return;
    updateLine(index, {
      catalogItemId: item.id,
      type: "service",
      description: item.name,
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate),
    });
  };

  const applyInventory = (index: number, inventoryId: string) => {
    const item = inventory.find((i) => i.id === inventoryId);
    if (!item) return;
    const qty = lines[index]?.quantity || 1;
    const delivery =
      item.deliveryChargeType === "perUnit" ? Number(item.deliveryCharge ?? 0) * qty : Number(item.deliveryCharge ?? 0);
    updateLine(index, {
      inventoryItemId: item.id,
      type: "part",
      description: item.name,
      partNumber: item.sku,
      unitPrice: Number(item.sellingPrice ?? item.unitCost) + delivery / Math.max(qty, 1),
    });
  };

  const persist = async (sendForApproval: boolean) => {
    if (!ticketId || !ticket) return;
    if (lines.some((line) => !line.description.trim() || line.quantity <= 0)) {
      toast({ title: "Invalid lines", description: "Each line needs a description and quantity.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const laborCost = lines.filter((l) => l.type !== "part").reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      const partsCost = lines.filter((l) => l.type === "part").reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      let target = estimate;
      if (!target) {
        target = await api.createEstimate({
          serviceRequestId: ticketId,
          laborCost,
          partsCost,
          validUntil,
          status: "draft",
        });
      }
      const revised = await api.createEstimateRevision(target.id, {
        lines,
        discount,
        terms,
        notes,
        sendForApproval,
        status: sendForApproval ? "pendingAdminApproval" : "draft",
      });
      setEstimate(revised);
      toast({
        title: sendForApproval ? "Sent for admin approval" : "Estimate saved",
        description: `Server total: ${formatCurrency(revised.total)}`,
      });
      if (sendForApproval) navigate("/app/estimates");
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof ApiError ? err.message : "Unable to save",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading estimate builder…
      </div>
    );
  }

  return (
    <RoleGuard roles={["admin", "coordinator", "estimator"]}>
      <div className="space-y-6">
        <PageHeader
          title="Estimate Builder"
          description={
            ticket
              ? `${ticket.reference} · ${ticket.customerName} · ${ticket.equipmentName ?? "Equipment"}`
              : "Build itemized labor and parts estimate"
          }
          actions={
            <Button variant="outline" asChild>
              <Link to="/app/estimates">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Link>
            </Button>
          }
        />

        {ticket?.inspectionReport && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Inspector findings (read-only)</p>
            <p className="mt-1 text-muted-foreground">{ticket.inspectionReport.findings}</p>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-2">Description</th>
                <th className="p-2 w-28">Type</th>
                <th className="p-2 w-20">Qty</th>
                <th className="p-2 w-28">Unit Price</th>
                <th className="p-2 w-20">Tax %</th>
                <th className="p-2 w-28">Total</th>
                <th className="p-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const net = Math.max(0, line.quantity * line.unitPrice - (line.discount || 0));
                const lineTotal = net + (net * (line.taxRate || 0)) / 100;
                return (
                  <tr key={index} className="border-t border-border">
                    <td className="p-2 space-y-1">
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(index, { description: e.target.value })}
                        placeholder="Description"
                      />
                      <div className="flex gap-2">
                        <Select onValueChange={(v) => applyCatalog(index, v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Catalog" />
                          </SelectTrigger>
                          <SelectContent>
                            {catalog.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select onValueChange={(v) => applyInventory(index, v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Inventory item" />
                          </SelectTrigger>
                          <SelectContent>
                            {inventory.map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.name} ({i.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                    <td className="p-2">
                      <Select value={line.type} onValueChange={(v) => updateLine(index, { type: v as EstimateLineInput["type"] })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["labor", "part", "service", "transport", "testing", "calibration", "other"].map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min={0.001}
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min={0}
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min={0}
                        value={line.taxRate}
                        onChange={(e) => updateLine(index, { taxRate: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="p-2 font-medium">{formatCurrency(lineTotal)}</td>
                    <td className="p-2">
                      <Button size="icon" variant="ghost" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Button variant="outline" onClick={() => setLines((prev) => [...prev, newLine(taxDefault)])}>
          <Plus className="mr-1 h-4 w-4" /> Add line
        </Button>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>Validity date</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Discount</Label>
              <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
            </div>
            <div className="grid gap-2">
              <Label>Terms</Label>
              <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="rounded-lg border border-border p-4 space-y-2 h-fit">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(clientSubtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Discount</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax</span>
              <span>{formatCurrency(clientTax)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base border-t border-border pt-2">
              <span>Preview total</span>
              <span>{formatCurrency(clientTotal)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Final totals are computed server-side when you save.</p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" disabled={saving} onClick={() => void persist(false)}>
                Save draft
              </Button>
              <Button disabled={saving} onClick={() => void persist(true)}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send for Approval
              </Button>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
