import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { peekLoginToken } from "@/lib/auth";
import { Mail, ArrowRight, Sparkle } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Check your email" };

export default async function LoginCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/login");

  const record = peekLoginToken(token);
  const expired = record ? new Date(record.expires_at).getTime() < Date.now() : true;
  const used = Boolean(record?.consumed_at);

  return (
    <div className="wrap max-w-lg py-14">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Mail size={26} />
      </span>
      <h1 className="mt-5 text-[clamp(1.8rem,4vw,2.4rem)] font-semibold leading-tight">Check your email</h1>
      <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-2">
        We sent a sign-in link{record ? ` to ${record.email}` : ""}. It works once and expires in 30 minutes.
      </p>

      {expired || used ? (
        <div className="mt-5 rounded-xl border border-warn/25 bg-warn-soft/70 px-4 py-3 text-[13.5px] leading-relaxed text-ink-2">
          {used ? "That link has already been used." : "That link has expired."} Sign-in links are single-use and
          time-limited on purpose — request a fresh one below.
        </div>
      ) : null}

      <div className="surface mt-6 p-5">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-accent">
          <Sparkle size={13} /> Demo build
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
          No email leaves this machine: the message is captured in the creator&apos;s outbox. Use the button below to
          finish the magic-link flow exactly as you would from your inbox.
        </p>
        {record && !expired && !used ? (
          <ButtonLink href={`/auth/verify?token=${token}`} className="mt-3 w-full justify-center">
            Open the sign-in link <ArrowRight size={16} />
          </ButtonLink>
        ) : (
          <ButtonLink href="/login" className="mt-3 w-full justify-center">
            Request a new link <ArrowRight size={16} />
          </ButtonLink>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-[13.5px]">
        <Link href="/login" className="font-medium text-brand hover:underline">
          Use a different email
        </Link>
        <Link href="/" className="text-ink-3 hover:text-brand">
          Back home
        </Link>
      </div>
    </div>
  );
}
