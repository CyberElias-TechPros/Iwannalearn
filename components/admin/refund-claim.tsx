"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { resolveRefundAction, type ActionState } from "@/lib/actions";
import { buttonClass } from "@/components/ui/button";
import { Spinner } from "@/components/icons";

const initial: ActionState = { ok: false };

/** One open learner refund claim, with both decisions one click away. */
export function RefundClaim({
  id,
  reason,
  amountLabel,
  learner,
  slug,
  createdAt,
}: {
  id: string;
  reason: string;
  amountLabel: string;
  learner: string | null;
  slug: string;
  createdAt: string;
}) {
  const [state, formAction, pending] = useActionState(resolveRefundAction, initial);
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<"approve" | "decline" | null>(null);

  return (
    <div className="rounded-xl border border-warn/25 bg-warn-soft/40 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">
            Refund requested · {amountLabel}
          </p>
          <p className="text-[11.5px] text-ink-3">
            {learner ?? "Learner"} ·{" "}
            <Link href={`/requests/${slug}`} className="font-medium text-brand hover:underline">
              open request
            </Link>{" "}
            · {createdAt}
          </p>
        </div>
      </div>

      <p className="mt-1.5 rounded-lg bg-card/70 px-2.5 py-2 text-[12.5px] leading-relaxed text-ink-2">“{reason}”</p>

      {state.message && (
        <p role="status" className="mt-1.5 text-[12px] font-medium text-brand">
          {state.message}
        </p>
      )}
      {state.error && (
        <p role="alert" className="mt-1.5 text-[12px] font-medium text-danger">
          {state.error}
        </p>
      )}

      {decision ? (
        <form action={formAction} className="mt-2 space-y-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value={decision} />
          <label htmlFor={`note-${id}`} className="text-[12px] font-medium">
            {decision === "approve" ? "Optional note for the receipt" : "Tell them why (they'll see this)"}
          </label>
          <textarea
            id={`note-${id}`}
            name="note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand/50"
            placeholder={
              decision === "approve" ? "Refunded — sorry it wasn't the right fit." : "The scope was delivered as agreed; happy to redo one section."
            }
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={buttonClass(decision === "approve" ? "danger" : "secondary", "sm")}>
              {pending ? <Spinner size={13} /> : null}
              {decision === "approve" ? "Approve and refund" : "Decline with note"}
            </button>
            <button type="button" onClick={() => setDecision(null)} className={buttonClass("ghost", "sm")}>
              Back
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setDecision("approve")} className={buttonClass("danger", "sm")}>
            Approve refund
          </button>
          <button type="button" onClick={() => setDecision("decline")} className={buttonClass("ghost", "sm")}>
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
