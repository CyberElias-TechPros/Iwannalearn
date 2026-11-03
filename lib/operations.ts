import { getDb, row } from "./db";
import { requestSchema, replySchema, fieldErrors } from "./validation";
import { createRequest, getSetting, rateLimit, track, changeStatus, promoteFromWaitlist, publishLesson, type RequestInput } from "./service";
import { attachUploads } from "./uploads";
import { notifyUser, queueEmail } from "./notify";
import { parseYouTube } from "./parse";
import { validateStreamUrl } from "./media";
import { STATUS_META, type RequestStatus } from "./status";
import { refund } from "./payments";
import type { SessionUser } from "./types";

export type OperationError = { ok: false; error: string; fieldErrors?: Record<string, string>; status?: number };
const short = (text: string, max: number) => text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** The web wizard and Android use the same intake, upload ownership and rate limit.
 * A persisted client UUID makes a retry after a dropped connection non-duplicating. */
export function receiveRequest(user: SessionUser, source: FormData | Record<string, unknown>) {
  const get = (key: string) => source instanceof FormData ? source.get(key) : source[key];
  const limit = rateLimit(`submit:${user.id}`, 10, 60 * 60_000);
  if (!limit.allowed) return { ok: false as const, error: `Give it ${Math.ceil(limit.retryAfterSeconds / 60)} minutes before sending another request.`, status: 429 };
  const parsed = requestSchema.safeParse({
    title: get("title"), goal: get("goal"), tried: get("tried") || undefined,
    category: get("category"), level: get("level"), tier: get("tier") || "community",
    contextLink: get("contextLink") || undefined, deadline: get("deadline") || undefined,
  });
  if (!parsed.success) return { ok: false as const, error: "A couple of fields need a tweak.", fieldErrors: fieldErrors(parsed.error), status: 422 };
  const clientRequestId = typeof get("clientRequestId") === "string" ? String(get("clientRequestId")) : undefined;
  if (clientRequestId && !/^[a-fA-F0-9-]{36}$/.test(clientRequestId)) return { ok: false as const, error: "Invalid draft identifier.", status: 422 };
  const db = getDb();
  if (clientRequestId) {
    const existing = row<{ id: string; slug: string }>(db.prepare("SELECT id, slug FROM requests WHERE created_by = ? AND client_request_id = ?"), user.id, clientRequestId);
    if (existing) return { ok: true as const, created: existing };
  }
  const rawIds = get("uploadIds");
  const uploadIds = Array.isArray(rawIds) ? rawIds.map(String) : String(rawIds || "").split(",").map((id) => id.trim()).filter(Boolean);
  if (uploadIds.length > 5 || new Set(uploadIds).size !== uploadIds.length) return { ok: false as const, error: "Attach at most five different files.", status: 422 };
  for (const id of uploadIds) {
    const upload = row<{ id: string }>(db.prepare("SELECT id FROM uploads WHERE id = ? AND user_id = ? AND request_id IS NULL"), id, user.id);
    if (!upload) return { ok: false as const, error: "An attachment expired or is already attached. Please attach it again.", status: 422 };
  }
  let created: ReturnType<typeof createRequest>;
  let attached = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    created = createRequest(user, { ...parsed.data, clientRequestId } as RequestInput);
    attached = uploadIds.length ? attachUploads(created.id, user.id, uploadIds) : 0;
    if (attached !== uploadIds.length) throw new Error("An attachment is no longer available.");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  const path = `/requests/${created.slug}`;
  track("request_submitted", { userId: user.id, requestId: created.id, data: { tier: parsed.data.tier, client: clientRequestId ? "android" : "web" } });
  notifyUser({
    userId: user.id, requestId: created.id, kind: "request_received", title: "We've got your request ✅",
    body: created.waitlisted ? "It's on the waitlist — we're at this week's filming capacity. You'll hear when a slot opens."
      : `“${short(parsed.data.title, 70)}” is in the queue${attached ? ` with ${attached} file${attached === 1 ? "" : "s"}` : ""}. We'll notify you when there's news.`, href: path,
  });
  queueEmail({
    to: user.email, userId: user.id, requestId: created.id,
    template: created.waitlisted ? "waitlisted" : "request_received", idempotencyKey: `received:${created.id}`,
    data: { name: user.name ?? "there", title: parsed.data.title, path, capacity: Number(getSetting("weekly_capacity", "4")) },
  });
  return { ok: true as const, created };
}

