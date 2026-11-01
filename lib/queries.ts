import { getDb, row, rows } from "./db";
import { OPEN_STATUSES } from "./status";
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
         r.visibility, r.upvote_count AS upvoteCount, r.created_at AS createdAt,
         r.fulfilled_at AS fulfilledAt, r.created_by AS ownerId, u.name AS ownerName,
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

function normaliseRequest(r: RawRequest): RequestSummary {
  return {
    ...r,
    hasLesson: Boolean(r.hasLesson),
    viewerUpvoted: Boolean(r.viewerUpvoted),
    replyCount: Number(r.replyCount ?? 0),
    upvoteCount: Number(r.upvoteCount ?? 0),
  };
}

export type ListOptions = {
  viewerId?: string | null;
  q?: string;
  category?: string;
  level?: string;
  sort?: "popular" | "newest" | "oldest";
  limit?: number;
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

  const sql = `${baseSelect} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ?`;
  params.push(opts.limit ?? 60);
  return rows<RawRequest>(db.prepare(sql), ...params).map(normaliseRequest);
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
    where.push("(LOWER(r.title) LIKE ? OR LOWER(r.goal) LIKE ? OR LOWER(p.video_title) LIKE ? OR LOWER(r.category) LIKE ?)");
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

  const sql = `
    SELECT r.id AS requestId, r.slug, r.title, r.goal, r.category, r.level,
           p.video_id AS videoId, p.video_url AS videoUrl, p.video_title AS videoTitle,
           p.video_length AS videoLength, p.message AS cameraMessage, p.resources,
           r.fulfilled_at AS fulfilledAt, r.upvote_count AS upvoteCount, u.name AS ownerName
      FROM replies p
      JOIN requests r ON r.id = p.request_id
      JOIN users u ON u.id = r.created_by
     WHERE ${where.join(" AND ")}
     ORDER BY ${opts.sort === "popular" ? "r.upvote_count DESC" : "r.fulfilled_at DESC"}
     LIMIT ?`;
  params.push(opts.limit ?? 40);

  return rows<any>(db.prepare(sql), ...params).map((r) => ({
    ...r,
    upvoteCount: Number(r.upvoteCount ?? 0),
    resources: safeJson(r.resources),
  }));
}

export function getLessonBySlug(slug: string): LessonSummary | null {
  const db = getDb();
  const r = row<any>(
    db.prepare(`
      SELECT r.id AS requestId, r.slug, r.title, r.goal, r.category, r.level,
             p.video_id AS videoId, p.video_url AS videoUrl, p.video_title AS videoTitle,
             p.video_length AS videoLength, p.message AS cameraMessage, p.resources,
             r.fulfilled_at AS fulfilledAt, r.upvote_count AS upvoteCount, u.name AS ownerName
        FROM replies p
        JOIN requests r ON r.id = p.request_id
        JOIN users u ON u.id = r.created_by
       WHERE r.slug = ? AND r.visibility = 'public' AND r.status = 'fulfilled'
         AND p.kind = 'external' AND p.video_url IS NOT NULL
       ORDER BY p.created_at DESC LIMIT 1`),
    slug,
  );
  if (!r) return null;
  return { ...r, upvoteCount: Number(r.upvoteCount ?? 0), resources: safeJson(r.resources) };
}

export function getRequestBySlug(slug: string, viewerId?: string | null) {
  const db = getDb();
  const raw = row<RawRequest>(
    db.prepare(`${baseSelect} WHERE r.slug = ?`),
    viewerId ?? "",
    slug,
  );
  if (!raw) return null;
  return normaliseRequest(raw);
}

