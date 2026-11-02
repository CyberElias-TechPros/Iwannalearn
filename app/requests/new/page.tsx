import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { RequestWizard } from "@/components/request-wizard";
import { CATEGORIES } from "@/lib/status";

export const metadata: Metadata = {
  title: "Ask for a lesson",
  description: "Tell us the one skill you're stuck on. We'll find a lesson that answers it, or make one for you.",
};

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; category?: string; tier?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const initialCategory = CATEGORIES.includes((params.category ?? "") as (typeof CATEGORIES)[number])
    ? params.category!
    : "";
  const initialTier = params.tier === "private" || params.tier === "priority" ? params.tier : "community";

  return (
    <div className="wrap max-w-5xl py-8 md:py-12">
      <Link href="/explore" className="text-[13px] font-medium text-ink-3 hover:text-brand">
        ← Back to explore
      </Link>

      <header className="mt-4 max-w-2xl">
        <h1 className="text-[clamp(1.9rem,4vw,2.8rem)] font-semibold leading-tight">
          What are you trying to learn?
        </h1>
        <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-2">
          Four short steps. You can&apos;t get this wrong — we&apos;ll ask if something is unclear, and every field
          explains why it&apos;s there.
        </p>
      </header>

      <div className="mt-8">
        <RequestWizard
          signedIn={Boolean(user)}
          initialTitle={params.title ?? ""}
          initialCategory={initialCategory}
          initialTier={initialTier}
        />
      </div>
    </div>
  );
}
