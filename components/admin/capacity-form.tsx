"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { setCapacityAction, type ActionState } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { buttonClass } from "@/components/ui/button";

const initial: ActionState = {};

export function CapacityForm({ capacity, queueSize }: { capacity: string; queueSize: number }) {
  const [state, formAction] = useActionState(setCapacityAction, initial);
  const { push } = useToast();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (state.ok && state.message && state.message !== last.current) {
      last.current = state.message;
      push(state.message, "success");
    }
    if (state.error) push(state.error, "error");
  }, [state, push]);

  const over = queueSize > Number(capacity);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="capacity" className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
          Filming capacity / week
        </label>
        <input
          id="capacity"
          name="capacity"
          type="number"
          min={0}
          max={50}
          defaultValue={capacity}
          className="h-9 w-20 rounded-lg border border-line-strong bg-card px-2.5 text-[13.5px] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
        />
      </div>
      <SaveButton />
      <p className="w-full text-[11.5px] text-ink-3 sm:w-auto">
        {over
          ? `${queueSize} in the queue — over capacity, so new requests should go to the waitlist.`
          : `${queueSize} in the queue — within capacity.`}
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
