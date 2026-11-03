import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { SCHEMA, COLUMN_MIGRATIONS, EXTRA_INDEXES, DEFAULT_SETTINGS } from "./schema";

/**
 * Storage layer.
 *
 * The blueprint targets PostgreSQL (Neon/Supabase) with Prisma. To keep this
 * build runnable anywhere with zero external services, the same relational
 * model is implemented on SQLite via Node's built-in driver (`prisma/schema.prisma`
 * mirrors it for the Postgres port). Reads live in lib/queries.ts, writes in
 * lib/service.ts — so the driver swap is contained.
 */

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_FILE ?? path.join(DB_DIR, "iwannalearn.db");

type Store = { db: DatabaseSync };

const globalForDb = globalThis as unknown as { __iwlStore?: Store };

function nowIso(offsetDays = 0, offsetHours = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  d.setHours(d.getHours() - offsetHours);
  return d.toISOString();
}

function connect(): DatabaseSync {
  const dir = path.dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

function applyColumnMigrations(db: DatabaseSync) {
  for (const migration of COLUMN_MIGRATIONS) {
    const columns = db.prepare(`PRAGMA table_info(${migration.table})`).all() as { name: string }[];
    if (!columns.some((column) => column.name === migration.column)) {
      db.exec(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.ddl}`);
    }
  }
}

/**
 * Requests that were already paid for before quotes existed keep working:
 * their payment becomes an accepted quote for the exact amount charged, so the
 * payment gate has a truthful record for them instead of refusing to settle.
 */
function backfillQuotes(db: DatabaseSync) {
  db.exec(`
    INSERT INTO quotes (id, request_id, amount_kobo, currency, scope, deliverables, turnaround_days, revisions,
                        status, proposed_by, proposed_at, accepted_at)
    SELECT 'qt_backfill_' || p.reference, p.request_id, p.amount_kobo, 'NGN',
           'Scope as delivered under payment ' || p.reference || '.',
           NULL, NULL, 0, 'accepted', p.user_id, p.created_at, p.paid_at
    FROM payments p
    WHERE p.status = 'paid'
      AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.request_id = p.request_id)
  `);
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

type SeedReply = {
  message: string;
  videoUrl: string;
  videoId: string;
  videoTitle: string;
  videoLength: string;
  resources?: { label: string; url: string }[];
  ageDays: number;
};

type SeedRequest = {
  ref: string;
  slug: string;
  title: string;
  goal: string;
  tried?: string;
  deadline?: string;
  category: string;
  level: "new" | "some" | "confident";
  status: string;
  upvotes: number;
  owner: string;
  ageDays: number;
  visibility?: "public" | "private";
  tier?: "community" | "priority" | "private";
  declineReason?: string;
  payment?: { amountKobo: number; taxKobo: number; paidDaysAgo: number };
  reply?: SeedReply;
};

const SEED_USERS = [
  { id: "usr_amara", email: "amara@example.com", name: "Amara O.", role: "learner" },
  { id: "usr_tunde", email: "tunde@example.com", name: "Tunde B.", role: "learner" },
  { id: "usr_zara", email: "zara@example.com", name: "Zara K.", role: "learner" },
  { id: "usr_kola", email: "kola@example.com", name: "Kola A.", role: "learner" },
  { id: "usr_ife", email: "ifeoma@example.com", name: "Ifeoma N.", role: "learner" },
  { id: "usr_creator", email: "hello@iwannalearn.app", name: "Elias", role: "creator" },
];

const SEED_REQUESTS: SeedRequest[] = [
  {
    ref: "REQ-1001",
    slug: "understand-what-a-neural-network-actually-is",
    title: "Understand what a neural network actually is before my course starts",
    goal: "Explain in plain words how a neural network learns, so I don't feel lost in week one of my ML course.",
    tried: "Read two blog posts and a Wikipedia page. The maths notation loses me.",
    category: "AI tools",
    level: "new",
    status: "fulfilled",
    upvotes: 42,
    owner: "usr_tunde",
    ageDays: 21,
    reply: {
      message:
        "Here's the visual explanation I wish I'd had. Watch it once without pausing, then a second time with a pen — the last three minutes are the part that makes it click.",
      videoUrl: "https://www.youtube.com/watch?v=aircAruvnKk",
      videoId: "aircAruvnKk",
      videoTitle: "What a neural network actually is, visually",
      videoLength: "19 min",
      resources: [{ label: "One-page summary of the terms used", url: "https://example.com/nn-glossary" }],
      ageDays: 16,
    },
  },
  {
    ref: "REQ-1002",
    slug: "learn-enough-sql-to-query-our-company-database",
    title: "Learn enough SQL to query our company database without asking for a favour",
    goal: "Write my own SELECT queries with joins and filters so I can pull weekly numbers myself.",
    tried: "I can copy queries from colleagues but I can't change them without breaking them.",
    category: "Data & Python",
    level: "some",
    status: "fulfilled",
    upvotes: 31,
    owner: "usr_amara",
    ageDays: 18,
    reply: {
      message:
        "This is the clearest zero-to-useful SQL walkthrough I know. Focus on sections 2–4 — joins and filtering is 90% of the queries you'll write at work.",
      videoUrl: "https://www.youtube.com/watch?v=HXV3zeQKqGY",
      videoId: "HXV3zeQKqGY",
      videoTitle: "Enough SQL to be dangerous at work",
      videoLength: "4h 20m",
      resources: [{ label: "Practice: 12 sample queries on a fake shop database", url: "https://example.com/sql-practice" }],
      ageDays: 12,
    },
  },
  {
    ref: "REQ-1003",
    slug: "friendly-tour-of-python-for-automating-reports",
    title: "A friendly tour of Python so I can automate my monthly reports",
    goal: "Open a CSV, clean it, and save a summary sheet — without touching a spreadsheet by hand.",
    tried: "Watched half of a 10-hour course and forgot everything.",
    category: "Data & Python",
    level: "new",
    status: "fulfilled",
    upvotes: 27,
    owner: "usr_zara",
    ageDays: 15,
    reply: {
      message:
        "Start here. It's long, but the first 90 minutes cover everything you need for your report task. Then jump straight to the project section.",
      videoUrl: "https://www.youtube.com/watch?v=rfscVS0vtbw",
      videoId: "rfscVS0vtbw",
      videoTitle: "Python for beginners — a guided tour",
      videoLength: "4h 26m",
      resources: [{ label: "Starter CSV and notebook", url: "https://example.com/python-report-starter" }],
      ageDays: 10,
    },
  },
  {
    ref: "REQ-1004",
    slug: "javascript-basics-to-rebuild-my-portfolio-site",
    title: "JavaScript basics so I can rebuild my portfolio site myself",
    goal: "Add a filterable project gallery and a working contact form without copying code I don't understand.",
    category: "Web development",
    level: "new",
    status: "fulfilled",
    upvotes: 19,
    owner: "usr_kola",
    ageDays: 30,
    reply: {
      message: "Watch this end to end, then rebuild your gallery before the contact form. Repetition is the whole trick.",
      videoUrl: "https://www.youtube.com/watch?v=PkZNo7MFNFg",
      videoId: "PkZNo7MFNFg",
      videoTitle: "JavaScript basics, end to end",
      videoLength: "3h 26m",
      resources: [],
      ageDays: 24,
    },
  },
  {
    ref: "REQ-1005",
    slug: "design-professional-flyer-in-canva-for-my-mums-shop",
    title: "Design a professional flyer in Canva for my mum's shop",
    goal: "Make a one-page flyer that looks like a designer made it, ready to print on A5.",
    tried: "I made one in Canva already, but it looks cluttered and the text is hard to read.",
    category: "Design & Canva",
    level: "new",
    status: "in_production",
    upvotes: 24,
    owner: "usr_zara",
    ageDays: 9,
  },
  {
    ref: "REQ-1006",
    slug: "automate-weekly-excel-reports-without-breaking-macros",
    title: "Automate weekly Excel reports without the macros breaking every Monday",
    goal: "One click turns raw exports into the summary my manager expects, every week.",
    tried: "Recorded macros that stop working when the file name changes.",
    category: "Spreadsheets",
    level: "some",
    status: "planned",
    upvotes: 18,
    owner: "usr_kola",
    ageDays: 7,
  },
  {
    ref: "REQ-1007",
    slug: "fix-permission-denied-when-installing-npm-packages",
    title: "Fix 'permission denied' every time I install npm packages",
    goal: "Install packages without sudo, and understand why the error happens so I can fix it myself next time.",
    tried: "Ran it with sudo once and now things are worse.",
    category: "Web development",
    level: "some",
    status: "under_review",
    upvotes: 15,
    owner: "usr_amara",
    ageDays: 4,
  },
  {
    ref: "REQ-1008",
    slug: "edit-phone-video-for-instagram-reels-without-looking-amateur",
    title: "Edit phone-shot video for Instagram Reels without it looking amateur",
    goal: "Cut, caption and colour a 30-second clip on my phone that looks intentional, not shaky.",
    tried: "CapCut tutorials that assume I already know what a keyframe is.",
    category: "Video & content",
    level: "new",
    status: "submitted",
    upvotes: 13,
    owner: "usr_tunde",
    ageDays: 3,
  },
  {
    ref: "REQ-1009",
    slug: "use-chatgpt-for-product-descriptions-that-dont-sound-robotic",
    title: "Use ChatGPT to write product descriptions that don't sound robotic",
    goal: "A repeatable prompt I can reuse for 40 products without them all sounding the same.",
    tried: "Generic prompts that produce the same three sentences every time.",
    category: "AI tools",
    level: "some",
    status: "submitted",
    upvotes: 11,
    owner: "usr_amara",
    ageDays: 2,
  },
  {
    ref: "REQ-1010",
    slug: "build-a-no-code-landing-page-for-my-side-business",
    title: "Build a simple no-code landing page for my side business",
    goal: "Publish a page with a photo, three benefits and a WhatsApp button — no developer needed.",
    tried: "Started on three different builders and abandoned all of them.",
    category: "Web development",
    level: "new",
    status: "waitlisted",
    upvotes: 22,
    owner: "usr_kola",
    ageDays: 12,
  },
  {
    ref: "REQ-1011",
    slug: "learn-enough-figma-to-hand-off-designs-to-a-developer",
    title: "Learn enough Figma to hand designs to a developer without a video call",
    goal: "Set up frames, styles and components so a developer can build from my file alone.",
    tried: "I design in Figma but everything is loose shapes on one page.",
    category: "Design & Canva",
    level: "some",
    status: "submitted",
    upvotes: 8,
    owner: "usr_zara",
    ageDays: 6,
  },
  {
    ref: "REQ-1012",
    slug: "best-stocks-to-invest-my-savings-in-this-month",
    title: "Tell me the best stocks to put my savings into this month",
    goal: "I want a specific list I can buy today.",
    category: "Other",
    level: "new",
    status: "declined",
    upvotes: 2,
    owner: "usr_tunde",
    ageDays: 11,
    declineReason:
      "We don't give investment or financial advice — it's on our not-covered list. Try a request about reading a company's financial statements instead; that's a skill we can teach well.",
  },
  {
    ref: "REQ-1013",
    slug: "set-up-my-companys-onboarding-sheet-with-our-real-data",
    title: "Set up our onboarding tracker the way our team actually works",
    goal: "A working tracker built around our real columns, with a short walkthrough of how to maintain it.",
    tried: "Templates that don't match how we hand off work.",
    category: "Spreadsheets",
    level: "confident",
    status: "in_production",
    upvotes: 0,
    owner: "usr_ife",
    ageDays: 5,
    visibility: "private",
    tier: "private",
    deadline: "Needed before the new hires start next month",
  },

  /* ---- starter library (keeps the product from feeling empty on day one) ---- */
  {
    ref: "REQ-1014",
    slug: "write-my-first-web-page-and-understand-the-tags",
    title: "Write my first web page and understand what each tag actually does",
    goal: "Build a one-page site from scratch and be able to explain every tag I used.",
    tried: "Copied a template, changed the text, broke the layout.",
    category: "Web development",
    level: "new",
    status: "fulfilled",
    upvotes: 36,
    owner: "usr_ife",
    ageDays: 44,
    reply: {
      message:
        "Follow along while typing — don't copy-paste. The part that matters is section 3, where headings, lists and links are explained rather than demonstrated.",
      videoUrl: "https://www.youtube.com/watch?v=kUMe1FH4CHE",
      videoId: "kUMe1FH4CHE",
      videoTitle: "HTML from zero: every tag you'll actually use",
      videoLength: "4h 07m",
      resources: [{ label: "The one-page reference used in the video", url: "https://example.com/html-reference" }],
      ageDays: 38,
    },
  },
  {
    ref: "REQ-1015",
    slug: "make-my-page-look-decent-without-a-framework",
    title: "Make my page look decent without pulling in a whole framework",
    goal: "Understand spacing, type and layout well enough to style a page by hand.",
    category: "Web development",
    level: "some",
    status: "fulfilled",
    upvotes: 23,
    owner: "usr_kola",
    ageDays: 52,
    reply: {
      message:
        "Twenty minutes, no framework. Pay attention to the flexbox section around 8:00 — that's the bit that stops everything looking cramped.",
      videoUrl: "https://www.youtube.com/watch?v=1PnVor36_40",
      videoId: "1PnVor36_40",
      videoTitle: "CSS that makes a page look intentional",
      videoLength: "20 min",
      resources: [],
      ageDays: 46,
    },
  },
  {
    ref: "REQ-1016",
    slug: "stop-being-scared-of-git-branches-and-merges",
    title: "Stop being scared of git branches and merges",
    goal: "Create a branch, make a change, open a pull request and resolve one conflict without panicking.",
    tried: "Only ever committing to main and hoping.",
    category: "Career & productivity",
    level: "new",
    status: "fulfilled",
    upvotes: 29,
    owner: "usr_tunde",
    ageDays: 60,
    reply: {
      message:
        "Watch the first hour, then break a branch on purpose in a throwaway repo. The conflict section starts at 41:00 — replay it until it's boring.",
      videoUrl: "https://www.youtube.com/watch?v=RGOj5yH7evk",
      videoId: "RGOj5yH7evk",
      videoTitle: "Git and GitHub without the fear",
      videoLength: "1h 08m",
      resources: [{ label: "Practice repo you can safely break", url: "https://example.com/git-playground" }],
      ageDays: 54,
    },
  },
  {
    ref: "REQ-1017",
    slug: "learn-javascript-properly-instead-of-gluing-snippets",
    title: "Learn JavaScript properly instead of gluing snippets together",
    goal: "Understand functions, arrays and events well enough to build a small feature without a tutorial open.",
    tried: "Six half-finished courses.",
    category: "Web development",
    level: "some",
    status: "fulfilled",
    upvotes: 17,
    owner: "usr_ife",
    ageDays: 68,
    reply: {
      message:
        "This is the one that finally made events click for me. Build the small to-do app he sketches in the last chapter — that's where it sticks.",
      videoUrl: "https://www.youtube.com/watch?v=W6NZfCO5SIk",
      videoId: "W6NZfCO5SIk",
      videoTitle: "JavaScript that finally sticks",
      videoLength: "48 min",
      resources: [],
      ageDays: 61,
    },
  },

  /* ---- a completed private commission, to show the paid delivery path ---- */
  {
    ref: "REQ-1018",
    slug: "team-branch-and-review-workflow-for-our-repo",
    title: "Set up a branch and review workflow that fits our four-person team",
    goal: "A repo setup with branch protection, a pull-request template and a short walkthrough of the daily loop.",
    tried: "Everyone commits to main; we've already lost work once.",
    category: "Career & productivity",
    level: "some",
    status: "fulfilled",
    upvotes: 0,
    owner: "usr_amara",
    ageDays: 20,
    visibility: "private",
    tier: "private",
    payment: { amountKobo: 2_500_000, taxKobo: 0, paidDaysAgo: 24 },
    reply: {
      message:
        "Recorded against your actual repo. Start at 2:10 where the branch protection rules go in; the daily loop is the last four minutes. The pull-request template is in your repo under .github/.",
      videoUrl: "https://www.youtube.com/watch?v=RGOj5yH7evk",
      videoId: "RGOj5yH7evk",
      videoTitle: "Your team's branch and review workflow",
      videoLength: "14 min",
      resources: [{ label: "Pull-request template we set up together", url: "https://example.com/pr-template" }],
      ageDays: 18,
    },
  },
];

const SEED_UPVOTERS = [
  ["REQ-1001", ["usr_amara", "usr_zara", "usr_kola"]],
  ["REQ-1002", ["usr_tunde", "usr_kola"]],
  ["REQ-1005", ["usr_amara", "usr_tunde", "usr_kola"]],
  ["REQ-1006", ["usr_amara", "usr_zara"]],
  ["REQ-1007", ["usr_tunde", "usr_zara", "usr_kola"]],
  ["REQ-1008", ["usr_amara", "usr_zara"]],
  ["REQ-1010", ["usr_amara", "usr_tunde", "usr_zara"]],
  ["REQ-1014", ["usr_amara", "usr_tunde", "usr_zara"]],
  ["REQ-1016", ["usr_amara", "usr_zara"]],
] as const;

function seed(db: DatabaseSync) {
  const insertUser = db.prepare(
    "INSERT INTO users (id, email, name, role, notify_email, created_at, email_verified_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
  );
  for (const user of SEED_USERS) insertUser.run(user.id, user.email, user.name, user.role, nowIso(40), nowIso(40));

  const insertRequest = db.prepare(`
    INSERT INTO requests (
      id, ref, slug, title, goal, tried, deadline, category, level, visibility, tier, status,
      decline_reason, payment_status, price_kobo, upvote_count, created_by, created_at, updated_at, fulfilled_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertReply = db.prepare(`
    INSERT INTO replies (
      id, request_id, kind, message, video_url, video_id, video_title, video_provider,
      video_length, resources, created_by, created_at
    ) VALUES (?, ?, 'external', ?, ?, ?, ?, 'youtube', ?, ?, ?, ?)
  `);
  const insertEvent = db.prepare(`
    INSERT INTO request_events (id, request_id, kind, from_status, to_status, message, actor, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertUpvote = db.prepare(
    "INSERT OR IGNORE INTO request_upvotes (request_id, user_id, created_at) VALUES (?, ?, ?)",
  );
  const insertPayment = db.prepare(`
    INSERT INTO payments (id, request_id, user_id, provider, reference, kind, amount_kobo, tax_kobo, currency, status, paid_at, created_at, updated_at)
    VALUES (?, ?, ?, 'mock', ?, 'private', ?, ?, 'NGN', 'paid', ?, ?, ?)
  `);
  const insertEntitlement = db.prepare(`
    INSERT INTO entitlements (id, user_id, request_id, access_type, granted_at) VALUES (?, ?, ?, 'private', ?)
  `);
  const insertQuote = db.prepare(`
    INSERT INTO quotes (id, request_id, amount_kobo, currency, scope, deliverables, turnaround_days, revisions, status, proposed_by, proposed_at)
    VALUES (?, ?, ?, 'NGN', ?, ?, ?, 1, 'proposed', 'usr_creator', ?)
  `);
  const insertNotificationLog = db.prepare(`
    INSERT INTO notification_logs (id, outbox_id, provider, channel, status, attempts, idempotency_key, to_email, subject, created_at, updated_at)
    VALUES (?, ?, 'stub', 'email', 'delivered', 1, ?, ?, ?, ?, ?)
  `);

  for (const request of SEED_REQUESTS) {
    const createdAt = nowIso(request.ageDays);
    const id = `req_${request.ref.toLowerCase()}`;
    insertRequest.run(
      id,
      request.ref,
      request.slug,
      request.title,
      request.goal,
      request.tried ?? null,
      request.deadline ?? null,
      request.category,
      request.level,
      request.visibility ?? "public",
      request.tier ?? "community",
      request.status,
      request.declineReason ?? null,
      request.payment ? "paid" : "none",
      request.payment?.amountKobo ?? null,
      request.upvotes,
      request.owner,
      createdAt,
      nowIso(Math.max(0, request.ageDays - 2)),
      request.reply ? nowIso(request.reply.ageDays) : null,
    );

    insertEvent.run(randomUUID(), id, "created", null, "submitted", "Request received.", request.owner, createdAt);

    if (request.status !== "submitted" && request.status !== "declined") {
      insertEvent.run(
        randomUUID(),
        id,
        "status",
        "submitted",
        request.status,
        null,
        "usr_creator",
        nowIso(Math.max(0, request.ageDays - 1)),
      );
    }
    if (request.status === "declined") {
      insertEvent.run(
        randomUUID(),
        id,
        "declined",
        "submitted",
        "declined",
        request.declineReason ?? null,
        "usr_creator",
        nowIso(Math.max(0, request.ageDays - 1)),
      );
    }

    if (request.reply) {
      insertReply.run(
        `rep_${request.ref.toLowerCase()}`,
        id,
        request.reply.message,
        request.reply.videoUrl,
        request.reply.videoId,
        request.reply.videoTitle,
        request.reply.videoLength,
        JSON.stringify(request.reply.resources ?? []),
        "usr_creator",
        nowIso(request.reply.ageDays),
      );
      insertEvent.run(
        randomUUID(),
        id,
        "fulfilled",
        "in_production",
        "fulfilled",
        "Lesson published.",
        "usr_creator",
        nowIso(request.reply.ageDays),
      );
    }

    if (request.payment) {
      const reference = `MOCK-${request.ref}`;
      insertPayment.run(
        randomUUID(),
        id,
        request.owner,
        reference,
        request.payment.amountKobo,
        request.payment.taxKobo,
        nowIso(request.payment.paidDaysAgo),
        nowIso(request.payment.paidDaysAgo),
        nowIso(request.payment.paidDaysAgo),
      );
      insertEntitlement.run(randomUUID(), request.owner, id, nowIso(request.payment.paidDaysAgo));
    }

    // A private request that is quoted but not yet paid: the demo state that
    // shows scope-agreement working end to end.
    if (request.tier === "private" && !request.payment) {
      insertQuote.run(
        randomUUID(),
        id,
        3_500_000,
        "A private walkthrough of your onboarding tracker: your real data, the formulas you actually need, a template tab your team can reuse, and a two-minute handover video.",
        "One private video walkthrough, the finished sheet, and a written checklist your team can follow.",
        9,
        nowIso(1),
      );
      db.prepare("UPDATE requests SET price_kobo = ? WHERE id = ?").run(3_500_000, id);
    }
  }

  for (const [ref, voters] of SEED_UPVOTERS) {
    const id = `req_${ref.toLowerCase()}`;
    for (const [index, userId] of voters.entries()) {
      insertUpvote.run(id, userId, nowIso(3 + index));
    }
  }

  const insertNotification = db.prepare(`
    INSERT INTO notifications (id, user_id, request_id, kind, title, body, href, read_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertNotification.run(
    randomUUID(),
    "usr_amara",
    "req_req-1002",
    "lesson_ready",
    "Your lesson is ready 🎉",
    "Enough SQL to be dangerous at work — built from your request.",
    "/tutorials/learn-enough-sql-to-query-our-company-database",
    null,
    nowIso(12),
  );
  insertNotification.run(
    randomUUID(),
    "usr_amara",
    "req_req-1018",
    "lesson_ready",
    "Your private lesson is ready 🔒",
    "Your team's branch and review workflow — only you can open it.",
    "/requests/team-branch-and-review-workflow-for-our-repo",
    null,
    nowIso(18),
  );
  insertNotification.run(
    randomUUID(),
    "usr_tunde",
    "req_req-1001",
    "lesson_ready",
    "Your lesson is ready 🎉",
    "What a neural network actually is, visually — built from your request.",
    "/tutorials/understand-what-a-neural-network-actually-is",
    null,
    nowIso(16),
  );

  const insertOutbox = db.prepare(
    "INSERT INTO outbox (id, request_id, to_email, subject, body, html, status, provider, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const outboxId = randomUUID();
  const createdAt = nowIso(12);
  insertOutbox.run(
    outboxId,
    "req_req-1002",
    "amara@example.com",
    "Your lesson is ready: Enough SQL to be dangerous at work",
    "Hi Amara,\n\nYour requested lesson is live and waiting for you.\n\nWatch it here: /tutorials/learn-enough-sql-to-query-our-company-database\n\nYou asked: “Learn enough SQL to query our company database without asking for a favour.”\n\n— Elias at iwannalearn",
    '<p>Hi Amara,</p><p>Your requested lesson is live and waiting for you.</p><p><a href="/tutorials/learn-enough-sql-to-query-our-company-database">Watch the lesson</a></p><p>— Elias at iwannalearn</p>',
    "delivered",
    "stub",
    createdAt,
  );
  insertNotificationLog.run(
    randomUUID(),
    outboxId,
    "rep_req-1002:amara@example.com",
    "amara@example.com",
    "Your lesson is ready: Enough SQL to be dangerous at work",
    createdAt,
    createdAt,
  );

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(key, value);
  }

  db.prepare(`
    INSERT INTO request_events (id, request_id, kind, from_status, to_status, message, actor, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    "req_req-1005",
    "note",
    null,
    null,
    "Filming Thursday. Keep the A5 print constraint front and centre.",
    "usr_creator",
    nowIso(2),
  );
}

export function getDb(): DatabaseSync {
  if (globalForDb.__iwlStore) return globalForDb.__iwlStore.db;

  const db = connect();
  db.exec(SCHEMA);
  applyColumnMigrations(db);
  db.exec(EXTRA_INDEXES);

  const row = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (row.n === 0) seed(db);

  backfillQuotes(db);

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(key, value);
  }

  globalForDb.__iwlStore = { db };
  return db;
}

/** Return plain objects (node:sqlite rows have a null prototype). */
export function rows<T>(stmt: ReturnType<DatabaseSync["prepare"]>, ...params: any[]): T[] {
  return (stmt.all(...params) as any[]).map((r) => ({ ...r })) as T[];
}

export function row<T>(stmt: ReturnType<DatabaseSync["prepare"]>, ...params: any[]): T | null {
  const r = stmt.get(...params) as any;
  return r ? ({ ...r } as T) : null;
}

export const iso = nowIso;
export { randomUUID, DB_PATH };
