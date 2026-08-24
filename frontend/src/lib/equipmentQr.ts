import QRCode from "qrcode";

const QR_OPTIONS = { margin: 1, errorCorrectionLevel: "M" as const };

function randomLetters(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function generateEquipmentAssetTag(existing: string[] = []) {
  const used = new Set(existing.map((tag) => tag.trim().toUpperCase()));
  for (let i = 0; i < 40; i += 1) {
    const tag = `MED-${randomLetters(2)}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    if (!used.has(tag)) return tag;
  }
  return `MED-${Date.now().toString(36).toUpperCase()}`;
}

export async function equipmentQrDataUrl(assetTag: string, width = 280) {
  const value = assetTag.trim();
  if (!value) return "";
  return QRCode.toDataURL(value, { ...QR_OPTIONS, width });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadEquipmentQrPng(assetTag: string) {
  const tag = assetTag.trim();
  if (!tag) return;
  const dataUrl = await equipmentQrDataUrl(tag, 640);
  downloadDataUrl(dataUrl, `${tag}-qr.png`);
}

function safeLabel(value: string | undefined, fallback: string) {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
}

export async function downloadEquipmentQrLabel(options: {
  assetTag: string;
  name?: string;
  manufacturer?: string;
  model?: string;
}) {
  const tag = options.assetTag.trim();
  if (!tag) return;

  const qr = await equipmentQrDataUrl(tag, 420);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to draw QR label"));
    img.src = qr;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 960;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0f766e";
  ctx.fillRect(0, 0, canvas.width, 88);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 28px Inter, Arial, sans-serif";
  ctx.fillText("MESMS", 40, 56);
  ctx.font = "400 16px Inter, Arial, sans-serif";
  ctx.fillText("Equipment asset label", 160, 56);

  const qrX = (canvas.width - 420) / 2;
  ctx.drawImage(image, qrX, 130, 420, 420);

  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.font = "700 36px ui-monospace, Consolas, monospace";
  ctx.fillText(tag, canvas.width / 2, 620);

  ctx.font = "600 28px Inter, Arial, sans-serif";
  ctx.fillText(safeLabel(options.name, "Unnamed equipment"), canvas.width / 2, 680);

  ctx.fillStyle = "#475569";
  ctx.font = "400 22px Inter, Arial, sans-serif";
  ctx.fillText(
    [options.manufacturer, options.model].filter((part) => part?.trim()).join(" · ") || "Ready for site install",
    canvas.width / 2,
    722,
  );

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

  ctx.fillStyle = "#64748b";
  ctx.font = "400 16px Inter, Arial, sans-serif";
  ctx.fillText("Scan to look up this machine in MESMS", canvas.width / 2, 880);

  downloadDataUrl(canvas.toDataURL("image/png"), `${tag}-label.png`);
}
