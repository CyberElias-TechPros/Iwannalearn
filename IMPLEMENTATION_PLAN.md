# iwannalearn — Implementation Plan & Build Record

> **What this document is.** Three things in one file: (1) what the source PDFs asked for, (2) what is actually built and running **today**, and (3) the ultra-granular roadmap for everything that remains — each task with *why it exists*, *what it achieves*, *what it connects to*, and *how you know it's done*.
>
> **Status key:** ✅ built and verified · 🔄 built but stubbed/partial · 📋 planned · 🚫 deliberately blocked behind a gate.

**One-line product:** *Tell us what you want to learn. We'll help you find it — or make it.*

**Last verified:** the full loop was exercised over HTTP against the running app on 2026-11-01 — 27/27 smoke checks, `tsc --noEmit` clean.

---

## 0. How to read this

| If you want… | Read |
| --- | --- |
| To see it running in 3 minutes | §3.4 |
| The product argument | §1 |
| What the PDFs said and where they disagree | §2 |
| Exactly what exists now | §3 |
| How it is put together / how to swap the stubs | §4 |
| Why it counts as "easy to use" | §5 |
| The roadmap, task by task | §6 |
| What must be true before charging money | §7 |
| What can go wrong | §8 |
| What to measure | §9 |
| What to do in the next six weeks | §10 |
| Decisions only the owner can make | §11 |
| Reference tables | §12 |

---

## 1. The product in one page

**The loop:** Request → Fulfil → Notify → Learn → Retain.

1. A learner describes the *stuck moment* in plain words ("merge two CSVs in pandas without losing the headers").
2. Before they submit, the product searches what already exists — library first, then open requests. If someone asked the same thing, they add a vote instead of a duplicate.
3. The creator checks it, schedules it, films it, publishes it.
4. Publishing notifies **the requester and every upvoter**, on two channels (bell + email).
5. One question afterwards: *did this solve it?* That answer decides what gets filmed next.

**Three tiers, one flow:**

| Tier | Price | Visibility | What the learner is buying |
| --- | --- | --- | --- |
| Community | Free | Public, reusable | The answer, eventually |
| Priority | ₦4,000 | Public, reusable | **Speed** — a place at the front of the queue |
| Private | from ₦25,000 | Never published | **Exclusivity** — a bespoke video of *their* files |

**The sentence that resolves the client's question in the PDF (p.52):** an *unlisted* video is not private. Public lessons are free and shareable forever; a private lesson is a different artefact — `visibility = 'private'`, served through signed expiring links tied to one account, revocable on refund. That is why private is the only tier that may charge for access, and why priority charges only for time.

---

## 2. What the source documents say

### 2.1 The two documents

- **`I wanna learn.pdf` (52 pp)** — the product vision: a request-driven micro-learning service, three tiers, "payments and confirmation" for private work, WhatsApp/email notifications, a creator queue, and (p.52) an explicit ask for an ultra-granular roadmap that records what is done, what is next, why, and what each step connects to.
- **`Platform Specification & Granular Implementation Roadmap.pdf` (6 pp)** — the engineering spec: schema sketch, phases, roles, launch checklist, prohibited categories.

### 2.2 Where they agree

Request-first intake · creator-owned scarcity · two notification channels · private work treated differently from public · measurement before monetisation · plain language over jargon.

### 2.3 Where they conflict — and the calls made

| Conflict | The call | Why |
| --- | --- | --- |
| Spec says Supabase + Prisma; the vision implies shipping quickly | **SQLite `node:sqlite` today, Postgres + Prisma as the production target**, hidden behind `lib/db.ts` | Zero setup to demo; the swap is one module plus a migration (Phase B) |
| Vision says email + bell; spec says email + SMS | **Bell + email now**, SMS as an opt-in third channel | Two channels already break the single-point-of-failure; SMS costs money per message and needs a provider |
| Spec puts payments in "Phase 7"; the vision asks for payments in the loop | **Payment code is built but gated**: `payments_mode` can be `off`/`mock`/`live` | The money path is verifiable without charging anyone; the gate is a switch, not a missing feature |
| Spec says "RLS before UI" | **Server-side ownership checks today; RLS + a proof suite as gate G1** | One creator and a few hundred learners do not need row-level security to be safe; the queries are already structured for it |

---

## 3. What is built today

### 3.1 The running application

A complete, mobile-first product with **19 tables**, a seeded workspace (18 requests across every status, 9 published lessons, votes, notifications, payments, entitlements, an outbox with real rendered emails), and a creator studio with eight screens.

**Learner surfaces**

| Route | What it does |
| --- | --- |
| `/` | Landing: instant search across library + open requests, three-tier explanation, live stats, demo entry points |
| `/explore` | Two tabs — *Ready to watch* / *Open requests* — search, topic and level filters, all URL-shareable |
| `/requests/new` | 4-step wizard: skill → outcome → level → delivery. Draft autosave, specificity nudge, live duplicate matching, example chips, review panel, tier preselection via `?tier=` |
| `/requests/[slug]` | Status timeline, the ask, the lesson (public player or **signed private player link**), payment panel, delivery confirmation, revision request, withdraw, feedback, related requests, share. Private requests 404 for anyone but owner/creator |
| `/tutorials/[slug]` | Public, indexable lesson page with `VideoObject` JSON-LD and click-to-load player |
| `/watch/[requestId]` | **Private delivery**: signed, 15-minute, account-bound link; four gates before a frame plays; `noindex` |
| `/dashboard` | Ready-for-you lessons (private ones open privately), in-progress with progress bars, **"Waiting on you"** (pay / confirm delivery), backed requests, closed requests |
| `/pricing` | Three tiers with live prices, VAT split, what "private" means, refund and revision terms |
| `/checkout/[reference]` | Scope, amount, VAT, terms, pay; the only place a payment is settled in mock mode |
| `/account` | Profile, phone, email/SMS/digest preferences, private entitlements, data export (JSON), account deletion |
| `/contact` | Support form → stored message + acknowledgement email |
| `/login`, `/login/check`, `/auth/verify` | Passwordless: single-use 30-minute link, demo one-tap accounts |
| `/how-it-works`, `/legal/{privacy,terms,not-covered}` | Explainer with FAQ; honest draft policies including payment and refund terms |

