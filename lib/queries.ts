import { getDb, row, rows } from "./db";
import { OPEN_STATUSES } from "./status";
import { getSetting } from "./service";
import type {
  AdminQueueItem,
  LessonSummary,
  NotificationRow,
  ReplyRow,
  RequestSummary,
} from "./types";

const baseSelect = `
  SELECT r.id, r.ref, r.slug, r.title, r.goal, r.tried, r.context_link AS contextLink,
         r.deadline, r.decline_reason AS declineReason, r.category, r.level, r.status, r.tier,
         r.visibility, r.payment_status AS paymentStatus, r.revision_state AS revisionState,
         r.moderation_flag AS moderationFlag, r.moderation_note AS moderationNote,
         r.price_kobo AS priceKobo, r.upvote_count AS upvoteCount, r.created_at AS createdAt,
         r.fulfilled_at AS fulfilledAt, r.delivery_confirmed_at AS deliveryConfirmedAt,
         r.created_by AS ownerId, u.name AS ownerName, u.email AS ownerEmail,
         r.priority_flag AS priorityFlag,
         EXISTS (SELECT 1 FROM replies p WHERE p.request_id = r.id AND p.kind = 'external' AND p.video_url IS NOT NULL) AS hasLesson,
         (SELECT p.video_title FROM replies p WHERE p.request_id = r.id AND p.kind = 'external' AND p.video_url IS NOT NULL ORDER BY p.created_at DESC LIMIT 1) AS lessonTitle,
         (SELECT p.video_id    FROM replies p WHERE p.request_id = r.id AND p.kind = 'external' AND p.video_url IS NOT NULL ORDER BY p.created_at DESC LIMIT 1) AS videoId,
         (SELECT p.video_length FROM replies p WHERE p.request_id = r.id AND p.kind = 'external' AND p.video_url IS NOT NULL ORDER BY p.created_at DESC LIMIT 1) AS videoLength,
         EXISTS (SELECT 1 FROM request_upvotes v WHERE v.request_id = r.id AND v.user_id = ?) AS viewerUpvoted,
         (SELECT COUNT(*) FROM replies p WHERE p.request_id = r.id AND p.kind = 'external') AS replyCount
    FROM requests r
    JOIN users u ON u.id = r.created_by
`;

type RawRequest = Omit<RequestSummary, "hasLesson" | "viewerUpvoted" | "replyCount"> & {
  hasLesson: number;
  viewerUpvoted: number;
  replyCount: number;
};

function normaliseRequest(raw: RawRequest): RequestSummary {
  return {
    ...raw,
    hasLesson: Boolean(raw.hasLesson),
    viewerUpvoted: Boolean(raw.viewerUpvoted),
    replyCount: Number(raw.replyCount ?? 0),
    upvoteCount: Number(raw.upvoteCount ?? 0),
    moderationFlag: Boolean(raw.moderationFlag),
    priceKobo: raw.priceKobo == null ? null : Number(raw.priceKobo),
  };
}

export type ListOptions = {
  viewerId?: string | null;
  q?: string;
  category?: string;
  level?: string;
  sort?: "popular" | "newest" | "oldest";
  limit?: number;
  offset?: number;
};

export function listOpenRequests(opts: ListOptions = {}): RequestSummary[] {
  const db = getDb();
  const viewer = opts.viewerId ?? "";
  const where: string[] = [
    `r.visibility = 'public'`,
    `r.status IN (${OPEN_STATUSES.map(() => "?").join(",")})`,
  ];
  const params: any[] = [viewer, ...OPEN_STATUSES];

  if (opts.q) {
    where.push("(LOWER(r.title) LIKE ? OR LOWER(r.goal) LIKE ? OR LOWER(r.category) LIKE ?)");
    const like = `%${opts.q.toLowerCase()}%`;
    params.push(like, like, like);
  }
  if (opts.category) {
    where.push("r.category = ?");
    params.push(opts.category);
  }
  if (opts.level) {
    where.push("r.level = ?");
    params.push(opts.level);
  }

  const order =
    opts.sort === "newest"
      ? "r.created_at DESC"
      : opts.sort === "oldest"
        ? "r.created_at ASC"
        : "r.upvote_count DESC, r.created_at DESC";

  const sql = `${baseSelect} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`;
  params.push(opts.limit ?? 60, opts.offset ?? 0);
  return rows<RawRequest>(db.prepare(sql), ...params).map(normaliseRequest);
}

