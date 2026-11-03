"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, row } from "./db";
import { endSession, findOrCreateUser, getCurrentUser, isCreator, startSession, createLoginToken } from "./auth";
import { CATEGORIES, STATUS_META, type RequestStatus } from "./status";
import {
  track,
  rateLimit,
  logSearch,
  addInternalNote,
  changeStatus,
  confirmDelivery,
  createRequest,
  createSupportMessage,
  promoteFromWaitlist,
  recordFeedback,
  requestRevision,
  setSetting,
  toggleUpvote,
  anonymizeUser,
  publishLesson,
} from "./service";
import { attachUploads } from "./uploads";
import { acceptQuote, declineQuote, proposeQuote } from "./quotes";
import { clearErrors } from "./errors";
import { requestRefund, resolveRefundRequest } from "./payments";
import { notifyUser, queueEmail, deliver, markBounced, clearBounce } from "./notify";
import { prepareCheckout, refund, settle, getPayment } from "./payments";
import { formatNaira, paymentsEnabled, paymentsMode, PRICING, type PaidTier } from "./pricing";
import { searchEverything, getRequestById } from "./queries";
import { parseYouTube } from "./parse";
import { requestSchema, supportSchema, replySchema, fieldErrors } from "./validation";
import { receiveRequest, publishAndNotify, moveRequest } from "./operations";

export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  data?: Record<string, unknown>;
};

const fail = (error: string, fieldErrors?: Record<string, string>): ActionState => ({ error, fieldErrors });

/**
 * `useActionState` actions arrive as (prevState, formData). A plain no-JS form
 * post arrives as (formData) only — accept both so a form never 500s just
 * because JavaScript hadn't loaded yet.
 */
function resolveFormData(prevOrData: ActionState | FormData, maybeData?: FormData): FormData {
  return (maybeData ?? prevOrData) as FormData;
}

function collectFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

function safeNext(next: unknown, fallback = "/dashboard"): string {
  const value = String(next ?? "");
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

const signInSchema = z.object({
  email: z.string().trim().email("That email doesn't look right — check for a typo."),
  name: z.string().trim().max(80).optional(),
});

export async function signInAction(prevOrData: ActionState | FormData, maybeData?: FormData): Promise<ActionState> {
  const formData = resolveFormData(prevOrData, maybeData);
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your email and try again.");

  const email = parsed.data.email.toLowerCase();
  const limit = rateLimit(`magic:${email}`, 5, 15 * 60_000);
  if (!limit.allowed) {
    return fail(`Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`);
  }

  const token = createLoginToken(email, parsed.data.name ?? null, safeNext(formData.get("next")));
  const user = findOrCreateUser(email, parsed.data.name ?? null);

  queueEmail({
    to: email,
    userId: user.id,
    template: "login_link",
    idempotencyKey: `login:${token}`,
    // A sign-in link must never be suppressed: it is the only way in.
    critical: true,
    data: {
      name: user.name ?? "there",
      url: `${process.env.SITE_URL ?? "http://localhost:3000"}/auth/verify?token=${token}`,
    },
  });
  track("login_requested", { userId: user.id });

  redirect(`/login/check?token=${token}`);
}

export async function signInAsDemoAction(formData: FormData) {
  const userId = String(formData.get("userId") || "usr_amara");
  const next = safeNext(formData.get("next"), userId === "usr_creator" ? "/admin" : "/dashboard");
  await startSession(userId);
  track("session_started", { userId, data: { method: "demo" } });
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOutAction() {
  await endSession();
  revalidatePath("/", "layout");
  redirect("/");
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Tell us what to call you.").max(80),
  phone: z
    .string()
    .trim()
    .max(24)
    .optional()
    .refine((v) => !v || /^[+0-9 ()-]{7,24}$/.test(v), "Use digits, spaces and a leading + for country code."),
  notifyEmail: z.enum(["0", "1"]),
  notifySms: z.enum(["0", "1"]),
  digest: z.enum(["0", "1"]),
});

export async function updateProfileAction(prevOrData: ActionState | FormData, maybeData?: FormData): Promise<ActionState> {
  const formData = resolveFormData(prevOrData, maybeData);
  const user = await getCurrentUser();
  if (!user) return fail("Sign in first.");

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    notifyEmail: formData.get("notifyEmail") ?? "1",
    notifySms: formData.get("notifySms") ?? "0",
    digest: formData.get("digest") ?? "1",
  });
  if (!parsed.success) return { error: "A couple of details need a look.", fieldErrors: collectFieldErrors(parsed.error) };

  getDb()
    .prepare(
      "UPDATE users SET name = ?, phone = ?, notify_email = ?, notify_via_sms = ?, digest_opt_in = ? WHERE id = ?",
    )
    .run(
      parsed.data.name,
      parsed.data.phone ?? null,
      Number(parsed.data.notifyEmail),
      Number(parsed.data.notifySms),
      Number(parsed.data.digest),
      user.id,
    );

  revalidatePath("/account");
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. Your preferences apply from the next notification." };
}

