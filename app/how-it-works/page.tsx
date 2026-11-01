import Link from "next/link";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Bell, Check, Clock, Globe, Lock, Plus, Search, Sparkle, ThumbUp, Video } from "@/components/icons";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "The four-step loop behind iwannalearn: ask in plain words, check what exists, get a video for your situation, and be told the moment it's ready.",
};

const steps = [
  {
    icon: <Sparkle size={20} />,
    title: "1. You describe the stuck moment",
    body: "Not “I want to learn Python” — “merge two CSVs in pandas without losing headers”. The form asks three questions that turn a vague wish into something filmable: what you want to be able to do, where you're starting from, and what you've already tried.",
    note: "About 30 seconds, and nothing is lost if you refresh.",
  },
  {
    icon: <Search size={20} />,
    title: "2. We check what already exists",
    body: "If a lesson already answers it, you watch it immediately — no request needed. If someone has asked something similar, you can back theirs instead. One video answering 40 people is better for everyone than 40 videos answering one.",
    note: "Search runs before you submit, not after.",
  },
  {
    icon: <Video size={20} />,
    title: "3. The video gets made for your situation",
    body: "Short, specific, and built against your actual goal. Public lessons join the library and stay free. Private lessons are built around your own files and never leave your account.",
    note: "You'll see the status change at every stage.",
  },
  {
    icon: <Bell size={20} />,
    title: "4. You're told, then you tell us",
    body: "An email and an in-app notification the moment it's live — two channels, so one bad inbox can't break the loop. Then one question: did this solve it? That answer decides what gets made next.",
    note: "No chasing, no silent waiting.",
  },
];