**Creator studio**

| Route | What it does |
| --- | --- |
| `/admin` | Queue cockpit: pipeline metrics, capacity setting, feedback score, full queue with filters, search, status control, internal notes, reply composer |
| `/admin/moderation` | Flagged requests with the reason, one-tap approve-to-schedule or decline-with-reason (the reason is emailed verbatim) |
| `/admin/library` | Every filmed lesson with reuse counts, search, and **"send to a request"** — reuse an existing lesson instead of filming again |
| `/admin/payments` | Collected, VAT within it, refunds, price card, mode switch, refunds with automatic entitlement revocation |
| `/admin/analytics` | Funnel, 14-day chart, median days to delivery, helpfulness, returning learners, top searches and **demand gaps** (zero-result searches, each with "file it") |
| `/admin/outbox` | Every email the app would send, verbatim, plain text + HTML, attempts, idempotency key, retry, simulate bounce, clear bounce |
| `/admin/support` | Messages from the contact form with reply links |
| `/admin/settings` | VAT rate, revision window, support email, digest day, provider state, environment checklist |

### 3.2 Feature matrix

| Capability | State | Evidence / note |
| --- | --- | --- |
| Schema, enums, FKs, indexes | ✅ | 22 tables, additive column migrations in `lib/schema.ts` |
| Cookie sessions, roles | ✅ | httpOnly, SameSite=Lax, 30 days |
| Magic-link auth | ✅ | Single-use, 30-minute, rate-limited (5 / 15 min per email); delivery is the same stubbed transport as email |
| Demo one-tap sign-in | ✅ | Guarded by `DEMO_MODE` |
| Guided intake, server validation | ✅ | Zod, field-level messages, 10 requests/hour/user |
| Duplicate / existing-answer matching | ✅ | Substring over title, goal, category; wired to `/api/search` and the wizard |
| Upvote toggle, atomic count | ✅ | Unique PK, toggle verified |
| Status machine + event log | ✅ | 7 states, every transition writes an event |
| Capacity-aware intake | ✅ | Over capacity → `waitlisted` with an honest email; publishing auto-promotes the top waitlisted request |
| Moderation screen + queue | ✅ | Keyword screen on submit, flag + note stored, creator decision recorded |
| Reply composer | ✅ | YouTube canonicalisation (watch/youtu.be/shorts/live/embed) |
| Lesson reuse | ✅ | `replies.reused_from`, library picker, reuse counts |
| Notify requester + all upvoters | ✅ | Per-person idempotency key; owner and backers get different wording |
| Email templates | ✅ | One template module → plain text + responsive HTML, no drift |
| Idempotent delivery log | ✅ | `notification_logs` with unique `idempotency_key`, attempts, provider status |
| Bounce handling | ✅ | Suppression + in-app-only fallback + "your email is bouncing" banner + admin clear |
| Weekly digest | ✅ | `POST /api/cron/digest` (bearer `CRON_SECRET`), idempotent per week; creator + opted-in learners |
| Payments: mock / Paystack / Stripe adapters | 🔄 | Mock runs the full path; Paystack and Stripe calls are written but need live keys |
| Webhook verification | ✅ | HMAC-SHA256, raw body, constant-time compare, amount check, idempotent settle, replay-safe |
| Entitlements + refunds | ✅ | Paid → grant; refund → revoke + notify both sides + event log |
| VAT + invoice lines | ✅ | 7.5% inclusive, split shown on checkout, receipt and admin |
| Delivery confirmation + revision window | ✅ | One revision, window enforced server-side, confirmation closes the request |
| Private signed delivery | ✅ | HMAC-signed 15-minute URL, account-bound, four gates, `noindex` |
| CDN playback tokens (Mux/Cloudflare) | 🔄 | Same call shape; swap `lib/signed-url.ts` verify + player source |
| Analytics event log | ✅ | `analytics_events` (allow-listed names) + `search_queries` |
| Rate limiting | ✅ | Fixed-window per key: login, submit, vote, support |
| Account export + deletion | ✅ | JSON export; deletion anonymises public history and removes private work |
| Accessibility | 🔄 | Landmarks, skip link, focus rings, `aria-current`, `aria-live`, labelled icons; screen-reader pass still pending |
| Automated tests | ✅ | `npm test` — 39 unit assertions (upload rules, quote gate, signed links, pricing); `npm run smoke` — 41 live checks |
| Quotes: scope + price agreed before payment | ✅ | `quotes` table; creator proposes, learner accepts/declines; `createCheckout` and `settle` both refuse any amount that isn't an accepted quote |
| Learner-initiated refunds | ✅ | `refund_requests`; claim → creator approves/declines → refund + revocation + email |
| Email preferences + unsubscribe | ✅ | `users.notify_email` gates all lesson mail; `critical` mail (sign-in, receipts, quotes) always sends; one-click `/unsubscribe/<token>` |
| Postgres + RLS | 📋 | Phase B; gate G1 |
| File uploads | ✅ | `/api/uploads` with magic-byte validation, 10 MB cap, 5 per request, authenticated download; local disk behind a key so R2/S3 presigned upload is one function |
| Topic hubs | ✅ | `/topics` + `/topics/[slug]`: lessons, open requests, most-wanted list, JSON-LD, in the sitemap |
| Pagination | ✅ | `/explore` pages 24 at a time with real totals — no silent truncation |
| Security headers | ✅ | CSP (no plugins, no cross-origin forms, YouTube-only framing), nosniff, referrer policy, permissions policy, HSTS |
| Error monitoring | ✅ | `error_logs` with digest de-duplication; boundaries report to `/api/errors`; `/admin/health` shows signals + stack |
| CAPTCHA | 📋 | Rate limiting only |

