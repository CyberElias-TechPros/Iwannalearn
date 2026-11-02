import { getDb, row, rows, randomUUID } from "./db";
import { STATUS_META, OPEN_STATUSES, type RequestStatus } from "./status";
import { slugify, parseYouTube } from "./parse";

/**
 * Service layer: every write that must be correct lives here, free of Next.js
 * request APIs, so it can be unit-tested directly (see tests/).
 * Server actions are thin wrappers: authenticate → call a service → revalidate.
 */

/* ------------------------------------------------------------------ */
/* Settings & small helpers                                            */
/* ------------------------------------------------------------------ */

export function getSetting(key: string, fallback: string): string {
  const found = row<{ value: string }>(getDb().prepare("SELECT value FROM settings WHERE key = ?"), key);
  return found?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export function uniqueSlug(base: string): string {
  const db = getDb();
  const root = base || `request-${Date.now()}`;
  let candidate = root;
  let n = 2;
  while (db.prepare("SELECT 1 FROM requests WHERE slug = ?").get(candidate)) {
    candidate = `${root}-${n++}`;
  }
  return candidate;
}

export function nextRef(): string {
  const { n } = getDb().prepare("SELECT COUNT(*) AS n FROM requests").get() as { n: number };
  return `REQ-${1001 + Number(n)}`;
}

/* ------------------------------------------------------------------ */
/* Intake                                                              */
/* ------------------------------------------------------------------ */

export type RequestInput = {
  title: string;
  goal: string;
  tried?: string;
  category: string;
  level: string;
  tier: "community" | "priority" | "private";
  contextLink?: string;
  deadline?: string;
};

export type IntakeDecision = {
  status: RequestStatus;
  reason: "normal" | "capacity" | "moderation";
  message?: string;
};

const MODERATION_TERMS = [
  "hack into",
  "crack",
  "keylogger",
  "steal",
  "medical advice",
  "diagnose",
  "prescription",
  "dosage",
  "legal advice",
  "sue",
  "invest in",
  "which stock",
  "crypto to buy",
  "essay for me",
  "write my thesis",
  "do my assignment",
  "onlyfans",
  "porn",
];

/** Screens a request before it reaches the filming queue. */
export function screenRequest(input: { title: string; goal: string }): { flagged: boolean; note?: string } {
  const haystack = `${input.title} ${input.goal}`.toLowerCase();
  const hit = MODERATION_TERMS.find((term) => haystack.includes(term));
  if (hit) {
    return {
      flagged: true,
      note: `Possible prohibited topic (“${hit}”). Review against the not-covered list before accepting.`,
    };
  }
  return { flagged: false };
}

/** Capacity-aware intake: paid tiers skip the waitlist, community requests queue honestly. */
export function intakeDecision(tier: RequestInput["tier"]): IntakeDecision {
  const capacity = Number(getSetting("weekly_capacity", "4"));
  const db = getDb();
  // Capacity measures work *committed to filming*, not the whole backlog:
  // submitted requests are still being checked, so they don't consume a slot.
  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM requests WHERE status IN ('planned','in_production')")
    .get() as { n: number };

  if (tier !== "community") return { status: "submitted", reason: "normal" };
  if (capacity > 0 && Number(n) >= capacity) {
    return {
      status: "waitlisted",
      reason: "capacity",
      message: "We're at this week's filming capacity. Your request keeps its place and moves up automatically.",
    };
  }
  return { status: "submitted", reason: "normal" };
}

export type CreatedRequest = {
  id: string;
  ref: string;
  slug: string;
  status: RequestStatus;
  waitlisted: boolean;
  moderationFlagged: boolean;
};

export function createRequest(
  user: { id: string; email: string; name: string | null },
  input: RequestInput,
  now = new Date().toISOString(),
): CreatedRequest {
  const db = getDb();
  const id = `req_${randomUUID().slice(0, 10)}`;
  const slug = uniqueSlug(slugify(input.title));
  const ref = nextRef();
  const visibility = input.tier === "private" ? "private" : "public";
  const decision = intakeDecision(input.tier);
  const screen = screenRequest(input);

  db.prepare(`
    INSERT INTO requests (
      id, ref, slug, title, goal, tried, context_link, category, level, visibility, tier,
      status, deadline, moderation_flag, moderation_note, upvote_count, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    id,
    ref,
    slug,
    input.title,
    input.goal,
    input.tried ?? null,
    input.contextLink ?? null,
    input.category,
    input.level,
    visibility,
    input.tier,
    decision.status,
    input.deadline ?? null,
    screen.flagged ? 1 : 0,
    screen.note ?? null,
    user.id,
    now,
    now,
  );

  db.prepare(
    "INSERT INTO request_events (id, request_id, kind, from_status, to_status, message, actor, created_at) VALUES (?, ?, 'created', NULL, ?, ?, ?, ?)",
  ).run(
    randomUUID(),
    id,
    decision.status,
    decision.reason === "capacity" ? "Over weekly capacity — waitlisted automatically." : "Request received.",
    user.id,
    now,
  );

  if (screen.flagged) {
    db.prepare(
      "INSERT INTO request_events (id, request_id, kind, message, actor, created_at) VALUES (?, ?, 'moderation', ?, ?, ?)",
    ).run(randomUUID(), id, screen.note ?? "Flagged for review.", "system", now);
  }

  // A private commission starts in review — it is scoped before it is filmed.
  if (input.tier === "private") {
    db.prepare("UPDATE requests SET status = 'under_review' WHERE id = ?").run(id);
  }

  return {
    id,
    ref,
    slug,
    status: input.tier === "private" ? "under_review" : decision.status,
    waitlisted: decision.status === "waitlisted",
    moderationFlagged: screen.flagged,
  };
}

/* ------------------------------------------------------------------ */
/* Votes                                                               */
/* ------------------------------------------------------------------ */

export function toggleUpvote(userId: string, requestId: string): { ok: boolean; upvoted?: boolean; count?: number; error?: string } {
  const db = getDb();
  const request = row<{ id: string; slug: string; visibility: string; status: string }>(
    db.prepare("SELECT id, slug, visibility, status FROM requests WHERE id = ?"),
    requestId,
  );
  if (!request) return { ok: false, error: "That request doesn't exist any more." };
  if (request.visibility !== "public") return { ok: false, error: "This request is private." };
  if (!OPEN_STATUSES.includes(request.status as RequestStatus)) {
    return { ok: false, error: "This request is already answered — no need to vote." };
  }

  const existing = db
    .prepare("SELECT 1 FROM request_upvotes WHERE request_id = ? AND user_id = ?")
    .get(requestId, userId);

  if (existing) {
    db.prepare("DELETE FROM request_upvotes WHERE request_id = ? AND user_id = ?").run(requestId, userId);
    db.prepare("UPDATE requests SET upvote_count = MAX(0, upvote_count - 1) WHERE id = ?").run(requestId);
  } else {
    db.prepare("INSERT INTO request_upvotes (request_id, user_id, created_at) VALUES (?, ?, ?)").run(
      requestId,
      userId,
      new Date().toISOString(),
    );
    db.prepare("UPDATE requests SET upvote_count = upvote_count + 1 WHERE id = ?").run(requestId);
  }

  const { count } = db.prepare("SELECT upvote_count AS count FROM requests WHERE id = ?").get(requestId) as {
    count: number;
  };

  return { ok: true, upvoted: !existing, count: Number(count) };
}

/* ------------------------------------------------------------------ */
/* Fulfilment                                                          */
/* ------------------------------------------------------------------ */

export type PublishPayload = {
  message: string;
  videoUrl: string;
  videoTitle: string;
  videoLength?: string;
  resources?: { label: string; url: string }[];
  reusedFrom?: string | null;
};

export type PublishResult =
  | {
      ok: true;
      slug: string;
      title: string;
      audience: { id: string; email: string; name: string | null; isOwner: boolean }[];
      promoted: number;
    }
  | { ok: false; error: string; field?: "videoUrl" };

export function publishLesson(creatorId: string, requestId: string, payload: PublishPayload, now = new Date().toISOString()): PublishResult {
  const db = getDb();
  const request = row<{ id: string; slug: string; title: string; created_by: string; status: string }>(
    db.prepare("SELECT id, slug, title, created_by, status FROM requests WHERE id = ?"),
    requestId,
  );
  if (!request) return { ok: false, error: "That request no longer exists." };

  const video = parseYouTube(payload.videoUrl);
  if (!video) {
    return {
      ok: false,
      error: "That doesn't look like a YouTube link.",
      field: "videoUrl",
    };
  }

  db.prepare(`
    INSERT INTO replies (id, request_id, kind, message, video_url, video_id, video_title, video_provider,
                         video_length, resources, reused_from, created_by, created_at)
    VALUES (?, ?, 'external', ?, ?, ?, ?, 'youtube', ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    requestId,
    payload.message,
    video.canonical,
    video.id,
    payload.videoTitle,
    payload.videoLength ?? null,
    JSON.stringify(payload.resources ?? []),
    payload.reusedFrom ?? null,
    creatorId,
    now,
  );

  db.prepare(
    "UPDATE requests SET status = 'fulfilled', fulfilled_at = COALESCE(fulfilled_at, ?), updated_at = ? WHERE id = ?",
  ).run(now, now, requestId);

  db.prepare(
    "INSERT INTO request_events (id, request_id, kind, from_status, to_status, message, actor, created_at) VALUES (?, ?, 'fulfilled', ?, 'fulfilled', ?, ?, ?)",
  ).run(randomUUID(), requestId, request.status, payload.videoTitle, creatorId, now);

  const audience = rows<{ id: string; email: string; name: string | null; isOwner: number }>(
    db.prepare(
      `SELECT DISTINCT u.id, u.email, u.name, (u.id = ?) AS isOwner FROM users u
        WHERE u.id = ?
           OR u.id IN (SELECT user_id FROM request_upvotes WHERE request_id = ?)
        ORDER BY isOwner DESC`,
    ),
    request.created_by,
    request.created_by,
    requestId,
  ).map((person) => ({ ...person, isOwner: Boolean(person.isOwner) }));

  const promoted = promoteFromWaitlist(1);

  return { ok: true, slug: request.slug, title: request.title, audience, promoted };
}

/** When capacity frees up, the oldest waitlisted request takes the slot. */
export function promoteFromWaitlist(limit = 1): number {
  const db = getDb();
  const candidates = rows<{ id: string; slug: string; title: string; created_by: string }>(
    db.prepare(
      "SELECT id, slug, title, created_by FROM requests WHERE status = 'waitlisted' ORDER BY upvote_count DESC, created_at ASC LIMIT ?",
    ),
    limit,
  );

  for (const candidate of candidates) {
    db.prepare("UPDATE requests SET status = 'planned', updated_at = ? WHERE id = ?").run(new Date().toISOString(), candidate.id);
    db.prepare(
      "INSERT INTO request_events (id, request_id, kind, from_status, to_status, message, actor, created_at) VALUES (?, ?, 'status', 'waitlisted', 'planned', ?, 'system', ?)",
    ).run(randomUUID(), candidate.id, "Promoted from the waitlist when a slot opened.", new Date().toISOString());
  }

  return candidates.length;
}

/* ------------------------------------------------------------------ */
/* Status, notes, feedback                                             */
/* ------------------------------------------------------------------ */

export function changeStatus(
  actorId: string,
  requestId: string,
  status: RequestStatus,
  reason?: string,
): { ok: boolean; error?: string; slug?: string; title?: string; ownerId?: string; label?: string } {
  const db = getDb();
  const request = row<{ id: string; slug: string; title: string; created_by: string; status: string }>(
    db.prepare("SELECT id, slug, title, created_by, status FROM requests WHERE id = ?"),
    requestId,
  );
  if (!request) return { ok: false, error: "Request not found." };
  if (status === "declined" && !reason?.trim()) {
    return { ok: false, error: "A decline needs a reason — the learner sees it." };
  }

  const now = new Date().toISOString();
  db.prepare(
    "UPDATE requests SET status = ?, decline_reason = COALESCE(?, decline_reason), updated_at = ? WHERE id = ?",
  ).run(status, status === "declined" ? (reason ?? null) : null, now, request.id);

  db.prepare(
    "INSERT INTO request_events (id, request_id, kind, from_status, to_status, message, actor, created_at) VALUES (?, ?, 'status', ?, ?, ?, ?, ?)",
  ).run(randomUUID(), request.id, request.status, status, reason ?? null, actorId, now);

  return {
    ok: true,
    slug: request.slug,
    title: request.title,
    ownerId: request.created_by,
    label: STATUS_META[status].learnerLabel,
  };
}

export function addInternalNote(actorId: string, requestId: string, message: string) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO replies (id, request_id, kind, message, created_by, created_at) VALUES (?, ?, 'internal', ?, ?, ?)",
  ).run(randomUUID(), requestId, message, actorId, now);
  db.prepare(
    "INSERT INTO request_events (id, request_id, kind, message, actor, created_at) VALUES (?, ?, 'note', ?, ?, ?)",
  ).run(randomUUID(), requestId, message, actorId, now);
}

