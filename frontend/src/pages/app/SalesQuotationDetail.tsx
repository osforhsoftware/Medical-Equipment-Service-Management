import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronsUpDown, Download, Eye, FilePenLine, Loader2, Minus, Package, Plus, Printer, Trash2, XCircle } from "lucide-react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfessionalDocument } from "@/components/shared/ProfessionalDocument";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { inventoryOriginUnitPrice } from "@/components/shared/InventoryHelpers";
import { ProductThumb, productImageFileId } from "@/components/shared/ProductThumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { SALES_WRITE_ROLES } from "@/config/roles";
import { useAuth } from "@/context/AuthContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ApiError, api, type BackendEstimate, type BackendInventoryItem } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type QuoteLine = {
  key: string;
  inventoryItemId?: string | null;
  catalogItemId?: string | null;
  type: string;
  description: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
};

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isClosed(status: string) {
  return status === "converted" || status === "rejected";
}

function linesFromQuote(quote: BackendEstimate): QuoteLine[] {
  return (quote.lineItems ?? []).map((line) => ({
    key: line.id || newKey(),
    inventoryItemId: line.inventoryItemId,
    catalogItemId: line.catalogItemId,
    type: line.type || (line.inventoryItemId ? "part" : "other"),
    description: line.description,
    sku: line.partNumber,
    quantity: Number(line.quantity) || 1,
    unitPrice: Number(line.unitPrice) || 0,
    discount: Number(line.discount) || 0,
    taxRate: Number(line.taxRate) || 0,
  }));
}

function lineAmount(line: QuoteLine) {
  const net = Math.max(0, line.quantity * line.unitPrice - (line.discount || 0));
  return net + (net * (line.taxRate || 0)) / 100;
}

