# iwannalearn — Implementation Plan

**Version 1.0 · 1 November 2026**
Sources: `I wanna learn.pdf` (52 pp, roadmap v2 + master plan) and `Platform Specification & Granular Implementation Roadmap.pdf` (6 pp, technical blueprint).
Companion artefact: the working application in this repository.

---

## 0. How to read this

This document does three jobs:

1. **It reconciles the two PDFs.** They overlap, and in three places they contradict each other. Where they do, a decision is recorded with its rationale (§2.3).
2. **It states exactly what is built today** — not what is planned, not what is sketched. Every claim in §3 was verified by exercising the running application (§3.3).
3. **It gives the remaining work as a granular, gated roadmap** (§6) with acceptance criteria, dependencies and a week-by-week sequence (§10).

Status legend used throughout:

| Mark | Meaning |
| --- | --- |
| ✅ | Built and verified in this repository |
| 🔄 | Partially built — the shape exists, the production dependency does not |
| ⏳ | Next — the immediate queue |
| 📋 | Planned — sequenced but not started |
| 🚫 | Blocked by an explicit gate (§7) |

Effort: **S** < 4 h · **M** ≈ 1 day · **L** 2–3 days · **XL** ≥ 1 week.
Roles: PM · UX · FE · BE · OPS · LEG · CRT (creator ops) · GRW (growth) · QA.

---

## 1. The product in one page

> **Tell us what you want to learn. We'll help you find it — or make it.**

A learner files a request in plain words ("merge two CSVs in pandas without losing headers"). The platform first tries to answer it — from the library, or by routing the learner to an existing request they can back. If it is genuinely new, the creator films a short, specific lesson against that exact goal and publishes it. The learner is notified on two channels, watches, and says whether it helped.

The loop is **Request → Fulfil → Notify → Learn → Retain**, and the plan treats two things as load-bearing:

- **Request quality.** A vague request produces an unusable video. The request form is therefore the highest-leverage product surface, not a formality.
- **Notification reliability.** If the reply never arrives, the loop silently breaks and the learner never returns. Notification is the retention mechanism, not a nice-to-have.

And one existential risk: **the creator is the only fulfilment node**. Unbounded free requests outrun filming capacity within weeks. The plan answers this with three non-optional mechanisms — content reuse, queue transparency and capacity-aware intake — all of which are visible in the product today.

**The three tiers** (one request flow):

| Tier | What you buy | Video fate | Price in this build |
| --- | --- | --- | --- |
| Community | A voice in what gets filmed | Public, reusable forever | Free |
| Priority | Speed — jumps the queue | Public, reusable forever | ₦4,000, **not charged yet** |
| Private | Relevance + confidentiality — built around *your* files | Never published, access-restricted | From ₦25,000, **not charged yet** |

"Private" means exactly one thing and the product says so in one sentence, in the wizard, on the pricing panel and in the FAQ: *a bespoke video of your project or files — not coaching, and not a generic video behind a link.*

---

## 2. What the source documents say

### 2.1 The two documents, in brief

**Document A — `I wanna learn.pdf`** is the product plan: expert scrutiny, a risk register, a three-tier monetisation model, and seven phases (0–7) of tasks with rationale, outcome, dependencies, tooling, acceptance criteria and role. It later restates the same body of work as a 15-phase master plan (Phase 0–14), adds a 10-point MVP release gate, a technology table, a "don't build yet" list, and eight success metrics. Its strongest opinions:

- Do not build until 3+ problem interviews confirm the pain.
- Free public tier first; paid private tier only after the free loop is healthy.
- Unlisted YouTube is *not* private. Paid privacy requires signed URLs.
- Request structure is the single highest-leverage UX decision.

**Document B — `Platform Specification & Granular Implementation Roadmap.pdf`** is the engineering companion: an entity/architecture matrix, a state machine, 18 implementation steps (PH-01.1 → PH-08.2), a Prisma schema, and a video-ingestion routine. Its distinctive additions:

- A fuzzy **deduplication engine** at title-entry time (`pg_trgm`, full-text), so 50 tickets for "React Auth" become one ticket with 50 votes.
- **Multi-channel notification orchestration** (email + web push + SMS/WhatsApp via Twilio/Termii).
- **ISR public watch pages** with Schema.org `VideoObject` for compounding SEO.
- **Tokenised private players** and anti-indexing headers.
- Explicit enum-based status machine enforced at the database level.

### 2.2 Where they agree

1. Public lessons are an asset; private lessons are a service.
2. The creator queue must be a real operational screen, not a mental list.
3. Structured request intake beats free-text tickets.
4. Status transparency is a trust mechanism.
5. Notification must survive a missed email.
6. Payments are a separate product with separate risk — ship them later.
7. Sign-in should be passwordless, and browsing must not require an account.

### 2.3 Where they conflict — and the call made

