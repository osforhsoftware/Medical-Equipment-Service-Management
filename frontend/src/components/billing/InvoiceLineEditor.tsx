import { Minus, Plus, Trash2 } from "lucide-react";
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
import { BILLING_ADD_LINE_TYPES, billingLineTypeLabel, lineAmount, newBillingLine } from "@/lib/billingCharges";
import { formatCurrency } from "@/lib/format";
import { fieldAria, fieldErrorClass } from "@/lib/formValidation";
import { cn } from "@/lib/utils";

const LINE_GRID =
  "grid grid-cols-[minmax(0,1.5fr)_8.5rem_8rem_7rem_5.5rem_6.5rem_7.5rem_2.5rem] items-start gap-x-2";
const numberInputClass =
  "h-10 min-w-0 w-full px-2 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

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

      {lines.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No line items yet. Add products or services like you do on an estimate.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[58rem]">
            <div
              className={cn(
                LINE_GRID,
                "border-b border-border bg-muted/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
              )}
            >
              <div>Description</div>
              <div>Type</div>
              <div className="text-center">Qty</div>
              <div className="pr-2 text-right">Unit Price</div>
              <div className="pr-2 text-right">Tax %</div>
              <div className="pr-2 text-right">Discount</div>
              <div className="pr-2 text-right">Total</div>
              <div />
            </div>
            {lines.map((line, index) => {
              const descKey = `line_${index}_description`;
              const qtyKey = `line_${index}_quantity`;
              const catalogId = `line_${index}_catalog`;
              const inventoryId = `line_${index}_inventory`;
              const typeId = `line_${index}_type`;
              const priceId = `line_${index}_unitPrice`;
              const taxId = `line_${index}_tax`;
              const discountId = `line_${index}_discount`;
              return (
                <div key={line.id ?? `new-${index}`} className="border-b border-border px-3 py-2 last:border-0">
                  <div className={LINE_GRID}>
                    <div className="min-w-0 space-y-1.5" data-field={descKey}>
                      <Input
                        id={descKey}
                        name={descKey}
                        value={line.description}
                        onChange={(e) => updateLine(index, { description: e.target.value })}
                        onBlur={() => onBlurField?.(descKey)}
                        placeholder="Item or service name"
                        aria-label={`Line ${index + 1} description`}
                        className={cn("min-w-0", fieldErrorClass(shouldShow?.(descKey)))}
                        {...fieldAria(descKey, shouldShow?.(descKey) ? errors?.[descKey] : null)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Select onValueChange={(value) => applyCatalog(index, value)}>
                          <SelectTrigger id={catalogId} className="h-8 min-w-0 text-xs">
                            <SelectValue placeholder="Catalog item" />
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
                          <SelectTrigger id={inventoryId} className="h-8 min-w-0 text-xs">
                            <SelectValue placeholder="Inventory item" />
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
                      {shouldShow?.(descKey) && errors?.[descKey] ? (
                        <FormFieldError field={descKey} message={errors[descKey]} />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <Select
                        value={line.type ?? "product"}
                        onValueChange={(value) => updateLine(index, { type: value })}
                      >
                        <SelectTrigger id={typeId} className="min-w-0" aria-label={`Line ${index + 1} type`}>
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
                    </div>
                    <div className="min-w-0" data-field={qtyKey}>
                      <div className="flex min-w-0 items-center gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-10 w-7 shrink-0"
                          aria-label={`Decrease line ${index + 1} quantity`}
                          onClick={() =>
                            updateLine(index, { quantity: Math.max(1, Number(line.quantity || 1) - 1) })
                          }
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Input
                          id={qtyKey}
                          name={qtyKey}
                          type="number"
                          min={0.001}
                          step="any"
                          size={1}
                          className={cn(
                            numberInputClass,
                            "min-w-0 flex-1 px-1 text-center",
                            fieldErrorClass(shouldShow?.(qtyKey)),
                          )}
                          value={line.quantity}
                          onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })}
                          onBlur={() => onBlurField?.(qtyKey)}
                          aria-label={`Line ${index + 1} quantity`}
                          {...fieldAria(qtyKey, shouldShow?.(qtyKey) ? errors?.[qtyKey] : null)}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-10 w-7 shrink-0"
                          aria-label={`Increase line ${index + 1} quantity`}
                          onClick={() => updateLine(index, { quantity: Number(line.quantity || 0) + 1 })}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {shouldShow?.(qtyKey) && errors?.[qtyKey] ? (
                        <FormFieldError field={qtyKey} message={errors[qtyKey]} />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <Input
                        id={priceId}
                        type="number"
                        min={0}
                        step="any"
                        size={1}
                        className={numberInputClass}
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) || 0 })}
                        aria-label={`Line ${index + 1} unit price`}
                      />
                    </div>
                    <div className="min-w-0">
                      <Input
                        id={taxId}
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        size={1}
                        className={numberInputClass}
                        value={line.taxRate ?? 0}
                        onChange={(e) => updateLine(index, { taxRate: Number(e.target.value) || 0 })}
                        aria-label={`Line ${index + 1} tax rate`}
                      />
                    </div>
                    <div className="min-w-0">
                      <Input
                        id={discountId}
                        type="number"
                        min={0}
                        step="any"
                        size={1}
                        className={numberInputClass}
                        value={line.discount ?? 0}
                        onChange={(e) => updateLine(index, { discount: Number(e.target.value) || 0 })}
                        aria-label={`Line ${index + 1} discount`}
                      />
                    </div>
                    <div className="flex h-10 items-center justify-end pr-2 text-sm font-semibold tabular-nums">
                      {formatCurrency(lineAmount(line))}
                    </div>
                    <div className="flex h-10 items-center justify-center">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove line ${index + 1}`}
                        disabled={lines.length <= minLines}
                        onClick={() => onChange(lines.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
