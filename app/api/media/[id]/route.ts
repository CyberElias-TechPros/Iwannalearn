import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getRequestById } from "@/lib/queries";
import { signAccess } from "@/lib/signed-url";
import { validateStreamUrl } from "@/lib/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Cookie-authenticated playback bootstrap for the existing web player. Native clients use bearer auth. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  const item = getRequestById(id, user?.id);
  if (!item || item.moderationFlag || !item.hasLesson || item.status !== "fulfilled") return NextResponse.json({ error: "Not found." }, { status: 404 });
  const privateLesson = item.visibility === "private";
  if (privateLesson && !user) return NextResponse.json({ error: "Private playback requires the owner account." }, { status: 403 });
  if (privateLesson && user!.role !== "creator") {
    const entitled = getDb().prepare("SELECT 1 FROM entitlements WHERE user_id = ? AND request_id = ? AND access_type = 'private' AND revoked_at IS NULL").get(user!.id, id);
    if (!entitled) return NextResponse.json({ error: "Private access isn't active." }, { status: 403 });
  }
  const reply = getDb().prepare("SELECT stream_url FROM replies WHERE request_id = ? AND kind = 'external' AND stream_url IS NOT NULL ORDER BY created_at DESC LIMIT 1").get(id) as { stream_url: string } | undefined;
  if (!reply?.stream_url) return NextResponse.json({ error: "This lesson is not available for direct playback." }, { status: 409 });
  const checked = validateStreamUrl(reply.stream_url);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 422 });
  const access = signAccess(id, privateLesson ? user!.id : "public", privateLesson ? 900 : 3600);
  const signature = access.url.split("sig=")[1];
  const url = `/api/mobile/v1/requests/${encodeURIComponent(id)}/stream?exp=${access.expiresAt}&sig=${signature}${privateLesson ? "" : "&public=1"}`;
  return NextResponse.json({ url, provider: "direct", private: privateLesson, expiresAt: access.expiresAt }, { headers: { "Cache-Control": "private, no-store" } });
}
