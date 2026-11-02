"use client";

import { useState, useTransition } from "react";
import { confirmDeliveryAction, requestRevisionAction } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { buttonClass } from "@/components/ui/button";
import { Check, Clock, Spinner } from "@/components/icons";

export function DeliveryActions({
  requestId,
  revisionState,
  deliveryConfirmedAt,
  windowDays,
  fulfilledAt,
}: {
  requestId: string;
  revisionState: string;
  deliveryConfirmedAt: string | null;
  windowDays: number;
  fulfilledAt: string | null;
}) {
  const [mode, setMode] = useState<"idle" | "revision">("idle");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  if (deliveryConfirmedAt) {
    return (
      <div className="rounded-xl border border-brand/25 bg-brand-soft/60 p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-strong">
          <Check size={14} /> Delivery confirmed and closed
        </p>
        <p className="mt-1 text-[12.5px] text-ink-2">
          Thanks — that closes the loop. If something changes, message us and we&apos;ll pick it up.
        </p>
      </div>
    );
  }

  const daysLeft = fulfilledAt
    ? Math.max(0, windowDays - Math.floor((Date.now() - new Date(fulfilledAt).getTime()) / 864e5))
    : null;

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <p className="text-[13px] font-semibold">Does this cover what you paid for?</p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">
        One revision is included
        {daysLeft !== null ? `, and the ${windowDays}-day window closes in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}` : ""}.
        Confirming closes the request — it also protects you if anything ever goes wrong.
      </p>

      {mode === "revision" ? (
        <div className="mt-2.5 space-y-2">
          <label htmlFor="revision-note" className="block text-[12px] font-medium">
            What missed the mark?
          </label>
          <textarea
            id="revision-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="The audio drops out at 4:00, and the export step needs to show our folder structure."
            className="min-h-[80px] w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-[13px] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || note.trim().length < 10 || revisionState === "requested"}
              onClick={() => {
                const formData = new FormData();
                formData.set("requestId", requestId);
                formData.set("note", note);
                startTransition(async () => {
                  const result = await requestRevisionAction(formData);
                  if (result.error) push(result.error, "error");
                  else {
                    push(result.message ?? "Revision requested.", "success");
                    setMode("idle");
                  }
                });
              }}
              className={buttonClass("primary", "sm")}
            >
              {pending ? (
                <>
                  <Spinner size={14} /> Sending…
                </>
              ) : (
                "Request my revision"
              )}
            </button>
            <button type="button" onClick={() => setMode("idle")} className={buttonClass("ghost", "sm", "border border-line")}>
              Cancel
            </button>
          </div>
          {revisionState === "requested" && (
            <p className="flex items-center gap-1.5 text-[12px] text-warn">
              <Clock size={12} /> You&apos;ve already used the included revision on this lesson.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || revisionState === "requested"}
            onClick={() => {
              const formData = new FormData();
              formData.set("requestId", requestId);
              startTransition(async () => {
                const result = await confirmDeliveryAction(formData);
                if (result.error) push(result.error, "error");
                else push(result.message ?? "Confirmed.", "success");
              });
            }}
            className={buttonClass("primary", "sm")}
          >
            {pending ? (
              <>
                <Spinner size={14} /> Saving…
              </>
            ) : (
              <>
                <Check size={14} /> Confirm and close
              </>
            )}
          </button>
          <button type="button" onClick={() => setMode("revision")} className={buttonClass("secondary", "sm")}>
            Ask for one revision
          </button>
        </div>
      )}
    </div>
  );
}
