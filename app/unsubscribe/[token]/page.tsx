import Link from "next/link";
import type { Metadata } from "next";
import { unsubscribeByToken } from "@/lib/notify";
import { ButtonLink } from "@/components/ui/button";
import { Check, ArrowRight, Mail } from "@/components/icons";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

/**
 * One-click opt-out. No login, no confirmation step designed to trap you:
 * the token is the authorisation, and the page says plainly what changed.
 * Transactional mail (sign-in links, receipts) still arrives, and says so.
 */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = unsubscribeByToken(token);

  if (!result.ok) {
    return (
      <div className="wrap max-w-lg py-16">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warn-soft text-warn">
          <Mail size={22} />
        </span>
        <h1 className="mt-4 text-[24px] font-semibold">That link doesn&apos;t match an account</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
          Unsubscribe links are unique per person. If this one came from an old email, open the most recent one, or
          turn email off from your account page.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink href="/account">
            Manage preferences <ArrowRight size={15} />
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Ask us to do it
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap max-w-lg py-16">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Check size={22} />
      </span>
      <h1 className="mt-4 text-[24px] font-semibold">
        {result.alreadyOff ? "You're already unsubscribed" : "Done — no more lesson emails"}
      </h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
        We&apos;ve stopped lesson updates{result.email ? ` to ${result.email}` : ""}. Nothing else changes: your requests
        keep their place in the queue, and you can still watch anything in the library.
      </p>

      <div className="mt-4 rounded-xl border border-line bg-card/60 p-4">
        <p className="text-[13px] font-semibold">One honest caveat</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
          Two things still arrive, because without them you&apos;d be locked out or out of pocket: <strong>sign-in
          links</strong> and <strong>payment receipts</strong>. In-app notifications in the bell also continue — that
          channel needs no email address.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <ButtonLink href="/account" variant="secondary">
          Turn email back on <ArrowRight size={15} />
        </ButtonLink>
        <Link href="/dashboard" className="inline-flex items-center px-2 text-[13.5px] font-medium text-ink-3 hover:text-brand">
          Back to my learning
        </Link>
      </div>
    </div>
  );
}
