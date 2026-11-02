import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { paymentsEnabled, paymentsMode, PRICING, taxPortion, formatNaira } from "@/lib/pricing";
import { getSetting } from "@/lib/service";
import { publicStats } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRight, Check, Clock, Globe, Lock, Plus, Shield, Sparkle, ThumbUp } from "@/components/icons";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Community requests are free forever. Priority buys a place in the queue. Private lessons are built around your own files and never published.",
};

export default async function PricingPage() {
  const user = await getCurrentUser();
  const stats = publicStats();
  const enabled = paymentsEnabled();
  const mode = paymentsMode();
  const vatRate = Number(getSetting("vat_rate", "7.5"));
  const windowDays = Number(getSetting("refund_window_days", "7"));

  const priorityTax = taxPortion(PRICING.priority.amountKobo, vatRate);
  const privateTax = taxPortion(PRICING.private.amountKobo, vatRate);

  return (
    <div className="wrap py-10 md:py-14">
      <header className="max-w-2xl">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand">Pricing</p>
        <h1 className="mt-3 text-[clamp(2rem,4.4vw,3rem)] font-semibold leading-[1.08]">
          Free to learn. Pay only for speed or privacy.
        </h1>
        <p className="mt-4 text-[16.5px] leading-relaxed text-ink-2">
          Every public lesson stays free forever — no subscription, no locked library. Two things cost money: jumping
          the queue, and having a video made about <em>your</em> actual files.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
          <Badge tone={enabled ? "success" : "warn"} dot>
            {mode === "live" ? "Payments live" : mode === "mock" ? "Test mode — no real money" : "Payments off"}
          </Badge>
          <span>·</span>
          <span>{stats.lessons} lessons free in the library right now</span>
        </div>
      </header>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {/* Community */}
        <section className="surface flex flex-col p-6" aria-labelledby="community-heading">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <ThumbUp size={19} />
          </span>
          <div className="mt-3 flex items-center gap-2">
            <h2 id="community-heading" className="text-[18px] font-semibold">
              Community
            </h2>
            <Badge tone="success">Most people</Badge>
          </div>
          <p className="font-display text-[30px] font-semibold leading-tight">Free</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">
            Ask in plain words, vote on what matters, and watch the lesson when it&apos;s ready. The video joins the
            public library and helps everyone after you.
          </p>
          <ul className="mt-4 space-y-2">
            {["Structured request with no time limit", "You get notified the moment it's live", "Full access to every public lesson", "No card, ever"].map((line) => (
              <li key={line} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-2">
                <Check size={15} className="mt-0.5 shrink-0 text-brand" /> {line}
              </li>
            ))}
          </ul>
          <ButtonLink href="/requests/new" variant="secondary" className="mt-auto w-full justify-center pt-0">
            <span className="inline-flex items-center gap-1.5">Ask for free <ArrowRight size={15} /></span>
          </ButtonLink>
        </section>

        {/* Priority */}
        <section className="surface flex flex-col border-accent/40 p-6 ring-1 ring-accent/20" aria-labelledby="priority-heading">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-[#8a5209]">
            <Clock size={19} />
          </span>
          <div className="mt-3 flex items-center gap-2">
            <h2 id="priority-heading" className="text-[18px] font-semibold">
              Priority
            </h2>
            <Badge tone="accent">Speed</Badge>
          </div>
          <p className="font-display text-[30px] font-semibold leading-tight">{PRICING.priority.label}</p>
          <p className="text-[11.5px] text-ink-3">one-off · includes {formatNaira(priorityTax)} VAT</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">
            Filmed next, ahead of the free queue. The lesson is still public — you&apos;re buying a place in the
            calendar, not secrecy.
          </p>
          <ul className="mt-4 space-y-2">
            {["Front of the filming queue", "Same public, reusable lesson", "Status updates at every stage"].map((line) => (
              <li key={line} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-2">
                <Check size={15} className="mt-0.5 shrink-0 text-brand" /> {line}
              </li>
            ))}
          </ul>
          <ButtonLink href="/requests/new?tier=priority" className="mt-auto w-full justify-center">
            <span className="inline-flex items-center gap-1.5">Start a priority request <ArrowRight size={15} /></span>
          </ButtonLink>
        </section>

        {/* Private */}
        <section className="surface flex flex-col border-info/30 p-6" aria-labelledby="private-heading">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-info-soft text-info">
            <Lock size={19} />
          </span>
          <div className="mt-3 flex items-center gap-2">
            <h2 id="private-heading" className="text-[18px] font-semibold">
              Private
            </h2>
            <Badge tone="info">Yours alone</Badge>
          </div>
          <p className="font-display text-[30px] font-semibold leading-tight">From {PRICING.private.label}</p>
          <p className="text-[11.5px] text-ink-3">one-off · includes {formatNaira(privateTax)} VAT</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">
            A bespoke walkthrough of your real project or data. Never published, never indexed, access tied to your
            account.
          </p>
          <ul className="mt-4 space-y-2">
            {["Built around your actual files", "Never published or indexed", "One revision within " + windowDays + " days", "Access revocable on refund"].map((line) => (
              <li key={line} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-2">
                <Check size={15} className="mt-0.5 shrink-0 text-brand" /> {line}
              </li>
            ))}
          </ul>
          <ButtonLink href="/requests/new?tier=private" variant="secondary" className="mt-auto w-full justify-center">
            <span className="inline-flex items-center gap-1.5">Start a private request <ArrowRight size={15} /></span>
          </ButtonLink>
        </section>
      </div>

      {/* What "private" means — stated once, verbatim */}
      <section className="mt-8 rounded-2xl border border-info/25 bg-info-soft/40 p-6">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold">
          <Shield size={17} className="text-info" /> What “private” means, in one sentence
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          A bespoke video of <strong>your</strong> project, files or data — not coaching, and not a generic video
          behind a link. We deliver it through access-controlled hosting rather than an unlisted YouTube URL, because
          an unlisted URL is not private.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { title: "Scope locked first", body: "You approve the exact scope before any charge. New scope is a new request." },
            { title: "One revision included", body: `Within ${windowDays} days of delivery. A second revision is a new request.` },
            { title: "Deletion on request", body: "Ask us to delete your files and we confirm when it's done." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl bg-card p-3">
              <p className="text-[12.5px] font-semibold">{item.title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The exact sequence, so nobody is surprised */}
      <section className="mt-6 surface p-5">
        <h2 className="text-[15px] font-semibold">How paying for a paid tier actually works</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { step: "1", title: "You ask", body: "Send the request with as much detail and as many files as you like. Free." },
            { step: "2", title: "We write the scope", body: "A concrete scope, a price and a turnaround land on your request page and in your inbox." },
            { step: "3", title: "You accept or decline", body: "Accepting locks the price and charges nothing. Declining is free and gets you a revision, not a silence." },
            { step: "4", title: "You pay, we film", body: "Checkout opens only after you accept, for the exact agreed amount. Nothing starts before it clears." },
          ].map((item) => (
            <li key={item.step} className="rounded-xl border border-line bg-paper-2/40 p-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11.5px] font-semibold text-white">
                {item.step}
              </span>
              <p className="mt-1.5 text-[12.5px] font-semibold">{item.title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Tax + payment notes */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="surface p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Globe size={16} className="text-brand" /> Paying from Nigeria or abroad
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
            Prices are in naira and include {vatRate}% VAT. Local cards, bank transfer and USSD run through Paystack;
            international cards run through Stripe. You&apos;ll see the exact amount before you confirm — never after.
          </p>
          <p className="mt-2 text-[12px] text-ink-3">
            {enabled
              ? mode === "mock"
                ? "This build runs checkout in test mode: no real money moves, but the full path — pending, paid, receipt, entitlement, refund — is exercised."
                : "Live mode is on. Real payments, real receipts."
              : "Payments are switched off in this build. You can still file a paid-tier request; we'll email you a scope and price before anything is charged."}
          </p>
        </div>

        <div className="surface p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Sparkle size={16} className="text-accent" /> Fair by default
          </h2>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-ink-2">
            <li className="flex gap-2">
              <Check size={15} className="mt-0.5 shrink-0 text-brand" /> If we don&apos;t deliver the agreed scope, you
              get a full refund.
            </li>
            <li className="flex gap-2">
              <Check size={15} className="mt-0.5 shrink-0 text-brand" /> Custom digital work that matches the agreed
              scope is normally non-refundable — which is why scope is agreed in writing first.
            </li>
            <li className="flex gap-2">
              <Check size={15} className="mt-0.5 shrink-0 text-brand" /> Declined requests are never charged, and we
              always give a reason.
            </li>
          </ul>
          <Link href="/legal/terms" className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand hover:underline">
            Read the full terms <ArrowRight size={13} />
          </Link>
        </div>
      </section>

      <section className="mt-10 text-center">
        <h2 className="text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold">Not sure which one you need?</h2>
        <p className="mx-auto mt-2 max-w-lg text-[14.5px] leading-relaxed text-ink-2">
          Start free. If it turns out to be specific to your own files, we&apos;ll tell you before anything is charged.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <ButtonLink href={user ? "/requests/new" : "/login?next=/requests/new"}>
            <Plus size={16} /> Ask for a lesson
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Ask a question first
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
