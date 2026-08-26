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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to create QR image"));
    img.src = src;
  });
}

export async function downloadEquipmentQrPng(assetTag: string) {
  const tag = assetTag.trim();
  if (!tag) return;

  const qrSize = 720;
  const padding = 40;
  const footer = 80;
  const qr = await equipmentQrDataUrl(tag, qrSize);
  const image = await loadImage(qr);

  const canvas = document.createElement("canvas");
  canvas.width = padding * 2 + qrSize;
  canvas.height = padding * 2 + qrSize + footer;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, padding, padding, qrSize, qrSize);

  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.font = "700 36px ui-monospace, Consolas, monospace";
  ctx.fillText(tag, canvas.width / 2, padding + qrSize + 52);

  downloadDataUrl(canvas.toDataURL("image/png"), `${tag}-qr.png`);
}
