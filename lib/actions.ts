"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, randomUUID } from "./db";
import { endSession, findOrCreateUser, getCurrentUser, isCreator, startSession } from "./auth";
import { CATEGORIES, STATUS_META, type RequestStatus } from "./status";
import { slugify, parseYouTube, truncate } from "./parse";

export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
};

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

const signInSchema = z.object({
  email: z.string().trim().email("That email doesn't look right — check for a typo."),
  name: z.string().trim().max(80).optional(),
});

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your email and try again." };
  }

  const next = String(formData.get("next") || "/dashboard");
  const user = findOrCreateUser(parsed.data.email, parsed.data.name);
  await startSession(user.id);
  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signInAsDemoAction(formData: FormData) {
  const userId = String(formData.get("userId") || "usr_amara");
  const next = String(formData.get("next") || (userId === "usr_creator" ? "/admin" : "/dashboard"));
  await startSession(userId);
  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signOutAction() {
  await endSession();
  revalidatePath("/", "layout");
  redirect("/");
}

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

const requestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(12, "Give your request a clear, specific title (at least 12 characters).")
    .max(140, "Keep the title under 140 characters — put the detail in the next step."),
  goal: z
    .string()
    .trim()
    .min(30, "Describe what you want to be able to do. A sentence or two is perfect.")
    .max(1200, "That's a lot of detail — try to keep it under 1200 characters."),
  tried: z.string().trim().max(800, "Keep this under 800 characters.").optional(),
  category: z.enum(CATEGORIES, { message: "Pick the closest topic." }),
  level: z.enum(["new", "some", "confident"]),
  tier: z.enum(["community", "priority", "private"]),
  contextLink: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine((v) => !v || /^https?:\/\//.test(v), "Paste a full link starting with https://"),
  deadline: z.string().trim().max(80).optional(),
});

export async function submitRequestAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Please sign in first — it takes one tap and keeps your request safe." };
  }

  const parsed = requestSchema.safeParse({
    title: formData.get("title"),
    goal: formData.get("goal"),
    tried: formData.get("tried") || undefined,
    category: formData.get("category"),
    level: formData.get("level"),
    tier: formData.get("tier") || "community",
    contextLink: formData.get("contextLink") || undefined,
    deadline: formData.get("deadline") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Almost there — a couple of fields need a tweak.", fieldErrors };
  }

  const data = parsed.data;
  const db = getDb();
  const now = new Date().toISOString();
  const id = `req_${randomUUID().slice(0, 10)}`;
  const slug = uniqueSlug(slugify(data.title));
  const visibility = data.tier === "private" ? "private" : "public";

  const { n } = db.prepare("SELECT COUNT(*) AS n FROM requests").get() as { n: number };
  const ref = `REQ-${1001 + Number(n)}`;

  db.prepare(`
    INSERT INTO requests (
      id, ref, slug, title, goal, tried, context_link, category, level, visibility, tier,
      status, deadline, upvote_count, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, 0, ?, ?, ?)
  `).run(
    id,
    ref,
    slug,
    data.title,
    data.goal,
    data.tried ?? null,
    data.contextLink ?? null,
    data.category,
    data.level,
    visibility,
    data.tier,
    data.deadline ?? null,
    user.id,
    now,
    now,
  );

  db.prepare(
    "INSERT INTO request_events (id, request_id, kind, from_status, to_status, message, actor, created_at) VALUES (?, ?, 'created', NULL, 'submitted', ?, ?, ?)",
  ).run(randomUUID(), id, "Request received.", user.id, now);

  await notify(user.id, {
    requestId: id,
    kind: "request_received",
    title: "We've got your request ✅",
    body: `“${truncate(data.title, 70)}” is in the queue. We'll notify you the moment there's news.`,
    href: `/requests/${slug}`,
  });

  await queueEmail({
    requestId: id,
    to: user.email,
    subject: `We've got your request: ${truncate(data.title, 60)}`,
    body: `Hi ${user.name ?? "there"},\n\nYour request is in.\n\n“${data.title}”\n\nWhat happens next:\n1. We check the details (usually within 2 days).\n2. It gets a filming slot.\n3. You get an email and an in-app notification the moment the lesson is ready.\n\nTrack it any time: /requests/${slug}\n\n— Elias at iwannalearn`,
  });

  revalidatePath("/");
  revalidatePath("/explore");
  revalidatePath("/dashboard");
  revalidatePath("/admin");

  redirect(`/requests/${slug}?new=1`);
}