/** Publication and its notification fan-out are shared, never duplicated per client. */
export function publishAndNotify(actorId: string, requestId: string, payload: {
  message: string; videoUrl?: string; streamUrl?: string; videoTitle: string; videoLength?: string;
  resources?: { label: string; url: string }[]; reusedFrom?: string | null;
}): { ok: true; message: string; slug: string } | OperationError {
  const parsed = replySchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Check the lesson details.", fieldErrors: fieldErrors(parsed.error), status: 422 };
  const target = row<{ visibility: string }>(getDb().prepare("SELECT visibility FROM requests WHERE id = ?"), requestId);
  if (!target) return { ok: false, error: "Request not found.", status: 404 };
  const video = payload.videoUrl ? parseYouTube(payload.videoUrl) : null;
  if (payload.videoUrl && !video) return { ok: false, error: "Use a youtube.com/watch?v=… or youtu.be/… link.", status: 422 };
  if (target.visibility === "private" && (!payload.streamUrl || payload.videoUrl)) return { ok: false, error: "Private delivery needs a protected direct video source, never a YouTube link.", status: 422 };
  if (payload.streamUrl) {
    const checked = validateStreamUrl(payload.streamUrl);
    if (!checked.ok) return { ok: false, error: checked.error, status: 422 };
    payload = { ...payload, streamUrl: checked.url };
  }
  const result = publishLesson(actorId, requestId, { ...payload, videoUrl: video?.canonical ?? "" });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not update the request.", status: 422 };
  const isPrivate = target.visibility === "private";
  for (const person of result.audience) {
    notifyUser({
      userId: person.id, requestId, kind: "lesson_ready",
      title: isPrivate ? (person.isOwner ? "Your private lesson is ready 🔒" : "A private lesson you helped request is ready 🔒")
        : (person.isOwner ? "Your lesson is ready 🎉" : "A lesson you backed is ready 🎉"),
      body: `${payload.videoTitle} — made in response to “${short(result.title, 60)}”.`,
      href: isPrivate ? `/requests/${result.slug}` : `/tutorials/${result.slug}`,
    });
    queueEmail({
      to: person.email, userId: person.id, requestId, template: "lesson_ready",
      idempotencyKey: `lesson:${requestId}:${person.id}:${result.deliveryId}`,
      data: { name: person.name ?? "there", title: result.title, videoTitle: payload.videoTitle, note: payload.message,
        path: isPrivate ? `/requests/${result.slug}` : `/tutorials/${result.slug}`, private: isPrivate ? "1" : "0" },
    });
  }
  if (result.promoted) {
    const promoted = row<{ id: string; slug: string; title: string; created_by: string; email: string; name: string | null }>(getDb().prepare(
      "SELECT r.id, r.slug, r.title, r.created_by, u.email, u.name FROM requests r JOIN users u ON u.id = r.created_by WHERE r.status = 'planned' ORDER BY r.updated_at DESC LIMIT 1",
    ));
    if (promoted) {
      notifyUser({ userId: promoted.created_by, requestId: promoted.id, kind: "promoted", title: "You're off the waitlist 🎬", body: `A slot opened — “${short(promoted.title, 60)}” is scheduled.`, href: `/requests/${promoted.slug}` });
      queueEmail({ to: promoted.email, userId: promoted.created_by, requestId: promoted.id, template: "promoted", idempotencyKey: `promoted:${promoted.id}`, data: { name: promoted.name ?? "there", title: promoted.title, path: `/requests/${promoted.slug}` } });
    }
  }
  track("lesson_published", { userId: actorId, requestId, data: { private: isPrivate, reused: Boolean(payload.reusedFrom) } });
  return { ok: true, slug: result.slug, message: `Published. ${result.audience.length} ${result.audience.length === 1 ? "person was" : "people were"} notified${result.promoted ? ", and a request left the waitlist" : ""}.` };
}

export function moveRequest(actorId: string, requestId: string, status: RequestStatus, reason?: string): { ok: true; message: string } | OperationError {
  const result = changeStatus(actorId, requestId, status, reason);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not update the request.", status: 422 };
  const meta = STATUS_META[status];
  const path = `/requests/${result.slug}`;
  notifyUser({ userId: result.ownerId!, requestId, kind: "status_change", title: `Update on your request: ${meta.learnerLabel}`, body: `${short(result.title!, 70)} — ${meta.blurb}`, href: path });
  const owner = row<{ email: string; name: string | null }>(getDb().prepare("SELECT email, name FROM users WHERE id = ?"), result.ownerId!);
  if (owner && (status === "declined" || status === "waitlisted")) {
    queueEmail({ to: owner.email, userId: result.ownerId!, requestId, template: status,
      idempotencyKey: `${status}:${requestId}:${Date.now()}`,
      data: { name: owner.name ?? "there", title: result.title!, path, reason: reason ?? "It's outside what we can teach well.", capacity: Number(getSetting("weekly_capacity", "4")) },
    });
  }
  if (status === "declined") {
    const paid = row<{ reference: string }>(getDb().prepare("SELECT reference FROM payments WHERE request_id = ? AND status = 'paid'"), requestId);
    if (paid) refund(paid.reference, reason || "Request declined; paid work refunded.");
  }
  if (status === "fulfilled") promoteFromWaitlist(1);
  return { ok: true, message: `Moved to “${meta.learnerLabel}”.` };
}
