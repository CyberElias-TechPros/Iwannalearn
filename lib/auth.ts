import { cookies } from "next/headers";
import { getDb, row, randomUUID } from "./db";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "iwl_session";
const SESSION_DAYS = 30;
const TOKEN_MINUTES = 30;

/**
 * Authentication.
 *
 * Passwordless by design: a single-use, 30-minute token delivered by email,
 * exchanged for an opaque httpOnly session. No passwords to reset, no OAuth
 * consent screen in the way of a first request.
 *
 * The token delivery is the same stubbed transport as notifications, so the
 * flow is real end to end and the provider swap is one function
 * (`queueEmail` in lib/notify.ts). Google OAuth is a Phase B addition: it
 * would call `findOrCreateUser` + `startSession` and change nothing else.
 */

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  return row<SessionUser>(
    getDb().prepare(
      `SELECT u.id, u.email, u.name, u.role
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > ?`,
    ),
    token,
    new Date().toISOString(),
  );
}

export function getUserByEmail(email: string) {
  return row<SessionUser & { email_bounced_at: string | null; notify_email: number; notify_via_sms: number }>(
    getDb().prepare(
      "SELECT id, email, name, role, email_bounced_at, notify_email, notify_via_sms FROM users WHERE email = ?",
    ),
    email.trim().toLowerCase(),
  );
}

export function findOrCreateUser(email: string, name?: string | null): SessionUser {
  const db = getDb();
  const normalised = email.trim().toLowerCase();
  const existing = getUserByEmail(normalised);
  if (existing) return { id: existing.id, email: existing.email, name: existing.name, role: existing.role };

  const id = `usr_${randomUUID().slice(0, 8)}`;
  const fallbackName = normalised.split("@")[0].replace(/[._-]/g, " ");
  db.prepare(
    "INSERT INTO users (id, email, name, role, notify_email, created_at, email_verified_at) VALUES (?, ?, ?, 'learner', 1, ?, ?)",
  ).run(id, normalised, name?.trim() || fallbackName, new Date().toISOString(), new Date().toISOString());
  return { id, email: normalised, name: name?.trim() || fallbackName, role: "learner" };
}

export function markVerified(userId: string) {
  getDb().prepare("UPDATE users SET email_verified_at = ? WHERE id = ? AND email_verified_at IS NULL").run(
    new Date().toISOString(),
    userId,
  );
}

export function createSession(userId: string, client: "web" | "android" = "web") {
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  getDb().prepare("INSERT INTO sessions (token, user_id, created_at, expires_at, client) VALUES (?, ?, ?, ?, ?)")
    .run(token, userId, createdAt, expiresAt, client);
  return { token, expiresAt };
}

export function userForSessionToken(token: string): SessionUser | null {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return row<SessionUser>(getDb().prepare(
    `SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ? AND u.deleted_at IS NULL`,
  ), token, new Date().toISOString());
}

export function revokeSessionToken(token: string) {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export async function startSession(userId: string) {
  const { token, expiresAt } = createSession(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(expiresAt),
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
    jar.delete(SESSION_COOKIE);
  }
}

export function createLoginToken(email: string, name: string | null, next: string, client: "web" | "android" = "web"): string {
  const db = getDb();
  const token = randomUUID().replace(/-/g, "");
  const now = Date.now();
  db.prepare(
    "INSERT INTO login_tokens (token, email, name, next, expires_at, created_at, client) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    token,
    email.trim().toLowerCase(),
    name,
    next,
    new Date(now + TOKEN_MINUTES * 60_000).toISOString(),
    new Date(now).toISOString(),
    client,
  );
  // Housekeeping: drop tokens that expired more than a day ago.
  db.prepare("DELETE FROM login_tokens WHERE expires_at < ?").run(new Date(now - 864e5).toISOString());
  return token;
}

export function peekLoginToken(token: string) {
  return row<{ token: string; email: string; name: string | null; next: string; expires_at: string; consumed_at: string | null; client: string }>(
    getDb().prepare("SELECT token, email, name, next, expires_at, consumed_at, client FROM login_tokens WHERE token = ?"),
    token,
  );
}

export function consumeLoginToken(token: string): { ok: boolean; email?: string; name?: string | null; next?: string; error?: string } {
  const db = getDb();
  const record = peekLoginToken(token);
  if (!record) return { ok: false, error: "That sign-in link doesn't exist. Request a new one." };
  if (record.consumed_at) return { ok: false, error: "That link has already been used. Request a new one." };
  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "That link expired after 30 minutes. Request a new one — it takes a second." };
  }

  db.prepare("UPDATE login_tokens SET consumed_at = ? WHERE token = ?").run(new Date().toISOString(), token);
  return { ok: true, email: record.email, name: record.name, next: record.next };
}

export function isCreator(user: SessionUser | null): user is SessionUser {
  return user?.role === "creator";
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE !== "false";
}