export async function toggleUpvoteAction(requestId: string): Promise<{ ok: boolean; upvoted?: boolean; count?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "sign_in" };

  const db = getDb();
  const request = db.prepare("SELECT id, slug, visibility, title, created_by FROM requests WHERE id = ?").get(requestId) as
    | { id: string; slug: string; visibility: string; title: string; created_by: string }
    | undefined;
  if (!request || request.visibility !== "public") return { ok: false, error: "This request is private." };

  const existing = db
    .prepare("SELECT 1 FROM request_upvotes WHERE request_id = ? AND user_id = ?")
    .get(requestId, user.id);

  if (existing) {
    db.prepare("DELETE FROM request_upvotes WHERE request_id = ? AND user_id = ?").run(requestId, user.id);
    db.prepare("UPDATE requests SET upvote_count = MAX(0, upvote_count - 1) WHERE id = ?").run(requestId);
  } else {
    db.prepare("INSERT INTO request_upvotes (request_id, user_id, created_at) VALUES (?, ?, ?)").run(
      requestId,
      user.id,
      new Date().toISOString(),
    );
    db.prepare("UPDATE requests SET upvote_count = upvote_count + 1 WHERE id = ?").run(requestId);
  }

  const { count } = db.prepare("SELECT upvote_count AS count FROM requests WHERE id = ?").get(requestId) as {
    count: number;
  };

  revalidatePath("/");
  revalidatePath("/explore");
  revalidatePath(`/requests/${request.slug}`);
  return { ok: true, upvoted: !existing, count: Number(count) };
}

/* ------------------------------------------------------------------ */
/* Creator actions                                                     */
/* ------------------------------------------------------------------ */

const replySchema = z.object({
  message: z.string().trim().min(10, "Add a short note so the learner knows where to start.").max(2000),
  videoUrl: z.string().trim().url("Paste the full video link, e.g. https://youtu.be/xxxxxxxxxxx"),
  videoTitle: z.string().trim().min(4, "Give the lesson a title.").max(140),
  videoLength: z.string().trim().max(20).optional(),
  resources: z.string().trim().max(2000).optional(),
});

