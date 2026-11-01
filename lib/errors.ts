import { getDb, row, rows, randomUUID } from "./db";
import { createHash } from "node:crypto";

/**
 * Error log.
 *
 * `console.error` disappears the moment the process restarts, which is exactly
 * when you need it. Every boundary and every caught server failure writes here
 * instead, de-duplicated by a fingerprint so one broken route can't bury the
 * signal under a thousand identical rows.
 */

export type ErrorLogRow = {
  id: string;
  scope: string;
  message: string;
  stack: string | null;
  url: string | null;
  user_id: string | null;
  digest: string | null;
  created_at: string;
  count: number;
  last_seen_at: string;
};

function fingerprint(scope: string, message: string, url: string | null): string {
  return createHash("sha256").update(`${scope}|${message}|${url ?? ""}`).digest("hex").slice(0, 16);
}

export function logError(input: {
  scope: string;
  message: string;
  stack?: string | null;
  url?: string | null;
  userId?: string | null;
  digest?: string | null;
}) {
  try {
    const db = getDb();
    const fp = fingerprint(input.scope, input.message, input.url ?? null);
    const now = new Date().toISOString();

    const existing = row<{ id: string; count: number }>(
      db.prepare("SELECT id, count FROM error_logs WHERE digest = ?"),
      fp,
    );

    if (existing) {
      db.prepare("UPDATE error_logs SET count = count + 1, last_seen_at = ?, stack = COALESCE(?, stack) WHERE id = ?").run(
        now,
        input.stack ?? null,
        existing.id,
      );
      return;
    }

    db.prepare(
      `INSERT INTO error_logs (id, scope, message, stack, url, user_id, digest, created_at, count, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    ).run(
      randomUUID(),
      input.scope.slice(0, 60),
      input.message.slice(0, 2000),
      input.stack?.slice(0, 8000) ?? null,
      input.url?.slice(0, 500) ?? null,
      input.userId ?? null,
      fp,
      now,
      now,
    );
  } catch (error) {
    // Logging must never take the request down with it.
    console.error("[error-log] could not record error", error);
  }
}

export function listErrors(limit = 50): ErrorLogRow[] {
  return rows<ErrorLogRow>(
    getDb().prepare("SELECT * FROM error_logs ORDER BY last_seen_at DESC LIMIT ?"),
    limit,
  );
}

export function errorStats() {
  const db = getDb();
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const one = (sql: string, ...params: unknown[]) =>
    Number(row<{ n: number }>(db.prepare(sql), ...params)?.n ?? 0);
  return {
    total: one("SELECT COUNT(*) AS n FROM error_logs"),
    last24h: one("SELECT COUNT(*) AS n FROM error_logs WHERE last_seen_at > ?", dayAgo),
    distinct: one("SELECT COUNT(DISTINCT digest) AS n FROM error_logs"),
    newest: row<{ last_seen_at: string }>(db.prepare("SELECT MAX(last_seen_at) AS last_seen_at FROM error_logs"))?.last_seen_at ?? null,
  };
}

export function clearErrors(): number {
  const result = getDb().prepare("DELETE FROM error_logs").run();
  return Number(result.changes);
}
