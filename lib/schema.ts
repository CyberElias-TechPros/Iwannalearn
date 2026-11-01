/**
 * Relational schema.
 *
 * Written as plain SQL against a Postgres-compatible shape so the same model
 * can be ported with `prisma/schema.prisma` (included) without redesign.
 * SQLite is the local runtime; see IMPLEMENTATION_PLAN.md §4.2 for the swap.
 */

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE,
  name             TEXT,
  role             TEXT NOT NULL DEFAULT 'learner',
  phone            TEXT,
  notify_email     INTEGER NOT NULL DEFAULT 1,
  notify_via_sms   INTEGER NOT NULL DEFAULT 0,
  digest_opt_in    INTEGER NOT NULL DEFAULT 1,
  email_verified_at TEXT,
  email_bounced_at TEXT,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS login_tokens (
  token       TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  name        TEXT,
  next        TEXT,
  consumed_at TEXT,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (
  id               TEXT PRIMARY KEY,
  ref              TEXT NOT NULL UNIQUE,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  goal             TEXT NOT NULL,
  tried            TEXT,
  context_link     TEXT,
  deadline         TEXT,
  category         TEXT NOT NULL,
  level            TEXT NOT NULL,
  visibility       TEXT NOT NULL DEFAULT 'public',
  tier             TEXT NOT NULL DEFAULT 'community',
  status           TEXT NOT NULL DEFAULT 'submitted',
  decline_reason   TEXT,
  moderation_flag  INTEGER NOT NULL DEFAULT 0,
  moderation_note  TEXT,
  price_kobo       INTEGER,
  payment_status   TEXT NOT NULL DEFAULT 'none',
  revision_state   TEXT NOT NULL DEFAULT 'none',
  delivery_confirmed_at TEXT,
  upvote_count     INTEGER NOT NULL DEFAULT 0,
  priority_flag    INTEGER NOT NULL DEFAULT 0,
  created_by       TEXT NOT NULL REFERENCES users(id),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  fulfilled_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_owner ON requests(created_by);
CREATE INDEX IF NOT EXISTS idx_requests_tier ON requests(tier);

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
  reused_from    TEXT,
  created_by     TEXT NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL,
  seen_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_replies_request ON replies(request_id);
CREATE INDEX IF NOT EXISTS idx_replies_kind ON replies(kind);

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
  html        TEXT,
  status      TEXT NOT NULL DEFAULT 'queued',
  provider    TEXT NOT NULL DEFAULT 'stub',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id              TEXT PRIMARY KEY,
  outbox_id       TEXT,
  provider        TEXT NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'email',
  status          TEXT NOT NULL DEFAULT 'queued',
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  idempotency_key TEXT UNIQUE,
  to_email        TEXT,
  subject         TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  request_id    TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id),
  provider      TEXT NOT NULL,
  reference     TEXT NOT NULL UNIQUE,
  kind          TEXT NOT NULL,
  amount_kobo   INTEGER NOT NULL,
  tax_kobo      INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'NGN',
  status        TEXT NOT NULL DEFAULT 'pending',
  checkout_url  TEXT,
  paid_at       TEXT,
  refunded_at   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_request ON payments(request_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

CREATE TABLE IF NOT EXISTS entitlements (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id  TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL,
  granted_at  TEXT NOT NULL,
  revoked_at  TEXT,
  UNIQUE(user_id, request_id)
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  user_id     TEXT,
  request_id  TEXT,
  props       TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_name ON analytics_events(name);

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS search_queries (
  id          TEXT PRIMARY KEY,
  term        TEXT NOT NULL,
  results     INTEGER NOT NULL,
  user_id     TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS support_messages (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  email       TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS uploads (
  id          TEXT PRIMARY KEY,
  request_id  TEXT,
  user_id     TEXT NOT NULL,
  filename    TEXT NOT NULL,
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
`;

/**
 * Columns added after the first release. SQLite's ALTER TABLE is additive, so
 * each entry is applied only when missing — the same shape a Prisma migration
 * would produce.
 */
export const COLUMN_MIGRATIONS: { table: string; column: string; ddl: string }[] = [
  { table: "users", column: "phone", ddl: "TEXT" },
  { table: "users", column: "notify_via_sms", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { table: "users", column: "digest_opt_in", ddl: "INTEGER NOT NULL DEFAULT 1" },
  { table: "users", column: "email_verified_at", ddl: "TEXT" },
  { table: "users", column: "email_bounced_at", ddl: "TEXT" },
  { table: "requests", column: "moderation_flag", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { table: "requests", column: "moderation_note", ddl: "TEXT" },
  { table: "requests", column: "price_kobo", ddl: "INTEGER" },
  { table: "requests", column: "payment_status", ddl: "TEXT NOT NULL DEFAULT 'none'" },
  { table: "requests", column: "revision_state", ddl: "TEXT NOT NULL DEFAULT 'none'" },
  { table: "requests", column: "delivery_confirmed_at", ddl: "TEXT" },
  { table: "replies", column: "reused_from", ddl: "TEXT" },
  { table: "outbox", column: "html", ddl: "TEXT" },
];

export const DEFAULT_SETTINGS: Record<string, string> = {
  weekly_capacity: "4",
  payments_mode: "off", // off | mock | live
  currency: "NGN",
  vat_rate: "7.5",
  refund_window_days: "7",
  support_email: "hello@iwannalearn.app",
  digest_day: "monday",
};
