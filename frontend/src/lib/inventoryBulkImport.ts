import JSZip from "jszip";
import * as XLSX from "xlsx";
import { downloadSpreadsheet } from "@/lib/exportSpreadsheet";
import {
  INVENTORY_ITEM_CLASS_LABELS,
  isInventoryItemClass,
  type InventoryItemClass,
} from "@/lib/inventoryItemClass";

export const INVENTORY_BULK_MAX_ROWS = 2000;

export const INVENTORY_BULK_TEMPLATE_HEADERS = [
  "sku",
  "name",
  "itemClass",
  "category",
  "subcategory",
  "description",
  "manufacturer",
  "compatibleModels",
  "inStock",
  "reorderLevel",
  "binLocation",
  "unitCost",
  "sellingPrice",
  "deliveryCharge",
  "deliveryChargeType",
  "unitOfMeasure",
  "supplier",
  "trackBatches",
  "trackSerials",
  "imageFileName",
] as const;

export type InventoryBulkTemplateHeader = (typeof INVENTORY_BULK_TEMPLATE_HEADERS)[number];

export type ParsedInventoryImportRow = {
  row: number;
  sku: string;
  name: string;
  itemClass: InventoryItemClass;
  category: string;
  subcategory: string;
  description: string;
  manufacturer: string;
  compatibleModels: string;
  inStock: number;
  reorderLevel: number;
  binLocation: string;
  unitCost: number;
  sellingPrice: number;
  deliveryCharge: number;
  deliveryChargeType: "flat" | "perUnit";
  unitOfMeasure: string;
  supplier: string;
  trackBatches: boolean;
  trackSerials: boolean;
  imageFileName: string;
  errors: string[];
  warnings: string[];
  imageFile?: File;
};

const HEADER_ALIASES: Record<string, InventoryBulkTemplateHeader> = {
  sku: "sku",
  "item sku": "sku",
  "part number": "sku",
  name: "name",
  "product name": "name",
  "item name": "name",
  itemclass: "itemClass",
  "item class": "itemClass",
  class: "itemClass",
  type: "itemClass",
  category: "category",
  subcategory: "subcategory",
  "sub category": "subcategory",
  description: "description",
  manufacturer: "manufacturer",
  brand: "manufacturer",
  compatiblemodels: "compatibleModels",
  "compatible models": "compatibleModels",
  models: "compatibleModels",
  instock: "inStock",
  "in stock": "inStock",
  qty: "inStock",
  quantity: "inStock",
  "qty on hand": "inStock",
  reorderlevel: "reorderLevel",
  "reorder level": "reorderLevel",
  "min level": "reorderLevel",
  "minimum level": "reorderLevel",
  minlevel: "reorderLevel",
  binlocation: "binLocation",
  "bin location": "binLocation",
  bin: "binLocation",
  unitcost: "unitCost",
  "unit cost": "unitCost",
  cost: "unitCost",
  "cost price": "unitCost",
  sellingprice: "sellingPrice",
  "selling price": "sellingPrice",
  price: "sellingPrice",
  deliverycharge: "deliveryCharge",
  "delivery charge": "deliveryCharge",
  deliverychargetype: "deliveryChargeType",
  "delivery charge type": "deliveryChargeType",
  unitofmeasure: "unitOfMeasure",
  "unit of measure": "unitOfMeasure",
  uom: "unitOfMeasure",
  supplier: "supplier",
  "supplier name": "supplier",
  trackbatches: "trackBatches",
  "track batches": "trackBatches",
  trackserials: "trackSerials",
  "track serials": "trackSerials",
  imagefilename: "imageFileName",
  "image file name": "imageFileName",
  "image filename": "imageFileName",
  image: "imageFileName",
  "image name": "imageFileName",
  filename: "imageFileName",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function cellString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value).trim();
}

function cellNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).replace(/[,₹$]/g, "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function cellBool(value: unknown): boolean {
  const raw = cellString(value).toLowerCase();
  if (!raw) return false;
  return raw === "true" || raw === "yes" || raw === "y" || raw === "1";
}

function parseItemClass(value: unknown): InventoryItemClass {
  const raw = cellString(value).toLowerCase().replace(/\s+/g, "_");
  if (isInventoryItemClass(raw)) return raw;
  if (raw.includes("consumable")) return "consumable";
  if (raw.includes("equipment") || raw.includes("machine")) return "equipment";
  if (raw.includes("spare") || raw.includes("part")) return "spare_part";
  if (!raw) return "spare_part";
  return "spare_part";
}

function mimeFromImageName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

function basenamePath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