export function countOpenRequests(opts: ListOptions = {}): number {
  const db = getDb();
  const where: string[] = [`r.visibility = 'public'`, `r.status IN (${OPEN_STATUSES.map(() => "?").join(",")})`];
  const params: any[] = [...OPEN_STATUSES];
  if (opts.q) {
    where.push("(LOWER(r.title) LIKE ? OR LOWER(r.goal) LIKE ? OR LOWER(r.category) LIKE ?)");
    const like = `%${opts.q.toLowerCase()}%`;
    params.push(like, like, like);
  }
  if (opts.category) {
    where.push("r.category = ?");
    params.push(opts.category);
  }
  if (opts.level) {
    where.push("r.level = ?");
    params.push(opts.level);
  }
  const found = row<{ n: number }>(
    db.prepare(`SELECT COUNT(*) AS n FROM requests r WHERE ${where.join(" AND ")}`),
    ...params,
  );
  return Number(found?.n ?? 0);
}

const lessonSelect = `
  SELECT r.id AS requestId, r.slug, r.title, r.goal, r.category, r.level,
         p.video_id AS videoId, p.video_url AS videoUrl, p.video_title AS videoTitle,
         p.video_length AS videoLength, p.message AS cameraMessage, p.resources,
         r.fulfilled_at AS fulfilledAt, r.upvote_count AS upvoteCount, u.name AS ownerName
    FROM replies p
    JOIN requests r ON r.id = p.request_id
    JOIN users u ON u.id = r.created_by
`;

function normaliseLesson(r: any): LessonSummary {
  return {
    ...r,
    upvoteCount: Number(r.upvoteCount ?? 0),
    resources: safeJson(r.resources),
  };
}

export function listLessons(opts: ListOptions = {}): LessonSummary[] {
  const db = getDb();
  const where: string[] = [
    "r.visibility = 'public'",
    "r.status = 'fulfilled'",
    "p.kind = 'external'",
    "p.video_url IS NOT NULL",
  ];
  const params: any[] = [];

  if (opts.q) {
    where.push(
      "(LOWER(r.title) LIKE ? OR LOWER(r.goal) LIKE ? OR LOWER(p.video_title) LIKE ? OR LOWER(r.category) LIKE ?)",
    );
    const like = `%${opts.q.toLowerCase()}%`;
    params.push(like, like, like, like);
  }
  if (opts.category) {
    where.push("r.category = ?");
    params.push(opts.category);
  }
  if (opts.level) {
    where.push("r.level = ?");
    params.push(opts.level);
  }

  const sql = `${lessonSelect} WHERE ${where.join(" AND ")}
     ORDER BY ${opts.sort === "popular" ? "r.upvote_count DESC" : "r.fulfilled_at DESC"}
     LIMIT ? OFFSET ?`;
  params.push(opts.limit ?? 40, opts.offset ?? 0);

  return rows<any>(db.prepare(sql), ...params).map(normaliseLesson);
}

export function countLessons(opts: ListOptions = {}): number {
  const db = getDb();
  const where: string[] = [
    "r.visibility = 'public'",
    "r.status = 'fulfilled'",
    "p.kind = 'external'",
    "p.video_url IS NOT NULL",
  ];
  const params: any[] = [];
  if (opts.q) {
    where.push(
      "(LOWER(r.title) LIKE ? OR LOWER(r.goal) LIKE ? OR LOWER(p.video_title) LIKE ? OR LOWER(r.category) LIKE ?)",
    );
    const like = `%${opts.q.toLowerCase()}%`;
    params.push(like, like, like, like);
  }
  if (opts.category) {
    where.push("r.category = ?");
    params.push(opts.category);
  }
  if (opts.level) {
    where.push("r.level = ?");
    params.push(opts.level);
  }
  const found = row<{ n: number }>(
    db.prepare(
      `SELECT COUNT(*) AS n FROM replies p JOIN requests r ON r.id = p.request_id WHERE ${where.join(" AND ")}`,
    ),
    ...params,
  );
  return Number(found?.n ?? 0);
}

export function getLessonBySlug(slug: string): LessonSummary | null {
  const found = row<any>(
    getDb().prepare(`${lessonSelect}
       WHERE r.slug = ? AND r.visibility = 'public' AND r.status = 'fulfilled'
         AND p.kind = 'external' AND p.video_url IS NOT NULL
       ORDER BY p.created_at DESC LIMIT 1`),
    slug,
  );
  return found ? normaliseLesson(found) : null;
}