export async function postReplyAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return { error: "Only the creator can publish a lesson." };

  const requestId = String(formData.get("requestId") || "");
  const parsed = replySchema.safeParse({
    message: formData.get("message"),
    videoUrl: formData.get("videoUrl"),
    videoTitle: formData.get("videoTitle"),
    videoLength: formData.get("videoLength") || undefined,
    resources: formData.get("resources") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Check the lesson details below.", fieldErrors };
  }

  const video = parseYouTube(parsed.data.videoUrl);
  if (!video) {
    return {
      error: "That doesn't look like a YouTube link.",
      fieldErrors: { videoUrl: "Use a youtube.com/watch?v=… or youtu.be/… link." },
    };
  }

  const db = getDb();
  const request = db
    .prepare("SELECT id, slug, title, created_by, status FROM requests WHERE id = ?")
    .get(requestId) as { id: string; slug: string; title: string; created_by: string; status: string } | undefined;
  if (!request) return { error: "That request no longer exists." };

  const now = new Date().toISOString();
  const resources = (parsed.data.resources ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, url] = line.split("|").map((s) => s.trim());
      return url ? { label: label || url, url } : { label: line, url: line };
    })
    .filter((r) => /^https?:\/\//.test(r.url));

  db.prepare(`
    INSERT INTO replies (id, request_id, kind, message, video_url, video_id, video_title, video_provider, video_length, resources, created_by, created_at)
    VALUES (?, ?, 'external', ?, ?, ?, ?, 'youtube', ?, ?, ?, ?)
  `).run(
    randomUUID(),
    requestId,
    parsed.data.message,
    video.canonical,
    video.id,
    parsed.data.videoTitle,
    parsed.data.videoLength ?? null,
    JSON.stringify(resources),
    user!.id,
    now,
  );

  const wasFulfilled = request.status === "fulfilled";
  db.prepare(
    "UPDATE requests SET status = 'fulfilled', fulfilled_at = COALESCE(fulfilled_at, ?), updated_at = ? WHERE id = ?",
  ).run(now, now, requestId);

  db.prepare(
    "INSERT INTO request_events (id, request_id, kind, from_status, to_status, message, actor, created_at) VALUES (?, ?, 'fulfilled', ?, 'fulfilled', ?, ?, ?)",
  ).run(randomUUID(), requestId, request.status, parsed.data.videoTitle, user!.id, now);

  // Everyone who asked or backed this request hears about it.
  const audience = db
    .prepare(
      `SELECT DISTINCT u.id, u.email, u.name FROM users u
        WHERE u.id = ?
           OR u.id IN (SELECT user_id FROM request_upvotes WHERE request_id = ?)`,
    )
    .all(request.created_by, requestId) as { id: string; email: string; name: string | null }[];

  for (const person of audience) {
    const isOwner = person.id === request.created_by;
    await notify(person.id, {
      requestId,
      kind: "lesson_ready",
      title: isOwner ? "Your lesson is ready 🎉" : "A lesson you backed is ready 🎉",
      body: `${parsed.data.videoTitle} — made in response to “${truncate(request.title, 60)}”.`,
      href: `/tutorials/${request.slug}`,
    });
    await queueEmail({
      requestId,
      to: person.email,
      subject: `${isOwner ? "Your lesson is ready" : "A lesson you backed is ready"}: ${parsed.data.videoTitle}`,
      body: `Hi ${person.name ?? "there"},\n\n${parsed.data.videoTitle} is live.\n\nYou'll recognise the question: “${request.title}”\n\nWatch it here: /tutorials/${request.slug}\n\n${parsed.data.message}\n\n— Elias at iwannalearn`,
    });
  }

  revalidatePath("/");
  revalidatePath("/explore");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath(`/requests/${request.slug}`);
  revalidatePath(`/tutorials/${request.slug}`);

  return {
    ok: true,
    message: wasFulfilled
      ? "Lesson updated and everyone was re-notified."
      : `Published. ${audience.length} ${audience.length === 1 ? "person was" : "people were"} notified.`,
  };
}

const statusSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(["submitted", "under_review", "planned", "in_production", "waitlisted", "fulfilled", "declined"]),
  reason: z.string().trim().max(500).optional(),
});