| # | A says | B says | Decision | Why |
| --- | --- | --- | --- | --- |
| 1 | Supabase (Postgres + Auth + RLS + Realtime + Storage) | Prisma + Neon/Supabase Postgres, NextAuth, R2/S3 presigned uploads | **Postgres + Prisma is the target; the app is written behind a narrow repository layer so either works.** This build runs on SQLite for zero-setup local execution. | The storage decision is reversible and low-stakes; the important thing is that the schema is relational and the queries are isolated. §4.2 lists every swap point. |
| 2 | Notifications: email (Resend/Postmark) + in-app bell | Email + web push + SMS/WhatsApp webhooks | **Email + in-app first; SMS/WhatsApp as a Phase C option, behind the same `notify()` seam.** | Two channels satisfy the reliability requirement. SMS adds cost, compliance and a provider decision that isn't needed to prove the loop. |
| 3 | Phase 7 monetisation gated on Phase 6 metrics | PH-04.1 payment integration is step 5 of 18 | **Monetisation is gated.** Tiers are selectable and priced in the UI, but nothing is charged. | Charging before the free loop is healthy multiplies support load without proving demand. Every pricing surface says "not charged yet", so nobody is misled. |
| 4 | RLS as a hard gate before UI | Role checks in route handlers | **Authorisation is enforced server-side in the data layer today; RLS + a pgTAP suite is a Phase B gate before public launch.** | A single missing RLS policy leaks private requests. The current implementation passes the equivalent behavioural test (private request returns 404 to a non-owner) but that test must become automated. |

---

## 3. What is built today

### 3.1 The running application

A complete, mobile-first product loop on a local-first stack, seeded with a believable workspace: 13 requests across every status, 4 published lessons, votes, notifications, an outbox and an admin queue.

**Learner surfaces**

| Surface | What it does |
| --- | --- |
| `/` | Landing with an instant-search hero (library + open requests), the three-tier explanation, live stats, and a demo entry point. |
| `/explore` | Two tabs — *Ready to watch* and *Open requests* — with search, topic and level filters, all URL-encoded and shareable. |
| `/requests/new` | The **4-step guided wizard**: skill → outcome → level → delivery, with draft autosave, a specificity nudge, live duplicate matching ("someone already asked this — add your vote"), example chips, and a review panel. |
| `/requests/[slug]` | Status timeline in plain language, the original ask, the lesson player once published, the creator's note, resources, feedback, related requests, and a share button. Private requests 404 for anyone but the owner and the creator. |
| `/tutorials/[slug]` | Public, SEO-indexed lesson page with `VideoObject` JSON-LD, click-to-load player (nothing third-party loads until you press play), resources, related lessons. |
| `/dashboard` | "My learning": ready-for-you lessons first, then in-progress with progress bars, requests you've backed, closed requests, and two reassurance cards. |
| `/login` | Passwordless entry: two one-tap demo accounts or an email. |
| `/how-it-works`, `/legal/*` | Plain-language explainer with FAQ, and honest draft policies (privacy, terms, not-covered). |

**Creator surfaces**

| Surface | What it does |
| --- | --- |
| `/admin` | The cockpit: four live metrics, weekly capacity setting, learner-feedback score, and the queue. |
| Queue | Sorted by tier → pin → votes → age; filterable by *needs a decision / in production / private / delivered / everything*; searchable; each row expands into the full brief, status control (with a required reason for decline), internal notes, and the reply composer. |
| Reply composer | Validates and canonicalises YouTube links (watch, `youtu.be`, shorts, live, embed), captures title, length, note and resources, then publishes, flips the request to *fulfilled*, writes the event log, and notifies **the requester plus every upvoter** on both channels. |
| `/admin/outbox` | Every notification the product would have emailed, rendered verbatim. This is the delivery layer made visible and testable while the provider is stubbed. |

### 3.2 Feature matrix

| Capability | State | Note |
| --- | --- | --- |
| Relational schema, enums, indexes, FKs | ✅ | 10 tables; see §4.3 |
| Cookie sessions, roles (learner / creator) | ✅ | httpOnly, SameSite=Lax, 30-day expiry |
| Magic-link email + Google OAuth | 🔄 | Session layer is production-shaped; provider is a stub |
| Guided request intake (5 fields max, helper text) | ✅ | Wizard, Zod validated on the server |
| Duplicate / existing-answer matcher | ✅ | SQLite `LIKE` over title + goal + category, wired to the search API and the wizard |
| Fuzzy/trigram matching (`pg_trgm`) | 📋 | Requires Postgres; current matcher is a substring heuristic |
| Upvotes: unique constraint, atomic counter, optimistic UI | ✅ | Verified: count 11 → 12 with exactly one row |
| Status machine with history | ✅ | 7 states, event log, plain-language labels |
| Creator queue + filters + pin | ✅ | |
| Reply composer + YouTube parsing | ✅ | Verified: parse → reply → fulfil → 4 notifications → 4 outbox rows |
| Internal notes, invisible to learners | ✅ | Enforced in every learner-facing query |
| In-app notification bell + unread count | ✅ | |
| Transactional email | 🔄 | Written to `outbox`; provider swap is one function |
| Email bounce/retry logging | 📋 | Needs a provider webhook |
| Feedback ("did this help?") | ✅ | Feeds the admin score |
| Capacity cap + waitlist | 🔄 | Capacity is configurable and displayed; automatic promotion is manual |
| Private request isolation | ✅ | Verified 404 for non-owner |
| Signed-URL private video (Mux / Cloudflare Stream) | 🚫 | Gate G3 |
| Payments (Stripe / Paystack), entitlements, refunds, tax | 🚫 | Gate G2 |
| SEO: metadata, JSON-LD, sitemap, robots | ✅ | `sitemap.xml` lists public lessons only |
| Analytics + error monitoring | 📋 | |
| Rate limiting, CAPTCHA, abuse controls | 📋 | |
| Attachments (files/screenshots) | 🔄 | A URL field today; presigned uploads are Phase B |
| Automated tests | 📋 | Manual QA script in Appendix D; the loop was exercised end-to-end via HTTP |
| Realtime updates | 📋 | Polling-free bell comes from full server renders |

