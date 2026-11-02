"use client";

import { useRef, useState, useTransition } from "react";
import { postReplyAction, type ActionState } from "@/lib/actions";
import { Field, Input, Textarea } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Check, Sparkle, Spinner } from "@/components/icons";

export function ReplyForm({ requestId, hasLesson }: { requestId: string; hasLesson: boolean }) {
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const { push } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [formKey, setFormKey] = useState(0);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("requestId", requestId);
    startTransition(async () => {
      const result = await postReplyAction(formData);
      setState(result);
      if (result?.ok) push(result.message ?? "Published.", "success");
      else if (result?.error) push(result.error, "error");
    });
  }

  if (state.ok) {
    return (
      <div className="rounded-xl border border-brand/25 bg-brand-soft/60 p-4">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-brand-strong">
          <Check size={16} /> {state.message ?? "Published."}
        </p>
        <p className="mt-1 text-[13px] text-ink-2">
          The lesson page is live and the outbox shows exactly what was sent to each person.
        </p>
        <button
          type="button"
          onClick={() => {
            setFormKey((k) => k + 1);
            window.location.reload();
          }}
          className={buttonClass("secondary", "sm", "mt-3")}
        >
          Back to publishing tools
        </button>
      </div>
    );
  }

  return (
    <form key={formKey} ref={formRef} onSubmit={handleSubmit} className="space-y-3.5">
      <input type="hidden" name="requestId" value={requestId} />

      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Sparkle size={14} />
        </span>
        <div>
          <p className="text-[14px] font-semibold">{hasLesson ? "Replace or add a lesson" : "Attach the lesson"}</p>
          <p className="text-[12px] text-ink-3">Paste the YouTube link — it publishes and notifies everyone instantly.</p>
        </div>
      </div>

      <Field label="YouTube link" htmlFor={`videoUrl-${requestId}`} hint="Accepts watch, youtu.be, shorts and live links." error={state.fieldErrors?.videoUrl}>
        <Input
          id={`videoUrl-${requestId}`}
          name="videoUrl"
          type="url"
          placeholder="https://youtu.be/…"
          invalid={Boolean(state.fieldErrors?.videoUrl)}
          required
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <Field label="Lesson title" htmlFor={`videoTitle-${requestId}`} hint="What the learner will see at the top." error={state.fieldErrors?.videoTitle}>
          <Input
            id={`videoTitle-${requestId}`}
            name="videoTitle"
            placeholder="e.g. Merge two CSVs without losing headers"
            maxLength={140}
            invalid={Boolean(state.fieldErrors?.videoTitle)}
            required
          />
        </Field>
        <Field label="Length" htmlFor={`videoLength-${requestId}`} optional>
          <Input id={`videoLength-${requestId}`} name="videoLength" placeholder="8 min" maxLength={20} />
        </Field>
      </div>

      <Field
        label="Note to the learner"
        htmlFor={`message-${requestId}`}
        hint="Where to start, what to skip, what to notice. Written to one person, not a crowd."
        error={state.fieldErrors?.message}
      >
        <Textarea
          id={`message-${requestId}`}
          name="message"
          placeholder="Start at 0:40 — the first section is context you already have…"
          invalid={Boolean(state.fieldErrors?.message)}
          required
        />
      </Field>

      <Field
        label="Resources"
        htmlFor={`resources-${requestId}`}
        optional
        hint="One per line: Label | https://link"
      >
        <Textarea
          id={`resources-${requestId}`}
          name="resources"
          placeholder={"Starter file | https://example.com/starter.csv"}
          className="min-h-[70px]"
        />
      </Field>

      {state.error && (
        <p role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-ink-3">
          {pending ? "Publishing and notifying…" : "Everyone who asked or voted gets an email + in-app notification."}
        </p>
        <SubmitButton hasLesson={hasLesson} pending={pending} />
      </div>
    </form>
  );
}

function SubmitButton({ hasLesson, pending }: { hasLesson: boolean; pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "shrink-0")}>
      {pending ? (
        <>
          <Spinner size={16} /> Publishing…
        </>
      ) : (
        <>{hasLesson ? "Publish update" : "Publish & notify"}</>
      )}
    </button>
  );
}
