"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { submitRequestAction, toggleUpvoteAction, type ActionState } from "@/lib/actions";
import { CATEGORIES, LEVELS, TIERS, levelLabel, tierMeta } from "@/lib/status";
import { Field, Input, Textarea, ValidNote } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ArrowLeft, ArrowRight, Check, Lock, Sparkle, Spinner } from "@/components/icons";
import { cn } from "@/lib/cn";

type Values = {
  title: string;
  goal: string;
  tried: string;
  category: string;
  level: string;
  tier: string;
  contextLink: string;
  deadline: string;
};

const STEPS = [
  { key: "topic", label: "The skill" },
  { key: "outcome", label: "The outcome" },
  { key: "level", label: "Your level" },
  { key: "delivery", label: "Delivery" },
] as const;

const VAGUE = new Set([
  "python",
  "excel",
  "sql",
  "canva",
  "design",
  "figma",
  "javascript",
  "marketing",
  "ai",
  "chatgpt",
  "video editing",
  "coding",
  "react",
  "photoshop",
]);

const GOAL_EXAMPLES: Record<string, string> = {
  "Design & Canva": "e.g. Make a one-page flyer that looks designed, prints cleanly on A5, and matches our shop colours.",
  "Data & Python": "e.g. Merge two CSVs in pandas without losing the header row or duplicating rows.",
  Spreadsheets: "e.g. Turn a messy export into a summary sheet with one click, without macros breaking.",
  "Web development": "e.g. Fix the 'permission denied' error when installing packages, and understand why it happens.",
  "AI tools": "e.g. Write product descriptions that sound like us, using one reusable prompt.",
  "Video & content": "e.g. Cut a 30-second phone clip with captions that looks intentional, not shaky.",
  "Marketing & social": "e.g. Plan a week of posts that don't feel like spam and actually get replies.",
  "Career & productivity": "e.g. Prepare for a performance review and say what I did without sounding arrogant.",
  Other: "e.g. Explain the one step I keep getting stuck on, in plain language.",
};

const DRAFT_KEY = "iwl_request_draft_v1";

