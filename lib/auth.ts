import { cookies } from "next/headers";
import { getDb, row, randomUUID } from "./db";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "iwl_session";
const SESSION_DAYS = 30;

/**
 * Demo-simple, production-shaped auth.
 *
 * The blueprint calls for Supabase Auth (magic link + Google OAuth). Until the
 * provider keys exist, this module issues the same kind of opaque, httpOnly,
 * server-verified session so the whole product loop can be exercised end to end.
 * Swapping the body of `startSession` for a Supabase call is the only change
 * needed elsewhere in the app — nothing else reads auth headers or JWTs.
 */

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const user = row<SessionUser>(
    db.prepare(
      `SELECT u.id, u.email, u.name, u.role
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > ?`,
    ),
    token,
    new Date().toISOString(),
  );
  return user;
}

export function findOrCreateUser(email: string, name?: string | null): SessionUser {
  const db = getDb();
  const normalised = email.trim().toLowerCase();
  const existing = row<SessionUser>(
    db.prepare("SELECT id, email, name, role FROM users WHERE email = ?"),
    normalised,
  );
  if (existing) return existing;

  const id = `usr_${randomUUID().slice(0, 8)}`;
  const fallbackName = normalised.split("@")[0].replace(/[._-]/g, " ");
  db.prepare("INSERT INTO users (id, email, name, role, notify_email, created_at) VALUES (?, ?, ?, 'learner', 1, ?)").run(
    id,
    normalised,
    name?.trim() || fallbackName,
    new Date().toISOString(),
  );
  return { id, email: normalised, name: name?.trim() || fallbackName, role: "learner" };
}

export async function startSession(userId: string) {
  const db = getDb();
  const token = randomUUID().replace(/-/g, "");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
    token,
    userId,
    new Date().toISOString(),
    expires,
  );

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expires),
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

export function isCreator(user: SessionUser | null): boolean {
  return user?.role === "creator";
}
