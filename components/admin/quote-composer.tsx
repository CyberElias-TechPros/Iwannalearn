"use client";

import { useActionState, useState } from "react";
import { proposeQuoteAction, type ActionState } from "@/lib/actions";
import { buttonClass } from "@/components/ui/button";
import { Spinner } from "@/components/icons";
import type { PaidTier } from "@/lib/pricing";

const initial: ActionState = { ok: false };

/**
 * Quote composer. Kept on one screen with the defaults pre-filled, because
 * quoting should take twelve seconds, not a form-filling session.
 */
export function QuoteComposer({
  requestId,
  tier,
  title,
  floorLabel,
  defaults,
  existing,
}: {
  requestId: string;
  tier: PaidTier;
  title: string;
  floorLabel: string;
  defaults: { scope: string; deliverables: string; turnaroundDays: number; revisions: number };
  existing?: { amountKobo: number; status: string } | null;
}) {
  const [state, formAction, pending] = useActionState(proposeQuoteAction, initial);
  const [open, setOpen] = useState(!existing);
  const fixed = tier === "priority";

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary", "sm")}>
        {existing?.status === "proposed" ? "Revise quote" : "Send a quote"}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-2.5 rounded-xl border border-line bg-paper-2/40 p-3.5">
      <input type="hidden" name="requestId" value={requestId} />

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_6rem]">
        <div>
          <label htmlFor={`amount-${requestId}`} className="text-[12px] font-semibold">
            Price (₦)
          </label>
          <input
            id={`amount-${requestId}`}
            name="amountNaira"
            type="number"
            inputMode="numeric"
            min={fixed ? floorLabel.replace(/[^0-9]/g, "") : 25000}
            step={500}
            defaultValue={existing ? existing.amountKobo / 100 : fixed ? floorLabel.replace(/[^0-9]/g, "") : 25000}
            readOnly={fixed}
            required
            className="mt-0.5 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-[13px] tabular-nums outline-none focus:border-brand/50 read-only:bg-paper-2"
          />
        </div>
        <div>
          <label htmlFor={`days-${requestId}`} className="text-[12px] font-semibold">
            Days
          </label>
          <input
            id={`days-${requestId}`}
            name="turnaroundDays"
            type="number"
            min={1}
            max={60}
            defaultValue={defaults.turnaroundDays}
            className="mt-0.5 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand/50"
          />
        </div>
        <div>
          <label htmlFor={`revs-${requestId}`} className="text-[12px] font-semibold">
            Revisions
          </label>
          <input
            id={`revs-${requestId}`}
            name="revisions"
            type="number"
            min={0}
            max={5}
            defaultValue={defaults.revisions}
            className="mt-0.5 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand/50"
          />
        </div>
      </div>
      <p className="text-[11px] text-ink-3">
        {fixed ? `Priority is a fixed ${floorLabel} — the price is public.` : `Private lessons start at ${floorLabel}; quote above that for bigger scope.`}
      </p>

      <div>
        <label htmlFor={`scope-${requestId}`} className="text-[12px] font-semibold">
          Scope — what they&apos;re paying for
        </label>
        <textarea
          id={`scope-${requestId}`}
          name="scope"
          rows={3}
          required
          minLength={20}
          defaultValue={defaults.scope}
          className="mt-0.5 w-full rounded-lg border border-line bg-card px-2.5 py-2 text-[13px] leading-relaxed outline-none focus:border-brand/50"
        />
        <p className="mt-0.5 text-[11px] text-ink-3">“{title}” — this text is what the learner accepts, so be concrete.</p>
      </div>

      <div>
        <label htmlFor={`deliv-${requestId}`} className="text-[12px] font-semibold">
          Delivered as
        </label>
        <input
          id={`deliv-${requestId}`}
          name="deliverables"
          defaultValue={defaults.deliverables}
          className="mt-0.5 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand/50"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-[12px] font-medium text-danger">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="text-[12px] font-medium text-brand">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
          {pending ? (
            <>
              <Spinner size={13} /> Sending…
            </>
          ) : existing ? (
            "Send revised quote"
          ) : (
            "Send quote — no charge yet"
          )}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "sm")}>
          Cancel
        </button>
      </div>
    </form>
  );
}
