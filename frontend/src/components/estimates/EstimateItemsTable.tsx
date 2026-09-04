import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BackendCatalogItem, BackendInventoryItem, EstimateLineInput } from "@/lib/api";
import { ESTIMATE_LINE_TYPES, formatLineType, lineTotal, newEstimateLine } from "@/lib/estimates";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const LINE_GRID =
  "grid grid-cols-[minmax(0,1.5fr)_8.5rem_5.5rem_7rem_5.5rem_6.5rem_7.5rem] items-start gap-x-2";
const LINE_GRID_EDIT =
  "grid grid-cols-[minmax(0,1.5fr)_8.5rem_5.5rem_7rem_5.5rem_6.5rem_7.5rem_2.5rem] items-start gap-x-2";
const numberInputClass =
  "h-10 min-w-0 w-full px-2 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

interface EstimateItemsTableProps {
  lines: EstimateLineInput[];
  mode?: "edit" | "view";
  taxDefault?: number;
  catalog?: BackendCatalogItem[];
  inventory?: BackendInventoryItem[];
  invalid?: boolean;
  onChange?: (lines: EstimateLineInput[]) => void;
}

export function EstimateItemsTable({
  lines,
  mode = "view",
  taxDefault = 0,
  catalog = [],
  inventory = [],
  invalid,
  onChange,
}: EstimateItemsTableProps) {
  const editable = mode === "edit";
  const gridClass = editable ? LINE_GRID_EDIT : LINE_GRID;

  const updateLine = (index: number, patch: Partial<EstimateLineInput>) => {
    onChange?.(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
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

  return (
    <section className={cn("overflow-hidden rounded-lg border border-border bg-card", invalid && "ring-1 ring-destructive")}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="section-title">Estimate Items</h2>
        {editable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange?.([...lines, newEstimateLine(taxDefault)])}
          >
            <Plus className="mr-1 h-4 w-4" /> Add Item
          </Button>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <div className={cn("min-w-[52rem]", editable && "min-w-[56rem]")}>
          <div
            className={cn(
              gridClass,
              "border-b border-border bg-muted/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
            )}
          >
            <div>Description</div>
            <div>Type</div>
            <div className="pr-2 text-right">Qty</div>
            <div className="pr-2 text-right">Unit Price</div>
            <div className="pr-2 text-right">Tax %</div>
            <div className="pr-2 text-right">Discount</div>
            <div className="pr-2 text-right">Total</div>
            {editable ? <div /> : null}
          </div>
          {lines.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No line items yet.</p>
          ) : (
            lines.map((line, index) => (
              <div key={index} className="border-b border-border px-3 py-2 last:border-0">
                <div className={gridClass}>
                  <div className="min-w-0">
                    {editable ? (
                      <div className="space-y-1.5">
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(index, { description: e.target.value })}
                          placeholder="Description"
                          aria-label={`Line ${index + 1} description`}
                          className="min-w-0"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Select onValueChange={(v) => applyCatalog(index, v)}>
                            <SelectTrigger className="h-8 min-w-0 text-xs">
                              <SelectValue placeholder="Catalog item" />
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
                            <SelectTrigger className="h-8 min-w-0 text-xs">
                              <SelectValue placeholder="Inventory item" />
                            </SelectTrigger>
                            <SelectContent>
                              {inventory.map((i) => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.name} ({i.sku}) · {Math.max(0, i.inStock - i.reserved)} avail
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0 py-2">
                        <p className="font-medium">{line.description || "—"}</p>
                        {line.partNumber ? <p className="text-xs text-muted-foreground">{line.partNumber}</p> : null}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    {editable ? (
                      <Select value={line.type} onValueChange={(v) => updateLine(index, { type: v as EstimateLineInput["type"] })}>
                        <SelectTrigger className="min-w-0" aria-label={`Line ${index + 1} type`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ESTIMATE_LINE_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="block py-2 text-muted-foreground">{formatLineType(line.type)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    {editable ? (
                      <Input
                        type="number"
                        min={0.001}
                        size={1}
                        className={numberInputClass}
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })}
                        aria-label={`Line ${index + 1} quantity`}
                      />
                    ) : (
                      <span className="block py-2 pr-2 text-right tabular-nums">{line.quantity}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        size={1}
                        className={numberInputClass}
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) || 0 })}
                        aria-label={`Line ${index + 1} unit price`}
                      />
                    ) : (
                      <span className="block py-2 pr-2 text-right tabular-nums">{formatCurrency(line.unitPrice)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        size={1}
                        className={numberInputClass}
                        value={line.taxRate}
                        onChange={(e) => updateLine(index, { taxRate: Number(e.target.value) || 0 })}
                        aria-label={`Line ${index + 1} tax rate`}
                      />
                    ) : (
                      <span className="block py-2 pr-2 text-right tabular-nums">{line.taxRate}%</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        size={1}
                        className={numberInputClass}
                        value={line.discount || 0}
                        onChange={(e) => updateLine(index, { discount: Number(e.target.value) || 0 })}
                        aria-label={`Line ${index + 1} discount`}
                      />
                    ) : (
                      <span className="block py-2 pr-2 text-right tabular-nums">{formatCurrency(line.discount || 0)}</span>
                    )}
                  </div>
                  <div className="flex h-10 items-center justify-end pr-2 font-medium tabular-nums">
                    {formatCurrency(lineTotal(line))}
                  </div>
                  {editable ? (
                    <div className="flex h-10 items-center justify-center">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Remove line ${index + 1}`}
                        onClick={() => onChange?.(lines.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
