import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, row, rows } from "./db";
import { createLoginToken, createSession, consumeLoginToken, findOrCreateUser, markVerified, userForSessionToken, revokeSessionToken, isDemoMode } from "./auth";
import { CATEGORIES, LEVELS, TIERS, STATUS_ORDER, OPEN_STATUSES, type RequestStatus } from "./status";
import { listTopics, topicCounts } from "./topics";
import { LEGAL_DOCS } from "./legal";
import { PRICING, paymentsMode, taxPortion } from "./pricing";
import { activeProvider } from "./providers";
import { requestSchema, profileSchema, supportSchema, fieldErrors } from "./validation";
import { receiveRequest, publishAndNotify, moveRequest } from "./operations";
import { addInternalNote, anonymizeUser, changeStatus, confirmDelivery, createSupportMessage, exportUserData, getSetting, logSearch, rateLimit, recordFeedback, requestRevision, setSetting, toggleUpvote, track } from "./service";
import { adminQueue, adminStats, analyticsSnapshot, countLessons, countOpenRequests, getLessonBySlug, getPaymentForRequest, getRequestById, getRequestBySlug, getRequestExtras, getViewerFeedback, hasEntitlement, searchLibrary, listEntitlements, listInternalNotes, listLessons, listMyRequests, listNotifications, listOpenRequests, listOutbox, listPayments, listRecentFeedback, listSupportMessages, listUpvotedRequests, paymentSummary, searchEverything, similarRequests, unreadNotificationCount } from "./queries";
import { listUploads, MAX_UPLOAD_BYTES, MAX_UPLOADS_PER_REQUEST, ACCEPT_ATTRIBUTE } from "./uploads";
import { acceptQuote, declineQuote, getQuote, proposeQuote, listQuotes } from "./quotes";
import { createCheckout, getPayment, prepareCheckout, refund, requestRefund, settle, refundRequestFor } from "./payments";
import { resolveRefundRequest, listRefundRequests } from "./payments";
import { signAccess, verifyAccess } from "./signed-url";
import { safeExternalUrl, validateStreamUrl } from "./media";
import { queueEmail, deliver, markBounced } from "./notify";
import type { SessionUser, RequestSummary, LessonSummary } from "./types";

