"use client";

import { useState, useTransition } from "react";
import { updateStatusAction } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { buttonClass } from "@/components/ui/button";
import { Check, Close, Spinner } from "@/components/icons";

const DECLINE_REASONS = [
  "It's medical advice — not something we can teach responsibly.",
  "It's legal or financial advice, which needs a licensed professional.",
  "It's someone else's academic work.",
  "It can't be taught safely without hands-on supervision.",
];

export function ModerationDecision({
  requestId,
  title,
  compact = false,
}: {
  requestId: string;
  title: string;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "decline">("idle");
  const [reason, setReason] = useState(DECLINE_REASONS[0]);
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  function move(status: "planned" | "declined", declineReason?: string) {
    const formData = new FormData();
    formData.set("requestId", requestId);
    formData.set("status", status);
    if (declineReason) formData.set("reason", declineReason);
    startTransition(async () => {
      const result = await updateStatusAction(formData);
      if (result.error) {
        push(result.error, "error");
        return;
      }
      push(result.message ?? "Done.", status === "declined" ? "info" : "success");
      setMode("idle");
    });
  }

  if (mode === "decline") {
    return (
      <div className="mt-2 rounded-xl border border-danger/25 bg-danger-soft/30 p-3">
        <label htmlFor={`reason-${requestId}`} className="block text-[11.5px] font-semibold text-danger">
          Reason shown to the learner
        </label>
        <select
          id={`reason-${requestId}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 h-8 w-full rounded-lg border border-line-strong bg-card px-2 text-[12px]"
        >
          {DECLINE_REASONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => move("declined", reason)}
            className={buttonClass("danger", "sm")}
          >
            {pending ? (
              <>
                <Spinner size={12} /> Declining…
              </>
            ) : (
              "Decline with this reason"
            )}
          </button>
          <button type="button" onClick={() => setMode("idle")} className={buttonClass("ghost", "sm", "border border-line")}>
            Back
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-ink-3">
          {title.slice(0, 70)} — they&apos;ll get an email with this exact wording and a link to the policy.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "mt-2.5"}`}>
      <button type="button" disabled={pending} onClick={() => move("planned")} className={buttonClass("primary", "sm")}>
        {pending ? <Spinner size={12} /> : <Check size={13} />} Looks fine — schedule it
      </button>
      <button
        type="button"
        onClick={() => setMode("decline")}
        className={buttonClass("ghost", "sm", "border border-line text-ink-3 hover:border-danger/30 hover:text-danger")}
      >
        <Close size={12} /> Can&apos;t take this one
      </button>
    </div>
  );
}
