/**
 * Transactional email: templates only, no transport.
 *
 * Rendering is kept in one place so the plain-text and HTML versions can never
 * drift, and so the outbox shows exactly what a provider would send.
 * Delivery lives in lib/notify.ts.
 */

export type EmailTemplate =
  | "login_link"
  | "request_received"
  | "lesson_ready"
  | "status_update"
  | "waitlisted"
  | "promoted"
  | "declined"
  | "receipt"
  | "revision_acknowledged"
  | "delivery_confirmed"
  | "creator_digest"
  | "support_ack";

type Data = Record<string, string | number | boolean | null | undefined> & {
  /** Injected by the delivery layer so every email carries a working opt-out. */
  unsubscribeUrl?: string;
};

const SITE = () => process.env.SITE_URL ?? "http://localhost:3000";

function link(path: string) {
  return `${SITE()}${path.startsWith("/") ? path : `/${path}`}`;
}

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

const SIGN_OFF = "— Elias at iwannalearn";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(
  heading: string,
  paragraphs: string[],
  cta?: { label: string; href: string },
  footnote?: string,
  unsubscribeUrl?: string,
) {
  const body = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#17251f">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  const button = cta
    ? `<p style="margin:22px 0"><a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#0f6b4f;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:15px;font-weight:600">${escapeHtml(cta.label)}</a></p>`
    : "";

  const note = footnote
    ? `<p style="margin:18px 0 0;font-size:12.5px;line-height:1.5;color:#6e7f75">${escapeHtml(footnote)}</p>`
    : "";

  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#fbf7ef;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7dfd0;border-radius:18px;padding:28px">
    <p style="margin:0 0 18px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0f6b4f">iwannalearn</p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#17251f;font-weight:600">${escapeHtml(heading)}</h1>
    ${body}
    ${button}
    ${note}
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e7dfd0;font-size:12.5px;color:#6e7f75">${escapeHtml(SIGN_OFF)}</p>
  </div>
  <p style="max-width:560px;margin:14px auto 0;text-align:center;font-size:11.5px;color:#6e7f75">
    You're getting this because you asked for a lesson.
    <a href="${link("/account")}" style="color:#6e7f75;text-decoration:underline">Manage preferences</a>
    &nbsp;·&nbsp;
    <a href="${String(unsubscribeUrl ?? link("/account"))}" style="color:#6e7f75;text-decoration:underline">Unsubscribe from lesson emails</a>
  </p>
</body></html>`;
}

export function renderEmail(template: EmailTemplate, data: Data): RenderedEmail {
  const name = String(data.name ?? "there");
  const title = String(data.title ?? "your request");
  const unsub = data.unsubscribeUrl;
  /** Local alias so every template gets the same footer without repeating an argument. */
  const w = (
    heading: string,
    paragraphs: string[],
    cta?: { label: string; href: string },
    footnote?: string,
  ) => shell(heading, paragraphs, cta, footnote, unsub);

  switch (template) {
    case "login_link": {
      const url = String(data.url ?? link("/dashboard"));
      return {
        subject: "Your sign-in link",
        text: `Hi ${name},

Here's your one-time sign-in link:

${url}

It works once and expires in 30 minutes. If you didn't ask for it, ignore this email — nobody can sign in without clicking it.

${SIGN_OFF}`,
        html: w(
          "Here's your sign-in link.",
          [
            `Hi ${name},`,
            "Click below and you're in. The link works once and expires in 30 minutes.",
            "If you didn't ask for this, ignore it — nobody can sign in without opening the link.",
          ],
          { label: "Sign in to iwannalearn", href: url },
          "Single use. Time limited. That's the whole password policy.",
        ),
      };
    }

    case "request_received": {
      const path = String(data.path ?? "/dashboard");
      return {
        subject: `We've got your request: ${title}`,
        text: `Hi ${name},

Your request is in.

"${title}"

What happens next:
1. We check the details — usually within two working days.
2. It gets a filming slot.
3. You get an email and an in-app notification the moment the lesson is ready.

Track it any time: ${link(path)}

${SIGN_OFF}`,
        html: w(
          "Your request is in.",
          [
            `Hi ${name},`,
            `We've got it: “${title}”.`,
            "Here's what happens next. We check the details, usually within two working days, and flag anything unclear. Then it gets a filming slot. Then you get this email's better-looking sibling: the one with a video in it.",
          ],
          { label: "Track your request", href: link(path) },
          "You don't need to do anything else. No chasing required.",
        ),
      };
    }

    case "lesson_ready": {
      const path = String(data.path ?? "/dashboard");
      const videoTitle = String(data.videoTitle ?? title);
      const isPrivate = data.private === "1" || data.private === 1 || data.private === true;
      return {
        subject: `${isPrivate ? "Your private lesson is ready" : "Your lesson is ready"}: ${videoTitle}`,
        text: `Hi ${name},

${videoTitle} is live.

${isPrivate ? "This one is private — only you can open it." : "You'll recognise the question: \"" + title + "\""}

Watch it here: ${link(path)}

${String(data.note ?? "")}

${SIGN_OFF}`,
        html: w(
          isPrivate ? "Your private lesson is ready." : "Your lesson is ready.",
          [
            `Hi ${name},`,
            `${videoTitle} is live.`,
            isPrivate
              ? "This lesson was built for you and only you can open it. It isn't published, it isn't indexed, and it won't appear anywhere public."
              : `Made in response to “${title}”.`,
            String(data.note ?? ""),
          ],
          { label: "Watch the lesson", href: link(path) },
          isPrivate ? "Keep the link to yourself — access is tied to your account." : undefined,
        ),
      };
    }

    case "status_update": {
      const path = String(data.path ?? "/dashboard");
      const statusLabel = String(data.statusLabel ?? "updated");
      return {
        subject: `Update on your request: ${statusLabel}`,
        text: `Hi ${name},

"${title}" has moved to: ${statusLabel}.

${String(data.blurb ?? "")}

See the request: ${link(path)}

${SIGN_OFF}`,
        html: w("A small update on your request.", [`Hi ${name},`, `“${title}” has moved to: ${statusLabel}.`, String(data.blurb ?? "")], {
          label: "Open your request",
          href: link(path),
        }),
      };
    }

    case "waitlisted": {
      const path = String(data.path ?? "/dashboard");
      const capacity = String(data.capacity ?? "a few");
      return {
        subject: `You're on the waitlist for: ${title}`,
        text: `Hi ${name},

We're at this week's filming capacity (${capacity} lessons), so your request is on the waitlist rather than silently stuck.

It keeps its place and moves up automatically when a slot opens — you don't need to ask again.

Your request: ${link(path)}

${SIGN_OFF}`,
        html: w(
          "An honest wait, not a silent one.",
          [
            `Hi ${name},`,
            `We cap filming at ${capacity} lessons a week so the videos stay good. That means “${title}” is on the waitlist for now.`,
            "It keeps its place and gets promoted automatically when a slot opens. We'd rather tell you that than let it rot quietly.",
          ],
          { label: "See your place", href: link(path) },
        ),
      };
    }

    case "promoted": {
      const path = String(data.path ?? "/dashboard");
      return {
        subject: `You're off the waitlist: ${title}`,
        text: `Hi ${name},

A slot opened, so "${title}" is now scheduled for filming.

We'll notify you the moment it's live.

${link(path)}

${SIGN_OFF}`,
        html: w("A slot opened.", [`Hi ${name},`, `“${title}” is off the waitlist and scheduled for filming.`], {
          label: "See the request",
          href: link(path),
        }),
      };
    }

    case "declined": {
      const path = String(data.path ?? "/legal/not-covered");
      return {
        subject: `About your request: ${title}`,
        text: `Hi ${name},

We can't take this one on, and we'd rather say so clearly than quietly.

Reason: ${String(data.reason ?? "It falls outside what we can teach responsibly.")}

If that's a surprise, reply to this email and we'll talk it through.

What we don't cover: ${link("/legal/not-covered")}

${SIGN_OFF}`,
        html: w(
          "We're not making this one.",
          [
            `Hi ${name},`,
            `About “${title}”: we can't take it on.`,
            String(data.reason ?? "It falls outside what we can teach responsibly."),
            "If you think we've got that wrong, reply and tell us — we read everything.",
          ],
          { label: "What we don't cover", href: link("/legal/not-covered") },
        ),
      };
    }

    case "receipt": {
      const path = String(data.path ?? "/dashboard");
      return {
        subject: `Receipt: ${title}`,
        text: `Hi ${name},

Payment received for "${title}".

Amount: ${String(data.amount ?? "")}
Tax included: ${String(data.tax ?? "")}
Reference: ${String(data.reference ?? "")}

What happens now: we scope it, film it, and tell you the moment it's ready.

${link(path)}

${SIGN_OFF}`,
        html: w(
          "Payment received.",
          [
            `Hi ${name},`,
            `We've been paid for “${title}”.`,
            `Amount ${String(data.amount ?? "")} (includes ${String(data.tax ?? "")} tax). Reference ${String(data.reference ?? "")}.`,
            `Your ${String(data.windowDays ?? "7")}-day revision window starts when the lesson is delivered.`,
          ],
          { label: "Open your request", href: link(path) },
        ),
      };
    }

    case "revision_acknowledged":
      return {
        subject: `Revision requested: ${title}`,
        text: `Hi ${name},

We've got your revision note and we'll take another pass.

What you asked for: ${String(data.note ?? "")}

${SIGN_OFF}`,
        html: w("Revision noted.", [`Hi ${name},`, "We've got your notes and we'll re-record the parts that missed.", String(data.note ?? "")]),
      };

    case "delivery_confirmed":
      return {
        subject: `Delivery confirmed: ${title}`,
        text: `Thanks ${name} — marked as delivered and closed.

If anything changes, reply to this email and we'll pick it back up.

${SIGN_OFF}`,
        html: w("Closed, and thanks.", [`Thanks ${name},`, "Marked as delivered and closed. If anything changes, reply and we'll pick it up."]),
      };

    case "creator_digest":
      return {
        subject: `Your week: ${String(data.newRequests ?? 0)} new requests`,
        text: `Weekly digest

New requests: ${String(data.newRequests ?? 0)}
Top voted: ${String(data.topVoted ?? "—")}
Delivered: ${String(data.delivered ?? 0)}
Waiting on you: ${String(data.queue ?? 0)}
Median days to delivery: ${String(data.medianDays ?? "—")}

Open the studio: ${link("/admin")}

${SIGN_OFF}`,
        html: w(
          "Your week in the studio.",
          [
            `${String(data.newRequests ?? 0)} new requests this week.`,
            `Top voted: ${String(data.topVoted ?? "—")}.`,
            `${String(data.delivered ?? 0)} delivered, ${String(data.queue ?? 0)} waiting on you.`,
            `Median time to delivery: ${String(data.medianDays ?? "—")} days.`,
          ],
          { label: "Open the studio", href: link("/admin") },
        ),
      };

    case "support_ack":
      return {
        subject: `We got your message`,
        text: `Hi ${name},

Thanks for writing in. We're one person, so give us a working day to reply properly.

Your message: ${String(data.body ?? "")}

${SIGN_OFF}`,
        html: w("Thanks for writing in.", [
          `Hi ${name},`,
          "We're one person, so give us a working day to reply properly.",
          String(data.body ?? ""),
        ]),
      };
  }
}
