import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Storage layer.
 *
 * The blueprint targets PostgreSQL (Neon/Supabase) with Prisma. To keep this
 * build runnable anywhere with zero external services, the same relational
 * model is implemented on SQLite via Node's built-in driver. Every query lives
 * in lib/queries.ts and every write in lib/actions.ts, so swapping the driver
 * for Prisma/Postgres is a contained change (see IMPLEMENTATION_PLAN.md §5).
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
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'learner',
  notify_email  INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS requests (
  id             TEXT PRIMARY KEY,
  ref            TEXT NOT NULL UNIQUE,
  slug           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  goal           TEXT NOT NULL,
  tried          TEXT,
  context_link   TEXT,
  category       TEXT NOT NULL,
  level          TEXT NOT NULL,
  visibility     TEXT NOT NULL DEFAULT 'public',
  tier           TEXT NOT NULL DEFAULT 'community',
  status         TEXT NOT NULL DEFAULT 'submitted',
  decline_reason TEXT,
  deadline       TEXT,
  upvote_count   INTEGER NOT NULL DEFAULT 0,
  priority_flag  INTEGER NOT NULL DEFAULT 0,
  created_by     TEXT NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  fulfilled_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_owner ON requests(created_by);

CREATE TABLE IF NOT EXISTS request_upvotes (
  request_id  TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (request_id, user_id)
);

CREATE TABLE IF NOT EXISTS request_events (
  id          TEXT PRIMARY KEY,
  request_id  TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  from_status TEXT,
  to_status   TEXT,
  message     TEXT,
  actor       TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_request ON request_events(request_id);

CREATE TABLE IF NOT EXISTS replies (
  id             TEXT PRIMARY KEY,
  request_id     TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL DEFAULT 'external',
  message        TEXT NOT NULL,
  video_url      TEXT,
  video_id       TEXT,
  video_title    TEXT,
  video_provider TEXT DEFAULT 'youtube',
  video_length   TEXT,
  resources      TEXT,
  created_by     TEXT NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL,
  seen_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_replies_request ON replies(request_id);

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id  TEXT,
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  href        TEXT,
  read_at     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

CREATE TABLE IF NOT EXISTS feedback (
  id          TEXT PRIMARY KEY,
  request_id  TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  helpful     INTEGER NOT NULL,
  comment     TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE(request_id, user_id)
);

CREATE TABLE IF NOT EXISTS outbox (
  id          TEXT PRIMARY KEY,
  request_id  TEXT,
  to_email    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued',
  provider    TEXT NOT NULL DEFAULT 'stub',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
`;

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

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
  reply?: {
    message: string;
    videoUrl: string;
    videoId: string;
    videoTitle: string;
    videoLength: string;
    resources?: { label: string; url: string }[];
    ageDays: number;
  };
};

const SEED_USERS = [
  { id: "usr_amara", email: "amara@example.com", name: "Amara O.", role: "learner" },
  { id: "usr_tunde", email: "tunde@example.com", name: "Tunde B.", role: "learner" },
  { id: "usr_zara", email: "zara@example.com", name: "Zara K.", role: "learner" },
  { id: "usr_kola", email: "kola@example.com", name: "Kola A.", role: "learner" },
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
      resources: [
        { label: "Practice: 12 sample queries on a fake shop database", url: "https://example.com/sql-practice" },
      ],
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
    owner: "usr_creator",
    ageDays: 5,
    visibility: "private",
    tier: "private",
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
] as const;

function seed(db: DatabaseSync) {
  const insertUser = db.prepare(
    "INSERT INTO users (id, email, name, role, notify_email, created_at) VALUES (?, ?, ?, ?, 1, ?)",
  );
  for (const u of SEED_USERS) insertUser.run(u.id, u.email, u.name, u.role, nowIso(40));

  const insertRequest = db.prepare(`
    INSERT INTO requests (
      id, ref, slug, title, goal, tried, category, level, visibility, tier, status,
      decline_reason, deadline, upvote_count, created_by, created_at, updated_at, fulfilled_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  for (const r of SEED_REQUESTS) {
    const createdAt = nowIso(r.ageDays);
    const id = `req_${r.ref.toLowerCase()}`;
    insertRequest.run(
      id,
      r.ref,
      r.slug,
      r.title,
      r.goal,
      r.tried ?? null,
      r.category,
      r.level,
      r.visibility ?? "public",
      r.tier ?? "community",
      r.status,
      r.declineReason ?? null,
      r.deadline ?? null,
      r.upvotes,
      r.owner,
      createdAt,
      nowIso(Math.max(0, r.ageDays - 2)),
      r.reply ? nowIso(r.reply.ageDays) : null,
    );

    insertEvent.run(
      randomUUID(),
      id,
      "created",
      null,
      "submitted",
      "Request received.",
      r.owner,
      createdAt,
    );

    if (r.status !== "submitted" && r.status !== "declined") {
      insertEvent.run(
        randomUUID(),
        id,
        "status",
        "submitted",
        r.status,
        null,
        "usr_creator",
        nowIso(Math.max(0, r.ageDays - 1)),
      );
    }
    if (r.status === "declined") {
      insertEvent.run(
        randomUUID(),
        id,
        "declined",
        "submitted",
        "declined",
        r.declineReason ?? null,
        "usr_creator",
        nowIso(Math.max(0, r.ageDays - 1)),
      );
    }

    if (r.reply) {
      insertReply.run(
        `rep_${r.ref.toLowerCase()}`,
        id,
        r.reply.message,
        r.reply.videoUrl,
        r.reply.videoId,
        r.reply.videoTitle,
        r.reply.videoLength,
        JSON.stringify(r.reply.resources ?? []),
        "usr_creator",
        nowIso(r.reply.ageDays),
      );
      insertEvent.run(
        randomUUID(),
        id,
        "fulfilled",
        "in_production",
        "fulfilled",
        "Lesson published.",
        "usr_creator",
        nowIso(r.reply.ageDays),
      );
    }
  }

  for (const [ref, voters] of SEED_UPVOTERS) {
    const id = `req_${ref.toLowerCase()}`;
    for (const [i, userId] of voters.entries()) {
      insertUpvote.run(id, userId, nowIso(3 + i));
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
    "INSERT INTO outbox (id, request_id, to_email, subject, body, status, provider, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  insertOutbox.run(
    randomUUID(),
    "req_req-1002",
    "amara@example.com",
    "Your lesson is ready: Enough SQL to be dangerous at work",
    "Hi Amara,\n\nYour requested lesson is live and waiting for you.\n\nWatch it here: /tutorials/learn-enough-sql-to-query-our-company-database\n\nYou asked: “Learn enough SQL to query our company database without asking for a favour.”\n\n— Elias at iwannalearn",
    "delivered",
    "stub",
    nowIso(12),
  );

  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("weekly_capacity", "4");

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

  const row = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (row.n === 0) seed(db);

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
export { randomUUID };
