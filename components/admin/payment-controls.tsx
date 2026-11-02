"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { refundPaymentAction, setPaymentsModeAction, type ActionState } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { buttonClass } from "@/components/ui/button";
import { Alert, Spinner } from "@/components/icons";

const initial: ActionState = {};

export function PaymentsModeForm({ mode }: { mode: string }) {
  const [state, formAction] = useActionState(setPaymentsModeAction, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="mode" className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
          Payments mode
        </label>
        <select
          id="mode"
          name="mode"
          defaultValue={mode}
          className="h-9 rounded-lg border border-line-strong bg-card px-2.5 text-[13px]"
        >
          <option value="off">Off — no charging</option>
          <option value="mock">Test — full path, no money</option>
          <option value="live">Live — real payments</option>
        </select>
      </div>
      <SaveButton />
      <p className="w-full text-[11.5px] text-ink-3">
        {state.error ? <span className="text-danger">{state.error}</span> : state.message ?? "Live mode requires provider keys in the environment."}
      </p>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("secondary", "sm")}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function RefundButton({ reference, amountLabel }: { reference: string; amountLabel: string }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonClass("ghost", "sm", "border border-line text-ink-3")}>
        Refund
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-danger/25 bg-danger-soft/40 p-3">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-danger">
        <Alert size={13} /> Refund {amountLabel}
      </p>
      <label htmlFor={`reason-${reference}`} className="mt-1.5 block text-[11.5px] text-ink-2">
        Reason (shown to the learner)
      </label>
      <input
        id={`reason-${reference}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Scope couldn't be met — full refund"
        className="mt-1 h-8 w-full rounded-lg border border-line-strong bg-card px-2.5 text-[12.5px] focus:border-danger focus:outline-none focus:ring-4 focus:ring-danger/10"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending || reason.trim().length < 4}
          onClick={() =>
            startTransition(async () => {
              const formData = new FormData();
              formData.set("reference", reference);
              formData.set("reason", reason.trim());
              const result = await refundPaymentAction(formData);
              push(result.message ?? result.error ?? "Done.", result.error ? "error" : "success");
              setConfirming(false);
            })
          }
          className={buttonClass("danger", "sm")}
        >
          {pending ? (
            <>
              <Spinner size={13} /> Refunding…
            </>
          ) : (
            "Refund & revoke access"
          )}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={buttonClass("ghost", "sm", "border border-line")}>
          Cancel
        </button>
      </div>
    </div>
  );
}