### 3.3 Numbers that are real

- 22 tables; 9 published lessons; 18 seeded requests spanning all seven statuses.
- 1 paid private commission in the seed (`REQ-1018`, ₦25,000, entitlement granted, backfilled accepted quote) so the private path is demonstrable on first run.
- 1 private request quoted at ₦35,000 and awaiting the learner's acceptance (`REQ-1013`) so the agree-then-pay path is one click away.
- 39 unit assertions + 41 smoke assertions; 0 type errors.

### 3.4 Verify it in three minutes

```bash
npm install
cp .env.example .env      # optional — everything has a safe default
npm run dev               # http://localhost:3000
npm run smoke             # in a second terminal: 27 checks
```

Then, by hand:

1. **Search** "sql" on `/` — a real lesson appears before you finish typing.
2. **Enter as a learner** → `/dashboard` → open the ready lesson → play.
3. **Ask for a lesson** → choose *Private* in step 3 → send with an example.
4. On the request page: **"Payment pending"** → *Continue to secure checkout* → **Pay ₦25,000** → you land back with a receipt, an entitlement and a "Payment confirmed" banner.
5. Open the **private player** (signed link) — then copy the URL, wait 15 minutes or edit `exp`, and watch it refuse.
6. **Enter as the creator** → `/admin/payments` → **Refund** → the learner's access is revoked and both parties are notified.
7. `/admin/library` → **Send to a request** on an existing lesson → that request is fulfilled without filming.
8. `/admin/outbox` → open any email → *Simulate bounce* → the address is suppressed and appears under "bounced".
9. File something with "hack into" in it → `/admin/moderation` shows it flagged with the reason.
10. `/requests/set-up-my-companys-onboarding-sheet-with-our-real-data` signed out → **404**. That is the privacy boundary.

`npm run db:reset` restores the seeded workspace.

---

## 4. Architecture

### 4.1 Stack as built

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 App Router, React 19, TypeScript strict | Server components keep private data on the server; server actions keep forms simple |
| Styling | Tailwind v4 + CSS variables | Warm paper `#fbf7ef`, ink `#17251f`, brand `#0f6b4f`, accent `#cf7a1b`; Fraunces + Instrument Sans, self-hosted |
| Data | `node:sqlite` (WAL, foreign keys on) | No service to provision; synchronous, so no N+1 waterfalls |
| Validation | Zod at every write boundary | One schema per action, messages written for humans |
| Media | YouTube click-to-load for public, signed link for private | Nothing third-party loads until asked; no external images in the build |

### 4.2 Swap points (the only files that know about infrastructure)

| Concern | File | Swap to |
| --- | --- | --- |
| Storage | `lib/db.ts` | Postgres + Prisma (`DATABASE_URL`) |
| Schema | `lib/schema.ts` | Prisma migrations; `COLUMN_MIGRATIONS` documents each additive step |
| Queries | `lib/queries.ts` | Same shapes, different driver |
| Writes | `lib/service.ts` + `lib/actions.ts` | Service layer is UI-free and testable |
| Auth | `lib/auth.ts` | Resend magic links + Google OAuth; `findOrCreateUser` + `startSession` stay |
| Email | `lib/notify.ts` (`deliver()`) | Resend or Postmark; `queueEmail()` already dedupes |
| Payments | `lib/providers.ts` | Stripe / Paystack — `settle()` is provider-agnostic and idempotent |
| Private media | `lib/signed-url.ts` | Mux / Cloudflare Stream playback tokens |

### 4.3 Data model (19 tables)

```
users(id, email, name, role, phone, notify_email, notify_via_sms, digest_opt_in,
      email_verified_at, email_bounced_at, created_at)
sessions(token, user_id, created_at, expires_at)
login_tokens(token, email, name, next, consumed_at, expires_at, created_at)

requests(id, ref, slug, title, goal, tried, context_link, deadline, category, level,
         visibility, tier, status, decline_reason, moderation_flag, moderation_note,
         price_kobo, payment_status, revision_state, delivery_confirmed_at,
         upvote_count, priority_flag, created_by, created_at, updated_at, fulfilled_at)
request_upvotes(request_id, user_id, created_at)          -- PK(request_id, user_id)
request_events(id, request_id, kind, from_status, to_status, message, actor, created_at)
replies(id, request_id, kind, message, video_url, video_id, video_title, video_provider,
        video_length, resources, reused_from, created_by, created_at, seen_at)
notifications(id, user_id, request_id, kind, title, body, href, read_at, created_at)
notification_logs(id, outbox_id, provider, channel, status, attempts, last_error,
                  idempotency_key UNIQUE, to_email, subject, created_at, updated_at)
outbox(id, request_id, to_email, subject, body, html, status, provider, created_at)
feedback(id, request_id, user_id, helpful, comment, created_at)  -- UNIQUE(request_id, user_id)
payments(id, request_id, user_id, provider, reference UNIQUE, kind, amount_kobo, tax_kobo,
         currency, status, checkout_url, paid_at, refunded_at, created_at, updated_at)
entitlements(id, user_id, request_id, access_type, granted_at, revoked_at)  -- UNIQUE(user,request)
analytics_events(id, name, user_id, request_id, props, created_at)
search_queries(id, term, results, user_id, created_at)
rate_limits(key PK, window_start, count)
support_messages(id, user_id, email, subject, body, status, created_at)
uploads(id, request_id, user_id, filename, mime, size, storage_key, created_at)
settings(key PK, value)
```