export async function updateStatusAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return { error: "Only the creator can move requests." };

  const parsed = statusSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { error: "That status change didn't look right." };

  const db = getDb();
  const request = db.prepare("SELECT id, slug, title, created_by, status, visibility FROM requests WHERE id = ?").get(
    parsed.data.requestId,
  ) as { id: string; slug: string; title: string; created_by: string; status: string; visibility: string } | undefined;
  if (!request) return { error: "Request not found." };

  const now = new Date().toISOString();
  db.prepare("UPDATE requests SET status = ?, decline_reason = COALESCE(?, decline_reason), updated_at = ? WHERE id = ?").run(
    parsed.data.status,
    parsed.data.reason ?? null,
    now,
    request.id,
  );

  db.prepare(
    "INSERT INTO request_events (id, request_id, kind, from_status, to_status, message, actor, created_at) VALUES (?, ?, 'status', ?, ?, ?, ?, ?)",
  ).run(randomUUID(), request.id, request.status, parsed.data.status, parsed.data.reason ?? null, user!.id, now);

  const meta = STATUS_META[parsed.data.status as RequestStatus];
  await notify(request.created_by, {
    requestId: request.id,
    kind: "status_change",
    title: `Update on your request: ${meta.learnerLabel}`,
    body: `${truncate(request.title, 70)} — ${meta.blurb}`,
    href: `/requests/${request.slug}`,
  });

  if (parsed.data.status === "declined" && parsed.data.reason) {
    await queueEmail({
      requestId: request.id,
      to: (db.prepare("SELECT email FROM users WHERE id = ?").get(request.created_by) as { email: string }).email,
      subject: `About your request: ${truncate(request.title, 60)}`,
      body: `Hi,\n\nWe can't take this one on, and we'd rather say so clearly than quietly.\n\nReason: ${parsed.data.reason}\n\nIf that's a surprise, reply to this email and we'll talk it through.\n\n— Elias at iwannalearn`,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/requests/${request.slug}`);
  return { ok: true, message: `Moved to “${meta.learnerLabel}”.` };
}

export async function addInternalNoteAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return { error: "Only the creator can add notes." };
  const requestId = String(formData.get("requestId") || "");
  const message = String(formData.get("message") || "").trim();
  if (!message) return { error: "Write a note first." };

  const db = getDb();
  db.prepare(
    "INSERT INTO replies (id, request_id, kind, message, created_by, created_at) VALUES (?, ?, 'internal', ?, ?, ?)",
  ).run(randomUUID(), requestId, message, user!.id, new Date().toISOString());
  db.prepare(
    "INSERT INTO request_events (id, request_id, kind, message, actor, created_at) VALUES (?, ?, 'note', ?, ?, ?)",
  ).run(randomUUID(), requestId, message, user!.id, new Date().toISOString());

  revalidatePath("/admin");
  return { ok: true, message: "Note saved — learners never see this." };
}

export async function togglePriorityAction(requestId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return { error: "Not allowed." };
  const db = getDb();
  db.prepare("UPDATE requests SET priority_flag = 1 - priority_flag WHERE id = ?").run(requestId);
  revalidatePath("/admin");
  return { ok: true };
}

export async function setCapacityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!isCreator(user)) return { error: "Not allowed." };
  const value = Number(formData.get("capacity"));
  if (!Number.isFinite(value) || value < 0 || value > 50) return { error: "Capacity must be between 0 and 50." };
  const db = getDb();
  db.prepare("INSERT INTO settings (key, value) VALUES ('weekly_capacity', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    String(Math.round(value)),
  );
  revalidatePath("/admin");
  return { ok: true, message: "Weekly capacity updated." };
}

/* ------------------------------------------------------------------ */
/* Learner actions                                                     */
/* ------------------------------------------------------------------ */

export async function markNotificationsReadAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  getDb()
    .prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL")
    .run(new Date().toISOString(), user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function submitFeedbackAction(formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to leave feedback." };

  const requestId = String(formData.get("requestId") || "");
  const helpful = String(formData.get("helpful")) === "1" ? 1 : 0;
  const comment = String(formData.get("comment") || "").trim().slice(0, 600);

  const db = getDb();
  db.prepare(`
    INSERT INTO feedback (id, request_id, user_id, helpful, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(request_id, user_id) DO UPDATE SET helpful = excluded.helpful, comment = excluded.comment, created_at = excluded.created_at
  `).run(randomUUID(), requestId, user.id, helpful, comment || null, new Date().toISOString());

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { ok: true, message: helpful ? "Glad it helped — noted." : "Thanks. That tells us what to fix next." };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function uniqueSlug(base: string): string {
  const db = getDb();
  const root = base || `request-${Date.now()}`;
  let candidate = root;
  let n = 2;
  while (db.prepare("SELECT 1 FROM requests WHERE slug = ?").get(candidate)) {
    candidate = `${root}-${n++}`;
  }
  return candidate;
}

async function notify(
  userId: string,
  input: { requestId?: string; kind: string; title: string; body: string; href?: string },
) {
  getDb()
    .prepare(
      "INSERT INTO notifications (id, user_id, request_id, kind, title, body, href, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(randomUUID(), userId, input.requestId ?? null, input.kind, input.title, input.body, input.href ?? null, new Date().toISOString());
}

/**
 * Email is the retention mechanism, so the write path is real even while the
 * provider is not wired up: every message lands in the `outbox` table and is
 * visible in the creator's outbox screen. Swapping in Resend/Postmark means
 * replacing the body of this function with one API call.
 */
async function queueEmail(input: { requestId?: string; to: string; subject: string; body: string }) {
  getDb()
    .prepare(
      "INSERT INTO outbox (id, request_id, to_email, subject, body, status, provider, created_at) VALUES (?, ?, ?, ?, ?, 'queued', 'stub', ?)",
    )
    .run(randomUUID(), input.requestId ?? null, input.to, input.subject, input.body, new Date().toISOString());
}
