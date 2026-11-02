"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestRefundAction } from "@/lib/actions";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Alert, Check, Clock, Spinner } from "@/components/icons";

const REASONS = [
  "The scope we agreed isn't what I need any more",
  "It arrived later than the agreed turnaround",
  "What was delivered doesn't match the agreed scope",
  "I no longer need this",
  "Something else",
];

/**
 * Learner-side refund. Deliberately low-friction and non-accusatory: choosing a
 * reason writes a claim, it does not claw money back on its own.
 */
export function RefundRequest({
  requestId,
  existing,
  amountLabel,
}: {
  requestId: string;
  existing: { status: "open" | "approved" | "declined"; reason: string; resolution: string | null } | null;
  amountLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  if (existing) {
    const copy =
      existing.status === "open"
        ? "You asked for a refund. We'll reply here and by email — nothing else will be charged while it's open."
        : existing.status === "approved"
          ? "Refunded. The money went back to your original payment method and access to the recording is closed."
          : `We couldn't approve this one.${existing.resolution ? ` ${existing.resolution}` : ""}`;
    return (
      <div
        className={
          existing.status === "approved"
            ? "rounded-xl border border-brand/25 bg-brand-soft/50 p-4"
            : "rounded-xl border border-warn/25 bg-warn-soft/50 p-4"
        }
      >
        <p className="flex items-center gap-1.5 text-[13px] font-semibold">
          {existing.status === "approved" ? <Check size={14} /> : <Clock size={14} />}
          {existing.status === "open" ? "Refund requested" : existing.status === "approved" ? "Refunded" : "Request declined"}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{copy}</p>
        <p className="mt-1 text-[11.5px] text-ink-3">Your reason: “{existing.reason}”</p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="rounded-xl border border-line bg-paper-2/40 p-4">
        <p className="text-[13px] font-semibold">Something wrong with this one?</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
          You paid {amountLabel}. If what arrived doesn&apos;t match the scope we agreed, ask for a refund — it goes
          straight to Elias, and you never have to argue for it.
        </p>
        <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary", "sm", "mt-2")}>
          Request a refund
        </button>
      </div>
    );
  }

  return (
    <form
      className="rounded-xl border border-line bg-paper-2/40 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await requestRefundAction(requestId, `${reason}. ${detail}`.trim());
          if (!result.ok) {
            setError(result.error ?? "Could not send that.");
            return;
          }
          push("Sent. We'll reply by email, usually within a day.", "success");
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <p className="text-[13px] font-semibold">Request a refund</p>

      <label htmlFor="refund-reason" className="mt-2 block text-[12px] font-medium">
        What happened?
      </label>
      <select
        id="refund-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="mt-0.5 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand/50"
      >
        {REASONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <label htmlFor="refund-detail" className="mt-2 block text-[12px] font-medium">
        Anything else? (optional)
      </label>
      <textarea
        id="refund-detail"
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        rows={2}
        maxLength={600}
        placeholder="What would make this right?"
        className="mt-0.5 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand/50"
      />

      <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-3">
        <Alert size={12} className="mt-0.5 shrink-0" />
        Asking doesn&apos;t close your access — a person reviews it first, usually within one working day.
      </p>

      {error && (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-danger">
          {error}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
          {pending ? (
            <>
              <Spinner size={13} /> Sending…
            </>
          ) : (
            "Send refund request"
          )}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "sm")}>
          Cancel
        </button>
      </div>
    </form>
  );
}
