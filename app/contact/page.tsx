import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getSetting } from "@/lib/service";
import { SupportForm } from "@/components/support-form";
import { ArrowRight, Mail, Clock, Shield } from "@/components/icons";

export const metadata: Metadata = {
  title: "Contact",
  description: "Ask a question, flag a problem, or tell us we got something wrong. One person reads every message.",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const user = await getCurrentUser();
  const { error, sent } = await searchParams;
  const supportEmail = getSetting("support_email", "hello@iwannalearn.app");

  return (
    <div className="wrap max-w-4xl py-10 md:py-14">
      <header className="max-w-xl">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand">Contact</p>
        <h1 className="mt-3 text-[clamp(1.9rem,4vw,2.6rem)] font-semibold leading-tight">A real person reads this</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-2">
          Ask before you pay, tell us a lesson missed the mark, or say we got something wrong. There&apos;s no ticket
          number and no chatbot in the way.
        </p>
      </header>

      <div className="mt-7 grid gap-5 md:grid-cols-[1.2fr_1fr] md:items-start">
        <section className="surface p-5 md:p-6">
          <h2 className="text-[16px] font-semibold">Send a message</h2>
          <p className="mt-1 text-[13px] text-ink-3">
            You&apos;ll get an instant confirmation, then a proper reply within one working day.
          </p>
          <div className="mt-4">
            <SupportForm
              defaultEmail={user?.email ?? ""}
              defaultName={user?.name ?? ""}
              sent={sent === "1"}
              error={error}
            />
          </div>
        </section>

        <aside className="space-y-3">
          <div className="surface p-5">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Mail size={14} className="text-brand" /> Email directly
            </p>
            <a
              href={`mailto:${supportEmail}`}
              className="mt-1 inline-block break-all text-[13.5px] font-medium text-brand hover:underline"
            >
              {supportEmail}
            </a>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
              Better if you want to attach files, screenshots or logs.
            </p>
          </div>

          <div className="surface p-5">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Clock size={14} className="text-accent" /> How long it takes
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
              One working day for questions, same day for anything to do with money. If we&apos;re slower than that,
              we&apos;re filming — and we&apos;ll say so.
            </p>
          </div>

          <div className="surface p-5">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Shield size={14} className="text-info" /> Already know what you need?
            </p>
            <ul className="mt-1.5 space-y-1.5 text-[12.5px]">
              <li>
                <Link href="/requests/new" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                  File a request <ArrowRight size={11} />
                </Link>
                <span className="text-ink-3"> — faster than explaining it by email.</span>
              </li>
              <li>
                <Link href="/how-it-works" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                  How it works <ArrowRight size={11} />
                </Link>
                <span className="text-ink-3"> — the whole loop in 60 seconds of reading.</span>
              </li>
              <li>
                <Link href="/legal/not-covered" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                  What we don&apos;t cover <ArrowRight size={11} />
                </Link>
                <span className="text-ink-3"> — please check before paying.</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