export function RequestWizard({
  signedIn,
  initialTitle = "",
  initialCategory = "",
}: {
  signedIn: boolean;
  initialTitle?: string;
  initialCategory?: string;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({
    title: initialTitle,
    goal: "",
    tried: "",
    category: initialCategory || "",
    level: "new",
    tier: "community",
    contextLink: "",
    deadline: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { push } = useToast();
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [restored, setRestored] = useState(false);

  /* Restore a half-written draft so nobody loses their words on a refresh. */
  useEffect(() => {
    if (initialTitle) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Values;
        setValues((prev) => ({ ...prev, ...parsed }));
        setRestored(true);
        push("We restored your unfinished request.", "info");
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [values]);

  const set = (key: keyof Values, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const wordCount = values.title.trim().split(/\s+/).filter(Boolean).length;
  const isVague = VAGUE.has(values.title.trim().toLowerCase()) || (wordCount > 0 && wordCount < 4);
  const titleOk = values.title.trim().length >= 12 && !isVague;

  const canContinue = useMemo(() => {
    if (step === 0) return values.title.trim().length >= 12 && values.category.length > 0;
    if (step === 1) return values.goal.trim().length >= 30;
    if (step === 2) return Boolean(values.level);
    return Boolean(values.tier);
  }, [step, values]);

  function goTo(next: number) {
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
    setFormError(null);
    window.setTimeout(() => headingRef.current?.focus(), 40);
  }

  function handleSubmit() {
    setFormError(null);
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => formData.append(key, value));

    startTransition(async () => {
      const result: ActionState = await submitRequestAction(formData);
      if (result?.error) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        const errors = result.fieldErrors ?? {};
        if (errors.title || errors.category) goTo(0);
        else if (errors.goal) goTo(1);
        else if (errors.level) goTo(2);
        else if (errors.tier || errors.contextLink) goTo(3);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
      <div className="surface overflow-hidden">
        {/* Progress */}
        <div className="border-b border-line bg-paper-2/50 px-5 py-4 md:px-7">
          <ol className="flex items-center gap-2" aria-label="Progress">
            {STEPS.map((item, index) => {
              const state = index === step ? "current" : index < step ? "done" : "todo";
              return (
                <li key={item.key} className="flex flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => index < step && goTo(index)}
                    disabled={index > step}
                    aria-current={state === "current" ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-full text-left text-[12.5px] font-medium transition",
                      index < step && "cursor-pointer text-brand hover:opacity-80",
                      index === step && "text-ink",
                      index > step && "cursor-default text-ink-3/70",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11.5px] font-semibold",
                        index < step && "border-brand bg-brand text-white",
                        index === step && "border-brand bg-brand-soft text-brand-strong",
                        index > step && "border-line bg-card text-ink-3",
                      )}
                    >
                      {index < step ? <Check size={12} strokeWidth={3} /> : index + 1}
                    </span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </button>
                  {index < STEPS.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden="true" />}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="p-5 md:p-7">
          {!signedIn && (
            <div className="mb-5 rounded-xl border border-accent/25 bg-accent-soft/60 px-4 py-3 text-[13.5px] text-ink-2">
              You can write everything first — we&apos;ll ask you to sign in only when you send it.
            </div>
          )}

          {restored && step === 0 && (
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[12.5px] font-medium text-brand-strong">
              <Sparkle size={13} /> Draft restored
            </p>
          )}

          {/* step 0 — topic */}
          {step === 0 && (
            <section aria-labelledby="step-title">
              <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-[clamp(1.35rem,2.6vw,1.75rem)] font-semibold outline-none">
                What do you want to learn?
              </h2>
              <p className="mt-1.5 text-[14px] text-ink-3">
                Say it the way you&apos;d say it to a friend. Specific beats short — “the thing I&apos;m stuck on” is
                exactly what we want to hear.
              </p>

              <div className="mt-5 space-y-5">
                <Field
                  label="Your request in one line"
                  htmlFor="title"
                  hint="One sentence. Name the task, not just the tool."
                  error={fieldErrors.title}
                >
                  <Input
                    id="title"
                    value={values.title}
                    onChange={(event) => set("title", event.target.value)}
                    placeholder="e.g. Merge two CSVs in pandas without losing headers"
                    maxLength={140}
                    invalid={Boolean(fieldErrors.title)}
                    autoComplete="off"
                  />
                  {values.title.trim().length >= 12 && (
                    <div className="mt-1.5">
                      {isVague ? (
                        <p className="text-[12.5px] leading-snug text-[#8a5209]">
                          A little more detail will get you a much better video — what should you be able to do when
                          it&apos;s done?
                        </p>
                      ) : (
                        <ValidNote>Good — that&apos;s filmable.</ValidNote>
                      )}
                    </div>
                  )}
                </Field>

                {titleOk && <SimilarRequests query={values.title} signedIn={signedIn} />}

                <Field label="Closest topic" htmlFor="category" hint="Helps us route it and helps others find it later." error={fieldErrors.category}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {CATEGORIES.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => set("category", category)}
                        aria-pressed={values.category === category}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition",
                          values.category === category
                            ? "border-brand bg-brand-soft text-brand-strong"
                            : "border-line bg-card text-ink-2 hover:border-line-strong",
                        )}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </section>
          )}

          {/* step 1 — outcome */}
          {step === 1 && (
            <section aria-labelledby="step-title">
              <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-[clamp(1.35rem,2.6vw,1.75rem)] font-semibold outline-none">
                What should you be able to do when it&apos;s done?
              </h2>
              <p className="mt-1.5 text-[14px] text-ink-3">
                This single sentence decides whether the video is useful. Be concrete about the end result.
              </p>

              <div className="mt-5 space-y-5">
                <Field
                  label="The outcome you want"
                  htmlFor="goal"
                  hint={GOAL_EXAMPLES[values.category] ?? GOAL_EXAMPLES.Other}
                  error={fieldErrors.goal}
                >
                  <Textarea
                    id="goal"
                    value={values.goal}
                    onChange={(event) => set("goal", event.target.value)}
                    placeholder="When this is done, I want to be able to…"
                    maxLength={1200}
                    invalid={Boolean(fieldErrors.goal)}
                  />
                  <div className="mt-1 flex justify-between text-[12px]">
                    <span className="text-ink-3">
                      {values.goal.trim().length < 30 ? "A sentence or two is plenty." : ""}
                    </span>
                    <span className="tabular-nums text-ink-3/70">{values.goal.length}/1200</span>
                  </div>
                </Field>

                <Field
                  label="What have you already tried?"
                  htmlFor="tried"
                  optional
                  hint="So we don't waste your time repeating the obvious."
                  error={fieldErrors.tried}
                >
                  <Textarea
                    id="tried"
                    value={values.tried}
                    onChange={(event) => set("tried", event.target.value)}
                    placeholder="Tutorials, docs, errors you hit… anything helps."
                    maxLength={800}
                    className="min-h-[88px]"
                  />
                </Field>
              </div>
            </section>
          )}

          {/* step 2 — level */}
          {step === 2 && (
            <section aria-labelledby="step-title">
              <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-[clamp(1.35rem,2.6vw,1.75rem)] font-semibold outline-none">
                Where are you starting from?
              </h2>
              <p className="mt-1.5 text-[14px] text-ink-3">
                This changes how the video opens — no 10-minute intro if you already know the basics.
              </p>

              <div className="mt-5 space-y-2.5" role="radiogroup" aria-labelledby="step-title">
                {(Object.keys(LEVELS) as Array<keyof typeof LEVELS>).map((level) => (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={values.level === level}
                    onClick={() => set("level", level)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition",
                      values.level === level
                        ? "border-brand bg-brand-soft/60"
                        : "border-line bg-card hover:border-line-strong",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        values.level === level ? "border-brand bg-brand text-white" : "border-line-strong",
                      )}
                      aria-hidden="true"
                    >
                      {values.level === level && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold">{LEVELS[level].label}</span>
                      <span className="mt-0.5 block text-[13px] text-ink-3">{LEVELS[level].hint}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <Field
                  label="Anything we should know about your setup?"
                  htmlFor="deadline"
                  optional
                  hint="A deadline, the software version, or when you need it by."
                >
                  <Input
                    id="deadline"
                    value={values.deadline}
                    onChange={(event) => set("deadline", event.target.value)}
                    placeholder="e.g. Needed before Friday / Using Excel 365 on Windows"
                    maxLength={80}
                  />
                </Field>
              </div>
            </section>
          )}

          {/* step 3 — delivery */}
          {step === 3 && (
            <section aria-labelledby="step-title">
              <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-[clamp(1.35rem,2.6vw,1.75rem)] font-semibold outline-none">
                How should we deliver it?
              </h2>
              <p className="mt-1.5 text-[14px] text-ink-3">
                One flow, three levels of commitment. Most people start with Community — it&apos;s free.
              </p>

              <div className="mt-5 space-y-2.5" role="radiogroup" aria-labelledby="step-title">
                {(Object.keys(TIERS) as Array<keyof typeof TIERS>).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    role="radio"
                    aria-checked={values.tier === tier}
                    onClick={() => set("tier", tier)}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition",
                      values.tier === tier ? "border-brand bg-brand-soft/60" : "border-line bg-card hover:border-line-strong",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold">{TIERS[tier].label}</span>
                        {tier === "community" && (
                          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-strong">
                            Most common
                          </span>
                        )}
                        {tier !== "community" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-paper-2 px-2 py-0.5 text-[11px] font-medium text-ink-3">
                            <Lock size={10} /> Not charged yet
                          </span>
                        )}
                      </span>
                      <span className="text-[14px] font-semibold">{TIERS[tier].price}</span>
                    </span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-ink-3">{TIERS[tier].detail}</span>
                  </button>
                ))}
              </div>

              {values.tier !== "community" && (
                <div className="mt-4 rounded-xl border border-accent/25 bg-accent-soft/60 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
                  <strong className="font-semibold">Payment isn&apos;t switched on yet.</strong> Send the request now and
                  we&apos;ll email you the exact price and scope before anything is charged. Nothing happens until you
                  say yes.
                </div>
              )}

              <div className="mt-5">
                <Field
                  label={values.tier === "private" ? "Link to your file or screenshot" : "Any example that helps?"}
                  htmlFor="contextLink"
                  optional
                  hint={
                    values.tier === "private"
                      ? "Only you and the creator can see this. Don't paste anything you wouldn't want filmed."
                      : "A spreadsheet, a screenshot, a page — a link is enough."
                  }
                  error={fieldErrors.contextLink}
                >
                  <Input
                    id="contextLink"
                    type="url"
                    value={values.contextLink}
                    onChange={(event) => set("contextLink", event.target.value)}
                    placeholder="https://"
                    invalid={Boolean(fieldErrors.contextLink)}
                  />
                </Field>
              </div>

              <div className="mt-6 rounded-xl border border-line bg-paper-2/50 p-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">Review</p>
                <p className="mt-1.5 text-[15px] font-semibold leading-snug">{values.title || "Untitled request"}</p>
                <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-ink-3">{values.goal || "No outcome described yet."}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] text-ink-3">
                  <span className="rounded-full bg-card px-2 py-0.5">{values.category || "No topic"}</span>
                  <span className="rounded-full bg-card px-2 py-0.5">{levelLabel(values.level)}</span>
                  <span className="rounded-full bg-card px-2 py-0.5">{tierMeta(values.tier).label}</span>
                </div>
                <button type="button" onClick={() => goTo(0)} className="mt-2 text-[12.5px] font-medium text-brand underline-offset-2 hover:underline">
                  Edit
                </button>
              </div>
            </section>
          )}

          {formError && (
            <p role="alert" className="mt-4 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-[13.5px] font-medium text-danger">
              {formError}
            </p>
          )}
          {/* Nav */}
          <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              disabled={step === 0}
              className={buttonClass("ghost", "md", step === 0 ? "invisible" : "")}
            >
              <ArrowLeft size={16} /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => goTo(step + 1)} disabled={!canContinue} className={buttonClass("primary")}>
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => (signedIn ? handleSubmit() : router.push("/login?next=/requests/new"))}
                disabled={pending}
                className={buttonClass("primary")}
              >
                {pending ? (
                  <>
                    <Spinner size={16} /> Sending…
                  </>
                ) : (
                  <>
                    {signedIn ? "Send my request" : "Sign in to send"} <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}
          </div>

          {!signedIn && step === STEPS.length - 1 && (
            <p className="mt-3 text-right text-[12.5px] text-ink-3">
              <Link href="/login?next=/requests/new" className="font-medium text-brand underline-offset-2 hover:underline">
                Sign in first
              </Link>{" "}
              — we&apos;ll keep this page open.
            </p>
          )}
        </div>
      </div>

      {/* Side rail */}
      <aside className="space-y-3 lg:sticky lg:top-24">
        <div className="surface p-5">
          <h3 className="text-[15px] font-semibold">What happens after you send</h3>
          <ol className="mt-3 space-y-3">
            {[
              { title: "We read it", body: "Usually within 2 days. If one detail is unclear we ask once, not five times." },
              { title: "You get a status", body: "Every stage is visible on your request page — no chasing." },
              { title: "We film it", body: "Short and specific. Public lessons stay free for everyone." },
              { title: "You're notified", body: "Email and in-app bell, the moment it's live." },
            ].map((item, index) => (
              <li key={item.title} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-strong">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-[13.5px] font-medium">{item.title}</span>
                  <span className="block text-[12.5px] leading-snug text-ink-3">{item.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-line bg-card/60 p-4">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
            <Sparkle size={13} className="text-accent" /> A good request sounds like
          </p>
          <p className="mt-1.5 text-[12.5px] italic leading-relaxed text-ink-3">
            “I have two CSVs with the same columns. I want to merge them into one file, keep a single header row,
            and know which file each row came from.”
          </p>
        </div>
      </aside>
    </div>
  );
}

function SimilarRequests({ query, signedIn }: { query: string; signedIn: boolean }) {
  const [matches, setMatches] = useState<{ slug: string; title: string; category: string; upvotes: number; id?: string }[]>([]);
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const { push } = useToast();

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await response.json();
        setMatches((data.requests ?? []).slice(0, 2));
      } catch {
        /* ignore */
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  if (matches.length === 0) return null;

  return (
    <div className="rounded-xl border border-accent/30 bg-accent-soft/40 p-3.5">
      <p className="text-[13px] font-semibold text-[#8a5209]">Someone may have already asked for this</p>
      <p className="mt-0.5 text-[12.5px] text-ink-2">
        Adding your vote is faster than starting again — and it pushes the lesson up the queue.
      </p>
      <ul className="mt-2.5 space-y-2">
        {matches.map((match) => (
          <li key={match.slug} className="flex items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-2">
            <Link href={`/requests/${match.slug}`} className="min-w-0 text-[13px] font-medium hover:text-brand">
              <span className="line-clamp-1">{match.title}</span>
              <span className="text-[11.5px] font-normal text-ink-3">
                {match.category} · {match.upvotes} waiting
              </span>
            </Link>
            <button
              type="button"
              disabled={voted[match.slug]}
              onClick={async () => {
                if (!signedIn) {
                  push("Sign in to vote — your request stays here.", "info");
                  return;
                }
                const result = await toggleUpvoteAction(match.id ?? "");
                if (result.ok) {
                  setVoted((prev) => ({ ...prev, [match.slug]: true }));
                  push("Vote added. You'll be notified when it's ready.", "success");
                }
              }}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-medium transition",
                voted[match.slug]
                  ? "border-brand/30 bg-brand-soft text-brand-strong"
                  : "border-line-strong text-ink-2 hover:border-brand/40 hover:text-brand",
              )}
            >
              {voted[match.slug] ? "Voted" : "Me too"}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11.5px] text-ink-3">
        Still different? Carry on — yours is welcome.
      </p>
    </div>
  );
}