**Decisions that matter:**

- `replies.kind` (`external` / `internal`) instead of a notes table — one thread, two visibilities, filtered at query level.
- `tier` and `visibility` are deliberately separate: priority is public *and* paid; private is private *and* paid. Collapsing them makes "why can't I see that video?" unanswerable.
- Money is **integer kobo**, never floats. `amount_kobo` is what is charged; `tax_kobo` is the portion of it, not an add-on.
- `entitlements` is the access truth; `payments` is the money truth. A refund writes one row each way and neither has to guess.
- `notification_logs` is separate from `outbox` because one is "what we said" and the other is "what happened when we tried".

### 4.4 The status machine

```
                ┌──────────── declined ◄────────────┐
                │                                   │
submitted ──► under_review ──► planned ──► in_production ──► fulfilled
    │              │              │              │
    └──────────────┴──────► waitlisted ◄─────────┘
```

| Internal | Learner sees | Meaning | Moved by |
| --- | --- | --- | --- |
| `submitted` | Received | In the queue for a first look | system |
| `under_review` | Being checked | Details verified; private scopes live here | creator / system |
| `planned` | Scheduled | Has a filming slot | creator / auto-promotion |
| `in_production` | Being filmed | Recording now | creator |
| `waitlisted` | On the waitlist | Over weekly capacity; keeps its place | system / creator |
| `fulfilled` | Lesson ready | Video published | system (publish) |
| `declined` | Not this time | Won't be made; reason shown and emailed | creator (reason required) |

Invariants enforced in the write path (and asserted by `npm run smoke`): publish always sets `fulfilled` + `fulfilled_at`; decline always carries a reason; every transition writes an event; every request has a `created` event; statuses are drawn only from the set above.

### 4.5 Who can read what

| Row | Visitor | Owner | Other learner | Creator |
| --- | --- | --- | --- | --- |
| Public request / lesson | read | read | read | read + write |
| Private request | ✗ 404 | read | ✗ 404 | read + write |
| Private video (`/watch`) | ✗ | signed link only | ✗ | signed link |
| Internal note | ✗ | ✗ | ✗ | read |
| Payment / entitlement | ✗ | own | ✗ | all |
| Outbox, support, analytics | ✗ | ✗ | ✗ | read |

Four gates guard private playback: signed in → token signature and expiry → active entitlement → token bound to *this* viewer. A refund revokes the entitlement, which closes the door even on an unexpired link.

### 4.6 Money flow

```
create request (tier=private)        → status under_review, payment_status none
owner presses "Continue to checkout" → payments(row, pending) + requests.price_kobo
provider page / mock checkout        → learner presses pay
settle(reference)                    → payments.paid  ─┬─► entitlements(grant)
                                                       ├─► receipt email (idempotent)
                                                       └─► bell notification + event
lesson published                     → learner notified, revision window opens
learner confirms / asks revision      → revision_state closed | requested (one only)
creator refunds                      → payments.refunded + entitlement revoked + both notified
```

The webhook is the only place money is ever confirmed: it verifies the signature over the raw body, compares the amount to what was asked for, and calls `settle()`, which is idempotent by reference. A browser redirect never grants anything.

### 4.7 Notification matrix

| Event | Requester | Upvoters | Creator | Channels |
| --- | --- | --- | --- | --- |
| Request submitted | ✅ confirmation + next steps | — | — | email + bell |
| Waitlisted | ✅ honest reason + auto-promotion promise | — | ✅ | email + bell |
| Promoted from waitlist | ✅ | — | — | email + bell |
| Status moved | ✅ quiet update | — | — | bell |
| Lesson published | ✅ "your lesson is ready" | ✅ "a lesson you backed is ready" | — | email + bell |
| Private delivered | ✅ "your private lesson is ready" + signed link | — | — | email + bell |
| Declined | ✅ reason + policy link | — | — | email + bell |
| Payment received | ✅ receipt with VAT line | — | ✅ | email + bell |
| Refund issued | ✅ access closed | — | — | email + bell |
| Revision requested | — | — | ✅ | bell |
| Delivery confirmed | — | — | ✅ | bell |
| Support message | ✅ acknowledgement | — | ✅ | email |

Every email carries a deterministic idempotency key (`received:<id>`, `lesson:<req>:<user>:<video>`, `receipt:<ref>`, `refund:<ref>`, `promoted:<id>`, `digest:<week>`, `login:<token>`), so retries and double-clicks cannot double-send.

---

## 5. What "very easy to use" means here

Fourteen rules, each implemented somewhere a reviewer can point at.

