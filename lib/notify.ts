import { getDb, row, randomUUID } from "./db";
import { renderEmail, type EmailTemplate } from "./email";

/**
 * The notification layer.
 *
 * Two channels on purpose: in-app (always available, no provider) and email
 * (the return trigger). Every email is captured in `outbox` and mirrored in
 * `notification_logs` with an idempotency key, so retries cannot double-send.
 *
 * The transport is the only stubbed part — swapping `deliver()` for a Resend or
 * Postmark call finishes Phase C.
 */

export type NotificationInput = {
  userId: string;
  kind: string;
  title: string;
  body: string;
  href?: string | null;
  requestId?: string | null;
};

export function notifyUser(input: NotificationInput) {
  getDb()
    .prepare(
      "INSERT INTO notifications (id, user_id, request_id, kind, title, body, href, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      randomUUID(),
      input.userId,
      input.requestId ?? null,
      input.kind,
      input.title,
      input.body,
      input.href ?? null,
      new Date().toISOString(),
    );
}

export type EmailJob = {
  to: string;
  template: EmailTemplate;
  data: Record<string, string | number | boolean | null | undefined>;
  requestId?: string | null;
  idempotencyKey: string;
  userId?: string | null;
};

export type DeliveryResult =
  | { status: "delivered"; id: string }
  | { status: "duplicate"; id: string | null }
  | { status: "suppressed"; id: string | null; reason: string };

export function queueEmail(job: EmailJob): DeliveryResult {
  const db = getDb();

  const existing = row<{ id: string }>(
    db.prepare("SELECT id FROM notification_logs WHERE idempotency_key = ?"),
    job.idempotencyKey,
  );
  if (existing) return { status: "duplicate", id: existing.id };

  // Never email a hard-bounced address: the bell already carries the message.
  if (job.userId) {
    const user = row<{ email_bounced_at: string | null }>(
      db.prepare("SELECT email_bounced_at FROM users WHERE id = ?"),
      job.userId,
    );
    if (user?.email_bounced_at) {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO notification_logs (id, provider, channel, status, attempts, last_error, idempotency_key, to_email, subject, created_at, updated_at)
         VALUES (?, 'stub', 'email', 'suppressed', 0, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        "Address previously bounced — delivered in-app only.",
        job.idempotencyKey,
        job.to,
        "",
        new Date().toISOString(),
        new Date().toISOString(),
      );
      return { status: "suppressed", id, reason: "bounced" };
    }
  }

  const rendered = renderEmail(job.template, job.data);
  const outboxId = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO outbox (id, request_id, to_email, subject, body, html, status, provider, created_at) VALUES (?, ?, ?, ?, ?, ?, 'queued', 'stub', ?)",
  ).run(outboxId, job.requestId ?? null, job.to, rendered.subject, rendered.text, rendered.html, now);

  const logId = randomUUID();
  db.prepare(
    `INSERT INTO notification_logs (id, outbox_id, provider, channel, status, attempts, idempotency_key, to_email, subject, created_at, updated_at)
     VALUES (?, ?, 'stub', 'email', 'queued', 0, ?, ?, ?, ?, ?)`,
  ).run(logId, outboxId, job.idempotencyKey, job.to, rendered.subject, now, now);

  return deliver(outboxId);
}

/**
 * Attempt delivery. With no provider configured this marks the message
 * `delivered` so the loop is testable; a real provider replaces the body.
 */
export function deliver(outboxId: string): DeliveryResult {
  const db = getDb();
  const log = row<{ id: string; attempts: number }>(
    db.prepare("SELECT id, attempts FROM notification_logs WHERE outbox_id = ?"),
    outboxId,
  );
  const now = new Date().toISOString();

  if (!log) {
    db.prepare("UPDATE outbox SET status = 'failed' WHERE id = ?").run(outboxId);
    return { status: "duplicate", id: null };
  }

  db.prepare("UPDATE notification_logs SET status = 'delivered', attempts = attempts + 1, updated_at = ? WHERE outbox_id = ?").run(
    now,
    outboxId,
  );
  db.prepare("UPDATE outbox SET status = 'delivered' WHERE id = ?").run(outboxId);
  return { status: "delivered", id: outboxId };
}

/** Simulates a provider bounce so the failure path is exercisable. */
export function markBounced(outboxId: string, email: string, reason = "Mailbox not found") {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE outbox SET status = 'bounced' WHERE id = ?").run(outboxId);
  db.prepare(
    "UPDATE notification_logs SET status = 'bounced', attempts = attempts + 1, last_error = ?, updated_at = ? WHERE outbox_id = ?",
  ).run(reason, now, outboxId);
  db.prepare("UPDATE users SET email_bounced_at = ? WHERE email = ?").run(now, email);
}

export function clearBounce(userId: string) {
  getDb().prepare("UPDATE users SET email_bounced_at = NULL WHERE id = ?").run(userId);
}
