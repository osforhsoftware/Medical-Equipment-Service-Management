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
import { FormFieldError } from "@/components/shared/FormFieldError";
import type { BackendCatalogItem, BackendInventoryItem, InvoiceLineInput } from "@/lib/api";
import { BILLING_ADD_LINE_TYPES, billingLineTypeLabel, lineAmount } from "@/lib/billingCharges";
import { formatCurrency } from "@/lib/format";
import { fieldAria, fieldErrorClass } from "@/lib/formValidation";
import { cn } from "@/lib/utils";

export function newBillingLine(type: string = "product"): InvoiceLineInput {
  return {
    type,
    description: "",
    quantity: 1,
    unitPrice: 0,
    taxRate: 0,
    discount: 0,
  };
}

interface InvoiceLineEditorProps {
  lines: InvoiceLineInput[];
  inventory?: BackendInventoryItem[];
  catalog?: BackendCatalogItem[];
  onChange: (lines: InvoiceLineInput[]) => void;
  shouldShow?: (field: string) => boolean;
  errors?: Record<string, string>;
  onBlurField?: (field: string) => void;
  minLines?: number;
  title?: string;
  className?: string;
}

export function InvoiceLineEditor({
  lines,
  inventory = [],
  catalog = [],
  onChange,
  shouldShow,
  errors,
  onBlurField,
  minLines = 0,
  title = "Invoice items",
  className,
}: InvoiceLineEditorProps) {
  const updateLine = (index: number, patch: Partial<InvoiceLineInput>) => {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const applyCatalog = (index: number, catalogId: string) => {
    const item = catalog.find((entry) => entry.id === catalogId);
    if (!item) return;
    updateLine(index, {
      type: "service",
      description: item.name,
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate),
    });
  };

  const applyInventory = (index: number, inventoryId: string) => {
    const item = inventory.find((entry) => entry.id === inventoryId);
    if (!item) return;
    const qty = lines[index]?.quantity || 1;
    const delivery =
      item.deliveryChargeType === "perUnit"
        ? Number(item.deliveryCharge ?? 0) * qty
        : Number(item.deliveryCharge ?? 0);
    updateLine(index, {
      type: "product",
      description: item.name,
      unitPrice: Number(item.sellingPrice ?? item.unitCost ?? 0) + delivery / Math.max(qty, 1),
    });
  };

  const typeOptions = (() => {
    const known = new Set(BILLING_ADD_LINE_TYPES.map((t) => t.value));
    const extras = lines
      .map((line) => line.type)
      .filter((type): type is string => Boolean(type) && !known.has(type as never));
    return [
      ...BILLING_ADD_LINE_TYPES,
      ...Array.from(new Set(extras)).map((value) => ({
        value,
        label: billingLineTypeLabel(value),
      })),
    ];
  })();

  return (
    <section className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="section-title">{title}</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...lines, newBillingLine()])}
        >
          <Plus className="mr-1 h-4 w-4" /> Add Item
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5">Description</th>
              <th className="w-32 px-3 py-2.5">Type</th>
              <th className="w-20 px-3 py-2.5 text-right">Qty</th>
              <th className="w-28 px-3 py-2.5 text-right">Unit Price</th>
              <th className="w-20 px-3 py-2.5 text-right">Tax</th>
              <th className="w-24 px-3 py-2.5 text-right">Discount</th>
              <th className="w-28 px-3 py-2.5 text-right">Total</th>
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No line items yet. Add products or services like you do on an estimate.
                </td>
              </tr>
            ) : (
              lines.map((line, index) => {
                const descKey = `line_${index}_description`;
                const qtyKey = `line_${index}_quantity`;
                return (
                  <tr key={line.id ?? `new-${index}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 align-top">
                      <div className="space-y-1.5" data-field={descKey}>
                        <Input
                          id={descKey}
                          name={descKey}
                          value={line.description}
                          onChange={(e) => updateLine(index, { description: e.target.value })}
                          onBlur={() => onBlurField?.(descKey)}
                          placeholder="Description"
                          aria-label={`Line ${index + 1} description`}
                          className={fieldErrorClass(shouldShow?.(descKey))}
                          {...fieldAria(descKey, shouldShow?.(descKey) ? errors?.[descKey] : null)}
                        />
                        {shouldShow?.(descKey) && errors?.[descKey] ? (
                          <FormFieldError field={descKey} message={errors[descKey]} />
                        ) : null}
                        <div className="flex gap-2">
                          <Select onValueChange={(value) => applyCatalog(index, value)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Service / catalog" />
                            </SelectTrigger>
                            <SelectContent>
                              {catalog.length === 0 ? (
                                <SelectItem value="__empty_catalog" disabled>
                                  No catalog services
                                </SelectItem>
                              ) : (
                                catalog.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <Select onValueChange={(value) => applyInventory(index, value)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Product / inventory" />
                            </SelectTrigger>
                            <SelectContent>
                              {inventory.length === 0 ? (
                                <SelectItem value="__empty_inventory" disabled>
                                  No inventory products
                                </SelectItem>
                              ) : (
                                inventory.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name} ({item.sku}) · {Math.max(0, item.inStock - item.reserved)} avail
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Select
                        value={line.type ?? "product"}
                        onValueChange={(value) => updateLine(index, { type: value })}
                      >
                        <SelectTrigger aria-label={`Line ${index + 1} type`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {typeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 align-top text-right" data-field={qtyKey}>
                      <Input
                        id={qtyKey}
                        name={qtyKey}
                        type="number"
                        min={0.001}
                        step="any"
                        className={cn("text-right", fieldErrorClass(shouldShow?.(qtyKey)))}
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })}
                        onBlur={() => onBlurField?.(qtyKey)}
                        aria-label={`Line ${index + 1} quantity`}
                        {...fieldAria(qtyKey, shouldShow?.(qtyKey) ? errors?.[qtyKey] : null)}
                      />
                      {shouldShow?.(qtyKey) && errors?.[qtyKey] ? (
                        <FormFieldError field={qtyKey} message={errors[qtyKey]} />
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        className="text-right"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) || 0 })}
                        aria-label={`Line ${index + 1} unit price`}
                      />
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        className="text-right"
                        value={line.taxRate ?? 0}
                        onChange={(e) => updateLine(index, { taxRate: Number(e.target.value) || 0 })}
                        aria-label={`Line ${index + 1} tax rate`}
                      />
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        className="text-right"
                        value={line.discount ?? 0}
                        onChange={(e) => updateLine(index, { discount: Number(e.target.value) || 0 })}
                        aria-label={`Line ${index + 1} discount`}
                      />
                    </td>
                    <td className="px-3 py-2 align-top text-right font-medium">
                      {formatCurrency(lineAmount(line))}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove line ${index + 1}`}
                        disabled={lines.length <= minLines}
                        onClick={() => onChange(lines.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
