import { NextResponse } from "next/server";
import { sendWeeklyDigests } from "@/lib/digest";
import { getSetting } from "@/lib/service";
import { track } from "@/lib/service";

export const dynamic = "force-dynamic";

/**
 * Weekly digest trigger. Point a scheduler at this (Vercel Cron, GitHub Actions,
 * or a cron box) with `Authorization: Bearer $CRON_SECRET`.
 *
 * Idempotent per ISO week, so a double-fire sends nothing twice.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not set, so this endpoint is disabled." },
      { status: 503 },
    );
  }
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const result = sendWeeklyDigests();
  track("digest_sent", { data: { ...result, day: getSetting("digest_day", "monday") } });

  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST with Authorization: Bearer $CRON_SECRET to send this week's digests.",
    digestDay: getSetting("digest_day", "monday"),
  });
}