### 3.3 Verify it in three minutes

```bash
npm install
npm run dev            # http://localhost:3000
```

1. Open `/` and search **"sql"** — a real lesson appears before you finish typing.
2. Click **Enter as a learner** → `/dashboard` → open the ready lesson → press play.
3. Go to **Ask for a lesson** → type `python` → notice the specificity nudge → continue → send.
4. Open the new request: status timeline, "what happens next", share.
5. Sign out → **Enter as the creator** → `/admin` → open the request you just filed → publish any YouTube link → watch the requester's bell and `/admin/outbox` fill in.
6. Try `/requests/set-up-my-companys-onboarding-sheet-with-our-real-data` signed out — it 404s. That is the privacy boundary doing its job.

`npm run db:reset` restores the seeded workspace at any time.

---

## 4. Architecture

### 4.1 Stack as built

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 App Router, React 19, TypeScript strict | Server components keep the board and lesson pages SEO-visible with no client data fetching; server actions remove a whole API surface. |
| Styling | Tailwind v4 with a tokenised theme (`@theme`) | One source of truth for colour, radius, shadow and type; no design drift. |
| Fonts | Fraunces (display) + Instrument Sans (text), self-hosted via `@fontsource` | No external font CDN — works offline, no layout shift, no cookie banner. |
| Data | SQLite via Node's built-in `node:sqlite` | Zero-install, real SQL, real constraints. The schema is Postgres-shaped. |
| Auth | Opaque session token in an httpOnly cookie, sessions table | Production-shaped; the provider swaps in behind `lib/auth.ts`. |
| Validation | Zod, server-side authoritative | Client hints are ergonomics; the server is the contract. |
| Email | Outbox table + renderer | The write path is real; only the transport is stubbed. |

### 4.2 Production swap points

Every production dependency is reachable through one module. This is deliberate: the plan can be executed without rewriting the product.

| Concern | Today | Production | Touch only |
| --- | --- | --- | --- |
| Database | `node:sqlite`, `data/iwannalearn.db` | Postgres (Neon or Supabase) + Prisma migrations | `lib/db.ts`, `lib/queries.ts` |
| Auth | Email → session row | Supabase Auth magic link + Google OAuth | `lib/auth.ts` (`getCurrentUser`, `startSession`, `findOrCreateUser`) |
| Email | `outbox` table | Resend or Postmark, verified domain (SPF + DKIM + DMARC) | `queueEmail()` in `lib/actions.ts` |
| Video (public) | YouTube embed, click-to-load | Unchanged | — |
| Video (private) | Not enabled | Mux or Cloudflare Stream signed playback tokens | New module + `LessonPlayer` branch |
| Payments | Not enabled | Stripe Checkout (international) + Paystack (NGN), webhook-verified | New `lib/payments.ts`, `entitlements`, `payments` tables |
| File attachments | URL field | R2/S3 presigned PUT, MIME allow-list, virus scan | New route handler + storage service |
| Realtime | Server renders | Supabase Realtime or SSE | `NotificationBell` |
| Analytics | Server logs | PostHog (or Plausible) + Sentry | `app/layout.tsx` + instrumentation |

### 4.3 Data model

```
users(id, email, name, role, notify_email, created_at)
sessions(token, user_id, created_at, expires_at)

requests(id, ref, slug, title, goal, tried, context_link, deadline,
         category, level, visibility, tier, status, decline_reason,
         upvote_count, priority_flag, created_by, created_at, updated_at, fulfilled_at)
request_upvotes(request_id, user_id, created_at)      -- PK(request_id, user_id)
request_events(id, request_id, kind, from_status, to_status, message, actor, created_at)
replies(id, request_id, kind, message, video_url, video_id, video_title,
        video_provider, video_length, resources, created_by, created_at, seen_at)
notifications(id, user_id, request_id, kind, title, body, href, read_at, created_at)
feedback(id, request_id, user_id, helpful, comment, created_at)  -- UNIQUE(request_id, user_id)
outbox(id, request_id, to_email, subject, body, status, provider, created_at)
settings(key, value)
```

Differences from the PDF's Prisma sketch, and why:

- `replies.kind` (`external` / `internal`) replaces a separate notes table. One thread, two visibilities, one index — and internal notes are excluded at query level rather than filtered in the view.
- `request_events` is added. The blueprint asks for status history; without an event log, "who moved this and why" is unanswerable.
- `outbox` is added. It is the observational layer for the most critical action in the product.
- `feedback` is added. It closes the quality loop and gives the creator a signal that is not vanity metrics.
- `tier` and `visibility` are separate. Priority is public *and* paid; private is private *and* paid. Collapsing them makes "why can't I see that video?" unanswerable.