export function recordFeedback(userId: string, requestId: string, helpful: boolean, comment?: string) {
  getDb()
    .prepare(`
      INSERT INTO feedback (id, request_id, user_id, helpful, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(request_id, user_id) DO UPDATE SET helpful = excluded.helpful, comment = excluded.comment, created_at = excluded.created_at
    `)
    .run(randomUUID(), requestId, userId, helpful ? 1 : 0, comment?.slice(0, 600) || null, new Date().toISOString());
}

export function confirmDelivery(userId: string, requestId: string): { ok: boolean; error?: string } {
  const db = getDb();
  const request = row<{ id: string; created_by: string; fulfilled_at: string | null; revision_state: string }>(
    db.prepare("SELECT id, created_by, fulfilled_at, revision_state FROM requests WHERE id = ?"),
    requestId,
  );
  if (!request) return { ok: false, error: "Request not found." };
  if (request.created_by !== userId) return { ok: false, error: "Only the person who commissioned this can confirm delivery." };
  if (!request.fulfilled_at) return { ok: false, error: "There's nothing to confirm yet — the lesson isn't published." };

  const now = new Date().toISOString();
  db.prepare("UPDATE requests SET delivery_confirmed_at = ?, revision_state = 'closed', updated_at = ? WHERE id = ?").run(
    now,
    now,
    requestId,
  );
  db.prepare(
    "INSERT INTO request_events (id, request_id, kind, message, actor, created_at) VALUES (?, ?, 'delivery', ?, ?, ?)",
  ).run(randomUUID(), requestId, "Delivery confirmed by the learner.", userId, now);
  return { ok: true };
}

