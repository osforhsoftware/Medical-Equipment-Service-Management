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
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5">Description</th>
              <th className="w-28 px-3 py-2.5">Type</th>
              <th className="w-20 px-3 py-2.5 text-right">Qty</th>
              <th className="w-28 px-3 py-2.5 text-right">Unit Price</th>
              <th className="w-20 px-3 py-2.5 text-right">Tax</th>
              <th className="w-24 px-3 py-2.5 text-right">Discount</th>
              <th className="w-28 px-3 py-2.5 text-right">Total</th>
              {editable ? <th className="w-10 px-2 py-2.5" /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={editable ? 8 : 7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No line items yet.
                </td>
              </tr>
            ) : (
              lines.map((line, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 align-top">
                    {editable ? (
                      <div className="space-y-1.5">
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(index, { description: e.target.value })}
                          placeholder="Description"
                          aria-label={`Line ${index + 1} description`}
                        />
                        <div className="flex gap-2">
                          <Select onValueChange={(v) => applyCatalog(index, v)}>
                            <SelectTrigger className="h-8 text-xs">
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
                            <SelectTrigger className="h-8 text-xs">
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
                      <div>
                        <p className="font-medium">{line.description || "—"}</p>
                        {line.partNumber ? <p className="text-xs text-muted-foreground">{line.partNumber}</p> : null}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {editable ? (
                      <Select value={line.type} onValueChange={(v) => updateLine(index, { type: v as EstimateLineInput["type"] })}>
                        <SelectTrigger aria-label={`Line ${index + 1} type`}>
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
                      <span className="text-muted-foreground">{formatLineType(line.type)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    {editable ? (
                      <Input
                        type="number"
                        min={0.001}
                        className="text-right"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })}
                        aria-label={`Line ${index + 1} quantity`}
                      />
                    ) : (
                      line.quantity
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        className="text-right"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) || 0 })}
                        aria-label={`Line ${index + 1} unit price`}
                      />
                    ) : (
                      formatCurrency(line.unitPrice)
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        className="text-right"
                        value={line.taxRate}
                        onChange={(e) => updateLine(index, { taxRate: Number(e.target.value) || 0 })}
                        aria-label={`Line ${index + 1} tax rate`}
                      />
                    ) : (
                      `${line.taxRate}%`
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        className="text-right"
                        value={line.discount || 0}
                        onChange={(e) => updateLine(index, { discount: Number(e.target.value) || 0 })}
                        aria-label={`Line ${index + 1} discount`}
                      />
                    ) : (
                      formatCurrency(line.discount || 0)
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-right font-medium">{formatCurrency(lineTotal(line))}</td>
                  {editable ? (
                    <td className="px-2 py-2 align-top">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove line ${index + 1}`}
                        onClick={() => onChange?.(lines.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
