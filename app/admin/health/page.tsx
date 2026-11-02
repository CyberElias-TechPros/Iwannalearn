import type { Metadata } from "next";
import { getDb, row } from "@/lib/db";
import { listErrors, errorStats } from "@/lib/errors";
import { paymentsMode } from "@/lib/pricing";
import { getSetting } from "@/lib/service";
import { Badge } from "@/components/ui/badge";
import { ClearErrorsButton } from "@/components/admin/health-controls";
import { Alert, Check, Clock, Sparkle } from "@/components/icons";
import { relativeTime } from "@/lib/status";

export const metadata: Metadata = { title: "Health — creator studio" };

export default async function AdminHealthPage() {
  const db = getDb();
  const stats = errorStats();
  const errors = listErrors(25);
  const mode = paymentsMode();

  const count = (sql: string) => Number(row<{ n: number }>(db.prepare(sql))?.n ?? 0);
  const outboxPending = count("SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending'");
  const outboxFailed = count("SELECT COUNT(*) AS n FROM outbox WHERE status = 'failed'");
  const bounced = count("SELECT COUNT(*) AS n FROM users WHERE email_bounced_at IS NOT NULL");
  const orphanUploads = count("SELECT COUNT(*) AS n FROM uploads WHERE request_id IS NULL");
  const unquoted = count(
    "SELECT COUNT(*) AS n FROM requests r WHERE r.tier IN ('priority','private') AND r.payment_status != 'paid' AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.request_id = r.id)",
  );

  const checks = [
    {
      label: "Database",
      ok: true,
      detail: `SQLite file present · ${count("SELECT COUNT(*) AS n FROM users")} users · ${count("SELECT COUNT(*) AS n FROM requests")} requests`,
    },
    {
      label: "Payments",
      ok: mode !== "off" || true,
      detail:
        mode === "off"
          ? "Switched off — free requests work, no checkout buttons appear."
          : mode === "live"
            ? "Live keys active. Real money moves."
            : "Test mode — full path exercised, no real money.",
      tone: mode === "live" ? "success" : "neutral",
    },
    {
      label: "Email outbox",
      ok: outboxFailed === 0,
      detail:
        outboxPending === 0 && outboxFailed === 0
          ? "Empty — everything has been delivered."
          : `${outboxPending} queued · ${outboxFailed} failed · ${bounced} address${bounced === 1 ? "" : "es"} bouncing`,
    },
    {
      label: "Quotes",
      ok: unquoted === 0,
      detail: unquoted === 0 ? "Every paid request has a quote." : `${unquoted} paid request${unquoted === 1 ? "" : "s"} still need a quote.`,
    },
    {
      label: "Uploads",
      ok: true,
      detail:
        orphanUploads === 0
          ? "No stray files. Staged files are purged after 24 hours."
          : `${orphanUploads} file${orphanUploads === 1 ? "" : "s"} staged but never attached (auto-purged after 24h).`,
    },
    {
      label: "Error log",
      ok: stats.last24h === 0,
      detail:
        stats.total === 0
          ? "Clean — nothing has thrown."
          : `${stats.total} recorded · ${stats.last24h} in the last 24h${stats.newest ? ` · newest ${relativeTime(stats.newest)}` : ""}`,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="surface p-4 md:p-5">
        <h2 className="text-[15px] font-semibold">Signals that matter</h2>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-3">
          The things that quietly break a small operation: email that never leaves, quotes nobody sent, files nobody
          claimed, and errors nobody saw. All four are visible here.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {checks.map((check) => (
            <li key={check.label} className="flex items-start gap-2.5 rounded-xl border border-line bg-paper-2/40 px-3 py-2.5">
              <span
                className={
                  check.ok
                    ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong"
                    : "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn"
                }
              >
                {check.ok ? <Check size={12} /> : <Alert size={12} />}
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold">{check.label}</p>
                <p className="text-[12px] leading-snug text-ink-3">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold">Recent errors</h2>
            <p className="text-[12px] text-ink-3">
              De-duplicated by fingerprint, so a looping failure appears once with a count.
            </p>
          </div>
          {stats.total > 0 && <ClearErrorsButton />}
        </div>

        {errors.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-6 text-[13px] text-ink-2">
            <Sparkle size={15} className="text-brand" /> Nothing has thrown. That&apos;s the goal.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {errors.map((error) => (
              <li key={error.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="danger">{error.scope}</Badge>
                  {Number(error.count) > 1 && <Badge tone="warn">×{error.count}</Badge>}
                  <span className="flex items-center gap-1 text-[11.5px] text-ink-3">
                    <Clock size={11} /> {relativeTime(error.last_seen_at || error.created_at)}
                  </span>
                  {error.url && <span className="font-mono text-[11px] text-ink-3">{error.url}</span>}
                </div>
                <p className="mt-1 text-[13px] font-medium leading-snug">{error.message}</p>
                {error.stack && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11.5px] text-ink-3 hover:text-ink-2">Stack</summary>
                    <pre className="mt-1 max-h-56 overflow-auto rounded-lg bg-paper-2 p-2 text-[11px] leading-relaxed text-ink-2">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface p-4">
        <h2 className="text-[14px] font-semibold">Configuration in force</h2>
        <dl className="mt-2 grid gap-1.5 text-[12.5px] sm:grid-cols-2">
          {[
            ["Payments", mode],
            ["Weekly capacity", `${getSetting("weekly_capacity", "4")} requests`],
            ["VAT rate", `${getSetting("vat_rate", "7.5")}% inclusive`],
            ["Refund window", `${getSetting("refund_window_days", "7")} days`],
            ["Support address", getSetting("support_email", "hello@iwannalearn.app")],
            ["Currency", getSetting("currency", "NGN")],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 rounded-lg border border-line/60 px-2.5 py-1.5">
              <dt className="text-ink-3">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
