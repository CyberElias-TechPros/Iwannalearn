import { describe, expect, it } from "vitest";
import { validateUpload, extensionOf, humanSize, MAX_UPLOAD_BYTES } from "@/lib/upload-rules";

/**
 * These are the rules that stand between "a learner's spreadsheet" and "somebody
 * uploading an executable". They are pure, so they get tested exhaustively.
 */

const head = (...bytes: number[]) => new Uint8Array(bytes);

const PNG = head(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
const PDF = head(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34);
const JPG = head(0xff, 0xd8, 0xff, 0xe0);
const ZIP = head(0x50, 0x4b, 0x03, 0x04);
const RIFF_WEBP = head(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
const TEXT = new TextEncoder().encode("name,amount\nAda,2500\n");

function check(filename: string, bytes: Uint8Array) {
  return validateUpload({ filename, size: bytes.byteLength, mime: "application/octet-stream", head: bytes.slice(0, 16) });
}

describe("extensionOf", () => {
  it("reads the last segment and lowercases it", () => {
    expect(extensionOf("Report.PDF")).toBe("pdf");
    expect(extensionOf("data.tar.gz")).toBe("gz");
    expect(extensionOf("no-extension")).toBe("");
  });
});

describe("validateUpload — accepted files", () => {
  it("accepts a real PDF", () => {
    expect(check("brief.pdf", PDF)).toEqual({ ok: true, ext: "pdf", mime: "application/pdf" });
  });

  it("accepts a real PNG", () => {
    expect(check("screenshot.png", PNG).ok).toBe(true);
  });

  it("accepts a real JPEG", () => {
    expect(check("photo.jpg", JPG).ok).toBe(true);
    expect(check("photo.jpeg", JPG).ok).toBe(true);
  });

  it("accepts a real WebP by RIFF/WEBP signature", () => {
    expect(check("shot.webp", RIFF_WEBP).ok).toBe(true);
  });

  it("accepts xlsx/docx/zip because they share the zip signature", () => {
    expect(check("sheet.xlsx", ZIP).ok).toBe(true);
    expect(check("doc.docx", ZIP).ok).toBe(true);
    expect(check("bundle.zip", ZIP).ok).toBe(true);
  });

  it("accepts plain text formats without a magic byte", () => {
    expect(check("notes.csv", TEXT).ok).toBe(true);
    expect(check("notes.txt", TEXT).ok).toBe(true);
    expect(check("notes.md", TEXT).ok).toBe(true);
    expect(check("notes.json", TEXT).ok).toBe(true);
  });
});

describe("validateUpload — refusals", () => {
  it("refuses SVG, which can carry scripts", () => {
    const result = check("logo.svg", new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/SVG/i);
  });

  it("refuses executables, scripts and html by extension", () => {
    for (const name of ["setup.exe", "run.sh", "page.html", "app.js"]) {
      const result = check(name, TEXT);
      expect(result.ok, name).toBe(false);
    }
  });

  it("refuses unknown extensions and lists what is allowed", () => {
    const result = check("photo.heic", TEXT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Accepted/);
  });

  it("refuses a file with no extension", () => {
    const result = check("mystery", TEXT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/extension/i);
  });

  it("refuses contents that don't match the extension", () => {
    // A Windows executable renamed to .pdf.
    const exe = head(0x4d, 0x5a, 0x90, 0x00, 0x03);
    const result = check("invoice.pdf", exe);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/contents/i);
  });

  it("refuses an empty file", () => {
    const result = check("empty.csv", new Uint8Array(0));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/empty/i);
  });

  it("refuses a file over the 10 MB cap and names the limit", () => {
    const result = validateUpload({
      filename: "huge.pdf",
      size: MAX_UPLOAD_BYTES + 1,
      mime: "application/pdf",
      head: PDF.slice(0, 16),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/10 MB/);
  });

  it("refuses a fake WebP", () => {
    const result = check("fake.webp", head(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20));
    expect(result.ok).toBe(false);
  });
});

describe("humanSize", () => {
  it("scales units sensibly", () => {
    expect(humanSize(512)).toBe("512 B");
    expect(humanSize(2048)).toBe("2 KB");
    expect(humanSize(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });
});
