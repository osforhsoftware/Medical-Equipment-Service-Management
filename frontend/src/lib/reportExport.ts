import { downloadSpreadsheet } from "@/lib/exportSpreadsheet";
import type { ReportActivityRow, ReportExportRow } from "@/lib/reportUtils";
import { toast } from "@/lib/toast";

export function exportReportRows(filename: string, rows: ReportExportRow[]) {
  downloadSpreadsheet(
    filename,
    [
      { header: "Report", value: (row) => row.section },
      { header: "Name / Description", value: (row) => row.name },
      { header: "Quantity / Value", value: (row) => row.quantity },
      { header: "Amount", value: (row) => row.amount },
      { header: "Notes", value: (row) => row.extra ?? "" },
    ],
    rows,
  );
  toast.success("Export ready", { description: `${rows.length} row(s) exported for Excel.` });
}

export function exportActivityRows(filename: string, rows: ReportActivityRow[]) {
  downloadSpreadsheet(
    filename,
    [
      { header: "Time", value: (row) => row.at },
      { header: "Actor", value: (row) => row.actor },
      { header: "Action", value: (row) => row.action },
      { header: "Reference", value: (row) => row.reference },
    ],
    rows,
  );
  toast.success("Activity export ready", { description: `${rows.length} activity row(s) exported.` });
}
