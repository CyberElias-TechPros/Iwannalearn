"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelRequestAction } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/icons";

export function CancelRequest({ requestId }: { requestId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const { push } = useToast();
  const router = useRouter();

  function withdraw() {
    const formData = new FormData();
    formData.set("requestId", requestId);
    startTransition(async () => {
      const result = await cancelRequestAction(formData);
      if (result.error) {
        push(result.error, "error");
        return;
      }
      push(result.message ?? "Withdrawn.", "info");
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full rounded-full border border-line px-4 py-2 text-[12.5px] font-medium text-ink-3 transition hover:border-danger/30 hover:text-danger"
      >
        Withdraw this request
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-danger/25 bg-danger-soft/40 p-3">
      <p className="text-[12.5px] leading-relaxed text-ink-2">
        Withdraw it? You can always ask again — nothing is held against you.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={withdraw}
          disabled={pending}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-danger px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
        >
          {pending ? (
            <>
              <Spinner size={12} /> Withdrawing…
            </>
          ) : (
            "Yes, withdraw"
          )}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-ink-2"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
