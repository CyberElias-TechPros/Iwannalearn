import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignInForm } from "@/components/sign-in-form";
import { signInAsDemoAction } from "@/lib/actions";
import { Logo } from "@/components/logo";
import { ArrowRight, Check, Sparkle, User, Video } from "@/components/icons";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; as?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(params.next && params.next.startsWith("/") ? params.next : "/dashboard");

  const next = params.next && params.next.startsWith("/") ? params.next : "/dashboard";

  return (
    <div className="wrap max-w-4xl py-10 md:py-16">
      <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-start">
        <div>
          <Logo />
          <h1 className="mt-6 text-[clamp(1.9rem,4vw,2.6rem)] font-semibold leading-tight">
            One tap in. No password to forget.
          </h1>
          <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-2">
            Sign in so your request stays yours and we can tell you the moment your lesson is ready.
          </p>

          <ul className="mt-6 space-y-2.5">
            {[
              "Track every request and its status in one place",
              "Get an email and an in-app notification when it's ready",
              "Private requests stay private — only you and the creator",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-[14px] text-ink-2">
                <Check size={16} className="mt-0.5 shrink-0 text-brand" /> {line}
              </li>
            ))}
          </ul>

          <div className="mt-7 rounded-2xl border border-line bg-paper-2/60 p-4">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
              <Sparkle size={13} className="text-accent" /> About this build
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
              This demo signs you in instantly so the whole loop is testable. The production build uses a real magic
              link (Resend) plus Google OAuth — same screens, no password either way.
            </p>
          </div>
        </div>

        <div className="surface p-6">
          <h2 className="text-[18px] font-semibold">Continue</h2>
          <p className="mt-1 text-[13.5px] text-ink-3">Pick a demo account, or use your own email.</p>

          <div className="mt-4 space-y-2">
            <form action={signInAsDemoAction}>
              <input type="hidden" name="userId" value="usr_amara" />
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition",
                  params.as === "creator"
                    ? "border-line bg-card hover:border-line-strong"
                    : "border-brand bg-brand-soft/60 hover:bg-brand-soft",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <User size={17} />
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold">Enter as a learner</span>
                    <span className="block text-[12px] text-ink-3">Amara — has an open query and a lesson ready</span>
                  </span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-ink-3" />
              </button>
            </form>

            <form action={signInAsDemoAction}>
              <input type="hidden" name="userId" value="usr_creator" />
              <input type="hidden" name="next" value={next === "/dashboard" ? "/admin" : next} />
              <button
                type="submit"
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition",
                  params.as === "creator"
                    ? "border-brand bg-brand-soft/60 hover:bg-brand-soft"
                    : "border-line bg-card hover:border-line-strong",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-[#8a5209]">
                    <Video size={17} />
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold">Enter as the creator</span>
                    <span className="block text-[12px] text-ink-3">Elias — the studio: queue, replies, notifications</span>
                  </span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-ink-3" />
              </button>
            </form>
          </div>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[11.5px] font-medium uppercase tracking-wide text-ink-3">or your email</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <SignInForm next={next} />
        </div>
      </div>
    </div>
  );
}