| # | Rule | Where |
| --- | --- | --- |
| 1 | **No jargon.** Never "ticket", "SLA", "workflow". It is a *request*; states are sentences. | `lib/status.ts` |
| 2 | **One primary action per screen.** | every page, `EmptyState` |
| 3 | **Explain every field.** Each input says why it is asked. | wizard, sign-in, admin forms |
| 4 | **Coach, don't reject.** A vague title earns a nudge with an example rewrite. | wizard specificity check |
| 5 | **Prevent duplicate work before it exists.** Matches surface while typing. | `/api/search`, wizard |
| 6 | **Never lose the user's words.** Draft autosaves and restores with a note; it clears only after a successful send. | `RequestWizard` |
| 7 | **Honest state, never fake progress.** Capacity overflow says "waitlist" out loud, and the email says why. | intake, status timeline |
| 8 | **Say what happens next before it happens.** | wizard rail, request page |
| 9 | **Two channels, always.** A spam folder cannot break the relationship. | bell + email |
| 10 | **Respect attention.** Nothing third-party loads until asked; no cookie banner because no trackers. | `LessonPlayer` |
| 11 | **Mobile first, thumb first.** Bottom bar with the ask action centred; 44px targets. | `MobileTabBar` |
| 12 | **Money is never a surprise.** Price, VAT and scope appear before the pay button; nothing is charged at request time. | `/pricing`, checkout, wizard |
| 13 | **Every wait has an end.** Waitlist promises automatic promotion; digest day is stated. | intake, settings |
| 14 | **Accessible by default.** Landmarks, skip link, visible focus, `aria-current`, `aria-live`, labelled icons, reduced motion, AA contrast. | global |

**Accessibility checklist:** keyboard-complete · focus visible · errors announced · no colour-only status · `prefers-reduced-motion` honoured · 16px base, 1.55 line-height · no `aria-hidden` on links · tab-role links replaced with `aria-current` navigation.

---

## 6. The roadmap

Each task carries *why*, *what it achieves*, *connections* and *acceptance*. A task is done when its acceptance criteria pass — not when code exists.

### Phase A — Foundation and the core loop ✅

| ID | Status | Task | Why / achieves | Acceptance |
| --- | --- | --- | --- | --- |
| A1 | ✅ | Relational schema, enums, FKs, indexes | Every later feature is additive, not a rewrite | Schema applies clean; indexes on status, visibility, votes, owner |
| A2 | ✅ | Cookie sessions + roles | Protects private data and creator routes | Session survives refresh; `/admin` redirects non-creators |
| A3 | ✅ | Public board and library with search + filters | Social proof; duplicate reduction | Signed-out read works; filters URL-shareable |
| A4 | ✅ | Guided 4-step wizard | Request structure is the highest-leverage quality lever | Submit in <60 s on mobile; server-side field errors |
| A5 | ✅ | Upvote toggle with unique constraint | Defensible demand signal | Double click cannot double-count |
| A6 | ✅ | Status machine + event log + timeline | Trust through transparency | Every transition writes an event |
| A7 | ✅ | Creator queue cockpit | One daily operating screen | Sorted by tier → pin → votes → age; filters + search |
| A8 | ✅ | Reply composer with YouTube parsing | Friction here costs hours weekly | Invalid URLs rejected clearly; publish <60 s |
| A9 | ✅ | Notify requester + all upvoters | The fulfilment payoff | One bell + one outbox row per person |
| A10 | ✅ | In-app bell | Fallback channel | Unread count accurate |
| A11 | ✅ | Feedback loop | Closes the quality loop | One tap; visible in studio |
| A12 | ✅ | Private isolation | Legal and trust baseline | Private request 404s for non-owners (smoke-asserted) |
| A13 | ✅ | SEO: metadata, JSON-LD, sitemap, robots | Compounding acquisition | Only public lessons in `sitemap.xml` |
| A14 | ✅ | Seed + `db:reset` | Empty databases hide layout bugs | 18 requests, 9 lessons, votes, payments, entitlements |

### Phase B — Production foundation and trust ⏳

*Goal: the same product on infrastructure that can take real users safely. Exit: RLS proof suite passes, auth is real, uploads are safe.*

| ID | Status | Task | Why / achieves | Connects to |
| --- | --- | --- | --- | --- |
| B1 | ⏳ | Provision Postgres (Neon/Supabase), two environments | Managed backend, dev/prod parity | B2–B4 |
| B2 | ⏳ | Port schema to Prisma + run the seed | Reviewable migrations | B3 |
| B3 | ⏳ | Replace the driver behind `lib/db.ts` | Proves the swap-point claim | all |
| B4 | ⏳ | RLS policies: public read, own-private read, owner insert, creator bypass | Security by default | B5 |
| B5 | ⏳ | **RLS test suite** — a second user cannot read a private request or an internal note | Hard gate G1 | G1 |
| B6 | ✅ | Real magic-link auth | Passwordless removes the top signup drop-off | A2 |
| B7 | ✅ | Human-readable auth errors, rate-limited link requests | Removes support burden | B6 |
| B8 | 📋 | Presigned uploads (R2/S3) using `uploads` | Requests about real files need real files | A4 |
| B9 | 📋 | MIME allow-list, size cap, EXIF strip, retention | Uploads are the biggest new attack surface | B8 |
| B10 | ✅ | Automated invariant tests | Prevents silent state corruption | A6 |
| B11 | 🔄 | CI: typecheck + smoke on every PR | Schema drift is the top "works locally" cause | B1 |
| B12 | ✅ | Account deletion + data export | Promised in the privacy page | A12 |

