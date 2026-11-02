import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, isCreator } from "@/lib/auth";
import { adminStats } from "@/lib/queries";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isCreator(user)) redirect("/dashboard?creatorOnly=1");

  const stats = adminStats();

  return (
    <div className="wrap py-6 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">Creator studio</p>
          <h1 className="mt-1 text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight">One queue, one truth</h1>
          <p className="mt-1 text-[13px] text-ink-3">
            {stats.inQueue} in the pipeline · {stats.needsDecision} needing a decision · {stats.flagged} flagged
          </p>
        </div>
        <AdminNav
          badges={{
            "/admin": stats.needsDecision || undefined,
            "/admin/moderation": stats.flagged || undefined,
            "/admin/quotes": stats.awaitingQuotes || undefined,
            "/admin/payments": stats.paidCount || undefined,
            "/admin/support": stats.openSupport || undefined,
            "/admin/outbox": stats.bouncedEmails || undefined,
          }}
        />
      </header>

      <div className="mt-5">{children}</div>
    </div>
  );
}
