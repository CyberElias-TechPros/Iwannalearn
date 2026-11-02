"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startCheckoutAction } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, Lock, Spinner } from "@/components/icons";
import type { PaidTier } from "@/lib/pricing";

export function PaymentPanel({
  requestId,
  tier,
  amountLabel,
  paymentStatus,
  enabled,
  reference,
  revisionState,
  quoteStatus,
}: {
  requestId: string;
  tier: PaidTier;
  amountLabel: string;
  paymentStatus: string;
  enabled: boolean;
  reference: string | null;
  revisionState: string;
  quoteStatus: "none" | "proposed" | "accepted" | "declined" | "withdrawn";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { push } = useToast();

  if (paymentStatus === "paid") {
    return (
      <div className="rounded-xl border border-brand/25 bg-brand-soft/60 p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-strong">
          <Check size={14} /> Paid — {amountLabel}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
          Your slot is confirmed and the work starts now. You&apos;ll get an email and a bell notification the moment
          it&apos;s ready.
          {revisionState === "requested" ? " One revision has been requested." : ""}
        </p>
        {reference && (
          <p className="mt-1.5 font-mono text-[11px] text-ink-3">Ref {reference}</p>
        )}
      </div>
    );
  }

  if (paymentStatus === "refunded") {
    return (
      <div className="rounded-xl border border-warn/25 bg-warn-soft/60 p-4">
        <p className="text-[13px] font-semibold text-warn">Refunded</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
          This payment was refunded and access is closed. You can ask again any time.
        </p>
      </div>
    );
  }

  // No accepted quote, no pay button. The server enforces this too — this is
  // just the honest interface for it.
  if (quoteStatus !== "accepted") {
    return (
      <div className="rounded-xl border border-line bg-paper-2/50 p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold">
          <Lock size={13} /> Payment unlocks after you accept the quote
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
          {quoteStatus === "proposed"
            ? "Agree the scope above and the exact amount appears here. Accepting doesn't charge you."
            : quoteStatus === "declined"
              ? "You declined the quote, so there's nothing to pay. A revised quote can be sent any time."
              : "Elias is preparing your quote — scope first, then the price. You'll get an email when it's ready."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-accent-soft/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#8a5209]">
          <Lock size={13} /> {tier === "private" ? "Private lesson" : "Priority slot"}
        </p>
        <Badge tone="accent">{amountLabel}</Badge>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
        {tier === "private"
          ? "A bespoke walkthrough of your own files, never published. Scope is agreed before you're charged, and one revision is included."
          : "Filmed next, ahead of the free queue. The lesson still joins the public library — you're buying speed, not secrecy."}
      </p>

      {error && (
        <p role="alert" className="mt-2 text-[12.5px] font-medium text-danger">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || !enabled}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await startCheckoutAction(requestId, tier);
              if (!result.ok || !result.reference) {
                setError(result.error ?? "Could not start checkout.");
                push(result.error ?? "Could not start checkout.", "error");
                return;
              }
              router.push(result.url ?? `/checkout/${result.reference}`);
            })
          }
          className={buttonClass("primary", "sm")}
        >
          {pending ? (
            <>
              <Spinner size={14} /> Preparing…
            </>
          ) : (
            <>
              Continue to secure checkout <ArrowRight size={14} />
            </>
          )}
        </button>
        <Link href="/legal/terms" className="text-[12px] font-medium text-ink-2 underline-offset-2 hover:underline">
          Terms & refund policy
        </Link>
      </div>

      {!enabled && (
        <p className="mt-2 text-[11.5px] text-ink-3">
          Payments are switched off in this build. Your request is safe in the queue — nobody is charged.
        </p>
      )}
    </div>
  );
}