### 4.4 The status machine

```
                ┌──────────── declined ◄────────────┐
                │                                   │
submitted ──► under_review ──► planned ──► in_production ──► fulfilled
    │              │              │              │
    └──────────────┴──────► waitlisted ◄─────────┘
```

| Internal | Learner sees | What it means | Who moves it |
| --- | --- | --- | --- |
| `submitted` | Received | In the queue for a first look | system |
| `under_review` | Being checked | Details verified, scope confirmed | creator |
| `planned` | Scheduled | Has a filming slot | creator |
| `in_production` | Being filmed | Being recorded now | creator |
| `waitlisted` | On the waitlist | Over capacity; keeps its place | creator / system |
| `fulfilled` | Lesson ready | Video published | system (on publish) |
| `declined` | Not this time | Won't be made; reason is shown | creator (reason required) |

Invariants enforced in the write path: publishing a lesson always yields `fulfilled` with a `fulfilled_at`; a decline always carries a reason that is shown to the learner and emailed; every transition writes an event.

### 4.5 Who can read what

| Row | Public visitor | Learner (owner) | Learner (other) | Creator |
| --- | --- | --- | --- | --- |
| Public open request | read | read | read | read + write |
| Public fulfilled lesson | read | read | read | read + write |
| Private request | ✗ 404 | read | ✗ 404 | read + write |
| Internal note | ✗ | ✗ | ✗ | read |
| Another learner's email | ✗ | ✗ | ✗ | read (admin only) |
| Outbox | ✗ | ✗ | ✗ | read |

Enforcement today is in the query layer (`visibility = 'public'` in every board/library query; an explicit owner/creator check on the detail route). Phase B replaces this with Postgres RLS **plus a test suite that proves a second user cannot read another's private request or internal note** — a hard gate before public launch.

### 4.6 Notification matrix

| Event | Requester | Upvoters | Creator | Channels |
| --- | --- | --- | --- | --- |
| Request submitted | ✅ confirmation + next steps | — | — | email + bell |
| Moved to review / planned / filming | ✅ quiet update | — | — | bell |
| Waitlisted | ✅ with honest ETA | — | ✅ | email + bell |
| Lesson published | ✅ "your lesson is ready" | ✅ "a lesson you backed is ready" | — | email + bell |
| Declined | ✅ reason + alternative | — | — | email + bell |
| Feedback received | — | — | ✅ (dashboard score) | in-app |

Every email is idempotent per (request, recipient, event) by construction in this build; the provider integration must add an explicit idempotency key before retries are enabled.

---

## 5. What "very easy to use" means here

The brief asks for a product that is easy and friendly. That is not a coat of paint; it is twelve rules, each of which is implemented and testable.

| # | Rule | Where it lives |
| --- | --- | --- |
| 1 | **No jargon.** Users never see "ticket", "SLA", "entity" or "workflow". The word is *request*, the state is a sentence. | `lib/status.ts` holds the only vocabulary |
| 2 | **One clear next action per screen.** Every page ends with a single primary button; empty states carry exactly one. | `EmptyState`, all pages |
| 3 | **Explain every field.** Each input has a helper line saying why it is asked. | Wizard, sign-in, admin reply form |
| 4 | **Coach instead of reject.** A vague title isn't blocked — it earns a nudge with an example rewrite. | `RequestWizard` specificity check |
| 5 | **Prevent duplicate work before it happens.** Matching requests surface *while typing*, with a one-tap "me too". | `SimilarRequests`, `/api/search` |
| 6 | **Never lose the user's words.** The wizard autosaves to `localStorage` and restores with a visible note. | `RequestWizard` |
| 7 | **Show honest state.** A 5-step timeline, plain-language blurbs, and a real "typical wait" line — no fake progress bars. | `StatusTimeline` |
| 8 | **Say what happens next, before it happens.** The wizard's rail and the post-submit panel both spell out the four steps. | `RequestWizard` aside, request detail |
| 9 | **Two channels, always.** The bell exists so a spam folder cannot break the relationship. | `NotificationBell`, `notify()` |
| 10 | **Respect attention.** Nothing third-party loads until asked: YouTube is click-to-load, no tracking scripts, no cookie banner. | `LessonPlayer` |
| 11 | **Mobile first, thumb first.** Bottom tab bar with the ask action in the centre, 44px+ targets, sticky primary actions. | `MobileTabBar`, spacing scale |
| 12 | **Accessible by default.** Semantic landmarks, skip link, visible focus rings, `aria-pressed` on votes, `aria-live` toasts, labelled SVGs, reduced-motion support, AA contrast. | global |

**Accessibility checklist** (verified in code, to be re-verified in QA): keyboard reachable everywhere · focus visible on every interactive element · form errors announced (`role="alert"`) · no colour-only status (every pill has a word) · `prefers-reduced-motion` honoured · fonts self-hosted at 16px base with 1.55 line-height.

---

## 6. The roadmap

Each task carries **why**, **achieves**, **connects to** and **acceptance** — the format the source documents asked for. A task is done when its acceptance criteria pass, not when code exists.

### Phase A — Foundation & the core loop ✅