export function getRequestBySlug(slug: string, viewerId?: string | null) {
  const found = row<RawRequest>(getDb().prepare(`${baseSelect} WHERE r.slug = ?`), viewerId ?? "", slug);
  return found ? normaliseRequest(found) : null;
}

export function getRequestById(id: string, viewerId?: string | null) {
  const found = row<RawRequest>(getDb().prepare(`${baseSelect} WHERE r.id = ?`), viewerId ?? "", id);
  return found ? normaliseRequest(found) : null;
}

export function getRequestExtras(requestId: string) {
  const db = getDb();
  const replies = rows<ReplyRow>(
    db.prepare(`
      SELECT p.id, p.kind, p.message, p.video_url AS videoUrl, p.video_id AS videoId,
             p.video_title AS videoTitle, p.video_length AS videoLength, p.resources,
             p.created_at AS createdAt, u.name AS authorName
        FROM replies p JOIN users u ON u.id = p.created_by
       WHERE p.request_id = ? AND p.kind = 'external'
       ORDER BY p.created_at ASC`),
    requestId,
  );

  const events = rows<any>(
    db.prepare(
      `SELECT id, kind, from_status AS fromStatus, to_status AS toStatus, message, created_at AS createdAt
         FROM request_events WHERE request_id = ? ORDER BY created_at ASC`,
    ),
    requestId,
  );

  const feedback = row<{ helpful: number; comment: string | null }>(
    db.prepare("SELECT helpful, comment FROM feedback WHERE request_id = ? ORDER BY created_at DESC LIMIT 1"),
    requestId,
  );

  return { replies, events, feedback };
}

export function getViewerFeedback(requestId: string, userId?: string | null) {
  if (!userId) return null;
  return row<{ helpful: number; comment: string | null }>(
    getDb().prepare("SELECT helpful, comment FROM feedback WHERE request_id = ? AND user_id = ?"),
    requestId,
    userId,
  );
}

export function listMyRequests(userId: string): RequestSummary[] {
  return rows<RawRequest>(
    getDb().prepare(`${baseSelect} WHERE r.created_by = ? ORDER BY r.created_at DESC`),
    userId,
    userId,
  ).map(normaliseRequest);
}

export function listUpvotedRequests(userId: string): RequestSummary[] {
  return rows<RawRequest>(
    getDb().prepare(
      `${baseSelect} WHERE r.visibility = 'public' AND EXISTS (SELECT 1 FROM request_upvotes v WHERE v.request_id = r.id AND v.user_id = ?) ORDER BY r.created_at DESC`,
    ),
    userId,
    userId,
  ).map(normaliseRequest);
}