export async function deleteAccountAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in first.");
  anonymizeUser(user.id);
  await endSession();
  revalidatePath("/", "layout");
  redirect("/?deleted=1");
}

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

export async function submitRequestAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in first — it takes one tap and keeps your request safe.");

  const result = receiveRequest(user, formData);
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };
  revalidatePath("/", "layout");
  redirect(`/requests/${result.created.slug}?new=1`);
}

export async function toggleUpvoteAction(
  requestId: string,
): Promise<{ ok: boolean; upvoted?: boolean; count?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "sign_in" };

  const limit = rateLimit(`vote:${user.id}`, 120, 60 * 60_000);
  if (!limit.allowed) return { ok: false, error: "Slow down a moment — too many votes at once." };

  const result = toggleUpvote(user.id, requestId);
  const request = row<{ slug: string }>(getDb().prepare("SELECT slug FROM requests WHERE id = ?"), requestId);

  if (result.ok) {
    track("upvote_toggled", { userId: user.id, requestId, data: { upvoted: result.upvoted } });
    revalidatePath("/");
    revalidatePath("/explore");
    if (request) revalidatePath(`/requests/${request.slug}`);
  }
  return result;
}

export async function cancelRequestAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in first.");
  const requestId = String(formData.get("requestId") || "");
  const request = row<{ id: string; slug: string; created_by: string; status: string }>(
    getDb().prepare("SELECT id, slug, created_by, status FROM requests WHERE id = ?"),
    requestId,
  );
  if (!request || request.created_by !== user.id) return fail("That isn't your request.");
  if (request.status === "fulfilled") return fail("This one is already answered — nothing to cancel.");

  changeStatus(user.id, requestId, "declined", "Withdrawn by the requester.");
  promoteFromWaitlist(1);
  revalidatePath("/dashboard");
  revalidatePath(`/requests/${request.slug}`);
  return { ok: true, message: "Withdrawn. You can ask again any time." };
}

/* ------------------------------------------------------------------ */
/* Creator: fulfilment                                                 */
/* ------------------------------------------------------------------ */

export async function postReplyAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Only the creator can publish a lesson.");

  const requestId = String(formData.get("requestId") || "");
  const resources = String(formData.get("resources") || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [label, url] = line.split("|").map((part) => part.trim());
    return { label: label || url, url: url || line };
  });
  const result = publishAndNotify(user.id, requestId, {
    message: String(formData.get("message") || ""),
    videoUrl: String(formData.get("videoUrl") || "") || undefined,
    streamUrl: String(formData.get("streamUrl") || "") || undefined,
    videoTitle: String(formData.get("videoTitle") || ""),
    videoLength: String(formData.get("videoLength") || "") || undefined,
    resources,
    reusedFrom: String(formData.get("reusedFrom") || "") || null,
  });
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };
  revalidatePath("/", "layout");
  return { ok: true, message: result.message };
}

