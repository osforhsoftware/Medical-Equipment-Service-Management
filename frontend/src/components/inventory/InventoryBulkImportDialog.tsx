import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, PackagePlus, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type InventoryBulkImportResult } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import {
  downloadInventoryImportTemplate,
  parseInventoryImportFile,
  splitAmountAcrossProducts,
  type ParsedInventoryImportRow,
} from "@/lib/inventoryBulkImport";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

type Phase = "pick" | "preview" | "uploading" | "done";

type DeliverySplitSummary = {
  productCount: number;
  totalCharge: number;
  perProductAmounts: number[];
  chargeType: "flat" | "perUnit";
  createdCount: number;
};

export function InventoryBulkImportDialog({ open, onOpenChange, onImported }: Props) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sourceLabel, setSourceLabel] = useState("");
  const [rows, setRows] = useState<ParsedInventoryImportRow[]>([]);
  const [imageCount, setImageCount] = useState(0);
  const [result, setResult] = useState<InventoryBulkImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [totalDeliveryChargeInput, setTotalDeliveryChargeInput] = useState("");
  const [deliveryChargeType, setDeliveryChargeType] = useState<"flat" | "perUnit">("flat");
  const [deliverySplit, setDeliverySplit] = useState<DeliverySplitSummary | null>(null);

  const stats = useMemo(() => {
    const valid = rows.filter((r) => r.errors.length === 0);
    const invalid = rows.filter((r) => r.errors.length > 0);
    const withImage = rows.filter((r) => r.imageFile);
    const imageWarnings = rows.filter((r) => r.warnings.some((w) => /image/i.test(w)));
    return { valid: valid.length, invalid: invalid.length, withImage: withImage.length, imageWarnings: imageWarnings.length };
  }, [rows]);

  const totalDeliveryCharge = useMemo(() => {
    const raw = totalDeliveryChargeInput.trim();
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
  }, [totalDeliveryChargeInput]);

  const splitPreview = useMemo(() => {
    if (totalDeliveryCharge == null || stats.valid <= 0) return null;
    const amounts = splitAmountAcrossProducts(totalDeliveryCharge, stats.valid);
    if (!amounts.length) return null;
    const min = amounts[amounts.length - 1] ?? 0;
    const max = amounts[0] ?? 0;
    return { amounts, min, max, equal: min === max };
  }, [totalDeliveryCharge, stats.valid]);

  const reset = () => {
    setPhase("pick");
    setBusy(false);
    setProgress(0);
    setSourceLabel("");
    setRows([]);
    setImageCount(0);
    setResult(null);
    setParseError(null);
    setTotalDeliveryChargeInput("");
    setDeliveryChargeType("flat");
    setDeliverySplit(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (busy) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const onFileSelected = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setParseError(null);
    try {
      const parsed = await parseInventoryImportFile(file);
      if (!parsed.rows.length) {
        throw new Error("No product rows found in the spreadsheet.");
      }
      setRows(parsed.rows);
      setSourceLabel(parsed.sourceLabel);
      setImageCount(parsed.imageCount);
      setDeliverySplit(null);
      setPhase("preview");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to read import file.";
      setParseError(message);
      toast({ title: "Import file invalid", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    const validRows = rows.filter((r) => r.errors.length === 0);
    if (!validRows.length) {
      toast({ title: "Nothing to import", description: "Fix row errors before importing.", variant: "destructive" });
      return;
    }

    if (totalDeliveryChargeInput.trim() && totalDeliveryCharge == null) {
      toast({
        title: "Invalid delivery charge",
        description: "Enter a valid total delivery charge (0 or greater), or leave it blank.",
        variant: "destructive",
      });
      return;
    }

    const splitAmounts =
      totalDeliveryCharge != null
        ? splitAmountAcrossProducts(totalDeliveryCharge, validRows.length)
        : null;

    setBusy(true);
    setPhase("uploading");
    setProgress(0);
    try {
      const payloads: Parameters<typeof api.bulkImportInventoryItems>[0]["items"] = [];
      const totalSteps = validRows.length + 1;
      let step = 0;

      for (let index = 0; index < validRows.length; index += 1) {
        const row = validRows[index];
        const imageFileIds: string[] = [];
        if (row.imageFile) {
          try {
            const uploaded = await api.uploadFile(row.imageFile);
            imageFileIds.push(uploaded.id);
          } catch (err) {
            toast.apiError(err, {
              fallback: `Row ${row.row}: image upload failed — product will import without image.`,
            });
          }
        }

        payloads.push({
          row: row.row,
          sku: row.sku || undefined,
          name: row.name,
          itemClass: row.itemClass,
          category: row.category || undefined,
          subcategory: row.subcategory || null,
          description: row.description || null,
          manufacturer: row.manufacturer,
          compatibleModels: row.compatibleModels || null,
          inStock: row.inStock,
          reorderLevel: row.reorderLevel,
          binLocation: row.binLocation,
          unitCost: row.unitCost,
          sellingPrice: row.sellingPrice,
          deliveryCharge: splitAmounts ? splitAmounts[index] : row.deliveryCharge,
          deliveryChargeType: splitAmounts ? deliveryChargeType : row.deliveryChargeType,
          unitOfMeasure: row.unitOfMeasure,
          supplier: row.supplier,
          trackBatches: row.trackBatches,
          trackSerials: row.trackSerials,
          imageFileIds: imageFileIds.length ? imageFileIds : undefined,
        });

        step += 1;
        setProgress(Math.round((step / totalSteps) * 100));
      }

      const summary = await api.bulkImportInventoryItems({ items: payloads });
      setResult(summary);
      if (splitAmounts && totalDeliveryCharge != null) {
        setDeliverySplit({
          productCount: validRows.length,
          totalCharge: totalDeliveryCharge,
          perProductAmounts: splitAmounts,
          chargeType: deliveryChargeType,
          createdCount: summary.created,
        });
      } else {
        setDeliverySplit(null);
      }
      setProgress(100);
      setPhase("done");
      toast({
        title: "Bulk import finished",
        description: `${summary.created} created · ${summary.skipped} skipped · ${summary.failed} failed`,
      });
      if (summary.created > 0) onImported();
    } catch (err) {
      setPhase("preview");
      toast.apiError(err, { fallback: "Bulk import failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            Bulk import products
          </DialogTitle>
          <DialogDescription>
            Upload a ZIP with <span className="font-medium text-foreground">products.xlsx</span> (or CSV) plus an{" "}
            <span className="font-medium text-foreground">images/</span> folder. Image file names must match the{" "}
            <span className="font-medium text-foreground">imageFileName</span> column (JPEG, PNG, WebP).
          </DialogDescription>
        </DialogHeader>

        {phase === "pick" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={downloadInventoryImportTemplate}>
                <Download className="mr-1 h-4 w-4" />
                Download template
              </Button>
            </div>
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center transition hover:bg-muted/50",
                busy && "pointer-events-none opacity-60",
              )}
            >
              {busy ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
              <div className="text-sm font-medium">Drop or choose ZIP / Excel / CSV</div>
              <p className="max-w-md text-xs text-muted-foreground">
                ZIP layout: products.xlsx + images/SP-001.jpg. Plain .xlsx/.csv imports products without images.
              </p>
              <input
                type="file"
                className="sr-only"
                accept=".zip,.xlsx,.xls,.csv,application/zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  void onFileSelected(file);
                }}
              />
            </label>
            {parseError ? <p className="text-sm text-destructive">{parseError}</p> : null}
            <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Download the template and fill one product per row (`name` required).</li>
              <li>Rename product photos to match `imageFileName` (e.g. SKU.jpg).</li>
              <li>Zip the sheet with an `images` folder, then upload here.</li>
              <li>Review the preview, then confirm import.</li>
            </ol>
          </div>
        ) : null}

        {phase === "preview" || phase === "uploading" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary" className="gap-1">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {sourceLabel}
              </Badge>
              <Badge variant="outline">{rows.length} rows</Badge>
              <Badge variant="outline" className="text-emerald-700">
                {stats.valid} ready
              </Badge>
              {stats.invalid > 0 ? (
                <Badge variant="destructive">{stats.invalid} with errors</Badge>
              ) : null}
              <Badge variant="outline">{imageCount || stats.withImage} images matched</Badge>
            </div>

            {phase === "preview" ? (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div>
                  <div className="text-sm font-medium">Delivery charge (optional)</div>
                  <p className="text-xs text-muted-foreground">
                    Enter a total delivery charge to split equally across ready products and save on each item.
                    Leave blank to use each row&apos;s spreadsheet `deliveryCharge`.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                  <div className="space-y-1.5">
                    <Label htmlFor="bulk-total-delivery-charge">Total delivery charge</Label>
                    <Input
                      id="bulk-total-delivery-charge"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      placeholder="e.g. 500"
                      value={totalDeliveryChargeInput}
                      disabled={busy}
                      onChange={(e) => setTotalDeliveryChargeInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Charge type</Label>
                    <Select
                      value={deliveryChargeType}
                      onValueChange={(v) => setDeliveryChargeType(v as "flat" | "perUnit")}
                      disabled={busy || totalDeliveryCharge == null}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat</SelectItem>
                        <SelectItem value="perUnit">Per unit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {splitPreview ? (
                  <div className="grid gap-2 sm:grid-cols-3 text-sm">
                    <div className="rounded-md border bg-background px-3 py-2">
                      <div className="text-xs text-muted-foreground">Products</div>
                      <div className="font-semibold tabular-nums">{stats.valid}</div>
                    </div>
                    <div className="rounded-md border bg-background px-3 py-2">
                      <div className="text-xs text-muted-foreground">Total delivery charge</div>
                      <div className="font-semibold tabular-nums">{formatCurrency(totalDeliveryCharge)}</div>
                    </div>
                    <div className="rounded-md border bg-background px-3 py-2">
                      <div className="text-xs text-muted-foreground">Split per product</div>
                      <div className="font-semibold tabular-nums">
                        {splitPreview.equal
                          ? formatCurrency(splitPreview.min)
                          : `${formatCurrency(splitPreview.min)} – ${formatCurrency(splitPreview.max)}`}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {phase === "uploading" ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Uploading images and creating products…</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            ) : null}

            <ScrollArea className="h-[280px] rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="border-b">
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Image</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const hasError = row.errors.length > 0;
                    return (
                      <tr key={row.row} className={cn("border-b align-top", hasError && "bg-destructive/5")}>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.row}</td>
                        <td className="px-3 py-2 font-mono">{row.sku || "—"}</td>
                        <td className="px-3 py-2">{row.name || "—"}</td>
                        <td className="px-3 py-2">
                          {row.imageFile ? (
                            <span className="text-emerald-700">Matched</span>
                          ) : row.imageFileName ? (
                            <span className="text-amber-700">Missing</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {hasError ? (
                            <span className="text-destructive">{row.errors.join(" ")}</span>
                          ) : row.warnings.length ? (
                            <span className="text-amber-700">{row.warnings.join(" ")}</span>
                          ) : (
                            <span className="text-emerald-700">Ready</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        ) : null}

        {phase === "done" && result ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/30">
                <div className="text-xs text-muted-foreground">Created</div>
                <div className="text-lg font-semibold tabular-nums">{result.created}</div>
              </div>
              <div className="rounded-lg border bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30">
                <div className="text-xs text-muted-foreground">Skipped</div>
                <div className="text-lg font-semibold tabular-nums">{result.skipped}</div>
              </div>
              <div className="rounded-lg border bg-destructive/10 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Failed</div>
                <div className="text-lg font-semibold tabular-nums">{result.failed}</div>
              </div>
            </div>

            {deliverySplit ? (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="text-sm font-medium">Delivery charge split</div>
                <div className="grid gap-2 sm:grid-cols-3 text-sm">
                  <div className="rounded-md border bg-background px-3 py-2">
                    <div className="text-xs text-muted-foreground">Products added</div>
                    <div className="text-lg font-semibold tabular-nums">{deliverySplit.createdCount}</div>
                  </div>
                  <div className="rounded-md border bg-background px-3 py-2">
                    <div className="text-xs text-muted-foreground">Total delivery charge</div>
                    <div className="text-lg font-semibold tabular-nums">
                      {formatCurrency(deliverySplit.totalCharge)}
                    </div>
                  </div>
                  <div className="rounded-md border bg-background px-3 py-2">
                    <div className="text-xs text-muted-foreground">Split per product</div>
                    <div className="text-lg font-semibold tabular-nums">
                      {formatCurrency(deliverySplit.perProductAmounts[0] ?? 0)}
                      {deliverySplit.perProductAmounts.some(
                        (amount) => amount !== deliverySplit.perProductAmounts[0],
                      )
                        ? "+"
                        : ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {deliverySplit.chargeType === "perUnit" ? "Per unit" : "Flat"} · saved on each product
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <ScrollArea className="h-[240px] rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80">
                  <tr className="border-b">
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((row) => (
                    <tr key={`${row.row}-${row.sku}`} className="border-b">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.row}</td>
                      <td className="px-3 py-2 font-mono">{row.sku || "—"}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            row.status === "created" && "text-emerald-700",
                            row.status === "skipped" && "text-amber-700",
                            row.status === "error" && "text-destructive",
                          )}
                        >
                          {row.status}
                          {row.message ? ` — ${row.message}` : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          {phase === "pick" ? (
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          ) : null}
          {phase === "preview" ? (
            <>
              <Button type="button" variant="outline" disabled={busy} onClick={reset}>
                Choose another file
              </Button>
              <Button type="button" variant="brand" disabled={busy || stats.valid === 0} onClick={() => void runImport()}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Import {stats.valid} product{stats.valid === 1 ? "" : "s"}
              </Button>
            </>
          ) : null}
          {phase === "uploading" ? (
            <Button type="button" disabled>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Importing…
            </Button>
          ) : null}
          {phase === "done" ? (
            <Button type="button" variant="brand" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
