const APPROVED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const APPROVED_FILE_TYPES = new Set([
  ...APPROVED_IMAGE_TYPES,
  "application/pdf",
  "text/plain",
  "text/csv",
  "video/mp4",
  "video/webm",
]);

export const APPROVED_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export const APPROVED_IMAGE_TYPE_MESSAGE =
  "This image type is not allowed. You can only upload approved types: JPEG, PNG, and WebP.";

const APPROVED_FILE_TYPE_MESSAGE =
  "This file type is not allowed. You can only upload approved types: JPEG, PNG, WebP, PDF, TXT, CSV, MP4, and WebM.";

function looksLikeImage(file: File) {
  const mime = file.type.toLowerCase();
  return mime.startsWith("image/") || /\.(gif|bmp|svg|heic|heif|tiff?|avif|ico|jpe?g|png|webp)$/i.test(file.name);
}

export function uploadTypeErrorMessage(file: File, imagesOnly = false): string | null {
  const mime = file.type.toLowerCase();
  const allowed = imagesOnly ? APPROVED_IMAGE_TYPES : APPROVED_FILE_TYPES;
  if (allowed.has(mime)) return null;
  if (!mime && /\.(jpe?g|png|webp)$/i.test(file.name)) return null;
  if (!imagesOnly && !mime && /\.(pdf|txt|csv|mp4|webm)$/i.test(file.name)) return null;
  if (imagesOnly || looksLikeImage(file)) return APPROVED_IMAGE_TYPE_MESSAGE;
  return APPROVED_FILE_TYPE_MESSAGE;
}

export function keepApprovedFiles(files: File[], imagesOnly = false) {
  const allowed: File[] = [];
  let error: string | null = null;
  for (const file of files) {
    const message = uploadTypeErrorMessage(file, imagesOnly);
    if (message) error = message;
    else allowed.push(file);
  }
  return { allowed, error };
}
