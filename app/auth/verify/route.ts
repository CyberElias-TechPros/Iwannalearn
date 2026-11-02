import { NextResponse } from "next/server";
import { consumeLoginToken, findOrCreateUser, markVerified, startSession } from "@/lib/auth";
import { track } from "@/lib/service";

export const dynamic = "force-dynamic";

/**
 * Exchanges a single-use login token for a session.
 * GET so the link in an email works when clicked; the token is consumed
 * atomically and can only be used once.
 */
/**
 * Redirects must use the *public* origin, not the bind address: behind a proxy
 * `request.url` can say 0.0.0.0:3000, which would send the browser nowhere.
 */
function publicOrigin(request: Request, url: URL): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return url.origin;
  const proto = request.headers.get("x-forwarded-proto") ?? (url.protocol.replace(":", "") || "http");
  return `${proto}://${host}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(request, url);
  const token = url.searchParams.get("token") ?? "";
  const result = consumeLoginToken(token);

  if (!result.ok || !result.email) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(result.error ?? "Invalid link")}`, origin));
  }

  const user = findOrCreateUser(result.email, result.name ?? null);
  markVerified(user.id);
  await startSession(user.id);
  track("session_started", { userId: user.id, data: { method: "magic_link" } });

  const next = result.next && result.next.startsWith("/") && !result.next.startsWith("//") ? result.next : "/dashboard";
  return NextResponse.redirect(new URL(next, origin));
}