const faqs = [
  {
    q: "What does it cost?",
    a: "Community requests are free, and every public lesson stays free to watch — no subscription, no paywall. Priority (₦4,000) buys a place at the front of the filming queue, while the lesson is still public. Private lessons start at ₦25,000 and are priced on scope. Payments aren't switched on in this build; nothing is charged.",
  },
  {
    q: "What does “private” actually mean?",
    a: "One thing only: a bespoke walkthrough of your actual project, files or data — never published, never indexed, access restricted to you. It does not mean coaching calls, and it does not mean an unlisted link to a generic video. We say that plainly here because it prevents disappointment later.",
  },
  {
    q: "How long does it take?",
    a: "Most community requests get a first look within two working days and a lesson within one to two weeks. The queue is capped to what can genuinely be filmed each week, so the estimate you see is the estimate you get. If the queue is long, new requests go to the waitlist with an honest timeframe rather than a silent backlog.",
  },
  {
    q: "Can I ask for something that already exists?",
    a: "Yes, and we'll tell you so. If a lesson covers it, that's a faster answer than waiting for a new one. If it only partly covers it, ask for the missing part specifically.",
  },
  {
    q: "What if my request is declined?",
    a: "You'll get a plain-language reason on the request page and by email. Usually it's because the topic is on our not-covered list (medical, legal, financial advice, hacking, academic dishonesty), or because it's too broad to film usefully. We'll usually suggest a narrower version you can ask for instead.",
  },
  {
    q: "Who owns what?",
    a: "You own the information you send us. Private recordings are yours for personal use. Public lessons stay free for everyone, and we may refilm the technique later without your data. You can ask us to delete your context at any time.",
  },
  {
    q: "Do I need an account?",
    a: "Not to browse or watch. You only need one to ask for a lesson or to vote — because both of those mean we'll be notifying you.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="wrap max-w-5xl py-10 md:py-14">
      <header className="max-w-3xl">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand">How it works</p>
        <h1 className="mt-3 text-[clamp(2rem,4.4vw,3.1rem)] font-semibold leading-[1.08]">
          Tell us what you want to learn. We&apos;ll help you find it — or make it.
        </h1>
        <p className="mt-4 text-[16.5px] leading-relaxed text-ink-2">
          Most learning stalls in the same place: the answer you need is a small, specific thing, and the internet is
          full of 40-minute videos that almost cover it. This is a place to ask for the exact thing.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <ButtonLink href="/requests/new">
            <Plus size={16} /> Ask for a lesson
          </ButtonLink>
          <ButtonLink href="/explore" variant="secondary">
            Browse the library
          </ButtonLink>
        </div>
      </header>

      <section className="mt-14" aria-labelledby="loop-heading">
        <h2 id="loop-heading" className="text-[clamp(1.5rem,2.8vw,2rem)] font-semibold">
          The loop, end to end
        </h2>
        <ol className="mt-6 space-y-3">
          {steps.map((step) => (
            <li key={step.title} className="surface flex gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                {step.icon}
              </span>
              <div>
                <h3 className="text-[17px] font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{step.body}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand">
                  <Check size={14} /> {step.note}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14" aria-labelledby="specific-heading">
        <h2 id="specific-heading" className="text-[clamp(1.5rem,2.8vw,2rem)] font-semibold">
          What makes a request work
        </h2>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-2">
          Specificity is the whole game. A request that names the task gets a video you finish; a request that names a
          tool gets a ramble you abandon.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-danger/20 bg-danger-soft/40 p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-danger">Too vague</p>
            <ul className="mt-2 space-y-1.5 text-[14px] text-ink-2">
              <li>“Python”</li>
              <li>“Excel help”</li>
              <li>“Learn design”</li>
              <li>“How do I use AI?”</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-brand/20 bg-brand-soft/40 p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-brand">Filmable</p>
            <ul className="mt-2 space-y-1.5 text-[14px] text-ink-2">
              <li>“Merge two CSVs in pandas without losing headers”</li>
              <li>“Stop my Excel macro breaking when the file name changes”</li>
              <li>“A flyer that prints correctly on A5”</li>
              <li>“One prompt that writes 40 product descriptions that sound like us”</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="private" className="mt-14 scroll-mt-24" aria-labelledby="private-heading">
        <h2 id="private-heading" className="text-[clamp(1.5rem,2.8vw,2rem)] font-semibold">
          Free, priority, private
        </h2>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-2">
          One request flow, three levels of commitment. You never pay to unlock a library — public lessons are free
          forever.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            {
              icon: <ThumbUp size={18} />,
              name: "Community",
              price: "Free",
              points: ["Public board, upvote-driven", "Lesson joins the public library", "Everyone who voted gets notified"],
              tone: "border-brand/25",
            },
            {
              icon: <Clock size={18} />,
              name: "Priority",
              price: "₦4,000",
              points: ["Filmed next, ahead of the queue", "Still public and reusable", "You're buying speed, not secrecy"],
              tone: "border-accent/30",
            },
            {
              icon: <Lock size={18} />,
              name: "Private",
              price: "From ₦25,000",
              points: ["Built around your real files", "Never published or indexed", "Access restricted to you"],
              tone: "border-info/25",
            },
          ].map((tier) => (
            <div key={tier.name} className={`surface border ${tier.tone} p-5`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-paper-2 text-ink-2">{tier.icon}</span>
              <div className="mt-3 flex items-baseline justify-between">
                <h3 className="text-[16px] font-semibold">{tier.name}</h3>
                <span className="font-display text-[18px] font-semibold">{tier.price}</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {tier.points.map((point) => (
                  <li key={point} className="flex items-start gap-1.5 text-[13px] leading-relaxed text-ink-2">
                    <Check size={14} className="mt-0.5 shrink-0 text-brand" /> {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-paper-2/50 p-5">
          <p className="text-[13.5px] font-semibold">Private means one thing, stated once:</p>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
            A bespoke video of <em>your</em> project or files — not coaching, not a generic video behind a link. We
            deliver it through access-controlled hosting, not an unlisted YouTube URL, because an unlisted URL is not
            private. Payments are not live in this build; when they are, scope is agreed before any charge.
          </p>
        </div>
      </section>

      <section id="faq" className="mt-14 scroll-mt-24" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-[clamp(1.5rem,2.8vw,2rem)] font-semibold">
          Questions people actually ask
        </h2>
        <div className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {faqs.map((faq) => (
            <details key={faq.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[14.5px] font-semibold hover:bg-paper-2/40">
                {faq.q}
                <span className="text-ink-3 transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="px-5 pb-4 text-[14px] leading-relaxed text-ink-2">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="cta-heading">
        <div className="surface flex flex-col items-start justify-between gap-4 bg-brand p-7 text-white md:flex-row md:items-center">
          <div>
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-white/70">Still with us?</p>
            <h2 id="cta-heading" className="mt-2 text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold">
              Ask for the thing you keep getting stuck on.
            </h2>
            <p className="mt-1.5 max-w-xl text-[14px] text-white/80">
              Free, thirty seconds, and you can back out until you press send.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/requests/new" variant="secondary" className="border-white/20 bg-white text-ink hover:bg-white/90">
              Ask for a lesson <ArrowRight size={16} />
            </ButtonLink>
            <ButtonLink href="/explore?tab=requests" variant="ghost" className="text-white hover:bg-white/10">
              See what people ask
            </ButtonLink>
          </div>
        </div>
      </section>

      <p className="mt-8 text-center text-[12.5px] text-ink-3">
        Curious what we won&apos;t cover?{" "}
        <Link href="/legal/not-covered" className="font-medium text-brand underline-offset-2 hover:underline">
          Read the short list
        </Link>
        .
      </p>
    </div>
  );
}
