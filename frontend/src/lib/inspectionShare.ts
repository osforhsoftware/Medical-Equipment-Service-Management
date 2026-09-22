import { api, type BackendCustomer, type BackendServiceRequest } from "@/lib/api";

export type InspectionShareChannel = "whatsapp" | "email";

export function sanitizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  const normalized = digits.startsWith("+") ? digits.slice(1) : digits.replace(/\D/g, "");
  const clean = normalized.replace(/\D/g, "");
  if (clean.length < 8 || clean.length > 15) return null;
  return clean;
}

export function buildWhatsAppShareUrl(phoneDigits: string, text: string) {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`;
}

export function buildGmailComposeUrl(input: { to: string; subject: string; body: string }) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: input.to,
    su: input.subject,
    body: input.body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function buildMailtoUrl(input: { to: string; subject: string; body: string }) {
  return `mailto:${encodeURIComponent(input.to)}?subject=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(input.body)}`;
}

function shareMessage(request: BackendServiceRequest, customerName: string) {
  return [
    `Inspection report for ${customerName}`,
    `Ticket: ${request.reference}`,
    request.equipmentName ? `Equipment: ${request.equipmentName}` : null,
    "",
    "Please find the inspection report PDF attached.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

async function fetchInspectionPdfBlob(fileId: string, filename: string) {
  const response = await fetch(api.fileDownloadUrl(fileId), { credentials: "include" });
  if (!response.ok) {
    throw new Error("Unable to download the generated inspection PDF.");
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

export async function shareInspectionReport(input: {
  channel: InspectionShareChannel;
  request: BackendServiceRequest;
  customer: BackendCustomer | null;
}): Promise<{ opened: boolean; downloaded: boolean; sharedNatively: boolean }> {
  const customerName = input.customer?.name?.trim() || input.request.customerName;
  const message = shareMessage(input.request, customerName);
  const subject = `Inspection Report ${input.request.reference}`;

  if (input.channel === "whatsapp") {
    const phone = sanitizeWhatsAppPhone(input.customer?.phone);
    if (!phone) {
      throw new Error("Customer phone number is missing or invalid. Update the customer record, then try again.");
    }
  } else {
    const email = input.customer?.email?.trim();
    if (!email || !email.includes("@")) {
      throw new Error("Customer email is missing or invalid. Update the customer record, then try again.");
    }
  }

  const doc = await api.generateDocument("inspection-report", input.request.id);
  if (!doc.file?.id) {
    throw new Error("Inspection report PDF could not be generated.");
  }

  const filename = `${input.request.reference}-inspection-report.pdf`;
  const file = await fetchInspectionPdfBlob(doc.file.id, filename);

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
    const phone = sanitizeWhatsAppPhone(input.customer?.phone)!;
    const popup = window.open(buildWhatsAppShareUrl(phone, message), "_blank", "noopener,noreferrer");
    opened = Boolean(popup);
  } else {
    const email = input.customer!.email!.trim();
    const gmailUrl = buildGmailComposeUrl({ to: email, subject, body: message });
    const popup = window.open(gmailUrl, "_blank", "noopener,noreferrer");
    opened = Boolean(popup);
    if (!opened) {
      window.location.href = buildMailtoUrl({ to: email, subject, body: message });
      opened = true;
    }
  }

  if (!opened && !sharedNatively) {
    throw new Error("Unable to open the messaging app. Allow pop-ups for this site, then try again.");
  }

  return { opened, downloaded: true, sharedNatively };
}