/** Fulfils a request with an existing lesson instead of filming a new one. */
export async function reuseLessonAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Only the creator can publish a lesson.");

  const requestId = String(formData.get("requestId") || "");
  const sourceId = String(formData.get("sourceReplyId") || "");
  const note = String(formData.get("note") || "").trim();

  const source = row<{
    id: string;
    video_url: string;
    video_id: string;
    video_title: string;
    video_length: string | null;
    resources: string | null;
    message: string;
  }>(
    getDb().prepare(
      "SELECT id, video_url, video_id, video_title, video_length, resources, message FROM replies WHERE id = ? AND kind = 'external'",
    ),
    sourceId,
  );
  if (!source || !source.video_url) return fail("That lesson no longer exists in the library.");
  const target = getRequestById(requestId, user.id);
  if (!target) return fail("Request not found.");
  if (target.visibility === "private") return fail("Public library lessons cannot fulfil a private commission. Deliver a protected video instead.");

  return publishAndNotify(user!.id, requestId, {
    message:
      note ||
      `This already answers your question, so I've sent it straight over rather than re-filming it. ${source.message}`,
    videoUrl: source.video_url,
    streamUrl: row<{ stream_url: string | null }>(getDb().prepare("SELECT stream_url FROM replies WHERE id = ?"), sourceId)?.stream_url ?? undefined,
    videoTitle: source.video_title,
    videoLength: source.video_length ?? undefined,
    resources: source.resources ? JSON.parse(source.resources) : [],
    reusedFrom: source.id,
  });
}

const statusSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(["submitted", "under_review", "planned", "in_production", "waitlisted", "fulfilled", "declined"]),
  reason: z.string().trim().max(500).optional(),
});

export async function updateStatusAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Only the creator can move requests.");

  const parsed = statusSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return fail("That status change didn't look right.");

  const result = moveRequest(user.id, parsed.data.requestId, parsed.data.status as RequestStatus, parsed.data.reason);
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  return { ok: true, message: result.message };
}

export async function addInternalNoteAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Only the creator can add notes.");
  const requestId = String(formData.get("requestId") || "");
  const message = String(formData.get("message") || "").trim();
  if (!message) return fail("Write a note first.");

  addInternalNote(user!.id, requestId, message);
  revalidatePath("/admin");
  return { ok: true, message: "Note saved — learners never see this." };
}

export async function togglePriorityAction(requestId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Not allowed.");
  getDb().prepare("UPDATE requests SET priority_flag = 1 - priority_flag WHERE id = ?").run(requestId);
  revalidatePath("/admin");
  return { ok: true };
}

export async function setCapacityAction(prevOrData: ActionState | FormData, maybeData?: FormData): Promise<ActionState> {
  const formData = resolveFormData(prevOrData, maybeData);
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Not allowed.");
  const value = Number(formData.get("capacity"));
  if (!Number.isFinite(value) || value < 0 || value > 50) return fail("Capacity must be between 0 and 50.");
  setSetting("weekly_capacity", String(Math.round(value)));
  revalidatePath("/admin");
  return { ok: true, message: "Weekly capacity updated." };
}

export async function setPaymentsModeAction(prevOrData: ActionState | FormData, maybeData?: FormData): Promise<ActionState> {
  const formData = resolveFormData(prevOrData, maybeData);
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Not allowed.");
  const mode = String(formData.get("mode") || "off");
  if (!["off", "mock", "live"].includes(mode)) return fail("Unknown payment mode.");
  if (mode === "live" && !process.env.STRIPE_SECRET_KEY && !process.env.PAYSTACK_SECRET_KEY) {
    return fail("Live mode needs provider keys. Add STRIPE_SECRET_KEY or PAYSTACK_SECRET_KEY first.");
  }
  setSetting("payments_mode", mode);
  revalidatePath("/admin");
  revalidatePath("/pricing");
  return { ok: true, message: `Payments mode set to ${mode}.` };
}

/* ------------------------------------------------------------------ */
/* Creator: notifications                                              */
/* ------------------------------------------------------------------ */

export async function retryEmailAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Not allowed.");
  const outboxId = String(formData.get("outboxId") || "");
  const result = deliver(outboxId);
  revalidatePath("/admin/outbox");
  revalidatePath("/admin");
  return result.status === "delivered"
    ? { ok: true, message: "Delivered." }
    : fail("That message could not be delivered.");
}

