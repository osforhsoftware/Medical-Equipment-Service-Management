import QRCode from "qrcode";

const QR_OPTIONS = { margin: 2, errorCorrectionLevel: "M" as const };

/** Physical sticker size for equipment QR labels. */
export const QR_LABEL_SIZE_MM = 50;
export const QR_LABEL_DPI = 300;
/** 50 mm at 300 DPI ≈ 591 px */
export const QR_LABEL_SIZE_PX = Math.round((QR_LABEL_SIZE_MM / 25.4) * QR_LABEL_DPI);

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

function fitAssetTagFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxSize: number, minSize: number) {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = `700 ${size}px ui-monospace, Consolas, monospace`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 1;
  }
  ctx.font = `700 ${minSize}px ui-monospace, Consolas, monospace`;
  return minSize;
}

async function createSquareQrCanvas(assetTag: string, targetSize: number) {
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, assetTag, { ...QR_OPTIONS, width: targetSize });

  // Guard against any non-square library output by re-centering into an exact square.
  const side = Math.min(qrCanvas.width, qrCanvas.height, targetSize);
  if (qrCanvas.width === side && qrCanvas.height === side) return qrCanvas;

  const square = document.createElement("canvas");
  square.width = side;
  square.height = side;
  const qctx = square.getContext("2d");
  if (!qctx) throw new Error("Unable to create QR canvas");
  qctx.imageSmoothingEnabled = false;
  qctx.fillStyle = "#ffffff";
  qctx.fillRect(0, 0, side, side);
  const sx = Math.floor((qrCanvas.width - side) / 2);
  const sy = Math.floor((qrCanvas.height - side) / 2);
  qctx.drawImage(qrCanvas, sx, sy, side, side, 0, 0, side, side);
  return square;
}

/**
 * Renders a print-ready square QR sticker (50 × 50 mm at 300 DPI).
 * Encodes only the asset tag; shows that tag below the QR. No other equipment fields.
 */
export async function renderEquipmentQrLabelCanvas(assetTag: string) {
  const tag = assetTag.trim();
  if (!tag) throw new Error("Asset tag is required");

  const size = QR_LABEL_SIZE_PX;
  const borderWidth = 3;
  const pad = 28;
  const textBlock = 78;
  const gap = 12;
  const qrDrawSize = Math.max(120, size - borderWidth * 2 - pad * 2 - textBlock - gap);

  const qrCanvas = await createSquareQrCanvas(tag, qrDrawSize);
  const qrSide = Math.min(qrCanvas.width, qrCanvas.height);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to create QR label canvas");

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(borderWidth / 2, borderWidth / 2, size - borderWidth, size - borderWidth);

  // Center QR horizontally with equal side quiet zone.
  const contentTop = borderWidth + pad;
  const contentBottom = size - borderWidth - pad;
  const qrX = Math.round((size - qrSide) / 2);
  const qrY = contentTop;
  ctx.drawImage(qrCanvas, 0, 0, qrSide, qrSide, qrX, qrY, qrSide, qrSide);

  const textMaxWidth = size - borderWidth * 2 - pad * 2;
  const fontSize = fitAssetTagFont(ctx, tag, textMaxWidth, 34, 16);
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${fontSize}px ui-monospace, Consolas, monospace`;
  const textY = Math.round((qrY + qrSide + gap + contentBottom) / 2);
  ctx.fillText(tag, size / 2, textY, textMaxWidth);

  return canvas;
}

export async function equipmentQrLabelDataUrl(assetTag: string) {
  const canvas = await renderEquipmentQrLabelCanvas(assetTag);
  return canvas.toDataURL("image/png");
}

export async function downloadEquipmentQrPng(assetTag: string) {
  const tag = assetTag.trim();
  if (!tag) return;

  const dataUrl = await equipmentQrLabelDataUrl(tag);
  downloadDataUrl(dataUrl, `${tag}-label.png`);
}

/** Opens a print dialog sized to the physical 50 × 50 mm label (not stretched to A4). */
export async function printEquipmentQrLabel(assetTag: string) {
  const tag = assetTag.trim();
  if (!tag) return;

  const dataUrl = await equipmentQrLabelDataUrl(tag);
  const safeTag = tag.replace(/[<>&"]/g, "");

  let iframe = document.getElementById("equipment-qr-print-iframe") as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "equipment-qr-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);
  }

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) throw new Error("Unable to access print frame");

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safeTag} QR label</title>
  <style>
    @page { size: ${QR_LABEL_SIZE_MM}mm ${QR_LABEL_SIZE_MM}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${QR_LABEL_SIZE_MM}mm;
      height: ${QR_LABEL_SIZE_MM}mm;
      overflow: hidden;
      background: #fff;
    }
    img {
      display: block;
      width: ${QR_LABEL_SIZE_MM}mm;
      height: ${QR_LABEL_SIZE_MM}mm;
      max-width: ${QR_LABEL_SIZE_MM}mm;
      max-height: ${QR_LABEL_SIZE_MM}mm;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <img width="${QR_LABEL_SIZE_PX}" height="${QR_LABEL_SIZE_PX}" src="${dataUrl}" alt="QR label ${safeTag}" />
</body>
</html>`);
  iframeDoc.close();

  return new Promise<void>((resolve, reject) => {
    const img = iframeDoc.querySelector("img");
    const triggerPrint = () => {
      setTimeout(() => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 150);
    };

    if (img) {
      if (img.complete) {
        triggerPrint();
      } else {
        img.onload = triggerPrint;
        img.onerror = () => reject(new Error("Failed to load QR image for printing"));
      }
    } else {
      triggerPrint();
    }
  });
}
