import { getDb, rows } from "./db";
import { queueEmail } from "./notify";
import { creatorDigestData } from "./queries";

/**
 * Weekly digest.
 *
 * Two audiences, one job: bring people back. Learners with `digest_opt_in` get
 * what's new in the topics they've asked about (never generic spam); the creator
 * gets the operating week. idempotency keys are per week so running the cron
 * twice is harmless.
 */
export function weekKey(date = new Date()): string {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const days = Math.floor((date.getTime() - start.getTime()) / 864e5);
  return `${date.getUTCFullYear()}-w${Math.ceil((days + start.getUTCDay() + 1) / 7)}`;
}

export function sendWeeklyDigests(now = new Date()): { creator: boolean; learners: number } {
  const db = getDb();
  const key = weekKey(now);
  const weekAgo = new Date(now.getTime() - 7 * 864e5).toISOString();

  let creator = false;
  const creatorRow = rows<{ id: string; email: string; name: string | null }>(
    db.prepare("SELECT id, email, name FROM users WHERE role = 'creator' LIMIT 1"),
  )[0];

  if (creatorRow) {
    const digest = creatorDigestData();
    const result = queueEmail({
      to: creatorRow.email,
      userId: creatorRow.id,
      template: "creator_digest",
      idempotencyKey: `digest:creator:${key}`,
      data: {
        name: creatorRow.name ?? "there",
        newRequests: digest.newRequests,
        topVoted: digest.topVoted,
        delivered: digest.delivered,
        queue: digest.queue,
        medianDays: digest.medianDays,
      },
    });
    creator = result.status === "delivered";
  }

  // Learners: only new public lessons in categories they've engaged with.
  const learners = rows<{ id: string; email: string; name: string | null; categories: string | null }>(
    db.prepare(`
      SELECT u.id, u.email, u.name,
             (SELECT GROUP_CONCAT(DISTINCT r.category)
                FROM requests r WHERE r.created_by = u.id) AS categories
        FROM users u
       WHERE u.role = 'learner'
         AND u.digest_opt_in = 1
         AND u.email_bounced_at IS NULL
         AND EXISTS (SELECT 1 FROM requests r WHERE r.created_by = u.id)
    `),
  );

  let sent = 0;
  for (const learner of learners) {
    const categories = (learner.categories ?? "").split(",").filter(Boolean);
    if (categories.length === 0) continue;

    const placeholders = categories.map(() => "?").join(",");
    const fresh = rows<{ title: string; slug: string }>(
      db.prepare(`
        SELECT r.title, r.slug FROM requests r
         WHERE r.visibility = 'public' AND r.status = 'fulfilled'
           AND r.fulfilled_at > ?
           AND r.category IN (${placeholders})
         ORDER BY r.fulfilled_at DESC LIMIT 3
      `),
      weekAgo,
      ...categories,
    );

    if (fresh.length === 0) continue;

    const result = queueEmail({
      to: learner.email,
      userId: learner.id,
      template: "lesson_ready",
      idempotencyKey: `digest:learner:${learner.id}:${key}`,
      data: {
        name: learner.name ?? "there",
        title: fresh[0].title,
        videoTitle: fresh[0].title,
        note:
          fresh.length === 1
            ? "One new lesson landed in a topic you asked about this week."
            : `${fresh.length} new lessons landed in topics you asked about: ${fresh.map((item) => item.title).join("; ")}.`,
        path: `/tutorials/${fresh[0].slug}`,
        private: "0",
      },
    });
    if (result.status === "delivered") sent += 1;
  }

  return { creator, learners: sent };
}