function mapSheetRows(matrix: unknown[][]): ParsedInventoryImportRow[] {
  if (!matrix.length) return [];
  const headerCells = matrix[0] ?? [];
  const columnMap = new Map<number, InventoryBulkTemplateHeader>();
  headerCells.forEach((cell, index) => {
    const alias = HEADER_ALIASES[normalizeHeader(cell)];
    if (alias) columnMap.set(index, alias);
  });
  if (![...columnMap.values()].includes("name")) {
    throw new Error('Spreadsheet must include a "name" column.');
  }

  const rows: ParsedInventoryImportRow[] = [];
  for (let r = 1; r < matrix.length; r += 1) {
    const line = matrix[r] ?? [];
    const values: Partial<Record<InventoryBulkTemplateHeader, string>> = {};
    let anyValue = false;
    columnMap.forEach((key, index) => {
      const text = cellString(line[index]);
      if (text) anyValue = true;
      values[key] = text;
    });
    if (!anyValue) continue;

    const errors: string[] = [];
    const warnings: string[] = [];
    const name = values.name?.trim() ?? "";
    if (name.length < 2) errors.push("Name is required (min 2 characters).");

    const inStock = cellNumber(values.inStock);
    const reorderLevel = cellNumber(values.reorderLevel);
    const unitCost = cellNumber(values.unitCost);
    const sellingPrice = cellNumber(values.sellingPrice);
    const deliveryCharge = cellNumber(values.deliveryCharge);

    const numFields: Array<[string, number | null]> = [
      ["inStock", inStock],
      ["reorderLevel", reorderLevel],
      ["unitCost", unitCost],
      ["sellingPrice", sellingPrice],
      ["deliveryCharge", deliveryCharge],
    ];
    for (const [label, n] of numFields) {
      if (n == null) continue;
      if (Number.isNaN(n) || n < 0) errors.push(`${label} must be a non-negative number.`);
      if ((label === "inStock" || label === "reorderLevel") && n != null && !Number.isInteger(n)) {
        errors.push(`${label} must be a whole number.`);
      }
    }

    const deliveryChargeTypeRaw = (values.deliveryChargeType ?? "flat").toLowerCase();
    const deliveryChargeType =
      deliveryChargeTypeRaw === "perunit" || deliveryChargeTypeRaw === "per unit" ? "perUnit" : "flat";

    const imageFileName = values.imageFileName?.trim() ?? "";
    if (imageFileName && !mimeFromImageName(imageFileName)) {
      warnings.push("Image must be JPEG, PNG, or WebP.");
    }

    const itemClass = parseItemClass(values.itemClass);
    if (values.itemClass?.trim() && !isInventoryItemClass(values.itemClass.trim().toLowerCase().replace(/\s+/g, "_"))) {
      const label = INVENTORY_ITEM_CLASS_LABELS[itemClass];
      warnings.push(`itemClass "${values.itemClass}" mapped to ${label}.`);
    }

    rows.push({
      row: r + 1,
      sku: values.sku?.trim() ?? "",
      name,
      itemClass,
      category: values.category?.trim() ?? "",
      subcategory: values.subcategory?.trim() ?? "",
      description: values.description?.trim() ?? "",
      manufacturer: values.manufacturer?.trim() ?? "",
      compatibleModels: values.compatibleModels?.trim() ?? "",
      inStock: inStock != null && !Number.isNaN(inStock) ? Math.trunc(inStock) : 0,
      reorderLevel: reorderLevel != null && !Number.isNaN(reorderLevel) ? Math.trunc(reorderLevel) : 0,
      binLocation: values.binLocation?.trim() ?? "",
      unitCost: unitCost != null && !Number.isNaN(unitCost) ? unitCost : 0,
      sellingPrice: sellingPrice != null && !Number.isNaN(sellingPrice) ? sellingPrice : 0,
      deliveryCharge: deliveryCharge != null && !Number.isNaN(deliveryCharge) ? deliveryCharge : 0,
      deliveryChargeType,
      unitOfMeasure: values.unitOfMeasure?.trim() || "pcs",
      supplier: values.supplier?.trim() ?? "",
      trackBatches: cellBool(values.trackBatches),
      trackSerials: cellBool(values.trackSerials),
      imageFileName,
      errors,
      warnings,
    });
  }

  if (rows.length > INVENTORY_BULK_MAX_ROWS) {
    throw new Error(`Import is limited to ${INVENTORY_BULK_MAX_ROWS} rows. Split the file and try again.`);
  }
  return rows;
}

function workbookToMatrix(workbook: XLSX.WorkBook): unknown[][] {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Spreadsheet has no sheets.");
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
}

async function parseSpreadsheetBuffer(buffer: ArrayBuffer, fileName: string): Promise<ParsedInventoryImportRow[]> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
    const workbook = XLSX.read(text, { type: "string" });
    return mapSheetRows(workbookToMatrix(workbook));
  }
  const workbook = XLSX.read(buffer, { type: "array" });
  return mapSheetRows(workbookToMatrix(workbook));
}

