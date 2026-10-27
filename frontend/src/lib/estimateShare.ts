import { api, type BackendCustomer, type BackendEstimate } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import {
  buildGmailComposeUrl,
  buildMailtoUrl,
  buildWhatsAppShareUrl,
  sanitizeWhatsAppPhone,
  type InspectionShareChannel,
} from "@/lib/inspectionShare";

export type EstimateShareChannel = InspectionShareChannel;

function shareMessage(estimate: BackendEstimate, customerName: string) {
  return [
    `Estimate for ${customerName}`,
    `Ref: ${estimate.reference}`,
    estimate.equipmentName ? `Equipment: ${estimate.equipmentName}` : null,
    `Total: ${formatCurrency(estimate.total)}`,
    "",
    "Please find the estimate PDF attached.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

async function fetchEstimatePdfBlob(fileId: string, filename: string) {
  const response = await fetch(api.fileDownloadUrl(fileId), { credentials: "include" });
  if (!response.ok) {
    throw new Error("Unable to download the generated estimate PDF.");
  }
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "application/pdf" });
}

function triggerLocalDownload(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function shareEstimate(input: {
  channel: EstimateShareChannel;
  estimate: BackendEstimate;
  customer: BackendCustomer | null;
}): Promise<{ opened: boolean; downloaded: boolean; sharedNatively: boolean }> {
  const customerName = input.customer?.name?.trim() || input.estimate.customerName;
  const message = shareMessage(input.estimate, customerName);
  const subject = `Estimate ${input.estimate.reference}`;
  // Phone/email are optional: if missing, open a generic compose window so the
  // user can pick any recipient (same behavior as ShareButtons / inspection share).
  const phone = sanitizeWhatsAppPhone(input.customer?.phone);
  const email = input.customer?.email?.trim();
  const validEmail = email && email.includes("@") ? email : "";

  const doc = await api.generateDocument("estimate", input.estimate.id);
  if (!doc.file?.id) {
    throw new Error("Estimate PDF could not be generated.");
  }

  const filename = `${input.estimate.reference}-estimate.pdf`;
  const file = await fetchEstimatePdfBlob(doc.file.id, filename);

  let sharedNatively = false;
  if (typeof navigator !== "undefined" && typeof navigator.canShare === "function") {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: subject,
          text: message,
        });
        sharedNatively = true;
      }
    } catch (err) {
      // User cancel should not look like a hard failure.
      if (err instanceof DOMException && err.name === "AbortError") {
        return { opened: false, downloaded: false, sharedNatively: false };
      }
    }
  }

  triggerLocalDownload(file);

  let opened = false;
  if (input.channel === "whatsapp") {
    const popup = window.open(buildWhatsAppShareUrl(phone, message), "_blank", "noopener,noreferrer");
    opened = Boolean(popup);
  } else {
    const gmailUrl = buildGmailComposeUrl({ to: validEmail, subject, body: message });
    const popup = window.open(gmailUrl, "_blank", "noopener,noreferrer");
    opened = Boolean(popup);
    if (!opened) {
      window.location.href = buildMailtoUrl({ to: validEmail, subject, body: message });
      opened = true;
    }
  }

  if (!opened && !sharedNatively) {
    throw new Error("Unable to open the messaging app. Allow pop-ups for this site, then try again.");
  }

  return { opened, downloaded: true, sharedNatively };
}