export function listNotifications(userId: string, limit = 20): NotificationRow[] {
  return rows<NotificationRow>(
    getDb().prepare(
      `SELECT id, title, body, href, read_at AS readAt, created_at AS createdAt, kind
         FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    ),
    userId,
    limit,
  );
}

export function unreadNotificationCount(userId: string): number {
  const found = row<{ n: number }>(
    getDb().prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL"),
    userId,
  );
  return Number(found?.n ?? 0);
}

export function similarRequests(request: RequestSummary, viewerId?: string | null, limit = 3) {
  return rows<RawRequest>(
    getDb().prepare(
      `${baseSelect}
        WHERE r.id != ? AND r.visibility = 'public'
          AND r.status IN (${OPEN_STATUSES.map(() => "?").join(",")})
          AND (r.category = ? OR r.level = ?)
        ORDER BY (r.category = ?) DESC, r.upvote_count DESC LIMIT ?`,
    ),
    viewerId ?? "",
    request.id,
    ...OPEN_STATUSES,
    request.category,
    request.level,
    request.category,
    limit,
  ).map(normaliseRequest);
}

export function searchEverything(q: string, viewerId?: string | null) {
  const term = q.trim();
  if (term.length < 2) return { lessons: [], requests: [] };
  return {
    lessons: listLessons({ q: term, limit: 4 }),
    requests: listOpenRequests({ q: term, viewerId, limit: 4 }),
  };
}

/* ------------------------------------------------------------------ */
/* Creator                                                             */
/* ------------------------------------------------------------------ */

export function adminQueue(): AdminQueueItem[] {
  const db = getDb();
  const result = rows<any>(
    db.prepare(`${baseSelect} ORDER BY
        CASE r.tier WHEN 'private' THEN 0 WHEN 'priority' THEN 1 ELSE 2 END,
        r.priority_flag DESC,
        r.upvote_count DESC,
        r.created_at ASC`),
    "",
  );

  return result.map((raw) => {
    const notes = row<{ n: number }>(
      db.prepare("SELECT COUNT(*) AS n FROM replies WHERE request_id = ? AND kind = 'internal'"),
      raw.id,
    );
    return {
      ...normaliseRequest(raw),
      ageDays: Math.max(0, Math.round((Date.now() - new Date(raw.createdAt).getTime()) / 864e5)),
      internalNoteCount: Number(notes?.n ?? 0),
    } as AdminQueueItem;
  });
}

export function listInternalNotes(requestId: string) {
  return rows<any>(
    getDb().prepare(
      `SELECT p.id, p.message, p.created_at AS createdAt, u.name AS authorName
         FROM replies p JOIN users u ON u.id = p.created_by
        WHERE p.request_id = ? AND p.kind = 'internal'
        ORDER BY p.created_at DESC`,
    ),
    requestId,
  );
}

export function adminStats() {
  const db = getDb();
  const one = (sql: string, ...params: any[]) => Number(row<{ n: number }>(db.prepare(sql), ...params)?.n ?? 0);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  return {
    inQueue: one(
      "SELECT COUNT(*) AS n FROM requests WHERE status IN ('submitted','under_review','planned','in_production','waitlisted')",
    ),
    needsDecision: one("SELECT COUNT(*) AS n FROM requests WHERE status IN ('submitted','under_review')"),
    waiting: one("SELECT COUNT(*) AS n FROM requests WHERE status = 'waitlisted'"),
    filming: one("SELECT COUNT(*) AS n FROM requests WHERE status = 'in_production'"),
    flagged: one("SELECT COUNT(*) AS n FROM requests WHERE moderation_flag = 1 AND status != 'declined'"),
    delivered: one("SELECT COUNT(*) AS n FROM requests WHERE status = 'fulfilled'"),
    deliveredThisWeek: one("SELECT COUNT(*) AS n FROM requests WHERE status = 'fulfilled' AND fulfilled_at > ?", weekAgo),
    privateOpen: one("SELECT COUNT(*) AS n FROM requests WHERE tier = 'private' AND status != 'fulfilled'"),
    newThisWeek: one("SELECT COUNT(*) AS n FROM requests WHERE created_at > ?", weekAgo),
    revenueKobo: Number(
      row<{ n: number }>(db.prepare("SELECT COALESCE(SUM(amount_kobo), 0) AS n FROM payments WHERE status = 'paid'"))?.n ?? 0,
    ),
    paidCount: one("SELECT COUNT(*) AS n FROM payments WHERE status = 'paid'"),
    bouncedEmails: one("SELECT COUNT(*) AS n FROM notification_logs WHERE status = 'bounced'"),
    openSupport: one("SELECT COUNT(*) AS n FROM support_messages WHERE status = 'open'"),
    capacity: Number(getSetting("weekly_capacity", "4")),
  };
}

export function listOutbox(limit = 40) {
  return rows<any>(
    getDb().prepare(
      `SELECT o.id, o.to_email AS toEmail, o.subject, o.body, o.html, o.status, o.created_at AS createdAt,
              r.slug, r.ref, l.status AS logStatus, l.attempts, l.last_error AS lastError
         FROM outbox o
         LEFT JOIN requests r ON r.id = o.request_id
         LEFT JOIN notification_logs l ON l.outbox_id = o.id
        ORDER BY o.created_at DESC LIMIT ?`,
    ),
    limit,
  );
}

export function getOutboxItem(id: string) {
  return row<any>(
    getDb().prepare(
      `SELECT o.id, o.to_email AS toEmail, o.subject, o.body, o.html, o.status, o.created_at AS createdAt,
              r.slug, r.ref, l.status AS logStatus, l.attempts, l.last_error AS lastError
         FROM outbox o
         LEFT JOIN requests r ON r.id = o.request_id
         LEFT JOIN notification_logs l ON l.outbox_id = o.id
        WHERE o.id = ?`,
    ),
    id,
  );
}

export function getFeedbackSummary() {
  const found = row<{ helpful: number; total: number }>(
    getDb().prepare("SELECT SUM(helpful) AS helpful, COUNT(*) AS total FROM feedback"),
  );
  return { helpful: Number(found?.helpful ?? 0), total: Number(found?.total ?? 0) };
}

export function listRecentFeedback(limit = 6) {
  return rows<any>(
    getDb().prepare(
      `SELECT f.helpful, f.comment, f.created_at AS createdAt, r.title, r.slug, u.name AS learner
         FROM feedback f JOIN requests r ON r.id = f.request_id JOIN users u ON u.id = f.user_id
        ORDER BY f.created_at DESC LIMIT ?`,
    ),
    limit,
  );
}

export function publicStats() {
  const db = getDb();
  const one = (sql: string) => Number(row<{ n: number }>(db.prepare(sql))?.n ?? 0);
  return {
    lessons: one("SELECT COUNT(*) AS n FROM requests WHERE status = 'fulfilled' AND visibility = 'public'"),
    open: one(
      "SELECT COUNT(*) AS n FROM requests WHERE status IN ('submitted','under_review','planned','in_production','waitlisted') AND visibility = 'public'",
    ),
    learners: one("SELECT COUNT(*) AS n FROM users WHERE role = 'learner'"),
    categories: one("SELECT COUNT(DISTINCT category) AS n FROM requests WHERE visibility = 'public'"),
  };
}

export function listRequestRefs() {
  return rows<{ slug: string; createdAt: string }>(
    getDb().prepare(
      "SELECT slug, COALESCE(fulfilled_at, created_at) AS createdAt FROM requests WHERE visibility = 'public' AND status = 'fulfilled'",
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Library reuse                                                       */
/* ------------------------------------------------------------------ */

export function searchLibrary(term: string, limit = 6) {
  const db = getDb();
  const where = ["r.status = 'fulfilled'", "p.kind = 'external'", "p.video_url IS NOT NULL"];
  const params: any[] = [];
  if (term.trim()) {
    where.push("(LOWER(p.video_title) LIKE ? OR LOWER(r.title) LIKE ? OR LOWER(r.category) LIKE ?)");
    const like = `%${term.trim().toLowerCase()}%`;
    params.push(like, like, like);
  }
  const result = rows<any>(
    db.prepare(`
      SELECT r.id AS requestId, r.slug, r.title, r.category, r.visibility,
             p.id AS replyId, p.video_url AS videoUrl, p.video_id AS videoId, p.video_title AS videoTitle,
             p.video_length AS videoLength, p.message,
             (SELECT COUNT(*) FROM replies x WHERE x.reused_from = p.id) AS reuseCount
        FROM replies p JOIN requests r ON r.id = p.request_id
       WHERE ${where.join(" AND ")}
       ORDER BY r.fulfilled_at DESC LIMIT ?`),
    ...params,
    limit,
  );
  return result.map((item) => ({ ...item, reuseCount: Number(item.reuseCount ?? 0) }));
}

export function libraryStats() {
  const db = getDb();
  const one = (sql: string) => Number(row<{ n: number }>(db.prepare(sql))?.n ?? 0);
  return {
    lessons: one("SELECT COUNT(*) AS n FROM requests WHERE status = 'fulfilled'"),
    reuses: one("SELECT COUNT(*) AS n FROM replies WHERE reused_from IS NOT NULL"),
    categories: one("SELECT COUNT(DISTINCT category) AS n FROM requests WHERE status = 'fulfilled'"),
    mostReused: row<{ title: string | null; n: number }>(
      db.prepare(
        `SELECT p.video_title AS title, COUNT(*) AS n FROM replies p WHERE p.reused_from IS NOT NULL GROUP BY p.reused_from ORDER BY n DESC LIMIT 1`,
      ),
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Payments & entitlements                                             */
/* ------------------------------------------------------------------ */

export function hasEntitlement(userId: string | null | undefined, requestId: string): boolean {
  if (!userId) return false;
  const found = row<{ ok: number }>(
    getDb().prepare(
      "SELECT 1 AS ok FROM entitlements WHERE user_id = ? AND request_id = ? AND revoked_at IS NULL",
    ),
    userId,
    requestId,
  );
  return Boolean(found);
}

export function listEntitlements(userId: string) {
  return rows<any>(
    getDb().prepare(
      `SELECT e.request_id AS requestId, e.access_type AS accessType, e.granted_at AS grantedAt,
              r.title, r.slug, r.status
         FROM entitlements e JOIN requests r ON r.id = e.request_id
        WHERE e.user_id = ? AND e.revoked_at IS NULL ORDER BY e.granted_at DESC`,
    ),
    userId,
  );
}

export function getPaymentForRequest(requestId: string) {
  return row<any>(
    getDb().prepare(
      "SELECT id, provider, reference, kind, amount_kobo AS amountKobo, tax_kobo AS taxKobo, currency, status, paid_at AS paidAt, refunded_at AS refundedAt FROM payments WHERE request_id = ? ORDER BY created_at DESC LIMIT 1",
    ),
    requestId,
  );
}

export function getPaymentByReference(reference: string) {
  return row<any>(
    getDb().prepare("SELECT * FROM payments WHERE reference = ?"),
    reference,
  );
}

export function listPayments(limit = 40) {
  return rows<any>(
    getDb().prepare(
      `SELECT p.id, p.reference, p.provider, p.kind, p.amount_kobo AS amountKobo, p.tax_kobo AS taxKobo,
              p.currency, p.status, p.paid_at AS paidAt, p.refunded_at AS refundedAt, p.created_at AS createdAt,
              r.title, r.slug, r.ref, u.name AS learner, u.email
         FROM payments p JOIN requests r ON r.id = p.request_id JOIN users u ON u.id = p.user_id
        ORDER BY p.created_at DESC LIMIT ?`,
    ),
    limit,
  );
}

export function paymentSummary() {
  const db = getDb();
  const found = row<{ paid: number; refunded: number; revenue: number; tax: number; count: number }>(
    db.prepare(
      `SELECT
         SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
         SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refunded,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_kobo ELSE 0 END), 0) AS revenue,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN tax_kobo ELSE 0 END), 0) AS tax,
         COUNT(*) AS count
       FROM payments`,
    ),
  );
  return {
    paid: Number(found?.paid ?? 0),
    refunded: Number(found?.refunded ?? 0),
    revenueKobo: Number(found?.revenue ?? 0),
    taxKobo: Number(found?.tax ?? 0),
    count: Number(found?.count ?? 0),
  };
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export function analyticsSnapshot() {
  const db = getDb();
  const count = (sql: string, ...params: any[]) =>
    Number(row<{ n: number }>(db.prepare(sql), ...params)?.n ?? 0);

  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const twoWeeksAgo = new Date(Date.now() - 14 * 864e5).toISOString();

  const funnel = {
    searches: count("SELECT COUNT(*) AS n FROM search_queries WHERE created_at > ?", weekAgo),
    zeroResultSearches: count("SELECT COUNT(*) AS n FROM search_queries WHERE results = 0 AND created_at > ?", weekAgo),
    requestsStarted: count("SELECT COUNT(*) AS n FROM analytics_events WHERE name = 'request_started' AND created_at > ?", weekAgo),
    requestsSubmitted: count("SELECT COUNT(*) AS n FROM requests WHERE created_at > ?", weekAgo),
    requestsPreviousWeek: count(
      "SELECT COUNT(*) AS n FROM requests WHERE created_at > ? AND created_at <= ?",
      twoWeeksAgo,
      weekAgo,
    ),
    lessonsWatched: count("SELECT COUNT(*) AS n FROM analytics_events WHERE name = 'lesson_played' AND created_at > ?", weekAgo),
    lessonsDelivered: count("SELECT COUNT(*) AS n FROM requests WHERE status = 'fulfilled' AND fulfilled_at > ?", weekAgo),
    votesCast: count("SELECT COUNT(*) AS n FROM request_upvotes WHERE created_at > ?", weekAgo),
    feedbackGiven: count("SELECT COUNT(*) AS n FROM feedback WHERE created_at > ?", weekAgo),
    signIns: count("SELECT COUNT(*) AS n FROM sessions WHERE created_at > ?", weekAgo),
  };

  const daily = rows<{ day: string; requests: number; lessons: number }>(
    db.prepare(`
      WITH RECURSIVE days(day) AS (
        SELECT date('now', '-13 days')
        UNION ALL
        SELECT date(day, '+1 day') FROM days WHERE day < date('now')
      )
      SELECT days.day AS day,
        (SELECT COUNT(*) FROM requests r WHERE date(r.created_at) = days.day) AS requests,
        (SELECT COUNT(*) FROM analytics_events e WHERE e.name = 'lesson_played' AND date(e.created_at) = days.day) AS lessons
      FROM days`),
  );

  const topSearches = rows<{ term: string; n: number; missed: number }>(
    db.prepare(
      `SELECT LOWER(term) AS term, COUNT(*) AS n, SUM(CASE WHEN results = 0 THEN 1 ELSE 0 END) AS missed
         FROM search_queries GROUP BY LOWER(term) ORDER BY n DESC LIMIT 6`,
    ),
  );

  const gaps = rows<{ term: string; n: number }>(
    db.prepare(
      `SELECT LOWER(term) AS term, COUNT(*) AS n FROM search_queries WHERE results = 0
        GROUP BY LOWER(term) ORDER BY n DESC LIMIT 6`,
    ),
  );

  const timings = rows<{ days: number }>(
    db.prepare(
      `SELECT julianday(fulfilled_at) - julianday(created_at) AS days
         FROM requests WHERE fulfilled_at IS NOT NULL`,
    ),
  );
  const sorted = timings.map((t) => Number(t.days)).sort((a, b) => a - b);
  const medianDays = sorted.length ? Number(sorted[Math.floor(sorted.length / 2)].toFixed(1)) : null;

  const returns = count(
    `SELECT COUNT(DISTINCT user_id) AS n FROM analytics_events
      WHERE name = 'session_started' AND created_at > ?
        AND user_id IN (SELECT user_id FROM analytics_events WHERE name = 'session_started' AND created_at <= ?)`,
    weekAgo,
    weekAgo,
  );
  const activeUsers = count(
    "SELECT COUNT(DISTINCT user_id) AS n FROM analytics_events WHERE name = 'session_started' AND created_at > ?",
    weekAgo,
  );

  const feedback = getFeedbackSummary();

  return {
    funnel,
    daily: daily.map((d) => ({ day: d.day, requests: Number(d.requests), lessons: Number(d.lessons) })),
    topSearches: topSearches.map((s) => ({ term: s.term, count: Number(s.n), missed: Number(s.missed) })),
    gaps: gaps.map((s) => ({ term: s.term, count: Number(s.n) })),
    medianDaysToDelivery: medianDays,
    returningUsers: returns,
    activeUsers,
    helpfulness: feedback.total ? Math.round((feedback.helpful / feedback.total) * 100) : null,
  };
}

export function creatorDigestData() {
  const db = getDb();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const one = (sql: string, ...params: any[]) => Number(row<{ n: number }>(db.prepare(sql), ...params)?.n ?? 0);

  const top = row<{ title: string; upvote_count: number }>(
    db.prepare(
      "SELECT title, upvote_count FROM requests WHERE visibility = 'public' AND status IN ('submitted','under_review','planned','in_production','waitlisted') ORDER BY upvote_count DESC LIMIT 1",
    ),
  );

  const timings = rows<{ days: number }>(
    db.prepare(
      "SELECT julianday(fulfilled_at) - julianday(created_at) AS days FROM requests WHERE fulfilled_at IS NOT NULL AND fulfilled_at > ?",
    ),
    weekAgo,
  );
  const sorted = timings.map((t) => Number(t.days)).sort((a, b) => a - b);

  return {
    newRequests: one("SELECT COUNT(*) AS n FROM requests WHERE created_at > ?", weekAgo),
    delivered: one("SELECT COUNT(*) AS n FROM requests WHERE fulfilled_at > ?", weekAgo),
    queue: one(
      "SELECT COUNT(*) AS n FROM requests WHERE status IN ('submitted','under_review','planned','in_production','waitlisted')",
    ),
    topVoted: top ? `${top.title} (${top.upvote_count})` : "—",
    medianDays: sorted.length ? sorted[Math.floor(sorted.length / 2)].toFixed(1) : "—",
  };
}

export function listSupportMessages(limit = 20) {
  return rows<any>(
    getDb().prepare(
      "SELECT id, email, subject, body, status, created_at AS createdAt FROM support_messages ORDER BY created_at DESC LIMIT ?",
    ),
    limit,
  );
}

function safeJson(value: unknown): { label: string; url: string }[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export { getSetting };
