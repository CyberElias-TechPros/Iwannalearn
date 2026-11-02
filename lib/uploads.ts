import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, unlink, stat } from "node:fs/promises";
import path from "node:path";
import { getDb, row, rows } from "./db";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOADS_PER_REQUEST,
  ACCEPT_ATTRIBUTE,
  validateUpload,
  extensionOf,
  humanSize,
} from "./upload-rules";

export { MAX_UPLOAD_BYTES, MAX_UPLOADS_PER_REQUEST, ACCEPT_ATTRIBUTE, validateUpload, extensionOf, humanSize };

/**
 * Attachments: the difference between "merge two CSVs" and "here's *my* CSV".
 *
 * A private lesson is a video about the learner's own files, so the product is
 * hollow without this. Storage is deliberately local-disk-with-a-key so the
 * swap to R2/S3 presigned uploads is one function (`putObject`/`getObject`).
 *
 * Safety rules, all enforced server-side:
 *  - allow-list by extension *and* sniffed magic bytes (never trust the client MIME),
 *  - hard size cap before anything touches disk,
 *  - random storage keys (no user-controlled path, no traversal),
 *  - files are only ever served back through an authenticated, ownership-checked route,
 *  - SVG is refused: it is a script execution vector when served inline.
 */

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

const ROOT = path.join(process.cwd(), "data", "uploads");

function storagePath(storageKey: string) {
  // storageKey is generated (uuid + ext) — never derived from user input.
  return path.join(ROOT, storageKey);
}

async function putObject(storageKey: string, bytes: Uint8Array) {
  await mkdir(ROOT, { recursive: true });
  await writeFile(storagePath(storageKey), bytes);
}

export async function getObject(storageKey: string): Promise<Uint8Array | null> {
  try {
    await stat(storagePath(storageKey));
    return new Uint8Array(await readFile(storagePath(storageKey)));
  } catch {
    return null;
  }
}

export async function deleteObject(storageKey: string) {
  try {
    await unlink(storagePath(storageKey));
  } catch {
    /* already gone */
  }
}

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */

export type UploadRow = {
  id: string;
  request_id: string | null;
  user_id: string;
  filename: string;
  mime: string;
  size: number;
  storage_key: string;
  kind: string;
  note: string | null;
  created_at: string;
};

export async function saveUpload(input: {
  userId: string;
  filename: string;
  mime: string;
  bytes: Uint8Array;
  kind?: "brief" | "delivery";
  note?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const validation = validateUpload({
    filename: input.filename,
    size: input.bytes.byteLength,
    mime: input.mime,
    head: input.bytes.slice(0, 16),
  });
  if (!validation.ok) return validation;

  // Content-addressed suffix keeps the key unguessable and collision-free.
  const hash = createHash("sha256").update(input.bytes).digest("hex").slice(0, 12);
  const storageKey = `${randomUUID()}-${hash}.${validation.ext}`;
  await putObject(storageKey, input.bytes);

  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO uploads (id, request_id, user_id, filename, mime, size, storage_key, kind, note, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.userId,
      input.filename.slice(0, 200),
      validation.mime,
      input.bytes.byteLength,
      storageKey,
      input.kind ?? "brief",
      input.note ?? null,
      new Date().toISOString(),
    );

  return { ok: true, id };
}

/** Attaches staged uploads to a request, enforcing ownership and the count cap. */
export function attachUploads(requestId: string, userId: string, uploadIds: string[]): number {
  const db = getDb();
  const current = row<{ n: number }>(
    db.prepare("SELECT COUNT(*) AS n FROM uploads WHERE request_id = ?"),
    requestId,
  );
  const room = Math.max(0, MAX_UPLOADS_PER_REQUEST - Number(current?.n ?? 0));
  let attached = 0;

  for (const id of uploadIds.slice(0, room)) {
    // Only the person who staged it may attach it, and only once.
    const result = db
      .prepare("UPDATE uploads SET request_id = ? WHERE id = ? AND user_id = ? AND request_id IS NULL")
      .run(requestId, id, userId);
    if (Number(result.changes) > 0) attached += 1;
  }

  const total = row<{ n: number }>(db.prepare("SELECT COUNT(*) AS n FROM uploads WHERE request_id = ?"), requestId);
  db.prepare("UPDATE requests SET attachment_count = ? WHERE id = ?").run(Number(total?.n ?? 0), requestId);
  return attached;
}

export function listUploads(requestId: string): UploadRow[] {
  return rows<UploadRow>(
    getDb().prepare("SELECT * FROM uploads WHERE request_id = ? ORDER BY created_at ASC"),
    requestId,
  );
}

export function getUpload(id: string): UploadRow | null {
  return row<UploadRow>(getDb().prepare("SELECT * FROM uploads WHERE id = ?"), id);
}

export function deleteUpload(id: string, userId: string): { ok: boolean; error?: string } {
  const db = getDb();
  const upload = getUpload(id);
  if (!upload) return { ok: false, error: "That file no longer exists." };
  if (upload.user_id !== userId) return { ok: false, error: "That isn't your file." };

  db.prepare("DELETE FROM uploads WHERE id = ?").run(id);
  if (upload.request_id) {
    const total = row<{ n: number }>(
      db.prepare("SELECT COUNT(*) AS n FROM uploads WHERE request_id = ?"),
      upload.request_id,
    );
    db.prepare("UPDATE requests SET attachment_count = ? WHERE id = ?").run(
      Number(total?.n ?? 0),
      upload.request_id,
    );
  }
  void deleteObject(upload.storage_key);
  return { ok: true };
}

/** Purges files that were staged but never attached to a request (abandoned wizards). */
export function purgeOrphanUploads(olderThanHours = 24): number {
  const db = getDb();
  const cutoff = new Date(Date.now() - olderThanHours * 3_600_000).toISOString();
  const orphans = rows<{ id: string; storage_key: string }>(
    db.prepare("SELECT id, storage_key FROM uploads WHERE request_id IS NULL AND created_at < ?"),
    cutoff,
  );
  for (const orphan of orphans) {
    db.prepare("DELETE FROM uploads WHERE id = ?").run(orphan.id);
    void deleteObject(orphan.storage_key);
  }
  return orphans.length;
}