export function requestRevision(userId: string, requestId: string, note: string): { ok: boolean; error?: string } {
  const db = getDb();
  const request = row<{ id: string; created_by: string; fulfilled_at: string | null; revision_state: string }>(
    db.prepare("SELECT id, created_by, fulfilled_at, revision_state FROM requests WHERE id = ?"),
    requestId,
  );
  if (!request) return { ok: false, error: "Request not found." };
  if (request.created_by !== userId) return { ok: false, error: "Not your request." };
  if (!request.fulfilled_at) return { ok: false, error: "The lesson isn't published yet." };
  if (request.revision_state === "requested") return { ok: false, error: "You've already asked for one revision on this lesson." };

  const windowDays = Number(getSetting("refund_window_days", "7"));
  const fulfilled = new Date(request.fulfilled_at).getTime();
  const withinWindow = Date.now() - fulfilled <= windowDays * 864e5;

  const now = new Date().toISOString();
  db.prepare("UPDATE requests SET revision_state = 'requested', updated_at = ? WHERE id = ?").run(now, requestId);
  db.prepare(
    "INSERT INTO request_events (id, request_id, kind, message, actor, created_at) VALUES (?, ?, 'revision', ?, ?, ?)",
  ).run(randomUUID(), requestId, withinWindow ? note : `${note} (requested outside the ${windowDays}-day window)`, userId, now);

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Analytics & abuse                                                   */
/* ------------------------------------------------------------------ */

export function track(name: string, props: { userId?: string | null; requestId?: string | null; data?: Record<string, unknown> } = {}) {
  try {
    getDb()
      .prepare("INSERT INTO analytics_events (id, name, user_id, request_id, props, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(
        randomUUID(),
        name,
        props.userId ?? null,
        props.requestId ?? null,
        props.data ? JSON.stringify(props.data) : null,
        new Date().toISOString(),
      );
  } catch {
    /* analytics must never break a request */
  }
}

export function logSearch(term: string, results: number, userId?: string | null) {
  if (term.trim().length < 2) return;
  try {
    getDb()
      .prepare("INSERT INTO search_queries (id, term, results, user_id, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(randomUUID(), term.trim().slice(0, 120), results, userId ?? null, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

/** Drops limiter rows whose window closed, so the table can't grow forever. */
export function purgeExpiredRateLimits(maxAgeMs = 24 * 60 * 60 * 1000): number {
  const result = getDb()
    .prepare("DELETE FROM rate_limits WHERE window_start < ?")
    .run(Date.now() - maxAgeMs);
  return Number(result.changes);
}

/** Fixed-window limiter. Good enough for one creator and a few hundred learners. */
export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const db = getDb();
  const now = Date.now();
  const existing = row<{ window_start: number; count: number }>(
    db.prepare("SELECT window_start, count FROM rate_limits WHERE key = ?"),
    key,
  );

  if (!existing || now - Number(existing.window_start) > windowMs) {
    db.prepare(
      "INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1",
    ).run(key, now);
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  const count = Number(existing.count) + 1;
  db.prepare("UPDATE rate_limits SET count = ? WHERE key = ?").run(count, key);

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.ceil((Number(existing.window_start) + windowMs - now) / 1000),
  };
}

/* ------------------------------------------------------------------ */
/* Support                                                             */
/* ------------------------------------------------------------------ */

export function createSupportMessage(input: { userId?: string | null; email: string; subject: string; body: string }) {
  getDb()
    .prepare("INSERT INTO support_messages (id, user_id, email, subject, body, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), input.userId ?? null, input.email, input.subject, input.body, new Date().toISOString());
}

/* ------------------------------------------------------------------ */
/* Account lifecycle                                                   */
/* ------------------------------------------------------------------ */

/**
 * Deletes what must be deleted and anonymises what must stay.
 * Public lessons other people rely on survive; the identity behind them does not.
 */
export function anonymizeUser(userId: string) {
  const db = getDb();
  const now = new Date().toISOString();

  const privateRequests = rows<{ id: string }>(
    db.prepare("SELECT id FROM requests WHERE created_by = ? AND visibility = 'private'"),
    userId,
  );
  for (const request of privateRequests) {
    db.prepare("DELETE FROM replies WHERE request_id = ?").run(request.id);
    db.prepare("DELETE FROM requests WHERE id = ?").run(request.id);
  }

  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM notifications WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM request_upvotes WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM feedback WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM entitlements WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM login_tokens WHERE email = (SELECT email FROM users WHERE id = ?)").run(userId);
  db.prepare(
    "UPDATE users SET email = ?, name = 'Deleted learner', phone = NULL, notify_email = 0, notify_via_sms = 0 WHERE id = ?",
  ).run(`deleted+${userId}@iwannalearn.invalid`, userId);

  db.prepare(
    "INSERT INTO request_events (id, request_id, kind, message, actor, created_at) SELECT ?, id, 'note', 'Requester deleted their account and personal data.', 'system', ? FROM requests WHERE created_by = ?",
  ).run(randomUUID(), now, userId);
}

export function exportUserData(userId: string) {
  const db = getDb();
  const user = row<any>(db.prepare("SELECT id, email, name, role, phone, created_at FROM users WHERE id = ?"), userId);
  const requests = rows<any>(
    db.prepare("SELECT ref, slug, title, goal, tried, category, level, status, tier, visibility, created_at FROM requests WHERE created_by = ?"),
    userId,
  );
  const notifications = rows<any>(
    db.prepare("SELECT title, body, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC"),
    userId,
  );
  const payments = rows<any>(
    db.prepare("SELECT reference, amount_kobo, currency, status, created_at FROM payments WHERE user_id = ?"),
    userId,
  );
  return { exportedAt: new Date().toISOString(), user, requests, notifications, payments };
}
