import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, row } from "@/lib/db";
import { listEntitlements, listMyRequests } from "@/lib/queries";
import { exportUserData } from "@/lib/service";
import { ProfileForm } from "@/components/account/profile-form";
import { DangerZone } from "@/components/account/danger-zone";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRight, Check, Lock, Sparkle } from "@/components/icons";
import { relativeTime } from "@/lib/status";
import { formatNaira } from "@/lib/pricing";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login?next=/account");

  const user = row<{
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    notify_email: number;
    notify_via_sms: number;
    digest_opt_in: number;
    email_verified_at: string | null;
    email_bounced_at: string | null;
    created_at: string;
  }>(
    getDb().prepare(
      "SELECT id, email, name, phone, notify_email, notify_via_sms, digest_opt_in, email_verified_at, email_bounced_at, created_at FROM users WHERE id = ?",
    ),
    session.id,
  );
  if (!user) redirect("/login");

  const requests = listMyRequests(user.id);
  const entitlements = listEntitlements(user.id);
  const exportJson = JSON.stringify(exportUserData(user.id), null, 2);

  return (
    <div className="wrap max-w-4xl py-8 md:py-12">
      <header>
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand">Account</p>
        <h1 className="mt-2 text-[clamp(1.8rem,3.6vw,2.4rem)] font-semibold leading-tight">Your details, your call</h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-2">
          Everything here is editable, portable and deletable. No dark patterns, no &ldquo;contact support to
          unsubscribe&rdquo;.
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Requests made", value: requests.length },
          { label: "Lessons ready", value: requests.filter((r) => r.status === "fulfilled").length },
          { label: "Private access", value: entitlements.length },
        ].map((stat) => (
          <div key={stat.label} className="surface p-4">
            <p className="text-[12px] text-ink-3">{stat.label}</p>
            <p className="font-display text-[24px] font-semibold leading-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      {user.email_bounced_at && (
        <div className="mt-4 rounded-xl border border-warn/25 bg-warn-soft/70 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
          <strong className="font-semibold">Your email is bouncing.</strong> We&apos;ll still notify you in the app, but
          you won&apos;t get lesson emails until the address works. Update it by{" "}
          <Link href="/contact" className="font-medium text-brand underline-offset-2 hover:underline">
            messaging us
          </Link>
          .
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section className="surface p-5 md:p-6" aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="text-[16px] font-semibold">
            Profile & notifications
          </h2>
          <p className="mt-1 text-[13px] text-ink-3">
            Your request is only as good as the details in it — and your notifications are how you find out it&apos;s
            ready.
          </p>
          <div className="mt-4">
            <ProfileForm
              user={{
                name: user.name,
                email: user.email,
                phone: user.phone,
                notifyEmail: Number(user.notify_email),
                notifyViaSms: Number(user.notify_via_sms),
                digestOptIn: Number(user.digest_opt_in),
              }}
            />
          </div>
        </section>

        <div className="space-y-4">
          <section className="surface p-5" aria-labelledby="access-heading">
            <h2 id="access-heading" className="text-[16px] font-semibold">
              Private access
            </h2>
            {entitlements.length === 0 ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
                Nothing private yet. Private lessons are built around your own files and never published.
              </p>
            ) : (
              <ul className="mt-2.5 space-y-2">
                {entitlements.map((item) => (
                  <li key={item.requestId} className="rounded-lg border border-line bg-paper-2/40 px-3 py-2">
                    <Link href={`/requests/${item.slug}`} className="block">
                      <span className="flex items-center gap-1.5 text-[13px] font-medium">
                        <Lock size={12} /> {item.title}
                      </span>
                      <span className="text-[11.5px] text-ink-3">
                        {item.accessType} · granted {relativeTime(item.grantedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {paymentsTotal(entitlements) > 0 && (
              <p className="mt-2 text-[12px] text-ink-3">{formatNaira(paymentsTotal(entitlements))} spent on private lessons.</p>
            )}
          </section>

          <section className="surface p-5" aria-labelledby="status-heading">
            <h2 id="status-heading" className="text-[16px] font-semibold">
              Account status
            </h2>
            <dl className="mt-2.5 space-y-2 text-[13px]">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-3">Email verified</dt>
                <dd>{user.email_verified_at ? <Badge tone="success"><Check size={11} /> Verified</Badge> : <Badge tone="warn">Unverified</Badge>}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-3">Member since</dt>
                <dd className="font-medium">{new Date(user.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-3">Email notifications</dt>
                <dd className="font-medium">{Number(user.notify_email) ? "On" : "Off"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-3">WhatsApp / SMS</dt>
                <dd className="font-medium">{Number(user.notify_via_sms) ? "On" : "Off"}</dd>
              </div>
            </dl>
            <ButtonLink href="/dashboard" variant="secondary" size="sm" className="mt-3 w-full justify-center">
              My learning <ArrowRight size={14} />
            </ButtonLink>
          </section>

          <section className="rounded-2xl border border-line bg-card/60 p-4">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">
              <Sparkle size={13} className="text-accent" /> Small print, plainly
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
              We store what a lesson needs and nothing else. Deleting your account removes your personal data; a
              public lesson you inspired stays in the library without your name attached.
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
              <Link href="/legal/privacy" className="font-medium text-brand hover:underline">
                Privacy
              </Link>
              <Link href="/legal/terms" className="font-medium text-brand hover:underline">
                Terms
              </Link>
              <Link href="/contact" className="font-medium text-brand hover:underline">
                Get help
              </Link>
            </div>
          </section>
        </div>
      </div>

      <section className="surface mt-4 p-5 md:p-6" aria-labelledby="danger-heading">
        <h2 id="danger-heading" className="text-[16px] font-semibold">
          Export & deletion
        </h2>
        <div className="mt-3">
          <DangerZone email={user.email} exportJson={exportJson} />
        </div>
      </section>
    </div>
  );
}

function paymentsTotal(entitlements: { accessType: string }[]) {
  return entitlements.filter((entry) => entry.accessType === "private").length * 2_500_000;
}