*Goal: a stranger can learn, ask, vote, track and be notified — unaided, on a phone.*

| ID | Status | Task | Why / achieves | Acceptance |
| --- | --- | --- | --- | --- |
| A1 | ✅ | Relational schema with enums, FKs, indexes | Makes every later feature additive rather than a migration project | Schema applies clean; indexes on status, visibility, votes, owner |
| A2 | ✅ | Cookie sessions + roles | Protects private data and the creator endpoints | Session survives refresh; creator routes reject learners |
| A3 | ✅ | Public board and library with search + filters | Social proof and duplicate reduction | Signed-out read works; filters are URL-shareable |
| A4 | ✅ | Guided 4-step request wizard | Request structure is the highest-leverage quality lever | Submits in < 60 s on mobile; server-side validation with field-level messages |
| A5 | ✅ | Upvote toggle with unique constraint | Defensible demand signal | Double click cannot double-count; count matches DB |
| A6 | ✅ | Status machine + event log + timeline | Trust through transparency | Every transition writes an event visible to the owner |
| A7 | ✅ | Creator queue cockpit | A single daily operational screen | Sorted by tier → pin → votes → age; filters and search |
| A8 | ✅ | Reply composer with YouTube validation | Friction here costs hours every week | Invalid URLs rejected with a clear message; publish in under 60 s |
| A9 | ✅ | Notify requester + all upvoters on publish | The fulfilment payoff | One bell entry and one outbox row per person, verified |
| A10 | ✅ | In-app notification bell | The fallback channel | Unread count accurate; marks read on demand |
| A11 | ✅ | Feedback loop | Closes the quality loop | One tap, comment optional, visible in the studio |
| A12 | ✅ | Private isolation | Legal and trust baseline | Private request 404s for non-owners (verified) |
| A13 | ✅ | SEO: metadata, JSON-LD, sitemap, robots | Compounding acquisition | Lessons indexable; sitemap lists public lessons only |
| A14 | ✅ | Seeded workspace + `db:reset` | An empty database hides layout bugs | 13 requests across all states, 4 lessons, votes, notifications |

### Phase B — Production foundation & trust ⏳

*Goal: the same product on infrastructure that can take real users and real money safely. Exit criterion: RLS tests pass, auth is real, uploads are safe.*

| ID | Status | Task | Why / achieves | Connects to | Effort | Role |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | ⏳ | Provision Postgres (Neon/Supabase), two environments | One managed backend; dev/prod parity | B2–B4 | S | OPS |
| B2 | ⏳ | Port the schema to Prisma and run the seed through it | Removes driver-specific SQL; migrations become reviewable | B3 | M | BE |
| B3 | ⏳ | Replace the SQLite driver behind `lib/db.ts` | Proves the swap-point claim in §4.2 | all | M | BE |
| B4 | ⏳ | RLS policies: public read, own-private read, owner insert, creator bypass | Security by default; one missing policy leaks everything | B5 | M | BE |
| B5 | ⏳ | **RLS test suite** (pgTAP or scripted SQL) — second user cannot read a private request or an internal note | This is a hard gate, not a nice-to-have | G1 | M | QA+BE |
| B6 | ⏳ | Real magic-link auth (Resend) + Google OAuth | Passwordless removes the top signup drop-off | A2 | M | FE+BE |
| B7 | ⏳ | Human-readable auth errors, session refresh, rate-limited link requests | Removes support burden | B6 | S | FE |
| B8 | 📋 | Presigned uploads for screenshots/files (R2 or S3) | Requests about real files need real files | A4 | M | BE |
| B9 | 📋 | MIME allow-list, size cap, EXIF strip, retention rule | Uploads are the largest new attack surface | B8 | S | BE+OPS |
| B10 | 📋 | Automated status-transition tests (unit) | Prevents silent state corruption | A6 | S | QA |
| B11 | 📋 | CI: lint, typecheck, migration dry-run on every PR | Schema drift is the top cause of "works locally" | B1 | M | OPS |
| B12 | 📋 | Account deletion + data export | Promised in the privacy page | A12 | M | BE |

### Phase C — Notification reliability ⏳

*Goal: no reply is ever lost. Exit criterion: an end-to-end test proves reply → delivered email → bell → click-through.*

| ID | Status | Task | Why / achieves | Acceptance | Effort | Role |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | ⏳ | Resend/Postmark integration with a verified domain (SPF, DKIM, DMARC) | Email is the primary return trigger | Inbox placement confirmed in Gmail, Outlook and one mobile client | M | OPS+BE |
| C2 | ⏳ | React Email templates with plain-text alternatives | Renders with images blocked; survives dark mode | Template renders in all three clients | M | FE |
| C3 | ⏳ | Idempotency keys per (request, recipient, event) | Retries must never double-send | Replay produces exactly one message | S | BE |
| C4 | ⏳ | Delivery webhook → `notification_logs`, retry with backoff | You must know when the loop breaks | A forced bounce appears in the admin within 60 s | M | BE |
| C5 | ⏳ | Bounce suppression + "your email is failing" banner in the bell | A dead address must not silently kill a request | Suppressed address shows in-app only | S | BE+FE |
| C6 | 📋 | Weekly creator digest | Demand trends without dashboard-checking | Monday email: new requests, top votes, delivered, median time | S | BE |
| C7 | 📋 | Optional WhatsApp/SMS for "lesson ready" (Termii/Twilio) | Bypasses clogged inboxes | Opt-in, per-user preference honoured, cost logged | M | BE |

