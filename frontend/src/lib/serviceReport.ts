import { api } from "@/lib/api";

/** Generate (or regenerate) the service-report PDF and open the download. */
export async function downloadServiceReportPdf(jobId: string) {
  const doc = await api.generateDocument("service-report", jobId);
  if (doc.file?.id) {
    window.open(api.fileDownloadUrl(doc.file.id), "_blank");
  }
  return doc;
}