### Phase C — Notification reliability ⏳

| ID | Status | Task | Why / achieves | Acceptance |
| --- | --- | --- | --- | --- |
| C1 | ⏳ | Resend/Postmark with a verified domain (SPF, DKIM, DMARC) | Email is the return trigger | Inbox placement verified in three clients |
| C2 | ✅ | Templates with plain-text alternatives | Works with images blocked | One module produces both |
| C3 | ✅ | Idempotency keys per (request, recipient, event) | Retries never double-send | Replay produces one message |
| C4 | 🔄 | Delivery webhook → `notification_logs`, retries with backoff | You must know when the loop breaks | Forced bounce appears within 60 s (simulated today) |
| C5 | ✅ | Bounce suppression + failing-email banner | A dead address must not silently kill a request | Suppressed address is in-app only |
| C6 | ✅ | Weekly creator digest | Trends without dashboard-checking | Idempotent per week; creator + opted-in learners |
| C7 | 📋 | Optional WhatsApp/SMS for "lesson ready" (Termii/Twilio) | Bypasses clogged inboxes | Opt-in honoured; cost logged |

### Phase D — Creator operations and reuse ✅

| ID | Status | Task | Why / achieves | Acceptance |
| --- | --- | --- | --- | --- |
| D1 | ✅ | "Send an existing lesson" | Biggest available reduction in creator load | Reuse publishes and notifies |
| D2 | ✅ | Searchable library with usage counts | Reuse needs findability | Counts increment on reuse |
| D3 | ✅ | Suggest existing lessons before a duplicate is filed | Prevents work rather than absorbing it | Wizard shows matches while typing |
| D4 | ✅ | Capacity-aware intake + auto-promotion | Silent backlog destroys trust faster than an honest wait | Over capacity → waitlisted email; publish promotes the top of the list |
| D5 | ✅ | Scope lock: "new scope = new request" on paid tiers | Protects the margin | Copy appears on pricing, checkout and request page |
| D6 | ✅ | Moderation queue for flagged requests | Prohibited categories must never reach filming | Flag + reason stored; decision recorded |
| D7 | ✅ | Decline reason templates | Consistency at volume | One-tap reasons, emailed verbatim |

### Phase E — Retention, growth and measurement 🔄

| ID | Status | Task | Why / achieves | Acceptance |
| --- | --- | --- | --- | --- |
| E1 | ✅ | Analytics: searches, zero-results, requests, plays, feedback, return | Cannot optimise what is not measured; no PII | Studio shows funnel + gaps |
| E2 | 📋 | Error monitoring (Sentry) on actions, email, auth | Silent failures kill trust | Alerts reach a phone |
| E3 | 🔄 | Rate limiting | Spam is cheap to send, expensive to triage | 11th request/hour blocked (CAPTCHA still pending) |
| E4 | ✅ | Zero-result search → "file this request" | Turns disappointment into demand | Gaps list links to the wizard |
| E5 | ✅ | Similar requests on detail | Keeps sessions and votes flowing | Three related, own excluded |
| E6 | 🔄 | Accessibility audit | The friendliness claim must hold for keyboards and screen readers | Zero critical findings in a manual pass |
| E7 | 📋 | Performance budget: LCP <2.5 s, CLS <0.1, JS <200 kB | Slow is unfriendly | Lighthouse ≥95 perf/SEO/a11y |
| E8 | 📋 | Learning paths once ≥14 lessons | Depth without more filming | Three paths with 3+ lessons |

### Phase F — Private beta and launch 📋

| ID | Status | Task | Why / achieves |
| --- | --- | --- | --- |
| F1 | 📋 | Invite 20 learners from the waitlist | Controlled environment to find real bugs |
| F2 | 🔄 | Seed the library with 8 starter lessons | 9 exist in seed; they must be real, not placeholders |
| F3 | 📋 | Launch checklist (Appendix E) signed off | Prevents launching with a broken loop |
| F4 | ✅ | Support inbox + acknowledgement | "Who do I ask?" has an answer |
| F5 | 🔄 | Legal review of privacy, terms, refund policy | Required before charging; drafts are written |
| F6 | 📋 | Ops runbook: refund, takedown, leaked private video, provider outage | Recoverability is part of the product |

### Phase G — Monetisation ✅ (built, gated)

The code exists; the *switch* is gated by `payments_mode` and by G1–G3.

| ID | Status | Task | Why / achieves | Acceptance |
| --- | --- | --- | --- | --- |
| G1 | ✅ | Fixed-price products: Priority ₦4,000, Private from ₦25,000 | Quoting adds a state machine and support load | Price and scope copy match policy |
| G2 | 🔄 | Stripe Checkout (international) + Paystack (NGN) | Payments must match the country's real rails | Adapters written; live keys required |
| G3 | ✅ | Webhook: verify signature, idempotent grant, status flip | Never treat a redirect as proof of payment | Replay grants once; forged rejected; amount mismatch 409 |
| G4 | ✅ | `payments` + `entitlements` | Access must be revocable | Refund revokes access automatically |
| G5 | 🔄 | Signed playback for private video | Unlisted YouTube is not private | Expired or foreign link refused (verified) |
| G6 | ✅ | Delivery confirmation + revision window | Primary chargeback defence | Window enforced server-side; one revision |
| G7 | 🔄 | Refund → revoke + notify both parties | Must be automatic, not discovered by email | Implemented locally; provider webhook to wire |
| G8 | 🔄 | VAT + invoice lines | Cross-border digital sales carry VAT obligations | Inclusive VAT split on checkout, receipt, admin; Stripe Tax pending |
| G9 | ✅ | "What private means" at checkout | Prevents refund disputes | Copy matches §1 |