### Phase D — Creator operations & reuse 📋

*Goal: fulfilment scales without proportionally more filming. Trigger: queue > 10 active.*

| ID | Status | Task | Why / achieves | Connects to | Effort |
| --- | --- | --- | --- | --- | --- |
| D1 | 📋 | "Reply with an existing lesson" picker | The single biggest creator-load reduction available | A8 | M |
| D2 | 📋 | Searchable lesson library with usage counts | Reuse requires findability | D1 | M |
| D3 | 📋 | Auto-suggest existing lessons *before* a duplicate request is filed | Prevents work rather than absorbing it | A4 | M |
| D4 | 📋 | Capacity-aware intake: overflow auto-waitlists with an emailed estimate; auto-promote on free capacity | Silent backlog destroys trust faster than an honest wait | A7 · C1 | M |
| D5 | 📋 | Scope lock: "new scope = new request" surfaced on paid tiers | Protects the margin | G3 | S |
| D6 | 📋 | Moderation queue for private requests (pending_review before production) | Prohibited categories must never reach filming | A6 | S |
| D7 | 📋 | Creator-side templates: declined reasons, clarification messages | Consistency at volume | A6 | S |

### Phase E — Retention, growth & measurement ⏳

| ID | Status | Task | Why / achieves | Acceptance | Effort |
| --- | --- | --- | --- | --- | --- |
| E1 | ⏳ | Analytics: request start/complete, search-with-no-results, watch start, feedback, 7-day return | You cannot optimise what you don't measure; no PII in payloads | Dashboard shows the funnel; events documented | M |
| E2 | ⏳ | Error monitoring (Sentry) on actions, email, auth | Silent failures kill trust faster than loud ones | Alerts reach a phone | S |
| E3 | ⏳ | Rate limiting + CAPTCHA on submit/upvote/auth | Spam tickets are cheap to send and expensive to triage | 21st submission in an hour is blocked with a human message | M |
| E4 | 📋 | Failed-search → demand capture: a search with no results offers "ask for this" | Turns disappointment into a request | Offer appears on zero-result search | S |
| E5 | 📋 | "Similar open requests" on the detail page | Keeps sessions alive and votes flowing | 3 related shown, own excluded | S |
| E6 | 📋 | Accessibility audit + fixes (screen reader pass, contrast, focus order) | The friendliness claim must hold for keyboard and screen readers | Zero critical findings in a manual pass | M |
| E7 | 📋 | Performance budget: LCP < 2.5 s on 4G, CLS < 0.1, JS < 200 kB on content routes | Slow is unfriendly | Lighthouse ≥ 95 perf/SEO/a11y on `/` and `/tutorials/*` | M |
| E8 | 📋 | Learning paths once ≥ 14 lessons exist | Increases depth without more filming | Path pages ship with 3+ lessons each | L |

### Phase F — Private beta & launch 📋

| ID | Status | Task | Why / achieves | Acceptance |
| --- | --- | --- | --- | --- |
| F1 | 📋 | Invite 20 learners from the waitlist | Controlled environment to catch real bugs | 20 invitees, 10+ requests, 5+ lessons, 3 interviews |
| F2 | 📋 | Seed the library with 8 starter lessons before opening the doors | An empty library reads as a dead product | 8 public lessons at launch |
| F3 | 📋 | Launch checklist (Appendix E) signed off | Prevents launching with a broken loop | All 10 checks pass on production |
| F4 | 📋 | Support inbox + response templates + a 24 h SLA | "Who do I ask?" must have an answer | Reply templates live; inbox monitored |
| F5 | 📋 | Legal review of privacy, terms, not-covered, refund policy | Required before payment | Lawyer sign-off recorded |
| F6 | 📋 | Ops runbook: refund, takedown, leaked private video, provider outage | Recoverability is part of the product | Runbook exists and is rehearsed once |

### Phase G — Monetisation 🚫 (gated)

Gate G2: only after Phase F metrics show a healthy free loop (≥ 70% fulfilment, ≥ 80% helpfulness, 7-day return ≥ 20%).

| ID | Status | Task | Why / achieves | Acceptance | Effort |
| --- | --- | --- | --- | --- | --- |
| G1 | 🚫 | Fixed-price products: Priority (₦4,000) and Private (from ₦25,000) | Quoting adds a whole state machine and support load | Two products live; price and scope text match the policy exactly | M |
| G2 | 🚫 | Stripe Checkout (international) + Paystack (NGN) | Payments must match the operating country's real capabilities | Checkout completes in both test modes; receipts correct | L |
| G3 | 🚫 | Webhook handler: verify signature, idempotent grant, transactional status flip | Never treat a browser redirect as proof of payment | Replayed event grants exactly once; forged event rejected | M |
| G4 | 🚫 | Entitlements + payments tables, RLS on both | Access must be revocable | A refunded user loses access automatically | M |
| G5 | 🚫 | **Signed-URL video hosting** (Mux or Cloudflare Stream) | Unlisted YouTube is not private | A direct URL fails outside an authenticated session; tokens expire | L |
| G6 | 🚫 | Delivery confirmation + 7-day revision window | The primary chargeback defence | Window enforced server-side; one revision included | L |
| G7 | 🚫 | Refund/dispute webhooks → revoke + notify both parties | Must be automatic, not discovered by email | Refund flips entitlement within one webhook | M |
| G8 | 🚫 | Tax (Stripe Tax) + invoices | Cross-border digital sales trigger VAT obligations | Tax lines appear on invoices | M |
| G9 | 🚫 | "What private means" one sentence at checkout | Prevents refund disputes | Copy matches §1 verbatim | S |

