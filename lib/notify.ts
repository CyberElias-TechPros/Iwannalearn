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
  /**
   * Transactional mail the user asked for or is contractually owed — a sign-in
   * link, a receipt. These ignore the "email me about lessons" preference,
   * because suppressing them would lock someone out or hide their money.
   */
  critical?: boolean;
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
    const user = row<{ email_bounced_at: string | null; notify_email: number; unsubscribe_token: string | null }>(
      db.prepare("SELECT email_bounced_at, notify_email, unsubscribe_token FROM users WHERE id = ?"),
      job.userId,
    );

    // Respect the preference the user actually set. Silent override would be
    // exactly the behaviour the account page promises we don't do.
    if (user && !Number(user.notify_email) && !job.critical) {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO notification_logs (id, provider, channel, status, attempts, last_error, idempotency_key, to_email, subject, created_at, updated_at)
         VALUES (?, 'stub', 'email', 'suppressed', 0, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        "Email notifications are switched off — delivered in-app only.",
        job.idempotencyKey,
        job.to,
        "",
        new Date().toISOString(),
        new Date().toISOString(),
      );
      return { status: "suppressed", id, reason: "preference" };
    }

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

  const unsubscribeUrl = job.userId
    ? `${process.env.SITE_URL ?? "http://localhost:3000"}/unsubscribe/${ensureUnsubscribeToken(job.userId)}`
    : null;

  const rendered = renderEmail(job.template, { ...job.data, ...(unsubscribeUrl ? { unsubscribeUrl } : {}) });
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
/** Lazily mints a stable unsubscribe token, so every email carries a working opt-out. */
export function ensureUnsubscribeToken(userId: string): string {
  const db = getDb();
  const existing = row<{ unsubscribe_token: string | null }>(
    db.prepare("SELECT unsubscribe_token FROM users WHERE id = ?"),
    userId,
  );
  if (existing?.unsubscribe_token) return existing.unsubscribe_token;

  const token = randomUUID().replace(/-/g, "");
  db.prepare("UPDATE users SET unsubscribe_token = ? WHERE id = ?").run(token, userId);
  return token;
}

export function unsubscribeByToken(
  token: string,
): { ok: boolean; email?: string; alreadyOff?: boolean } {
  const db = getDb();
  const user = row<{ id: string; email: string; notify_email: number }>(
    db.prepare("SELECT id, email, notify_email FROM users WHERE unsubscribe_token = ?"),
    token,
  );
  if (!user) return { ok: false };

  if (!Number(user.notify_email)) return { ok: true, email: user.email, alreadyOff: true };

  db.prepare("UPDATE users SET notify_email = 0 WHERE id = ?").run(user.id);
  db.prepare(
    "INSERT INTO notification_logs (id, provider, channel, status, attempts, last_error, idempotency_key, to_email, subject, created_at, updated_at) VALUES (?, 'stub', 'email', 'suppressed', 0, ?, ?, ?, '', ?, ?)",
  ).run(
    randomUUID(),
    "Unsubscribed via one-click link.",
    `unsubscribe:${user.id}`,
    user.email,
    new Date().toISOString(),
    new Date().toISOString(),
  );
  return { ok: true, email: user.email };
}

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
