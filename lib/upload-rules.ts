/**
 * Upload rules: pure functions and constants with **no Node built-ins**, so the
 * browser component can validate locally with the exact same rules the server
 * enforces. Storage and database work live in lib/uploads.ts.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MAX_UPLOADS_PER_REQUEST = 5;

/** Extension → the magic bytes that must be present. */
const ALLOWED: Record<string, { mimes: string[]; magic: number[][] }> = {
  png: { mimes: ["image/png"], magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  jpg: { mimes: ["image/jpeg"], magic: [[0xff, 0xd8, 0xff]] },
  jpeg: { mimes: ["image/jpeg"], magic: [[0xff, 0xd8, 0xff]] },
  gif: { mimes: ["image/gif"], magic: [[0x47, 0x49, 0x46, 0x38]] },
  webp: { mimes: ["image/webp"], magic: [] }, // RIFF....WEBP, checked below
  pdf: { mimes: ["application/pdf"], magic: [[0x25, 0x50, 0x44, 0x46]] },
  csv: { mimes: ["text/csv", "application/csv", "text/plain"], magic: [] },
  txt: { mimes: ["text/plain"], magic: [] },
  md: { mimes: ["text/markdown", "text/plain"], magic: [] },
  json: { mimes: ["application/json", "text/plain"], magic: [] },
  xlsx: { mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], magic: [[0x50, 0x4b, 0x03, 0x04]] },
  docx: { mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], magic: [[0x50, 0x4b, 0x03, 0x04]] },
  zip: { mimes: ["application/zip"], magic: [[0x50, 0x4b, 0x03, 0x04]] },
};

export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED)
  .map((ext) => `.${ext}`)
  .join(",");

export type ValidationResult =
  | { ok: true; ext: string; mime: string }
  | { ok: false; error: string };

export function extensionOf(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((byte, index) => bytes[index] === byte);
}

/** Validates name, size and content. Call before writing anything to disk. */
export function validateUpload(input: {
  filename: string;
  size: number;
  mime: string;
  head: Uint8Array;
}): ValidationResult {
  const ext = extensionOf(input.filename);

  if (!ext) return { ok: false, error: "That file has no extension — rename it (for example notes.pdf) and try again." };
  if (ext === "svg" || ext === "svgz") {
    return { ok: false, error: "SVG files can carry scripts, so they aren't accepted. Export a PNG instead." };
  }
  if (ext === "html" || ext === "htm" || ext === "js" || ext === "exe" || ext === "sh") {
    return { ok: false, error: "That file type can't be accepted. Screenshots, PDFs and data files are fine." };
  }

  const rule = ALLOWED[ext];
  if (!rule) {
    return {
      ok: false,
      error: `We can't take .${ext} files. Accepted: ${Object.keys(ALLOWED).join(", ")}.`,
    };
  }

  if (input.size <= 0) return { ok: false, error: "That file is empty." };
  if (input.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `That file is ${(input.size / 1048576).toFixed(1)} MB — the limit is 10 MB.` };
  }

  // Magic-byte check: a .pdf that is really a zip or an executable is refused.
  if (rule.magic.length > 0 && input.head.length > 0) {
    const matches = rule.magic.some((prefix) => startsWith(input.head, prefix));
    if (!matches) {
      return { ok: false, error: "That file's contents don't match its extension. Try re-exporting it." };
    }
  }

  if (ext === "webp") {
    const riff = startsWith(input.head, [0x52, 0x49, 0x46, 0x46]);
    const webp = input.head.length > 11 && String.fromCharCode(...input.head.slice(8, 12)) === "WEBP";
    if (!riff || !webp) return { ok: false, error: "That isn't a valid WebP image." };
  }

  return { ok: true, ext, mime: rule.mimes[0] };
}


/** Human-readable size, for both the picker and the request page. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
