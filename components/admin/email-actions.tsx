"use client";

import { useTransition } from "react";
import { bounceEmailAction, clearBounceAction, retryEmailAction, sendDigestAction } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { buttonClass } from "@/components/ui/button";
import { Refresh, Spinner } from "@/components/icons";

export function EmailActions({ outboxId, email }: { outboxId: string; email: string }) {
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const formData = new FormData();
            formData.set("outboxId", outboxId);
            const result = await retryEmailAction(formData);
            push(result.message ?? result.error ?? "Done.", result.error ? "error" : "success");
          })
        }
        className={buttonClass("ghost", "sm", "border border-line")}
      >
        {pending ? <Spinner size={13} /> : <Refresh size={13} />} Retry
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const formData = new FormData();
            formData.set("outboxId", outboxId);
            formData.set("email", email);
            const result = await bounceEmailAction(formData);
            push(result.message ?? result.error ?? "Done.", result.error ? "error" : "info");
          })
        }
        className={buttonClass("ghost", "sm", "border border-line text-ink-3")}
      >
        Simulate bounce
      </button>
    </div>
  );
}

export function ClearBounceButton({ userId, email }: { userId: string; email: string }) {
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const formData = new FormData();
          formData.set("userId", userId);
          const result = await clearBounceAction(formData);
          push(result.message ?? result.error ?? `Cleared ${email}.`, result.error ? "error" : "success");
        })
      }
      className={buttonClass("secondary", "sm")}
    >
      {pending ? <Spinner size={13} /> : null} Clear bounce
    </button>
  );
}

export function DigestButton() {
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await sendDigestAction();
          push(result.message ?? result.error ?? "Queued.", result.error ? "error" : "success");
        })
      }
      className={buttonClass("secondary", "sm")}
    >
      {pending ? <Spinner size={13} /> : null} Email me this week&apos;s digest
    </button>
  );
}
