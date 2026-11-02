"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptQuoteAction, declineQuoteAction } from "@/lib/actions";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Close, Spinner } from "@/components/icons";

export type QuoteView = {
  amountLabel: string;
  taxLabel: string;
  scope: string;
  deliverables: string | null;
  turnaroundDays: number | null;
  revisions: number;
  status: "proposed" | "accepted" | "declined" | "withdrawn";
  declineNote: string | null;
};

/**
 * The agreement step. Deliberately boring and explicit: what you get, what it
 * costs, what happens after you say yes, and a decline path that costs nothing.
 */
export function QuoteCard({ requestId, quote }: { requestId: string; quote: QuoteView }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const router = useRouter();
  const { push } = useToast();

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptQuoteAction(requestId);
      if (!result.ok) {
        setError(result.error ?? "Could not accept the quote.");
        return;
      }
      push("Quote accepted. Pay whenever you're ready.", "success");
      router.refresh();
    });
  }

  function decline() {
    setError(null);
    startTransition(async () => {
      const result = await declineQuoteAction(requestId, note);
      if (!result.ok) {
        setError(result.error ?? "Could not decline the quote.");
        return;
      }
      push("Declined — you haven't been charged anything.", "success");
      setDeclining(false);
      router.refresh();
    });
  }

  if (quote.status === "declined") {
    return (
      <div className="rounded-xl border border-line bg-paper-2/50 p-4">
        <p className="text-[13px] font-semibold">You declined this quote</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
          Nothing was charged. {quote.declineNote ? `You said: “${quote.declineNote}”.` : ""} A new quote with different
          scope or price can be sent the same day — just reply or ask again.
        </p>
      </div>
    );
  }

  if (quote.status === "accepted") {
    return (
      <div className="rounded-xl border border-brand/25 bg-brand-soft/50 p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-strong">
          <Check size={14} /> Agreed at {quote.amountLabel}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
          Scope is locked in. Pay below and the work starts — {quote.turnaroundDays ? `about ${quote.turnaroundDays} ` : ""}
          days, with {quote.revisions === 0 ? "no" : quote.revisions} revision{quote.revisions === 1 ? "" : "s"} included.
          If anything changes after payment, you can ask for a refund from your account.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-accent-soft/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-[#8a5209]">Your quote</p>
        <Badge tone="accent">{quote.amountLabel}</Badge>
      </div>

      <dl className="mt-2.5 space-y-2 text-[12.5px] leading-relaxed">
        <div>
          <dt className="font-semibold text-ink-2">What you get</dt>
          <dd className="text-ink-2">{quote.scope}</dd>
        </div>
        {quote.deliverables && (
          <div>
            <dt className="font-semibold text-ink-2">Delivered as</dt>
            <dd className="text-ink-2">{quote.deliverables}</dd>
          </div>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-ink-2">
          {quote.turnaroundDays ? (
            <span className="flex items-center gap-1">
              <Clock size={12} /> about {quote.turnaroundDays} days
            </span>
          ) : null}
          <span>
            {quote.revisions === 0 ? "No" : quote.revisions} revision{quote.revisions === 1 ? "" : "s"} included
          </span>
          <span className="text-ink-3">includes {quote.taxLabel} VAT</span>
        </div>
      </dl>

      <p className="mt-2.5 rounded-lg bg-paper/70 px-2.5 py-2 text-[11.5px] leading-snug text-ink-2">
        Accepting doesn&apos;t charge you — it agrees the scope. Payment is a separate step you can do today or later, and
        nothing is filmed until it clears.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-[12.5px] font-medium text-danger">
          {error}
        </p>
      )}

      {declining ? (
        <div className="mt-3 space-y-2">
          <label htmlFor="decline-note" className="text-[12.5px] font-medium">
            What would make this work? (optional)
          </label>
          <textarea
            id="decline-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Too expensive, wrong scope, or something else — this goes straight to Elias."
            className="w-full rounded-lg border border-line bg-card px-3 py-2 text-[13px] outline-none focus:border-brand/50"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={decline} className={buttonClass("danger", "sm")}>
              {pending ? <Spinner size={13} /> : <Close size={13} />} Decline quote
            </button>
            <button type="button" onClick={() => setDeclining(false)} className={buttonClass("ghost", "sm")}>
              Keep considering
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending} onClick={accept} className={buttonClass("primary", "sm")}>
            {pending ? (
              <>
                <Spinner size={13} /> Saving…
              </>
            ) : (
              <>
                <Check size={13} /> Accept this quote
              </>
            )}
          </button>
          <button type="button" disabled={pending} onClick={() => setDeclining(true)} className={buttonClass("ghost", "sm")}>
            Decline
          </button>
          <span className="text-[11.5px] text-ink-3">Declining is free and doesn&apos;t cancel your request.</span>
        </div>
      )}
    </div>
  );
}
