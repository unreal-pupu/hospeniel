/**
 * Server-only image validation: magic bytes + size + filename safety.
 * Does not trust client file extensions.
 */

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

const DANGEROUS_EXTENSIONS = [
  ".js",
  ".mjs",
  ".php",
  ".phtml",
  ".exe",
  ".sh",
  ".bash",
  ".py",
  ".rb",
  ".pl",
  ".cgi",
  ".jsp",
  ".asp",
  ".aspx",
  ".dll",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".vbs",
  ".wasm",
  ".jar",
  ".app",
  ".deb",
  ".rpm",
];

export type DetectedImageKind = "jpeg" | "png" | "webp";

export interface ImageValidationSuccess {
  ok: true;
  kind: DetectedImageKind;
  contentType: string;
  fileExtension: string;
}

export interface ImageValidationFailure {
  ok: false;
  message: string;
}

export type ImageValidationResult = ImageValidationSuccess | ImageValidationFailure;

function detectKindByMagicBytes(buf: Uint8Array): DetectedImageKind | null {
  if (buf.length < 12) return null;

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpeg";
  }

  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "png";
  }

  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

function kindToContentType(kind: DetectedImageKind): string {
  switch (kind) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function kindToFileExtension(kind: DetectedImageKind): string {
  switch (kind) {
    case "jpeg":
      return "jpg";
    case "png":
      return "png";
    case "webp":
      return "webp";
    default:
      return "bin";
  }
}

function declaredMimeMatchesKind(declaredMime: string | null | undefined, kind: DetectedImageKind): boolean {
  const d = (declaredMime || "").trim().toLowerCase();
  if (!d || d === "application/octet-stream") return true;

  if (kind === "jpeg") {
    return d === "image/jpeg" || d === "image/jpg" || d === "image/pjpeg";
  }
  if (kind === "png") {
    return d === "image/png";
  }
  if (kind === "webp") {
    return d === "image/webp";
  }
  return false;
}

function isDangerousOriginalName(originalName: string): boolean {
  const lower = originalName.trim().toLowerCase();
  if (!lower) return false;
  if (lower.includes("..") || lower.includes("/") || lower.includes("\\")) return true;
  return DANGEROUS_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Validate raw bytes as a safe image. Call only on the server.
 */
export function validateImageUpload(input: {
  buffer: Uint8Array;
  originalName: string;
  declaredMime?: string | null;
}): ImageValidationResult {
  if (input.buffer.byteLength > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      ok: false,
      message: `File is too large. Images must be ${MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024}MB or smaller.`,
    };
  }

  if (input.buffer.byteLength < 24) {
    return { ok: false, message: "File is too small or corrupted." };
  }

  if (isDangerousOriginalName(input.originalName)) {
    return { ok: false, message: "This file type is not allowed." };
  }

  const kind = detectKindByMagicBytes(input.buffer);
  if (!kind) {
    return {
      ok: false,
      message: "Only JPG, JPEG, PNG, and WebP images are allowed.",
    };
  }

  if (!declaredMimeMatchesKind(input.declaredMime, kind)) {
    return {
      ok: false,
      message: "File type does not match the image contents. Please upload a valid JPG, PNG, or WebP file.",
    };
  }

  return {
    ok: true,
    kind,
    contentType: kindToContentType(kind),
    fileExtension: kindToFileExtension(kind),
  };
}