export async function bounceEmailAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Not allowed.");
  const outboxId = String(formData.get("outboxId") || "");
  const email = String(formData.get("email") || "");
  markBounced(outboxId, email);
  revalidatePath("/admin/outbox");
  revalidatePath("/admin");
  return { ok: true, message: `Recorded a bounce for ${email}. Future email will be suppressed; the bell still works.` };
}

export async function clearBounceAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Not allowed.");
  clearBounce(String(formData.get("userId") || ""));
  revalidatePath("/admin/outbox");
  return { ok: true, message: "Address cleared — email will be attempted again." };
}

export async function sendDigestAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Not allowed.");
  const { creatorDigestData } = await import("./queries");
  const digest = creatorDigestData();
  const result = queueEmail({
    to: user!.email,
    userId: user!.id,
    template: "creator_digest",
    idempotencyKey: `digest:${new Date().toISOString().slice(0, 10)}`,
    data: {
      newRequests: digest.newRequests,
      topVoted: digest.topVoted,
      delivered: digest.delivered,
      queue: digest.queue,
      medianDays: digest.medianDays,
    },
  });
  revalidatePath("/admin/outbox");
  return result.status === "duplicate"
    ? { ok: true, message: "Today's digest was already queued — check the outbox." }
    : { ok: true, message: "Digest queued. It's in the outbox." };
}

/* ------------------------------------------------------------------ */
/* Learner: notifications, feedback, account                           */
/* ------------------------------------------------------------------ */

export async function markNotificationsReadAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in.");
  getDb().prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").run(
    new Date().toISOString(),
    user.id,
  );
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function submitFeedbackAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in to leave feedback.");

  const requestId = String(formData.get("requestId") || "");
  const helpful = String(formData.get("helpful")) === "1";
  const comment = String(formData.get("comment") || "").trim().slice(0, 600);

  recordFeedback(user.id, requestId, helpful, comment);
  track("feedback_given", { userId: user.id, requestId, data: { helpful } });

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { ok: true, message: helpful ? "Glad it helped — noted." : "Thanks. That tells us what to fix next." };
}

export async function confirmDeliveryAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in first.");
  const requestId = String(formData.get("requestId") || "");
  const result = confirmDelivery(user.id, requestId);
  if (!result.ok) return fail(result.error ?? "Could not confirm delivery.");

  notifyUser({
    userId: "usr_creator",
    requestId,
    kind: "delivery_confirmed",
    title: "Delivery confirmed by the learner ✅",
    body: "The revision window is closed for this one.",
    href: `/admin?focus=${requestId}`,
  });
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { ok: true, message: "Confirmed and closed. Thanks — that helps us both." };
}

export async function requestRevisionAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in first.");
  const requestId = String(formData.get("requestId") || "");
  const note = String(formData.get("note") || "").trim();
  if (note.length < 10) return fail("Tell us what missed — a sentence is enough.");

  const result = requestRevision(user.id, requestId, note);
  if (!result.ok) return fail(result.error ?? "Could not request a revision.");

  notifyUser({
    userId: "usr_creator",
    requestId,
    kind: "revision_requested",
    title: "Revision requested",
    body: note.slice(0, 120),
    href: `/admin?focus=${requestId}`,
  });
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { ok: true, message: "Sent. One revision is included — we'll re-record what missed." };
}

/* ------------------------------------------------------------------ */
/* Quotes — scope agreed before money                                   */
/* ------------------------------------------------------------------ */

export async function acceptQuoteAction(
  requestId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const result = acceptQuote({ requestId, userId: user.id });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/dashboard");
  revalidatePath("/admin/quotes");
  return { ok: true };
}

export async function declineQuoteAction(
  requestId: string,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const result = declineQuote({ requestId, userId: user.id, note });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/admin/quotes");
  return { ok: true };
}