function indexImagesFromZip(zip: JSZip): Map<string, JSZip.JSZipObject> {
  const images = new Map<string, JSZip.JSZipObject>();
  Object.keys(zip.files).forEach((path) => {
    const entry = zip.files[path];
    if (!entry || entry.dir) return;
    const base = basenamePath(path);
    if (base.startsWith(".")) return;
    const mime = mimeFromImageName(base);
    if (!mime) return;
    images.set(base.toLowerCase(), entry);
    // Also index without folder prefix already handled via basename
  });
  return images;
}

async function attachImages(
  rows: ParsedInventoryImportRow[],
  images: Map<string, JSZip.JSZipObject>,
): Promise<ParsedInventoryImportRow[]> {
  const used = new Set<string>();
  const out: ParsedInventoryImportRow[] = [];
  for (const row of rows) {
    const next = { ...row, warnings: [...row.warnings], errors: [...row.errors] };
    if (!row.imageFileName) {
      out.push(next);
      continue;
    }
    const key = basenamePath(row.imageFileName).toLowerCase();
    const mime = mimeFromImageName(key);
    if (!mime) {
      next.warnings.push("Skipped image — only JPEG, PNG, and WebP are allowed.");
      out.push(next);
      continue;
    }
    const entry = images.get(key);
    if (!entry) {
      next.warnings.push(`Image file "${row.imageFileName}" not found in ZIP.`);
      out.push(next);
      continue;
    }
    const blob = await entry.async("blob");
    const file = new File([blob], basenamePath(row.imageFileName), { type: mime });
    next.imageFile = file;
    used.add(key);
    out.push(next);
  }
  return out;
}

export type InventoryImportParseResult = {
  rows: ParsedInventoryImportRow[];
  sourceLabel: string;
  imageCount: number;
};

export async function parseInventoryImportFile(file: File): Promise<InventoryImportParseResult> {
  const lower = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (lower.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(buffer);
    const sheetEntry = Object.values(zip.files).find((entry) => {
      if (entry.dir) return false;
      const base = basenamePath(entry.name).toLowerCase();
      return base.endsWith(".xlsx") || base.endsWith(".xls") || base.endsWith(".csv");
    });
    if (!sheetEntry) {
      throw new Error("ZIP must include a products.xlsx or products.csv spreadsheet.");
    }
    const sheetBuffer = await sheetEntry.async("arraybuffer");
    const rows = await parseSpreadsheetBuffer(sheetBuffer, sheetEntry.name);
    const images = indexImagesFromZip(zip);
    const withImages = await attachImages(rows, images);
    return {
      rows: withImages,
      sourceLabel: file.name,
      imageCount: withImages.filter((r) => r.imageFile).length,
    };
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    const rows = await parseSpreadsheetBuffer(buffer, file.name);
    return { rows, sourceLabel: file.name, imageCount: 0 };
  }

  throw new Error("Upload a .zip (Excel + images), .xlsx, or .csv file.");
}

export function downloadInventoryImportTemplate() {
  downloadSpreadsheet(
    "inventory-import-template",
    INVENTORY_BULK_TEMPLATE_HEADERS.map((header) => ({
      header,
      value: (row: Record<string, string | number>) => row[header],
    })),
    [
      {
        sku: "SP-ECG-001",
        name: "ECG Cable 3 Lead",
        itemClass: "spare_part",
        category: "Cables",
        subcategory: "",
        description: "Compatible with common monitors",
        manufacturer: "Generic",
        compatibleModels: "MX40",
        inStock: 20,
        reorderLevel: 5,
        binLocation: "A-12",
        unitCost: 400,
        sellingPrice: 550,
        deliveryCharge: 0,
        deliveryChargeType: "flat",
        unitOfMeasure: "pcs",
        supplier: "",
        trackBatches: "FALSE",
        trackSerials: "FALSE",
        imageFileName: "SP-ECG-001.jpg",
      },
      {
        sku: "CON-GEL-250",
        name: "Ultrasound Gel 250ml",
        itemClass: "consumable",
        category: "Consumables",
        subcategory: "",
        description: "",
        manufacturer: "",
        compatibleModels: "",
        inStock: 100,
        reorderLevel: 20,
        binLocation: "B-02",
        unitCost: 80,
        sellingPrice: 120,
        deliveryCharge: 0,
        deliveryChargeType: "flat",
        unitOfMeasure: "pcs",
        supplier: "",
        trackBatches: "FALSE",
        trackSerials: "FALSE",
        imageFileName: "CON-GEL-250.png",
      },
    ],
  );
}