export const MOBILE_API_VERSION = 1;
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", "X-API-Version": "1" } });
const error = (message: string, status = 400, fields?: Record<string, string>) => json({ ok: false, error: message, fieldErrors: fields }, status);
const siteUrl = () => (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const requestIdSchema = z.string().min(1).max(100);

function tokenFrom(request: Request) {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : "";
}
function viewer(request: Request) { return userForSessionToken(tokenFrom(request)); }
function requireUser(request: Request): SessionUser {
  const user = viewer(request);
  if (!user) throw new ApiError(401, "Your session expired. Please sign in again.");
  return user;
}
function requireCreator(request: Request): SessionUser {
  const user = requireUser(request);
  if (user.role !== "creator") throw new ApiError(403, "This screen is only for the creator.");
  return user;
}
class ApiError extends Error { constructor(public status: number, message: string, public fields?: Record<string, string>) { super(message); } }
async function body(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") ?? 0) > 32_768) throw new ApiError(413, "That message is too large.");
  try {
    const text = await request.text();
    if (text.length > 32_768) throw new ApiError(413, "That message is too large.");
    const value = JSON.parse(text || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch (e) { if (e instanceof ApiError) throw e; throw new ApiError(400, "Send a valid JSON object."); }
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(422, "Check the highlighted details.", fieldErrors(result.error));
  return result.data;
}
function visibleRequest(slug: string, user: SessionUser | null) {
  const item = getRequestBySlug(slug, user?.id);
  if (!item || (item.visibility !== "public" && item.ownerId !== user?.id && user?.role !== "creator")) throw new ApiError(404, "That request isn't available.");
  return item;
}
function ownedRequest(id: string, user: SessionUser) {
  const item = getRequestById(id, user.id);
  if (!item || (item.ownerId !== user.id && user.role !== "creator")) throw new ApiError(404, "Request not found.");
  return item;
}

/** Explicit allow-list DTOs: never spread a database row into a native response.
 * In particular, stream sources, storage keys, emails and internal notes stay private. */
function requestDto(r: RequestSummary, user: SessionUser | null) {
  return {
    id: r.id, ref: r.ref, slug: r.slug, title: r.title, goal: r.goal, tried: r.tried,
    contextLink: safeExternalUrl(r.contextLink), deadline: r.deadline, declineReason: r.declineReason,
    category: r.category, level: r.level, status: r.status, tier: r.tier, visibility: r.visibility,
    paymentStatus: r.paymentStatus, revisionState: r.revisionState, priceKobo: r.priceKobo,
    upvoteCount: r.upvoteCount, createdAt: r.createdAt, fulfilledAt: r.fulfilledAt,
    deliveryConfirmedAt: r.deliveryConfirmedAt, ownerName: r.ownerName,
    hasLesson: r.hasLesson, lessonTitle: r.lessonTitle, videoId: r.visibility === "public" ? r.videoId : null,
    videoLength: r.videoLength, viewerUpvoted: r.viewerUpvoted, replyCount: r.replyCount,
    isOwner: r.ownerId === user?.id,
    ...(user?.role === "creator" ? { ownerEmail: r.ownerEmail, moderationFlag: r.moderationFlag, moderationNote: r.moderationNote, priorityFlag: r.priorityFlag } : {}),
  };
}
function lessonDto(l: LessonSummary) {
  return { requestId: l.requestId, slug: l.slug, title: l.videoTitle ?? l.title, goal: l.goal,
    category: l.category, level: l.level, videoId: l.videoId, videoProvider: l.videoProvider,
    videoTitle: l.videoTitle, videoLength: l.videoLength, cameraMessage: l.cameraMessage,
    resources: l.resources.map((r) => ({ label: r.label, url: safeExternalUrl(r.url) })).filter((r) => r.url),
    fulfilledAt: l.fulfilledAt, upvoteCount: l.upvoteCount, ownerName: l.ownerName };
}
function profileDto(user: SessionUser) {
  const p = row<{ phone: string | null; notify_email: number; notify_via_sms: number; digest_opt_in: number; email_bounced_at: string | null }>(
    getDb().prepare("SELECT phone, notify_email, notify_via_sms, digest_opt_in, email_bounced_at FROM users WHERE id = ?"), user.id,
  )!;
  return { ...user, phone: p.phone, notifyEmail: Boolean(p.notify_email), notifySms: Boolean(p.notify_via_sms), digest: Boolean(p.digest_opt_in), emailBounced: Boolean(p.email_bounced_at) };
}
function requestDetail(item: RequestSummary, user: SessionUser | null) {
  const privileged = item.ownerId === user?.id || user?.role === "creator";
  const extras = getRequestExtras(item.id);
  const quote = privileged ? getQuote(item.id) : null;
  const payment = privileged ? getPaymentForRequest(item.id) : null;
  const canPlay = item.hasLesson && (item.visibility === "public" || (user && (user.role === "creator" || hasEntitlement(user.id, item.id))));
  return {
    request: requestDto(item, user), canPlay: Boolean(canPlay),
    replies: extras.replies.map((r) => ({ id: r.id, message: r.message, videoTitle: r.videoTitle, videoLength: r.videoLength,
      videoProvider: r.videoProvider, videoUrl: item.visibility === "public" ? safeExternalUrl(r.videoUrl) : null,
      authorName: r.authorName, createdAt: r.createdAt,
      resources: (() => { try { const a = JSON.parse(r.resources ?? "[]"); return Array.isArray(a) ? a.map((v) => ({ label: String(v.label ?? "Resource"), url: safeExternalUrl(v.url) })).filter((v) => v.url) : []; } catch { return []; } })(),
    })),
    // Internal notes and moderation messages are not a public timeline.
    events: extras.events.filter((e) => ["created", "status", "fulfilled", "delivery", "payment"].includes(e.kind)).map((e) => ({ id: e.id, kind: e.kind, toStatus: e.toStatus, createdAt: e.createdAt })),
    feedback: privileged ? getViewerFeedback(item.id, user?.id) : null,
    quote: quote ? { ...quote, taxKobo: taxPortion(quote.amount_kobo) } : null,
    payment, refund: privileged ? refundRequestFor(item.id) : null,
    attachments: privileged ? listUploads(item.id).map((u) => ({ id: u.id, filename: u.filename, mime: u.mime, size: u.size, kind: u.kind, note: u.note, createdAt: u.created_at })) : [],
    internalNotes: user?.role === "creator" ? listInternalNotes(item.id) : [],
    related: similarRequests(item, user?.id).map((r) => requestDto(r, user)),
  };
}
function pricingDto() {
  return { mode: paymentsMode(), enabled: paymentsMode() !== "off", refundWindowDays: Number(getSetting("refund_window_days", "7")),
    tiers: Object.entries(PRICING).map(([key, value]) => ({ key, amountKobo: value.amountKobo, label: value.label, blurb: value.blurb })) };
}
function adminSnapshot() {
  const user = row<{ email: string }>(getDb().prepare("SELECT email FROM users WHERE role = 'creator' LIMIT 1"));
  return {
    stats: adminStats(), queue: adminQueue().map((r) => ({ ...requestDto(r, { id: "", role: "creator", name: null, email: "" }), ageDays: r.ageDays, internalNoteCount: r.internalNoteCount })),
    payments: listPayments(100), paymentSummary: paymentSummary(), refunds: listRefundRequests(),
    quotes: listQuotes().map((q) => ({ ...q, title: getRequestById(q.request_id)?.title ?? "Request" })),
    library: searchLibrary("", 100).filter((l) => l.visibility === "public").map((l) => ({ ...l, videoUrl: safeExternalUrl(l.videoUrl) })),
    outbox: listOutbox(60).map(({ html: _html, ...rest }) => rest), support: listSupportMessages(60),
    analytics: analyticsSnapshot(), feedback: listRecentFeedback(),
    settings: { capacity: Number(getSetting("weekly_capacity", "4")), vatRate: Number(getSetting("vat_rate", "7.5")), refundWindow: Number(getSetting("refund_window_days", "7")), supportEmail: getSetting("support_email", user?.email ?? ""), digestDay: getSetting("digest_day", "monday"), paymentsMode: paymentsMode() },
  };
}

export async function handleMobileApi(request: Request, segments: string[]): Promise<Response> {
  try {
    const method = request.method;
    const path = segments.map((s) => decodeURIComponent(s));
    const route = `${method} /${path.join("/")}`;
    const url = new URL(request.url);
    const user = viewer(request);
    const id = path[1] ?? "";

    if (route === "GET /bootstrap") {
      return json({ apiVersion: MOBILE_API_VERSION, appName: "iwannalearn", demoMode: isDemoMode(),
        categories: CATEGORIES, levels: LEVELS, tiers: TIERS, statuses: STATUS_ORDER,
        topics: listTopics().map((t) => ({ ...t, ...topicCounts()[t.category] })),
        stats: { lessons: countLessons(), requests: countOpenRequests() }, pricing: pricingDto(),
        upload: { maxBytes: MAX_UPLOAD_BYTES, maxFiles: MAX_UPLOADS_PER_REQUEST, accept: ACCEPT_ATTRIBUTE },
        supportEmail: getSetting("support_email", "hello@iwannalearn.app"), legal: LEGAL_DOCS,
      });
    }
    if (route === "POST /auth/login") {
      const input = parse(z.object({ email: z.string().trim().email().max(254), name: z.string().trim().max(80).optional() }), await body(request));
      const email = input.email.toLowerCase();
      const limit = rateLimit(`magic:${email}`, 5, 15 * 60_000);
      if (!limit.allowed) throw new ApiError(429, `Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`);
      const account = findOrCreateUser(email, input.name);
      const token = createLoginToken(email, input.name ?? null, "/dashboard", "android");
      queueEmail({ to: email, userId: account.id, template: "login_link", idempotencyKey: `login:${token}`, critical: true,
        data: { name: account.name ?? "there", url: `${siteUrl()}/auth/android?token=${token}` } });
      track("login_requested", { userId: account.id, data: { client: "android" } });
      return json({ ok: true, email, message: "Check your email for a single-use sign-in link. It expires in 30 minutes.", ...(isDemoMode() ? { demoToken: token } : {}) });
    }
    if (route === "POST /auth/exchange") {
      const input = parse(z.object({ token: z.string().regex(/^[a-f0-9]{32}$/) }), await body(request));
      const result = consumeLoginToken(input.token);
      if (!result.ok || !result.email) throw new ApiError(401, result.error ?? "Invalid sign-in link.");
      const account = findOrCreateUser(result.email, result.name);
      markVerified(account.id);
      const session = createSession(account.id, "android");
      track("session_started", { userId: account.id, data: { method: "magic_link", client: "android" } });
      return json({ ok: true, ...session, user: profileDto(account) });
    }
    if (route === "POST /auth/demo") {
      if (!isDemoMode()) throw new ApiError(404, "Not found.");
      const input = parse(z.object({ role: z.enum(["learner", "creator"]) }), await body(request));
      const account = row<SessionUser>(getDb().prepare("SELECT id, email, name, role FROM users WHERE id = ?"), input.role === "creator" ? "usr_creator" : "usr_amara");
      if (!account) throw new ApiError(404, "Demo accounts aren't installed on this server.");
      const session = createSession(account.id, "android");
      track("session_started", { userId: account.id, data: { method: "demo", client: "android" } });
      return json({ ok: true, ...session, user: profileDto(account) });
    }
    if (route === "POST /auth/logout") { revokeSessionToken(tokenFrom(request)); return json({ ok: true }); }
    if (route === "GET /me") return json({ user: profileDto(requireUser(request)) });
    if (route === "PATCH /me") {
      const account = requireUser(request);
      const input = parse(profileSchema, await body(request));
      getDb().prepare("UPDATE users SET name = ?, phone = ?, notify_email = ?, notify_via_sms = ?, digest_opt_in = ? WHERE id = ?")
        .run(input.name, input.phone || null, Number(input.notifyEmail), Number(input.notifySms), Number(input.digest), account.id);
      return json({ ok: true, user: profileDto(requireUser(request)) });
    }
    if (route === "DELETE /me") { const account = requireUser(request); anonymizeUser(account.id); return json({ ok: true }); }
    if (route === "GET /export") {
      const account = requireUser(request);
      return NextResponse.json(exportUserData(account.id), { headers: { "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="iwannalearn-export.json"' } });
    }
    if (route === "GET /explore") {
      const tab = url.searchParams.get("tab") === "requests" ? "requests" : "lessons";
      const options = { viewerId: user?.id, q: (url.searchParams.get("q") ?? "").trim().slice(0, 120),
        category: url.searchParams.get("category") || undefined, level: url.searchParams.get("level") || undefined,
        sort: (["popular", "newest", "oldest"].includes(url.searchParams.get("sort") ?? "") ? url.searchParams.get("sort") : "newest") as "popular" | "newest" | "oldest",
        limit: 24, offset: (Math.max(1, Math.min(10000, Number(url.searchParams.get("page")) || 1)) - 1) * 24 };
      if (options.category && !CATEGORIES.includes(options.category as typeof CATEGORIES[number])) throw new ApiError(422, "Unknown topic.");
      if (options.level && !["new", "some", "confident"].includes(options.level)) throw new ApiError(422, "Unknown level.");
      if (options.q.length >= 2) { const found = searchEverything(options.q, user?.id); logSearch(options.q, found.lessons.length + found.requests.length, user?.id); }
      return json({ tab, page: options.offset / 24 + 1, pageSize: 24,
        total: tab === "lessons" ? countLessons(options) : countOpenRequests(options),
        lessons: tab === "lessons" ? listLessons(options).map(lessonDto) : [],
        requests: tab === "requests" ? listOpenRequests(options).map((r) => requestDto(r, user)) : [],
      });
    }
    if (route === "GET /search") {
      const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
      const found = searchEverything(q, user?.id);
      if (q.length >= 2) logSearch(q, found.lessons.length + found.requests.length, user?.id);
      return json({ lessons: found.lessons.map((l) => ({ slug: l.slug, title: l.videoTitle ?? l.title, category: l.category })), requests: found.requests.map((r) => ({ slug: r.slug, title: r.title, category: r.category })) });
    }
    if (route === "GET /dashboard") {
      const account = requireUser(request);
      return json({ requests: listMyRequests(account.id).map((r) => requestDto(r, account)), backed: listUpvotedRequests(account.id).map((r) => requestDto(r, account)), entitlements: listEntitlements(account.id), unread: unreadNotificationCount(account.id) });
    }
    if (route === "GET /notifications") {
      const account = requireUser(request);
      return json({ notifications: listNotifications(account.id, 100), unread: unreadNotificationCount(account.id) });
    }
    if (route === "POST /notifications/read") {
      const account = requireUser(request);
      const input = parse(z.object({ id: z.string().max(100).optional() }), await body(request));
      if (input.id) getDb().prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND id = ? AND read_at IS NULL").run(new Date().toISOString(), account.id, input.id);
      else getDb().prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").run(new Date().toISOString(), account.id);
      return json({ ok: true, unread: unreadNotificationCount(account.id) });
    }
    if (route === "POST /requests") {
      const account = requireUser(request);
      const result = receiveRequest(account, await body(request));
      if (!result.ok) throw new ApiError(result.status ?? 422, result.error, result.fieldErrors);
      return json({ ok: true, request: result.created }, 201);
    }
    if (path[0] === "requests" && path.length >= 2) {
      const bySlug = method === "GET" && path.length === 2;
      const item = bySlug ? visibleRequest(id, user) : ownedRequest(id, user ?? { id: "", role: "", email: "", name: null });
      if (bySlug) return json(requestDetail(item, user));
      const action = path[2];
      if (method === "GET" && action === "playback") {
        if (!item.hasLesson || item.status !== "fulfilled") throw new ApiError(409, "Your lesson isn't ready yet.");
        const reply = row<{ video_id: string | null; video_url: string; video_title: string; video_provider: string; stream_url: string | null }>(getDb().prepare("SELECT video_id, video_url, video_title, video_provider, stream_url FROM replies WHERE request_id = ? AND kind = 'external' AND video_url IS NOT NULL ORDER BY created_at DESC LIMIT 1"), item.id)!;
        if (item.visibility === "private") {
          if (!user || (user.role !== "creator" && !hasEntitlement(user.id, item.id))) throw new ApiError(403, "Private access isn't active.");
          if (!reply.stream_url) throw new ApiError(409, "This legacy delivery needs a protected video source. Contact the creator; private YouTube links are not supported.");
          const access = signAccess(item.id, user.id);
          return json({ kind: "direct", title: reply.video_title, url: `${siteUrl()}/api/mobile/v1/requests/${item.id}/stream?exp=${access.expiresAt}&sig=${access.url.split("sig=")[1]}`, expiresAt: access.expiresAt, private: true });
        }
        if (reply.video_provider === "youtube" && reply.video_id) return json({ kind: "youtube", title: reply.video_title, videoId: reply.video_id, url: `https://www.youtube.com/watch?v=${reply.video_id}`, private: false });
        if (!reply.stream_url) throw new ApiError(409, "No compatible video source is available.");
        const access = signAccess(item.id, user?.id ?? "public", 3600);
        const signature = access.url.split("sig=")[1];
        return json({ kind: "direct", title: reply.video_title, url: `${siteUrl()}/api/mobile/v1/requests/${item.id}/stream?exp=${access.expiresAt}&sig=${signature}&public=1`, expiresAt: access.expiresAt, private: false });
      }
      if (method === "GET" && action === "stream") {
        const publicStream = item.visibility === "public" && url.searchParams.get("public") === "1";
        if (!publicStream && (!user || (user.role !== "creator" && !hasEntitlement(user.id, item.id)))) throw new ApiError(403, "Private access isn't active.");
        const check = verifyAccess(item.id, publicStream ? "public" : user!.id, url.searchParams.get("exp") ?? undefined, url.searchParams.get("sig") ?? undefined);
        if (!check.ok) throw new ApiError(401, check.reason === "expired" ? "Playback expired. Open the lesson again." : "Invalid playback link.");
        const source = row<{ stream_url: string | null }>(getDb().prepare("SELECT stream_url FROM replies WHERE request_id = ? AND kind = 'external' AND stream_url IS NOT NULL ORDER BY created_at DESC LIMIT 1"), item.id);
        if (!source?.stream_url) throw new ApiError(404, "Video source not found.");
        const checked = validateStreamUrl(source.stream_url);
        if (!checked.ok) throw new ApiError(409, checked.error);
        const range = request.headers.get("range");
        if (range && !/^bytes=\d+-\d*$/.test(range)) throw new ApiError(416, "Invalid byte range.");
        const upstream = await fetch(checked.url, { redirect: "manual", signal: request.signal, headers: { ...(range ? { Range: range } : {}) } });
        if (upstream.status >= 300 && upstream.status < 400) { await upstream.body?.cancel(); throw new ApiError(502, "The video host redirected to an unapproved address. Configure its direct host."); }
        if (!upstream.ok && upstream.status !== 206) { await upstream.body?.cancel(); throw new ApiError(502, "The video host is unavailable. Try again shortly."); }
        const headers = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Type": upstream.headers.get("content-type") ?? "video/mp4", "Accept-Ranges": upstream.headers.get("accept-ranges") ?? "bytes" });
        for (const key of ["content-length", "content-range"]) { const value = upstream.headers.get(key); if (value) headers.set(key, value); }
        return new Response(upstream.body, { status: upstream.status, headers });
      }
      const account = requireUser(request);
      const isOwner = item.ownerId === account.id;
      if (!isOwner && account.role !== "creator") throw new ApiError(403, "That isn't your request.");
      if (method === "POST" && action === "vote") {
        const limit = rateLimit(`vote:${account.id}`, 120, 3600_000);
        if (!limit.allowed) throw new ApiError(429, "Slow down a moment — too many votes at once.");
        const result = toggleUpvote(account.id, item.id);
        if (!result.ok) throw new ApiError(422, result.error!);
        track("upvote_toggled", { userId: account.id, requestId: item.id, data: { upvoted: result.upvoted } });
        return json(result);
      }
      const input = await body(request);
      if (method === "POST" && action === "withdraw") {
        if (!isOwner) throw new ApiError(403, "Only the requester can withdraw this.");
        if (item.status === "fulfilled") throw new ApiError(409, "This lesson is already delivered.");
        const result = changeStatus(account.id, item.id, "declined", "Withdrawn by the requester.");
        if (!result.ok) throw new ApiError(422, result.error!);
        const paid = getPaymentForRequest(item.id);
        if (paid?.status === "paid") refund(paid.reference, "Withdrawn by the requester.");
        return json({ ok: true });
      }
      if (method === "POST" && action === "feedback") {
        if (!isOwner || !item.fulfilledAt) throw new ApiError(403, "Only the requester can review a delivered lesson.");
        const value = parse(z.object({ helpful: z.boolean(), comment: z.string().max(600).optional() }), input);
        recordFeedback(account.id, item.id, value.helpful, value.comment);
        track("feedback_given", { userId: account.id, requestId: item.id, data: { helpful: value.helpful } });
        return json({ ok: true });
      }
      if (method === "POST" && action === "confirm") {
        if (!isOwner) throw new ApiError(403, "Only the requester can confirm delivery.");
        const result = confirmDelivery(account.id, item.id);
        if (!result.ok) throw new ApiError(422, result.error!);
        return json({ ok: true });
      }
      if (method === "POST" && action === "revision") {
        if (!isOwner) throw new ApiError(403, "Only the requester can request a revision.");
        const value = parse(z.object({ note: z.string().trim().min(10).max(1000) }), input);
        const result = requestRevision(account.id, item.id, value.note);
        if (!result.ok) throw new ApiError(422, result.error!);
        const creator = row<{ id: string }>(getDb().prepare("SELECT id FROM users WHERE role = 'creator' LIMIT 1"));
        if (creator) queueInApp(creator.id, item.id, "Revision requested", value.note, `/requests/${item.slug}`);
        return json({ ok: true });
      }
      if (method === "POST" && action === "quote") {
        if (!isOwner) throw new ApiError(403, "Only the requester can answer a quote.");
        const value = parse(z.object({ accept: z.boolean(), note: z.string().trim().max(500).optional() }), input);
        const result = value.accept ? acceptQuote({ requestId: item.id, userId: account.id }) : declineQuote({ requestId: item.id, userId: account.id, note: value.note });
        if (!result.ok) throw new ApiError(422, result.error);
        return json({ ok: true });
      }
      if (method === "POST" && action === "checkout") {
        if (!isOwner || !["priority", "private"].includes(item.tier)) throw new ApiError(403, "You can only pay for your own paid request.");
        const mode = paymentsMode();
        if (mode === "live" && activeProvider() === "mock") throw new ApiError(503, "Live checkout isn't configured. No payment has been taken.");
        const result = await prepareCheckout(account, item.id, item.tier as "priority" | "private", siteUrl());
        if (!result.ok) throw new ApiError(422, result.error);
        const payment = getPayment(result.reference)!;
        track("checkout_started", { userId: account.id, requestId: item.id, data: { kind: item.tier, client: "android" } });
        return json({ ok: true, reference: result.reference, mode, amountKobo: payment.amount_kobo, taxKobo: payment.tax_kobo, title: item.title, url: mode === "live" ? result.url : null });
      }
      if (method === "POST" && action === "confirm-test-payment") {
        const reference = parse(z.object({ reference: z.string().max(100) }), input).reference;
        const payment = getPayment(reference);
        if (!isOwner || !payment || payment.user_id !== account.id || payment.request_id !== item.id) throw new ApiError(404, "Checkout not found.");
        if (paymentsMode() !== "mock" || payment.provider !== "mock") throw new ApiError(403, "Test settlement is disabled.");
        const result = settle(reference, { provider: "mock", signal: "android_user_confirmed" });
        if (!result.ok) throw new ApiError(422, result.error!);
        track("payment_settled", { userId: account.id, requestId: item.id, data: { reference } });
        return json({ ok: true });
      }
      if (method === "POST" && action === "refund") {
        if (!isOwner) throw new ApiError(403, "You can only ask about your own payment.");
        const value = parse(z.object({ reason: z.string().trim().min(10).max(1000) }), input);
        const result = requestRefund({ userId: account.id, requestId: item.id, reason: value.reason });
        if (!result.ok) throw new ApiError(422, result.error);
        return json({ ok: true });
      }
    }
    if (route === "GET /lessons" || (method === "GET" && path[0] === "lessons" && path.length === 2)) {
      if (path.length === 2) { const lesson = getLessonBySlug(id); if (!lesson) throw new ApiError(404, "Lesson not found."); return json({ lesson: lessonDto(lesson) }); }
    }
    if (route === "POST /support") {
      const input = parse(supportSchema, await body(request));
      const limit = rateLimit(`support:${user?.id ?? "anon"}`, 5, 3600_000);
      if (!limit.allowed) throw new ApiError(429, "We've got your last few messages. Give us a working day to reply.");
      createSupportMessage({ ...input, userId: user?.id });
      queueEmail({ to: input.email, userId: user?.id, template: "support_ack", idempotencyKey: `support:${Date.now()}:${user?.id ?? "anon"}`, critical: true, data: { name: user?.name ?? "there", body: input.body } });
      return json({ ok: true, message: "Got it. Give us a working day — we'll reply by email." });
    }
    if (route === "POST /analytics") {
      const input = parse(z.object({ name: z.enum(["request_started", "lesson_played"]), requestId: z.string().max(100).optional() }), await body(request));
      if (input.requestId) {
        const r = getRequestById(input.requestId, user?.id);
        if (!r || (r.visibility !== "public" && r.ownerId !== user?.id && user?.role !== "creator")) throw new ApiError(404, "Request not found.");
      }
      track(input.name, { userId: user?.id, requestId: input.requestId, data: { client: "android" } });
      return json({ ok: true });
    }

    // Creator studio is native too. Every admin route repeats the role check server-side.
    if (path[0] === "admin") {
      const creator = requireCreator(request);
      const id = path[2] ?? "";
      if (route === "GET /admin") return json(adminSnapshot());
      const input = method === "POST" ? await body(request) : {};
      if (method === "POST" && path[1] === "requests" && path[3]) {
        const item = ownedRequest(id, creator);
        const action = path[3];
        if (action === "status") {
          const value = parse(z.object({ status: z.enum(STATUS_ORDER as [RequestStatus, ...RequestStatus[]]), reason: z.string().trim().max(500).optional() }), input);
          const result = moveRequest(creator.id, item.id, value.status, value.reason);
          if (!result.ok) throw new ApiError(result.status ?? 422, result.error);
          return json(result);
        }
        if (action === "note") {
          const value = parse(z.object({ message: z.string().trim().min(1).max(2000) }), input);
          addInternalNote(creator.id, item.id, value.message); return json({ ok: true });
        }
        if (action === "publish") {
          const result = publishAndNotify(creator.id, item.id, parse(z.object({ message: z.string(), videoTitle: z.string(), videoUrl: z.string().optional(), streamUrl: z.string().optional(), videoLength: z.string().optional(), resources: z.array(z.object({ label: z.string(), url: z.string() })).optional() }), input));
          if (!result.ok) throw new ApiError(result.status ?? 422, result.error, result.fieldErrors);
          return json(result);
        }
        if (action === "quote") {
          const value = parse(z.object({ amountKobo: z.number().int().positive().max(100_000_000), scope: z.string().trim().min(20).max(4000), deliverables: z.string().max(2000).optional(), turnaroundDays: z.number().int().min(1).max(365).optional(), revisions: z.number().int().min(0).max(3).default(1) }), input);
          const result = proposeQuote({ ...value, creatorId: creator.id, requestId: item.id });
          if (!result.ok) throw new ApiError(422, result.error);
          return json({ ok: true });
        }
        if (action === "priority") { getDb().prepare("UPDATE requests SET priority_flag = 1 - priority_flag WHERE id = ?").run(item.id); return json({ ok: true }); }
        if (action === "reuse") {
          if (item.visibility === "private") throw new ApiError(422, "A public lesson cannot fulfil private work.");
          const value = parse(z.object({ sourceReplyId: z.string().min(1), note: z.string().max(2000).optional() }), input);
          const source = row<{ id: string; video_url: string; video_title: string; video_length: string | null; resources: string | null; message: string; stream_url: string | null; visibility: string }>(getDb().prepare("SELECT p.id, p.video_url, p.video_title, p.video_length, p.resources, p.message, p.stream_url, r.visibility FROM replies p JOIN requests r ON r.id = p.request_id WHERE p.id = ? AND p.kind = 'external'"), value.sourceReplyId);
          if (!source || source.visibility !== "public") throw new ApiError(404, "Public source lesson not found.");
          const result = publishAndNotify(creator.id, item.id, { message: value.note || source.message, videoUrl: source.video_url, streamUrl: source.stream_url ?? undefined, videoTitle: source.video_title, videoLength: source.video_length ?? undefined, resources: JSON.parse(source.resources ?? "[]"), reusedFrom: source.id });
          if (!result.ok) throw new ApiError(result.status ?? 422, result.error);
          return json(result);
        }
        if (action === "moderate") {
          const value = parse(z.object({ approve: z.boolean(), reason: z.string().trim().max(500).optional() }), input);
          if (!value.approve && !value.reason) throw new ApiError(422, "A decline needs a reason.");
          getDb().prepare("UPDATE requests SET moderation_flag = 0 WHERE id = ?").run(item.id);
          const result = moveRequest(creator.id, item.id, value.approve ? "planned" : "declined", value.reason);
          if (!result.ok) throw new ApiError(result.status ?? 422, result.error);
          return json(result);
        }
      }
      if (route === "POST /admin/settings") {
        const value = parse(z.object({ capacity: z.number().int().min(0).max(50), vatRate: z.number().min(0).max(30), refundWindow: z.number().int().min(1).max(90), supportEmail: z.string().email(), digestDay: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]), paymentsMode: z.enum(["off", "mock", "live"]) }), input);
        if (value.paymentsMode === "live" && (activeProvider() === "mock" || !process.env.PAYSTACK_SECRET_KEY && !process.env.STRIPE_SECRET_KEY)) throw new ApiError(422, "Live payments need a configured provider and server-side keys.");
        for (const [key, v] of Object.entries({ weekly_capacity: value.capacity, vat_rate: value.vatRate, refund_window_days: value.refundWindow, support_email: value.supportEmail, digest_day: value.digestDay, payments_mode: value.paymentsMode })) setSetting(key, String(v));
        return json({ ok: true });
      }
      if (method === "POST" && path[1] === "payments" && path[3] === "refund") {
        const value = parse(z.object({ reason: z.string().trim().min(3).max(1000) }), input);
        const result = refund(id, value.reason);
        if (!result.ok) throw new ApiError(422, result.error!);
        return json(result);
      }
      if (method === "POST" && path[1] === "refunds" && path[3] === "resolve") {
        const value = parse(z.object({ approve: z.boolean(), note: z.string().trim().min(3).max(1000) }), input);
        const result = resolveRefundRequest({ id, ...value });
        if (!result.ok) throw new ApiError(422, result.error!);
        return json(result);
      }
      if (method === "POST" && path[1] === "outbox" && ["retry", "bounce"].includes(path[3])) {
        const message = row<{ to_email: string }>(getDb().prepare("SELECT to_email FROM outbox WHERE id = ?"), id);
        if (!message) throw new ApiError(404, "Message not found.");
        if (path[3] === "bounce") markBounced(id, message.to_email); else deliver(id);
        return json({ ok: true });
      }
      if (method === "POST" && path[1] === "support" && path[3] === "resolve") { getDb().prepare("UPDATE support_messages SET status = 'resolved' WHERE id = ?").run(id); return json({ ok: true }); }
    }
    return error("This API endpoint doesn't exist.", 404);
  } catch (e) {
    if (e instanceof ApiError) return error(e.message, e.status, e.fields);
    console.error("[mobile-api]", e instanceof Error ? e.message : "Unknown error");
    return error("Something went wrong on the server. Your saved draft is safe; please try again.", 500);
  }
}

function queueInApp(userId: string, requestId: string, title: string, message: string, href: string) {
  // Import-free helper keeps revision notifications on the same durable bell channel.
  getDb().prepare("INSERT INTO notifications (id, user_id, request_id, kind, title, body, href, created_at) VALUES (?, ?, ?, 'revision', ?, ?, ?, ?)")
    .run(crypto.randomUUID(), userId, requestId, title, message.slice(0, 120), href, new Date().toISOString());
}