/** Creator-side: propose or re-propose the scope and price. */
export async function proposeQuoteAction(
  prevOrData: ActionState | FormData,
  maybeData?: FormData,
): Promise<ActionState> {
  const formData = resolveFormData(prevOrData, maybeData);
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Only the creator can send quotes.");

  const requestId = String(formData.get("requestId") || "");
  const naira = Number(String(formData.get("amountNaira") || "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(naira) || naira <= 0) {
    return { ok: false, error: "Enter the price in naira, for example 25000.", fieldErrors: { amountNaira: "Enter a price." } };
  }

  const result = proposeQuote({
    requestId,
    creatorId: user!.id,
    amountKobo: Math.round(naira * 100),
    scope: String(formData.get("scope") || ""),
    deliverables: String(formData.get("deliverables") || "") || null,
    turnaroundDays: Number(formData.get("turnaroundDays") || 0) || null,
    revisions: Number(formData.get("revisions") || 1),
  });

  if (!result.ok) return fail(result.error);

  revalidatePath("/admin/quotes");
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/dashboard");
  return { ok: true, message: `Quote for ${(naira).toLocaleString("en-NG")} naira sent. Nothing is charged until they accept.` };
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

export async function startCheckoutAction(
  requestId: string,
  kind: PaidTier,
): Promise<{ ok: boolean; reference?: string; url?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to pay." };

  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const result = await prepareCheckout(user, requestId, kind, siteUrl);
  if (!result.ok) return { ok: false, error: result.error };

  track("checkout_started", { userId: user.id, requestId, data: { kind } });
  return { ok: true, reference: result.reference, url: result.url };
}

export async function confirmMockPaymentAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in first.");

  const reference = String(formData.get("reference") || "");
  const payment = getPayment(reference);
  if (!payment || payment.user_id !== user.id) return fail("This checkout isn't yours.");
  if (paymentsMode() !== "mock" || payment.provider !== "mock") return fail("Test settlement is disabled for this payment.");
  const result = settle(reference, { provider: "mock", signal: "user_confirmed" });
  if (!result.ok) return fail(result.error ?? "Payment could not be confirmed.");

  track("payment_settled", { userId: user.id, data: { reference } });
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/pricing");
  if (result.slug) revalidatePath(`/requests/${result.slug}`);

  redirect(`/requests/${result.slug}?paid=1`);
}

export async function refundPaymentAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Only the creator can refund.");
  const reference = String(formData.get("reference") || "");
  const result = refund(reference, String(formData.get("reason") || "Refunded by the creator"));
  if (!result.ok) return fail(result.error ?? "Refund failed.");
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  return { ok: true, message: "Refunded. Access revoked and the learner has been told." };
}

export async function requestRefundAction(
  requestId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const result = requestRefund({ userId: user.id, requestId, reason });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin/payments");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function resolveRefundAction(
  prevOrData: ActionState | FormData,
  maybeData?: FormData,
): Promise<ActionState> {
  const formData = resolveFormData(prevOrData, maybeData);
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Only the creator can settle refunds.");

  const result = resolveRefundRequest({
    id: String(formData.get("id") || ""),
    approve: String(formData.get("decision") || "") === "approve",
    note: String(formData.get("note") || ""),
  });
  if (!result.ok) return fail(result.error ?? "Could not resolve that.");

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  return { ok: true, message: "Settled. The learner has been told, and access follows the decision." };
}

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */

export async function clearErrorsAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Not allowed.");
  const removed = clearErrors();
  revalidatePath("/admin/health");
  return { ok: true, message: `Cleared ${removed} recorded error${removed === 1 ? "" : "s"}.` };
}

/* ------------------------------------------------------------------ */
/* Search, analytics, support                                          */
/* ------------------------------------------------------------------ */

export async function logSearchAction(term: string): Promise<void> {
  const user = await getCurrentUser();
  const results = searchEverything(term, user?.id);
  logSearch(term, results.lessons.length + results.requests.length, user?.id);
}

export async function trackLessonPlayedAction(requestId: string): Promise<void> {
  const user = await getCurrentUser();
  track("lesson_played", { userId: user?.id ?? null, requestId });
}

