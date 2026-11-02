"use client";

import { useState, useTransition } from "react";
import { submitFeedbackAction } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { Check, ThumbDown, ThumbUp } from "@/components/icons";
import { cn } from "@/lib/cn";

export function FeedbackPrompt({
  requestId,
  signedIn,
  existing,
}: {
  requestId: string;
  signedIn: boolean;
  existing: { helpful: number; comment: string | null } | null;
}) {
  const [sent, setSent] = useState(Boolean(existing));
  const [helpful, setHelpful] = useState(existing?.helpful === 1);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  function send(value: boolean) {
    if (!signedIn) {
      push("Sign in to leave feedback — it shapes what gets made next.", "info");
      return;
    }
    setHelpful(value);
    setSent(true);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("requestId", requestId);
      formData.set("helpful", value ? "1" : "0");
      formData.set("comment", comment);
      const result = await submitFeedbackAction(formData);
      if (result?.error) push(result.error, "error");
      else push(result?.message ?? "Thanks for the note.", value ? "success" : "info");
    });
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-brand/20 bg-brand-soft/60 px-4 py-3.5">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-brand-strong">
          <Check size={15} /> Thanks — noted.
        </p>
        <p className="mt-1 text-[13px] text-ink-2">
          {helpful
            ? "Glad it landed. We use this to decide which requests to take on next."
            : "That's useful. Tell us what was missing and we'll do better on the next one."}
        </p>
        <form
          className="mt-2.5 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            send(helpful);
          }}
        >
          <label htmlFor="feedback-comment" className="sr-only">
            What would have made it better?
          </label>
          <input
            id="feedback-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Anything to add? (optional)"
            className="h-10 flex-1 rounded-full border border-line-strong bg-card px-4 text-[13.5px] outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-full bg-brand px-4 text-[13px] font-medium text-white hover:bg-brand-strong disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-4">
      <p className="text-[14px] font-semibold">Did this solve it?</p>
      <p className="mt-0.5 text-[13px] text-ink-3">One tap. It decides what we film next and what we fix.</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => send(true)}
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-line-strong bg-card px-4 py-2 text-[13.5px] font-medium transition hover:border-brand/40 hover:text-brand",
          )}
        >
          <ThumbUp size={16} /> Yes, it helped
        </button>
        <button
          type="button"
          onClick={() => send(false)}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-card px-4 py-2 text-[13.5px] font-medium text-ink-2 transition hover:border-danger/40 hover:text-danger"
        >
          <ThumbDown size={16} /> Not really
        </button>
      </div>
    </div>
  );
}