export function getRequestExtras(requestId: string) {
  const db = getDb();
  const replies = rows<any>(
    db.prepare(`
      SELECT p.id, p.kind, p.message, p.video_url AS videoUrl, p.video_id AS videoId,
             p.video_title AS videoTitle, p.video_length AS videoLength, p.resources,
             p.created_at AS createdAt, u.name AS authorName
        FROM replies p JOIN users u ON u.id = p.created_by
       WHERE p.request_id = ? AND p.kind = 'external'
       ORDER BY p.created_at ASC`),
    requestId,
  ).map<ReplyRow>((r) => ({ ...r, resources: null }));

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
  return rows<any>(
    getDb().prepare(
      `SELECT id, title, body, href, read_at AS readAt, created_at AS createdAt, kind
         FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    ),
    userId,
    limit,
  );
}

export function unreadNotificationCount(userId: string): number {
  const r = row<{ n: number }>(
    getDb().prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL"),
    userId,
  );
  return Number(r?.n ?? 0);
}

export function similarRequests(request: RequestSummary, viewerId?: string | null, limit = 3) {
  const db = getDb();
  return rows<RawRequest>(
    db.prepare(
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

export function adminQueue(): AdminQueueItem[] {
  const db = getDb();
  const result = rows<any>(
    db.prepare(`
      ${baseSelect.replace("r.created_by AS ownerId", "r.created_by AS ownerId, r.priority_flag AS priorityFlag, u.email AS ownerEmail")}
      ORDER BY
        CASE r.tier WHEN 'private' THEN 0 WHEN 'priority' THEN 1 ELSE 2 END,
        r.priority_flag DESC,
        r.upvote_count DESC,
        r.created_at ASC
    `),
    "",
  );

  return result.map((r) => {
    const count = row<{ n: number }>(
      db.prepare("SELECT COUNT(*) AS n FROM replies WHERE request_id = ? AND kind = 'internal'"),
      r.id,
    );
    return {
      ...normaliseRequest(r),
      tried: r.tried,
      contextLink: r.contextLink,
      declineReason: r.declineReason,
      priorityFlag: Number(r.priorityFlag ?? 0),
      ownerEmail: r.ownerEmail,
      ageDays: Math.max(0, Math.round((Date.now() - new Date(r.createdAt).getTime()) / 864e5)),
      replyCount: Number(r.replyCount ?? 0),
      internalNoteCount: Number(count?.n ?? 0),
      paymentStatus: r.tier === "community" ? "none" : "not_charged",
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
  return {
    inQueue: one("SELECT COUNT(*) AS n FROM requests WHERE status IN ('submitted','under_review','planned','in_production','waitlisted')"),
    waiting: one("SELECT COUNT(*) AS n FROM requests WHERE status = 'waitlisted'"),
    filming: one("SELECT COUNT(*) AS n FROM requests WHERE status = 'in_production'"),
    delivered: one("SELECT COUNT(*) AS n FROM requests WHERE status = 'fulfilled'"),
    deliveredThisWeek: one("SELECT COUNT(*) AS n FROM requests WHERE status = 'fulfilled' AND fulfilled_at > ?", new Date(Date.now() - 7 * 864e5).toISOString()),
    privateOpen: one("SELECT COUNT(*) AS n FROM requests WHERE tier = 'private' AND status != 'fulfilled'"),
    newThisWeek: one("SELECT COUNT(*) AS n FROM requests WHERE created_at > ?", new Date(Date.now() - 7 * 864e5).toISOString()),
    capacity: getSetting("weekly_capacity", "4"),
  };
}

export function getSetting(key: string, fallback: string): string {
  const r = row<{ value: string }>(getDb().prepare("SELECT value FROM settings WHERE key = ?"), key);
  return r?.value ?? fallback;
}

export function listOutbox(limit = 30) {
  return rows<any>(
    getDb().prepare(
      `SELECT o.id, o.to_email AS toEmail, o.subject, o.body, o.status, o.created_at AS createdAt, r.slug, r.ref
         FROM outbox o LEFT JOIN requests r ON r.id = o.request_id
        ORDER BY o.created_at DESC LIMIT ?`,
    ),
    limit,
  );
}

export function getFeedbackSummary() {
  const db = getDb();
  const r = row<{ helpful: number; total: number }>(
    db.prepare("SELECT SUM(helpful) AS helpful, COUNT(*) AS total FROM feedback"),
  );
  return { helpful: Number(r?.helpful ?? 0), total: Number(r?.total ?? 0) };
}

export function publicStats() {
  const db = getDb();
  const one = (sql: string) => Number(row<{ n: number }>(db.prepare(sql))?.n ?? 0);
  return {
    lessons: one("SELECT COUNT(*) AS n FROM requests WHERE status = 'fulfilled'"),
    open: one("SELECT COUNT(*) AS n FROM requests WHERE status IN ('submitted','under_review','planned','in_production','waitlisted') AND visibility = 'public'"),
    learners: one("SELECT COUNT(*) AS n FROM users"),
  };
}

export function listRequestRefs() {
  return rows<{ slug: string; createdAt: string }>(
    getDb().prepare("SELECT slug, COALESCE(fulfilled_at, created_at) AS createdAt FROM requests WHERE visibility = 'public' AND status = 'fulfilled'"),
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
