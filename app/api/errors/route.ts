import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { rateLimit } from "@/lib/service";

export const dynamic = "force-dynamic";

/**
 * Client error intake. The error boundary has no database access, so it posts
 * here. Rate-limited and size-capped: an error loop must not become a write
 * amplification attack.
 */
export async function POST(request: Request) {
  const limit = rateLimit("client-errors", 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ ok: true });

  let payload: { message?: string; stack?: string; url?: string; digest?: string; scope?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!payload.message || typeof payload.message !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const user = await getCurrentUser();

  logError({
    scope: (payload.scope ?? "client").slice(0, 60),
    message: payload.message,
    stack: payload.stack ?? null,
    url: payload.url ?? null,
    userId: user?.id ?? null,
    digest: payload.digest ?? null,
  });

  return NextResponse.json({ ok: true });
}
