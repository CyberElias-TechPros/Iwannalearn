# iwannalearn

> Tell us what you want to learn. We'll help you find it — or make it.

A request-driven learning platform. A learner describes the exact thing they're stuck on; the product finds an existing lesson, routes them to a similar request they can back, or the creator films a short lesson against that specific goal and notifies them on two channels.

Public lessons are free forever. Priority buys a place in the queue. Private buys a bespoke video of your own files, delivered through signed, expiring links — never published.

Built from the two source documents in this repository:
[`I wanna learn.pdf`](I%20wanna%20learn.pdf) and
[`Platform Specification & Granular Implementation Roadmap.pdf`](Platform%20Specification%20%26%20Granular%20Implementation%20Roadmap.pdf).

The reconciled, granular plan — what is built, what is gated, what is next and why — is **[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)**.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
npm run smoke        # 27 end-to-end checks (second terminal)
```

The database is created and seeded on first request. Reset it any time:

```bash
npm run db:reset
```

Other scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run build        # production build
npm start            # serve the production build
```

Nothing is required in the environment; everything has a safe default. Copy `.env.example` to `.env` only when you want to switch on a real provider (Paystack/Stripe, Mux/Cloudflare Stream, a cron secret).

---

## Try the whole loop in three minutes

1. **Search first.** On `/`, type `sql` — matching lessons and open requests appear before you finish typing.
2. **Sign in.** `/login` → *Enter as a learner* (Amara). Passwordless: a real single-use link is issued; the transport is stubbed so nothing leaves the machine.
3. **Ask.** `/requests/new` → type `python` to see the specificity nudge → step 3 lets you choose *Private* → send. Your draft survives a refresh.
4. **Pay.** On the request page, press *Continue to secure checkout* → **Pay ₦25,000**. The receipt, entitlement and "Payment confirmed" banner are created server-side by the same `settle()` a webhook would call.
5. **Watch privately.** Press *Open the private player*. The signed link lasts 15 minutes and only works for that account — edit `exp` in the URL and it refuses.
6. **Fulfil.** Sign out → *Enter as the creator* → `/admin` → open a request → paste a YouTube link → **Publish & notify**. The requester *and* every upvoter get one bell entry and one real email (visible in `/admin/outbox`).
7. **Reuse instead of filming.** `/admin/library` → *Send to a request* on an existing lesson → the request is fulfilled in one click, the author credited, reuse count incremented.
8. **Refund.** `/admin/payments` → *Refund* → access is revoked, both parties are notified, the event log records it.
9. **Moderate.** File a request containing "hack into" → `/admin/moderation` shows it flagged with the reason and a one-tap approve/decline.
10. **Check the privacy boundary.** Signed out, open `/requests/set-up-my-companys-onboarding-sheet-with-our-real-data` — it returns **404**. That request is private.

---

## What's built

**Learner**
- Landing with instant search across the library and open requests, live stats, tier explanation
- Explore with two tabs, search, topic and level filters — all URL-shareable
- Four-step wizard: draft autosave, example-driven prompts, a vague-title nudge, live duplicate matching, tier preselection, review
- Request detail: status timeline, brief, public or **private** player, payment panel, delivery confirmation, one included revision, withdraw, feedback, related requests, share
- Public lesson pages: click-to-load YouTube, `VideoObject` JSON-LD, sitemap and robots
- Dashboard: ready lessons (private ones open privately), in-progress with progress bars, **"Waiting on you"** (pay or confirm), backed requests, closed requests
- Pricing with live prices and VAT split; checkout; mock card-free payment
- Account: profile, email/SMS/digest preferences, private entitlements, JSON export, account deletion
- Contact form with acknowledgement and an admin inbox
- Passwordless sign-in: single-use 30-minute links, rate-limited, plus demo accounts

**Creator studio**
- Queue cockpit: pipeline metrics, weekly capacity, feedback score, filters, search, status control with required decline reasons, internal notes, reply composer
- Moderation queue: flagged requests with reason, approve → schedule, decline → reason emailed verbatim
- Library: search what's already filmed, reuse counts, **send an existing lesson to an open request**
- Payments: collected, VAT inside it, refunds that revoke entitlements, mode switch (`off`/`mock`/`live`)
- Analytics: funnel, 14-day chart, median days to delivery, helpfulness, returning learners, top searches and **demand gaps**
- Outbox: every email verbatim (text + HTML), attempts, idempotency key, retry, simulate/clear bounce
- Support inbox, and settings for VAT, revision window, support email and digest day

**Deliberately gated** (see §7 of the plan)
- Live payments — adapters are written; keys and lawyer-reviewed terms are the gate
- CDN playback tokens — signed links work end to end; Mux/Cloudflare swap is one module

---

## Architecture

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 App Router, React 19, TypeScript strict |
| Styling | Tailwind v4 with a tokenised theme (`app/globals.css`) |
| Fonts | Fraunces + Instrument Sans, self-hosted (no external CDN) |
| Data | SQLite via Node's built-in `node:sqlite` (WAL, FKs on) |
| Auth | Single-use magic-link token → opaque session in an httpOnly cookie |
| Email | `outbox` + `notification_logs` — write path real, transport stubbed |
| Money | Integer kobo, VAT-inclusive, provider adapters + verified webhook |
| Private media | HMAC-signed 15-minute, account-bound playback links |

Every production dependency sits behind one module, so the migration to Postgres + Prisma + Resend + Mux is contained:

- reads → `lib/queries.ts`
- writes → `lib/service.ts` (pure) + `lib/actions.ts` (request-aware)
- schema, migrations, seed → `lib/schema.ts`, `lib/db.ts`
- sessions and magic links → `lib/auth.ts`
- email templates and delivery → `lib/email.ts`, `lib/notify.ts`
- payments and providers → `lib/payments.ts`, `lib/providers.ts`, `lib/pricing.ts`
- private playback → `lib/signed-url.ts`

`IMPLEMENTATION_PLAN.md` §4.2 lists every swap point.

---

## Project layout

```
app/            routes: landing, explore, requests, tutorials, watch, dashboard, account,
                pricing, checkout, contact, login, auth, admin/*, api/*, legal
components/     UI + feature components
  ui/           button, badge, field, modal, toast, empty state
  admin/        queue board, reply form, status control, moderation, reuse, payments, settings
  account/      profile form, danger zone
lib/            schema, db, queries, service, actions, auth, notify, email, payments,
                providers, pricing, signed-url, digest, status, parse, types
data/           local SQLite database (git-ignored, seeded on first run)
scripts/        reset-db.mjs, smoke.mjs
```

## Design notes

- **One vocabulary.** Internal statuses live in `lib/status.ts`; learners only read plain language ("Being filmed", "On the waitlist", "Lesson ready").
- **Honest waiting.** Over weekly capacity, a request is waitlisted *and told why*, then promoted automatically when a slot opens. A silent backlog is worse than a queue.
- **Money is never a surprise.** Price, VAT and scope appear before the pay button; nothing is charged at request time; a decline is always free.
- **Private means private.** Signed, expiring, account-bound links; refunds revoke; no unlisted-YouTube theatre.
- **No dead ends.** Every empty state carries one action — including "no results", which offers to turn the failed search into a request.
- **Two channels.** The bell exists so a spam folder can't break the relationship.
- **Accessible by default.** Skip link, landmarks, visible focus, `aria-current` navigation, `aria-live` toasts, labelled icons, reduced motion, AA contrast, 44px+ targets.