### Phase H — Scale 📋

Community creators with revenue share · subject-matter review · course bundles · team/enterprise training · localisation (Pidgin/Yoruba/Hausa/French) · native apps · recommendation engine. **Explicitly deferred** (per Document A): native app, AI recommendation engine, marketplace, live chat, subscriptions, automated video creation, gamification economies.

---

## 7. Hard gates

| Gate | Condition | Blocks |
| --- | --- | --- |
| **G1** | RLS (or equivalent) test suite proves private requests and internal notes are unreadable by a second user | Any public launch |
| **G2** | Free loop is healthy: ≥ 70% fulfilment, ≥ 80% helpfulness, ≥ 20% 7-day return, ≥ 8 lessons | Any payment code |
| **G3** | Signed-URL private hosting live **and** lawyer-reviewed terms published | Accepting money for private lessons |

A gate is not a suggestion. Each one exists because the failure it prevents is expensive and public: a data leak, a chargeback wave, or a paid customer discovering their "private" video is shareable.

---

## 8. Risk register

| Risk | Impact | Mitigation in this build | Remaining work |
| --- | --- | --- | --- |
| Creator queue overload | Trust collapse | Capacity setting + waitlist state + reusable public lessons | Auto-promotion (D4) |
| Email lands in spam | Loop breaks silently | Two channels; bell; outbox visible | Verified domain + bounce logging (C1, C4) |
| Vague requests | Wasted filming hours | Wizard prompts, specificity nudge, examples, duplicate matcher | Clarification template (D7) |
| Duplicate requests | Wasted effort | Live duplicate matching + votes | Trigram matching on Postgres |
| Scope creep on paid work | Margin death | Tier copy + review step | Scope-lock wording at checkout (D5) |
| Prohibited content (medical/legal/financial/hacking) | Legal liability | Not-covered list published and linked from declines; decline reason required | Moderation queue (D6) |
| Chargebacks on custom digital goods | Revenue loss | Feedback + delivery confirmation shape | Revision window + refund terms (G6) |
| Private video leakage | Refund + trust | Private requests never listed | Signed URLs (G5) |
| Sales tax / VAT exposure | Compliance | Pricing in NGN, tax stated as pending | Stripe Tax (G8) |
| Single-operator bus factor | Product stops | Everything is in one runbook-able repo | Ops runbook (F6), second creator (H) |

---

## 9. Metrics

Targets are set after the first 20-user pilot; these are the initial hypotheses.

| Metric | Why it matters | Target |
| --- | --- | --- |
| Request → lesson completion rate | Whether requests actually get fulfilled | ≥ 70% |
| Median time to first response | Whether learners feel acknowledged | ≤ 2 working days |
| Median time to delivery (community) | Whether capacity meets demand | ≤ 10 days |
| Duplicate-avoidance rate (votes on existing ÷ total submissions) | Whether the matcher prevents duplicate filming | ≥ 50% |
| Lesson helpfulness | Whether videos solve the actual problem | ≥ 80% |
| 7-day return rate | Whether the loop retains | ≥ 20% |
| Email delivery / click-through | Whether notifications arrive and are used | ≥ 98% / ≥ 35% |
| Stated-ETA accuracy | Whether the waitlist is honest | ≥ 85% delivered inside the stated window |
| Cost & revenue per private request | Whether paid work is sustainable | Margin positive from the third request |

---

## 10. Six-week sequence

| Week | Focus | Exit criterion |
| --- | --- | --- |
| **0 (now)** | This build + 8–15 interviews + 5 manual requests handled inside the app | Go/no-go; verbatim language for the landing page |
| **1** | Postgres + Prisma port (B1–B3), RLS + test suite (B4–B5) | Gate G1 passes in CI |
| **2** | Real auth (B6–B7), uploads (B8–B9), CI (B11) | A stranger can sign up, upload, and get an RLS-safe request |
| **3** | Email provider + templates + idempotency + bounce logging (C1–C5) | End-to-end test: reply → delivered → bell → click |
| **4** | Analytics, error monitoring, rate limiting, a11y + perf pass (E1–E3, E6–E7) | Dashboard live; Lighthouse ≥ 95; zero critical a11y findings |
| **5** | Private beta with 20 learners (F1–F2, F4), creator reuse tools (D1–D4) | 10 requests, 5 lessons, 3 interviews, first testimonial |
| **6** | Public launch (F3, F5), measure and iterate; begin G-gate preparation | Launch checklist signed; weekly review scheduled |