export async function trackRequestStartedAction(): Promise<void> {
  const user = await getCurrentUser();
  track("request_started", { userId: user?.id ?? null });
}

export async function supportAction(prevOrData: ActionState | FormData, maybeData?: FormData): Promise<ActionState> {
  const formData = resolveFormData(prevOrData, maybeData);
  const user = await getCurrentUser();
  const limit = rateLimit(`support:${user?.id ?? "anon"}`, 5, 60 * 60_000);
  if (!limit.allowed) return fail("We've got your last few — give us a day to reply before sending more.");

  const parsed = supportSchema.safeParse({
    email: formData.get("email") || user?.email,
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: "A couple of fields need a look.", fieldErrors: collectFieldErrors(parsed.error) };

  createSupportMessage({ ...parsed.data, userId: user?.id ?? null });
  queueEmail({
    to: parsed.data.email,
    userId: user?.id ?? null,
    template: "support_ack",
    idempotencyKey: `support:${Date.now()}`,
    critical: true,
    data: { name: user?.name ?? "there", body: parsed.data.body },
  });

  revalidatePath("/admin/support");
  return { ok: true, message: "Got it. We're one person, so give us a working day — you'll get a reply by email." };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function getSettingNumber(key: string, fallback: number): number {
  const found = row<{ value: string }>(getDb().prepare("SELECT value FROM settings WHERE key = ?"), key);
  return found ? Number(found.value) : fallback;
}

export async function priceFor(tier: PaidTier) {
  return { label: PRICING[tier].label, enabled: paymentsEnabled(), amount: formatNaira(PRICING[tier].amountKobo) };
}

/* ------------------------------------------------------------------ */
/* Progressive-enhancement wrappers                                    */
/*                                                                     */
/* Plain <form action> handlers must return void. These wrap the       */
/* state-returning actions so the no-JS path still works, and redirect  */
/* to a page that can explain the outcome.                            */
/* ------------------------------------------------------------------ */

export async function confirmMockPaymentFormAction(formData: FormData): Promise<void> {
  const reference = String(formData.get("reference") || "");
  const result = await confirmMockPaymentAction(formData).catch((error) => {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return { error: "Payment could not be confirmed." } as ActionState;
  });
  if (result && "error" in result && result.error) {
    redirect(`/checkout/${reference}?error=${encodeURIComponent(result.error)}`);
  }
}

export async function submitSupportFormAction(formData: FormData): Promise<void> {
  const result = await supportAction({}, formData);
  if (result.error) redirect(`/contact?error=${encodeURIComponent(result.error)}`);
  redirect("/contact?sent=1");
}

const settingsSchema = z.object({
  vatRate: z.coerce.number().min(0, "VAT can't be negative.").max(50, "That VAT rate looks wrong."),
  refundWindow: z.coerce.number().int().min(0).max(90, "Keep the window under 90 days."),
  supportEmail: z.string().trim().email("Use a real email address."),
  digestDay: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
});

export async function saveSettingsAction(prevOrData: ActionState | FormData, maybeData?: FormData): Promise<ActionState> {
  const formData = resolveFormData(prevOrData, maybeData);
  const user = await getCurrentUser();
  if (!isCreator(user)) return fail("Not allowed.");

  const parsed = settingsSchema.safeParse({
    vatRate: formData.get("vatRate"),
    refundWindow: formData.get("refundWindow"),
    supportEmail: formData.get("supportEmail"),
    digestDay: formData.get("digestDay"),
  });
  if (!parsed.success) return { error: "Check the numbers below.", fieldErrors: collectFieldErrors(parsed.error) };

  setSetting("vat_rate", String(parsed.data.vatRate));
  setSetting("refund_window_days", String(parsed.data.refundWindow));
  setSetting("support_email", parsed.data.supportEmail);
  setSetting("digest_day", parsed.data.digestDay);

  revalidatePath("/admin", "layout");
  revalidatePath("/pricing");
  revalidatePath("/contact");
  return { ok: true, message: "Saved. New prices, emails and windows apply immediately." };
}
