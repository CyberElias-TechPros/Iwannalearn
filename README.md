# iwannalearn

> Tell us what you want to learn. We'll help you find it — or make it.

A request-driven learning platform. Learners describe the exact thing they're stuck on; the platform finds an existing lesson, routes them to an identical request they can back, or the creator films a short lesson against that specific goal and notifies them on two channels.

Built from the two source documents in this repository:
[`I wanna learn.pdf`](I%20wanna%20learn.pdf) and
[`Platform Specification & Granular Implementation Roadmap.pdf`](Platform%20Specification%20%26%20Granular%20Implementation%20Roadmap.pdf).

The reconciled, granular plan — including what is built, what is gated, and why — is in **[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)**.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

The database is created and seeded automatically on first request. Reset it any time:

```bash
npm run db:reset
```

Other scripts:

```bash
npm run build        # production build
npm start            # serve the production build
npm run typecheck    # tsc --noEmit
```

No environment variables are required. `SITE_URL` is optional and only affects canonical URLs in the sitemap and metadata.

---

## Try the whole loop in two minutes

1. **Search first.** On the home page, type `sql` — matching lessons and open requests appear before you finish typing.
2. **Sign in.** `/login` → *Enter as a learner* (Amara). No password: this build issues a real session, with the provider stubbed.
3. **Ask.** `/requests/new` → type `python` to see the specificity nudge → continue through four steps → send. Your draft survives a refresh.
4. **Track.** The request page shows a plain-language status timeline and an honest "what happens next".
5. **Fulfil.** Sign out → *Enter as the creator* (Elias) → `/admin` → open the newest request → paste any YouTube link → **Publish & notify**.
6. **Verify the loop.** Sign back in as Amara: the bell has a new notification, `/dashboard` shows "Ready for you", and `/admin/outbox` contains the exact emails that would have been sent (to the requester *and* every upvoter).
7. **Check the privacy boundary.** While signed out, open `/requests/set-up-my-companys-onboarding-sheet-with-our-real-data` — it returns 404. That request is private.

---

## What's built

**Learner**
- Landing page with instant search across lessons and open requests
- Explore with two tabs, search, topic and level filters, all URL-shareable
- Four-step guided request wizard: draft autosave, example-driven prompts, a vague-title nudge, live duplicate matching ("someone already asked this — add your vote"), and a review step
- Request detail: status timeline, the original brief, the lesson player, creator notes, resources, feedback, related requests, share
- Public lesson pages with click-to-load YouTube (nothing third-party loads until you press play), `VideoObject` JSON-LD, sitemap and robots
- "My learning" dashboard: ready lessons first, then in progress, then requests you've backed
- In-app notification bell with unread count

**Creator**
- Cockpit with live metrics, weekly capacity, and learner-feedback score
- Queue sorted by tier → pin → votes → age, filterable and searchable
- Status control with a required reason for declines
- Internal notes, invisible to learners in every query
- Reply composer: validates and canonicalises YouTube links, publishes, flips the request to fulfilled, writes the event log, and notifies the requester plus every upvoter
- Outbox: every notification the product would have sent, rendered verbatim

**Deliberately not enabled** (see gates in the plan)
- Payments — tiers are priced and selectable, but nothing is charged
- Signed-URL private video hosting (unlisted YouTube is not private)
- Real email transport, Google OAuth, fuzzy trigram matching, analytics, rate limiting

---

## Architecture

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 App Router, React 19, TypeScript strict |
| Styling | Tailwind v4 with tokenised theme (`app/globals.css`) |
| Fonts | Fraunces + Instrument Sans, self-hosted (no external CDN) |
| Data | SQLite via Node's built-in `node:sqlite` |
| Auth | Opaque session token in an httpOnly cookie |
| Email | `outbox` table — the write path is real, the transport is stubbed |

Every production dependency is behind a single module, so the migration to Postgres + Prisma + Supabase Auth + Resend is contained:

- reads → `lib/queries.ts`
- writes → `lib/actions.ts`
- schema + seed → `lib/db.ts`
- sessions → `lib/auth.ts`
- email → `queueEmail()` in `lib/actions.ts`

`IMPLEMENTATION_PLAN.md` §4.2 lists every swap point.

---

## Project layout

```
app/            routes (landing, explore, requests, tutorials, dashboard, admin, legal)
components/     UI and feature components
  ui/           button, badge, field, modal, toast, empty state
  admin/        queue board, reply form, status control, capacity
lib/            db, queries, actions, auth, status vocabulary, parsing
data/           local SQLite database (git-ignored, seeded on first run)
scripts/        reset-db
```

## Design notes

- **One vocabulary.** Internal status codes live in `lib/status.ts`; learners only ever read plain language ("Being filmed", "On the waitlist", "Lesson ready").
- **No dead ends.** Every empty state carries one clear action — including "no search results", which offers to turn the failed search into a request.
- **Two channels.** The bell exists so a spam folder can't break the relationship.
- **Accessible by default.** Skip link, landmarks, visible focus, `aria-pressed` votes, `role="alert"` errors, `aria-live` toasts, reduced-motion support, AA contrast, 44px+ targets.