### Phase H — Scale 📋

Community creators with revenue share · subject-matter review · course bundles · team training · localisation (Pidgin/Yoruba/Hausa/French) · native apps · recommendation engine. **Explicitly deferred:** native app, AI recommendations, marketplace, live chat, subscriptions, automated video generation, gamification.

---

## 7. Hard gates

| Gate | Requirement | State |
| --- | --- | --- |
| **G1** | Ownership is *proven*, not assumed: RLS policy suite shows a second user cannot read another's private request, internal note, payment or entitlement | 🔄 App-layer checks pass (smoke asserts the 404). Postgres RLS pending (B4/B5) |
| **G2** | The free loop works before charging: ≥70% fulfilment, ≥80% helpfulness, ≥20% 7-day return, ≥8 lessons | ⏳ Instrumented (studio shows all four); needs 4 weeks of real traffic |
| **G3** | Private charging is safe: signed/expiring playback, revocable access, lawyer-reviewed terms | 🔄 Signed links + revocation done; legal review outstanding (F5) |

**The rule that matters:** money does not switch on because the code is ready. It switches on when G2 says people are already getting what they asked for.

---

## 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| One creator becomes the bottleneck | High | High | Capacity cap + honest waitlist; reuse library; digest shows queue |
| Private video leaks via a forwarded link | Medium | High | Signed 15-min account-bound links; refund revokes; runbook for takedown |
| Payment webhook spoofed or replayed | Medium | High | Signature over raw body, amount check, idempotent settle, event log |
| Refund dispute over scope | Medium | Medium | Written scope before payment; one revision; confirmation closes the request |
| Email lands in spam and the loop silently breaks | Medium | High | Two channels; bounce suppression; admin outbox |
| Prohibited topic reaches filming | Medium | High | Keyword screen + moderation queue with recorded decision |
| SQLite write contention | Low today | Medium | WAL; swap point ready (B3) |
| "Free forever" promise broken by later monetisation | Medium | Medium | Public lessons stay free; only speed and exclusivity are sold |
| Scope creep in the request itself | High | Medium | Specificity nudge, scope lock, decline-with-reason |

---

## 9. Metrics

| Metric | Target | Where it is now |
| --- | --- | --- |
| Request → lesson fulfilment | ≥70% in 14 days | Studio: funnel |
| Helpfulness ("did this solve it?") | ≥80% | Studio: helpfulness % |
| 7-day return | ≥20% | Studio: returning learners |
| Median days to delivery | <7 | Studio: median days |
| Search success | ≥70% of searches return something | Studio: top searches, demand gaps |
| Payment success rate | ≥95% of started checkouts | `/admin/payments` |
| Refund rate | <5% | `/admin/payments` |
| Private access revoked on refund | 100% | Smoke invariant |
| Duplicate requests avoided | count of votes on existing | Request detail |

---

## 10. Six-week sequence

| Week | Focus | Ships |
| --- | --- | --- |
| 0 (done) | The loop | Built app A1–A14, D1–D7, G1/G3/G4/G6/G9 |
| 1 | Interviews + real requests | 8 interviews, 5 real requests, 9 real lessons replacing placeholders |
| 2 | Payments keys + legal | Stripe/Paystack test keys, webhook on a public URL, lawyer review (G3) |
| 3 | Email provider | Resend domain, SPF/DKIM/DMARC, delivery webhook (C1/C4) |
| 4 | Postgres + RLS suite | B1–B5 complete; smoke green on the new driver |
| 5 | Private beta | 20 learners, 5 lessons, 3 interviews (F1) |
| 6 | Decide on charging | Read G2 numbers; turn `payments_mode=live` only if green |

---

## 11. Open decisions

1. **Who owns the naira price?** Priority at ₦4,000 and private from ₦25,000 are assumptions from the PDF. They need a margin test (filming hours × hourly target + revisions).
2. **Revision policy.** One revision is generous for ₦25,000. Keep, or price a second revision?
3. **SMS/WhatsApp.** Worth per-message cost only if email deliverability proves poor in Nigeria.
4. **Public lesson reuse.** If a public lesson answers a private request, may the creator charge for it? Current answer: no — reuse is free and the private fee buys *bespoke work*.
5. **Community creators.** Phase H assumes revenue share; the trust and review model is unwritten.

---

## 12. Appendices

### A. Prohibited list (published at `/legal/not-covered`)

Medical advice · legal advice · investment advice · hacking or credential theft · academic work-for-hire · adult content · anything requiring a third party's data without consent.

### B. SEO plan

Public lessons are the acquisition surface: `VideoObject` JSON-LD, canonical slugs from the request title, `sitemap.xml` listing public lessons only, `robots.txt` excluding `/admin`, `/dashboard`, `/account`, `/checkout`, `/watch`, plus `noindex` on all private surfaces.

### C. Manual QA script (~6 minutes)

