import { NextResponse } from "next/server";
import { searchEverything } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { logSearch } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 120).trim();
  const user = await getCurrentUser();
  const result = searchEverything(q, user?.id);
  // Search terms are the cheapest demand signal we have — log the misses too.
  logSearch(q, result.lessons.length + result.requests.length, user?.id);

  return NextResponse.json(
    {
      query: q,
      lessons: result.lessons.map((l) => ({
        slug: l.slug,
        title: l.videoTitle ?? l.title,
        category: l.category,
        length: l.videoLength,
      })),
      requests: result.requests.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        category: r.category,
        upvotes: r.upvoteCount,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