export default function SalesQuotationDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canWrite = hasRole(SALES_WRITE_ROLES);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [customName, setCustomName] = useState("");
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [pdfBusy, setPdfBusy] = useState(false);
  const debouncedItemSearch = useDebouncedValue(itemSearch);

  const quoteQuery = useQuery({
    queryKey: ["sales-quotation", id],
    queryFn: () => api.getEstimate(id),
    enabled: Boolean(id),
  });
  const quote = quoteQuery.data;
  const closed = quote ? isClosed(quote.status) : false;

  const customerQuery = useQuery({
    queryKey: ["customers", quote?.customerId],
    queryFn: () => api.getCustomer(quote!.customerId!),
    enabled: Boolean(quote?.customerId),
  });
  const customer = customerQuery.data;

  useEffect(() => {
    if (!quote) return;
    setLines(linesFromQuote(quote));
    setNotes(quote.notes ?? "");
    setValidUntil(quote.validUntil ? quote.validUntil.slice(0, 10) : "");
  }, [quote]);

  const inventoryQuery = useQuery({
    queryKey: ["inventory", "sales-quotation", debouncedItemSearch],
    queryFn: () =>
      api.listInventory({
        status: "active",
        limit: 50,
        page: 1,
        search: debouncedItemSearch || undefined,
        sortBy: "name",
        sortOrder: "asc",
      }),
    enabled: Boolean(quote) && !closed && canWrite,
  });

  const selectedInventoryIds = useMemo(
    () => new Set(lines.map((line) => line.inventoryItemId).filter(Boolean) as string[]),
    [lines],
  );
  const total = useMemo(() => lines.reduce((sum, line) => sum + lineAmount(line), 0), [lines]);

  const refresh = async (next?: BackendEstimate) => {
    if (next) queryClient.setQueryData(["sales-quotation", id], next);
    await queryClient.invalidateQueries({ queryKey: ["estimates", "sales-quotations"] });
    await quoteQuery.refetch();
  };

  const payload = () => ({
    validUntil,
    notes: notes.trim() || null,
    lines: lines
      .filter((line) => line.description.trim() && line.quantity > 0)
      .map((line) => ({
        inventoryItemId: line.inventoryItemId ?? null,
        catalogItemId: line.catalogItemId ?? null,
        type: line.inventoryItemId ? "part" : line.type || "other",
        description: line.description.trim(),
        sku: line.sku ?? null,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice) || 0,
        discount: Number(line.discount) || 0,
        taxRate: Number(line.taxRate) || 0,
      })),
  });

  const save = async () => {
    const body = payload();
    if (!body.lines.length) {
      toast({ title: "Add at least one product", variant: "destructive" });
      return null;
    }
    if (!validUntil) {
      toast({ title: "Set a valid-until date", variant: "destructive" });
      return null;
    }
    setSaving(true);
    try {
      const updated = await api.updateSalesQuote(id, body);
      toast.success("Quotation updated");
      await refresh(updated);
      return updated;
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to update quotation" });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const convert = async () => {
    const saved = closed ? quote : await save();
    if (!saved) return;
    setSaving(true);
    try {
      const order = await api.convertSalesQuote(id);
      toast.success("Sales order created", { description: order.reference });
      navigate(`/app/sales/orders/${order.id}`);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to convert quotation" });
      setSaving(false);
    }
  };

  const reject = async () => {
    setSaving(true);
    try {
      const updated = await api.rejectSalesQuote(id, rejectNote.trim() || undefined);
      toast.success("Quotation rejected");
      setRejectOpen(false);
      setRejectNote("");
      await refresh(updated);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to reject quotation" });
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async () => {
    if (!quote) return;
    setPdfBusy(true);
    try {
      const doc = await api.generateDocument("estimate", quote.id);
      if (doc.file?.id) window.open(api.fileDownloadUrl(doc.file.id), "_blank");
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to generate PDF" });
    } finally {
      setPdfBusy(false);
    }
  };

  const addInventory = (item: BackendInventoryItem) => {
    setLines((prev) => {
      if (prev.some((line) => line.inventoryItemId === item.id)) return prev;
      return [
        ...prev,
        {
          key: newKey(),
          inventoryItemId: item.id,
          type: "part",
          description: item.name,
          sku: item.sku,
          quantity: 1,
          unitPrice: inventoryOriginUnitPrice(item),
          discount: 0,
          taxRate: 0,
        },
      ];
    });
  };

  const addCustom = () => {
    const description = customName.trim();
    if (!description) {
      toast({ title: "Enter a custom product name", variant: "destructive" });
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        type: "other",
        description,
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        taxRate: 0,
      },
    ]);
    setCustomName("");
  };

  return (
    <RoleGuard roles={["admin", "sales", "coordinator", "billing"]}>
      <div className="space-y-5">
        <Button variant="ghost" size="sm" className="no-print -ml-2 w-fit text-muted-foreground" asChild>
          <Link to="/app/sales/quotations">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to quotations
          </Link>
        </Button>

        {quoteQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading quotation…
          </div>
        ) : quoteQuery.isError ? (
          <p className="text-sm text-destructive">
            {quoteQuery.error instanceof ApiError ? quoteQuery.error.message : "Unable to load quotation"}
          </p>
        ) : quote?.serviceRequestId ? (
          <p className="text-sm text-muted-foreground">This record belongs to a service estimate, not product sales.</p>
        ) : quote ? (
          <>
            <PageHeader
              title={quote.reference}
              description={`${quote.customerName} · preview the quotation, then edit, convert to an order, or reject.`}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={mode === "preview" ? "secondary" : "outline"}
                    onClick={() => setMode("preview")}
                  >
                    <Eye className="mr-1 h-4 w-4" /> Preview
                  </Button>
                  {canWrite && !closed ? (
                    <Button
                      variant={mode === "edit" ? "secondary" : "outline"}
                      onClick={() => setMode("edit")}
                    >
                      <FilePenLine className="mr-1 h-4 w-4" /> Edit quotation
                    </Button>
                  ) : null}
                  {mode === "preview" ? (
                    <>
                      <Button variant="outline" onClick={() => window.print()}>
                        <Printer className="mr-1 h-4 w-4" /> Print
                      </Button>
                      <Button variant="outline" disabled={pdfBusy} onClick={() => void downloadPdf()}>
                        {pdfBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                        PDF
                      </Button>
                    </>
                  ) : null}
                  {canWrite && !closed && mode === "edit" ? (
                    <Button variant="outline" disabled={saving} onClick={() => void save()}>
                      {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                      Update quotation
                    </Button>
                  ) : null}
                  {canWrite && !closed ? (
                    <>
                      <Button variant="outline" disabled={saving} onClick={() => setRejectOpen(true)}>
                        <XCircle className="mr-1 h-4 w-4" /> Reject
                      </Button>
                      <Button variant="brand" disabled={saving} onClick={() => void convert()}>
                        Convert to order
                      </Button>
                    </>
                  ) : null}
                </div>
              }
            />

            <div className="no-print flex flex-wrap items-center gap-2">
              <StatusBadge status={quote.status === "draft" ? "draft" : quote.status} />
              <span className="text-sm text-muted-foreground">{quote.customerName}</span>
              <span className="font-mono text-sm font-medium">{formatCurrency(total || Number(quote.total))}</span>
            </div>

            {closed ? (
              <p className="no-print text-sm text-muted-foreground">
                {quote.status === "converted"
                  ? "This quotation is now a sales order."
                  : "The customer rejected this quotation."}
              </p>
            ) : null}

            {mode === "preview" ? (
              <div className="print-area mx-auto w-full max-w-[210mm] border border-border bg-white shadow-sm print:mx-0 print:max-w-none print:border-0 print:shadow-none">
                <ProfessionalDocument
                  kind="Estimate"
                  reference={quote.reference}
                  customerName={quote.customerName}
                  customerAddress={
                    customer
                      ? [customer.address, customer.city, customer.country].filter(Boolean).join(", ")
                      : undefined
                  }
                  customerPhone={customer?.phone || undefined}
                  customerEmail={customer?.email || undefined}
                  equipmentName={lines.length === 1 ? lines[0].description : quote.equipmentName}
                  issueDate={quote.createdAt}
                  validOrDueLabel="Valid until"
                  validOrDueDate={validUntil || quote.validUntil}
                  detailsHeading="Quotation details"
                  detailRows={[
                    { label: "Customer", value: quote.customerName },
                    { label: "Revision", value: `Rev ${quote.revision}` },
                    { label: "Status", value: quote.status === "draft" ? "Open" : quote.status },
                  ]}
                  lines={lines.map((line) => ({
                    id: line.key,
                    description: line.sku ? `${line.description} (${line.sku})` : line.description,
                    type: line.type,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    discount: line.discount,
                    taxRate: line.taxRate,
                  }))}
                  notes={notes || undefined}
                  hideToolbar
                  showSignature
                />
              </div>
            ) : null}

            {mode === "edit" ? (
            <Card>
              <CardContent className="space-y-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Valid until</Label>
                    <Input
                      type="date"
                      value={validUntil}
                      disabled={closed || !canWrite}
                      onChange={(e) => setValidUntil(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <Textarea
                      rows={2}
                      value={notes}
                      disabled={closed || !canWrite}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                {canWrite && !closed ? (
                  <div className="space-y-3">
                    <Popover modal open={itemOpen} onOpenChange={setItemOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="h-10 w-full justify-between font-normal">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Package className="h-4 w-4" /> Select inventory products…
                          </span>
                          <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="z-[80] p-0" align="start" style={{ width: "var(--radix-popover-trigger-width)" }}>
                        <Command shouldFilter={!debouncedItemSearch}>
                          <CommandInput placeholder="Search by name or SKU…" value={itemSearch} onValueChange={setItemSearch} />
                          <CommandList className="max-h-60">
                            <CommandEmpty>{inventoryQuery.isLoading ? "Searching…" : "No matching products."}</CommandEmpty>
                            <CommandGroup>
                              {(inventoryQuery.data?.data ?? []).map((item) => {
                                const selected = selectedInventoryIds.has(item.id);
                                return (
                                  <CommandItem
                                    key={item.id}
                                    value={`${item.name} ${item.sku}`}
                                    onSelect={() => {
                                      if (selected) {
                                        setLines((prev) => prev.filter((line) => line.inventoryItemId !== item.id));
                                        return;
                                      }
                                      addInventory(item);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                    <ProductThumb fileId={productImageFileId(item)} name={item.name} size="xs" className="mr-2" />
                                    <span className="flex-1 truncate">{item.name}</span>
                                    <span className="text-xs text-muted-foreground">{formatCurrency(inventoryOriginUnitPrice(item))}</span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <div className="flex gap-2">
                      <Input
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Custom product not in inventory"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustom();
                          }
                        }}
                      />
                      <Button type="button" variant="outline" onClick={addCustom}>
                        <Plus className="mr-1 h-4 w-4" /> Add
                      </Button>
                    </div>
                  </div>
                ) : null}

                {lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No products on this quotation yet.</p>
                ) : (
                  <div className="space-y-2">
                    {lines.map((line) => (
                      <div key={line.key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_7rem_7rem_auto] sm:items-center">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                            {line.inventoryItemId ? "Inventory" : "Custom"}
                            {line.sku ? ` · ${line.sku}` : ""}
                          </p>
                          {line.inventoryItemId || closed || !canWrite ? (
                            <div className="flex min-w-0 items-center gap-2">
                              {line.inventoryItemId ? (
                                <ProductThumb
                                  fileId={productImageFileId(
                                    (inventoryQuery.data?.data ?? []).find((item) => item.id === line.inventoryItemId),
                                  )}
                                  name={line.description}
                                  size="xs"
                                />
                              ) : null}
                              <p className="truncate text-sm font-medium">{line.description}</p>
                            </div>
                          ) : (
                            <Input
                              className="mt-1 h-8"
                              value={line.description}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((row) => (row.key === line.key ? { ...row, description: e.target.value } : row)),
                                )
                              }
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-7"
                            disabled={closed || !canWrite}
                            onClick={() =>
                              setLines((prev) =>
                                prev.map((row) =>
                                  row.key === line.key ? { ...row, quantity: Math.max(1, row.quantity - 1) } : row,
                                ),
                              )
                            }
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            className="h-8 text-center"
                            type="number"
                            min={1}
                            disabled={closed || !canWrite}
                            value={line.quantity}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((row) =>
                                  row.key === line.key
                                    ? { ...row, quantity: Math.max(1, Number(e.target.value) || 1) }
                                    : row,
                                ),
                              )
                            }
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-7"
                            disabled={closed || !canWrite}
                            onClick={() =>
                              setLines((prev) =>
                                prev.map((row) => (row.key === line.key ? { ...row, quantity: row.quantity + 1 } : row)),
                              )
                            }
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input
                          className="h-8"
                          type="number"
                          min={0}
                          disabled={closed || !canWrite}
                          value={line.unitPrice}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((row) =>
                                row.key === line.key ? { ...row, unitPrice: Math.max(0, Number(e.target.value) || 0) } : row,
                              ),
                            )
                          }
                        />
                        {canWrite && !closed ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setLines((prev) => prev.filter((row) => row.key !== line.key))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span />
                        )}
                      </div>
                    ))}
                    <p className="text-right text-sm">
                      Quotation total <span className="font-medium">{formatCurrency(total)}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            ) : null}

            <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject this quotation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Use this when the customer declines the quote. It will not become a sales order.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Optional reason"
                  rows={3}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                  <AlertDialogAction disabled={saving} onClick={(e) => { e.preventDefault(); void reject(); }}>
                    Reject quotation
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : null}
      </div>
    </RoleGuard>
  );
}
