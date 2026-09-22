/** Excel-friendly CSV export (UTF-8 BOM). Opens cleanly in Excel / Google Sheets. */

export type SpreadsheetColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function downloadSpreadsheet<T>(
  filenameBase: string,
  columns: SpreadsheetColumn<T>[],
  rows: T[],
) {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCsvCell(c.value(row))).join(","))
    .join("\r\n");
  const csv = `\uFEFF${header}\r\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `${filenameBase}-${stamp}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
