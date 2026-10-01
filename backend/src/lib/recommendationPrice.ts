type PriceValue = { toString(): string } | number | string | null | undefined;

function positivePrice(...values: PriceValue[]): number {
  for (const value of values) {
    const amount = Number(value ?? 0);
    if (Number.isFinite(amount) && amount > 0) return amount;
  }
  return 0;
}

/** Unit price for a recommended part: selling price, then cost, then catalog price. */
export function recommendationUnitPrice(input: {
  estimatedCost?: PriceValue;
  inventoryItem?: { sellingPrice?: PriceValue; unitCost?: PriceValue } | null;
  catalogItem?: { unitPrice?: PriceValue } | null;
}): number {
  const live = positivePrice(
    input.inventoryItem?.sellingPrice,
    input.inventoryItem?.unitCost,
    input.catalogItem?.unitPrice,
  );
  if (live > 0) return live;
  return positivePrice(input.estimatedCost);
}

/** Line amount shown on the inspection report: current unit price × quantity. */
export function recommendationLinePrice(input: {
  quantity?: PriceValue;
  estimatedCost?: PriceValue;
  inventoryItem?: { sellingPrice?: PriceValue; unitCost?: PriceValue } | null;
  catalogItem?: { unitPrice?: PriceValue } | null;
}): number {
  const unit = positivePrice(
    input.inventoryItem?.sellingPrice,
    input.inventoryItem?.unitCost,
    input.catalogItem?.unitPrice,
  );
  if (unit > 0) {
    const quantity = Number(input.quantity ?? 1);
    const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    return Math.round(unit * qty * 100) / 100;
  }
  return positivePrice(input.estimatedCost);
}