Monetisation does not begin in week 6. It begins when G2 passes.

---

## 11. Open decisions

The source document lists five questions that must be answered before the paid flow can be specified. Recommended answers below; each can be overturned cheaply **now** and expensively later.

| # | Question | Recommendation | Consequence if changed |
| --- | --- | --- | --- |
| 1 | Is "private" a bespoke video or video + coaching? | **Bespoke video only.** Coaching destroys filming throughput and turns the product into consulting. | Coaching adds calendar tooling, scheduling and a second support model. |
| 2 | Fixed price tiers or per-request quoting? | **Fixed tiers** for v1. Quoting adds a state machine and a support burden before demand is proven. | Quoting needs a quote object, expiry, and acceptance flow. |
| 3 | May private work be re-filmed publicly later? | **Yes — technique only, never user data**, stated in the terms. | Saying no reduces long-term library value. |
| 4 | Launch country and currency? | **Nigeria, NGN**, Paystack primary for local cards/transfers, Stripe for diaspora card payments. Verify settlement and FX before publishing prices. | A US-first launch inverts the provider choice and the refund-law rules. |
| 5 | Prohibited categories? | **Medical, legal, financial advice, hacking, adult content, academic dishonesty** — published now at `/legal/not-covered`. | A narrower list raises liability; a wider one frustrates legitimate requests. |

---

## 12. Appendices

### A. Notification matrix

See §4.6.

### B. SEO plan

- Every public fulfilled request becomes `/tutorials/[slug]`, statically revalidated, with `VideoObject` + `LearningResource` JSON-LD, canonical URL, OG tags, and the learner's question as the H1 context.
- `sitemap.xml` includes public lessons only; `robots.txt` disallows `/admin`, `/dashboard`, `/api`, `/requests`, `/login`.
- Private requests are never rendered publicly, never linked, never in the sitemap, and carry owner-only access.
- Next: per-lesson OG images, breadcrumb schema, internal linking from lessons to related topics, Search Console verification, and a "was this answered?" satisfaction signal in the SERP-facing copy.

### C. Prohibited list (published)

Medical advice · legal advice · financial advice · hacking/credential theft · adult content · academic dishonesty · anything that facilitates harm. Each decline carries a reason and a suggested narrower alternative.

### D. Manual QA script (runs in ~6 minutes)

1. Signed out: board and lesson pages render; vote prompts sign-in and preserves intent.
2. Sign in → wizard → draft survives a refresh → validation blocks a 3-word title → submit → success panel.
3. Status timeline matches the admin status at every step.
4. Duplicate check finds an existing request and "me too" increments the counter exactly once.
5. Creator: publish with a bad URL → clear error; publish with a good URL → learner bell + outbox row within one refresh.
6. Private request 404s signed out and for another learner; 200 for the owner and the creator.
7. Declined request shows the reason and the not-covered link.
8. Feedback appears in the admin score.
9. Keyboard-only pass on the wizard and the queue.
10. Mobile 375 px: bottom tab bar, sticky actions, no horizontal scroll.

### E. Launch checklist (the 10-point gate from Document A)

1. Learner can register, verify and sign in — including recovery.
2. Learner can submit a useful request; validation and ownership are correct.
3. Platform suggests existing answers before a duplicate is filed.
4. Public lessons appear; private content never appears in public results.
5. Creator can review and process a request; status changes are recorded.
6. Creator can attach a lesson; the link is valid and the access claim is accurate.
7. Learner is notified; the link opens the correct request.
8. Learner can watch and give feedback; feedback is stored against the right request.
9. Security boundaries verified — another learner cannot read or modify the request, reply or files.
10. Failures are detectable: email failure, application error and restore-from-backup have all been tested.

### F. File map

```
app/
  page.tsx                     landing + instant search
  explore/                     board + library with URL state
  requests/new/                wizard shell
  requests/[slug]/             request detail, timeline, lesson, feedback
  tutorials/[slug]/            public lesson page + JSON-LD
  dashboard/                   "my learning"
  admin/                       creator cockpit
  admin/outbox/                notification capture
  login/  how-it-works/  legal/[page]/
  api/search/                  instant-search JSON
  sitemap.ts  robots.ts  not-found.tsx
components/
  request-wizard  hero-search  lesson-player  status-timeline
  request-card  lesson-card  upvote-button  feedback-prompt
  admin/{queue-board,reply-form,status-control,capacity-form}
  ui/{button,badge,field,modal,toast,empty-state}
lib/
  db.ts        schema, seed, connection
  queries.ts   all reads (the only place SQL SELECTs live)
  actions.ts   all writes, auth checks, revalidation
  auth.ts      sessions and roles
  status.ts    the single vocabulary
  parse.ts     slugs, YouTube parsing
```

---

## 13. What I would do first, if only one thing

Run eight interviews and file five real requests through this build by hand. The riskiest assumption in both documents is untested: that people will describe a specific stuck moment and wait for a video, rather than searching YouTube for twenty minutes and giving up quietly. Everything in §6 is cheaper to build after that question is answered — and nothing in §6 matters if it isn't.

The product's promise should stay exactly as written on the landing page:

> **Tell us what you want to learn. We'll help you find it — or make it.**