1. Search "sql" on `/` → lesson appears.
2. Submit a request as a new user (magic link flow) → lands on the request page with a received confirmation.
3. Submit 5 requests → the 6th over capacity is waitlisted with an honest banner.
4. File a request containing "hack into" → appears in `/admin/moderation` flagged.
5. As creator: schedule it, then decline one with a reason → learner sees the reason.
6. Publish a lesson → requester + upvoters each get one bell entry and one outbox row.
7. `/admin/library` → send an existing lesson to a new request → fulfilled, reuse count +1.
8. Start a private checkout → pay → entitlement granted → open the signed player.
9. Edit `exp` in the URL → refused. Sign out → 404.
10. Refund from `/admin/payments` → access revoked, both notified.
11. `/admin/outbox` → simulate a bounce → address suppressed.
12. `/account` → download data → delete account → sign out clean.

### D. Launch checklist

- [ ] G1 RLS suite green on Postgres
- [ ] G2 free-loop metrics green
- [ ] G3 lawyer-reviewed terms + signed playback
- [ ] Email domain authenticated; delivery webhook live
- [ ] Error monitoring + uptime alerts
- [ ] Backups + tested restore
- [ ] Runbook rehearsed once (refund, takedown, leak, outage)
- [ ] 8 real lessons in the library
- [ ] Analytics dashboards reviewed weekly
- [ ] Support inbox with a 24-hour promise

### E. Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `SITE_URL` | Absolute links in email, sitemap, callbacks | `http://localhost:3000` |
| `DATABASE_FILE` | SQLite path | `data/iwannalearn.db` |
| `PAYMENT_PROVIDER` | `mock` · `paystack` · `stripe` | `mock` |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_WEBHOOK_SECRET` | NGN rails + webhook verification | — |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | International cards + webhook | — |
| `STREAM_SIGNING_SECRET` | Private playback token signing | dev fallback |
| `CRON_SECRET` | Guards `/api/cron/digest` | — |
| `DEMO_MODE` | Shows one-tap demo accounts | `true` |

### F. API surface

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/search` | GET | Library + open-request search, logs the query |
| `/api/payments/webhook` | POST | Provider callback: verify, amount-check, idempotent settle |
| `/api/cron/digest` | POST | Weekly digest (bearer `CRON_SECRET`), idempotent per week |
| `/auth/verify` | GET | Exchanges a single-use login token for a session |

### G. File map

```
app/
  page.tsx  explore/  requests/{new,[slug]}/  tutorials/[slug]/  watch/[requestId]/
  dashboard/  account/  pricing/  checkout/[reference]/  contact/  login/{,check}/  auth/verify/
  admin/{,moderation,library,payments,analytics,outbox,support,settings}/  api/{search,payments/webhook,cron/digest}/
  how-it-works/  legal/[page]/  sitemap.ts  robots.ts  not-found.tsx  error.tsx
components/    ui/ (button, badge, field, modal, toast, empty-state)
  request-wizard · lesson-player · private-player · payment-panel · delivery-actions
  admin/ (queue-board, reply-form, status-control, capacity-form, moderation-decision,
          reuse-form, payment-controls, settings-form, email-actions, admin-nav)
  account/ (profile-form, danger-zone)
lib/
  schema.ts  db.ts  queries.ts  service.ts  actions.ts  types.ts  status.ts  parse.ts
  auth.ts  notify.ts  email.ts  payments.ts  providers.ts  pricing.ts  signed-url.ts
  digest.ts  analytics-client.ts  cn.ts  category-theme.ts
scripts/  reset-db.mjs  smoke.mjs
```

---

## 13. If you only do one thing next

**Run eight interviews and file five real requests into the app you now have.**

Everything above is ready for that: the wizard takes 30 seconds, the studio tells you what to film, publishing notifies everyone, and the private path is verifiable end to end. What the build cannot tell you is whether the thing people are stuck on is what you think it is — and that answer changes the roadmap more than any remaining ticket.


---

## Native Android delivery

The Android client in `android/` is a separate native Kotlin/Compose application, not a WebView. It uses the existing server as its system of record through `/api/mobile/v1`.

Implemented native surfaces:

- learner home, topics, explore/search, request detail, lesson detail, learning dashboard, notification inbox;
- native three-step request brief with drafts, file picker, staged uploads, duplicate matching, quote acceptance and owner-only checkout;
- account/profile, notification preferences, sessions, export/deletion, support and legal screens;
- creator Studio with queue, quoting, publishing, revisions, refunds, library, moderation, inbox, insights and settings;
- Media3 playback for direct media, protected private-window flag, YouTube app/browser handoff for public YouTube lessons;
- encrypted bearer session storage, Room public-metadata cache, DataStore preferences/drafts, WorkManager notification polling;
- deep links, App Links confirmation handoff, native unit tests and CI APK build.

Backend additions:

- bearer-authenticated mobile API with server-side DTO allowlists and owner/creator authorization;
- shared web/native request, publishing, status and revision operations;
- idempotency keys for request intake and replies;
- bearer upload authentication without falling back to ambient web cookies after a failed bearer token;
- direct protected-media publishing and an entitlement-checked range-stream proxy;
- Android login-token handoff and configurable assetlinks endpoint.

Important production boundaries:

- WorkManager polling is not instant push; add FCM if instant notifications are required.
- Offline support caches metadata, not complete video files or server operations.
- Public YouTube playback uses the YouTube app/browser because the native YouTube Player API is deprecated.
- Private delivery requires protected direct HTTPS media and `STREAM_SIGNING_SECRET`/`STREAM_ALLOWED_HOSTS`; unlisted YouTube is rejected for new private lessons.
- Live payments/email/media hosting, legal review, release signing, Play data-safety/account-deletion requirements and device QA remain deployment gates. The current live refund adapter is not a provider refund API integration.
