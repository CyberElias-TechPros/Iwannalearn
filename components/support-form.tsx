"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { supportAction, type ActionState } from "@/lib/actions";
import { Field, Input, Textarea } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { Check, Spinner } from "@/components/icons";

const initial: ActionState = {};

export function SupportForm({
  defaultEmail,
  defaultName,
  sent,
  error,
}: {
  defaultEmail: string;
  defaultName: string;
  sent: boolean;
  error?: string;
}) {
  const [state, formAction] = useActionState(supportAction, initial);
  const showSuccess = state.ok || sent;

  if (showSuccess) {
    return (
      <div className="rounded-xl border border-brand/25 bg-brand-soft/60 p-5">
        <p className="flex items-center gap-1.5 text-[15px] font-semibold text-brand-strong">
          <Check size={16} /> Message received
        </p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
          {state.message ??
            "We've got it and a confirmation is on its way to your inbox. You'll hear back within one working day."}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3.5">
      <Field label="Your email" htmlFor="contact-email" error={state.fieldErrors?.email}>
        <Input
          id="contact-email"
          name="email"
          type="email"
          defaultValue={state.fieldErrors?.email ? "" : defaultEmail}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </Field>

      <Field label="Subject" htmlFor="contact-subject" error={state.fieldErrors?.subject}>
        <Input id="contact-subject" name="subject" placeholder="Question about a private lesson" maxLength={140} required />
      </Field>

      <Field
        label="Message"
        htmlFor="contact-body"
        hint="If it's about a request, paste the reference (e.g. REQ-1013) and we'll find it instantly."
        error={state.fieldErrors?.body}
      >
        <Textarea id="contact-body" name="body" rows={6} maxLength={2000} required />
      </Field>

      {(state.error || error) && (
        <p role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
          {state.error ?? error}
        </p>
      )}

      <SubmitButton signedIn={Boolean(defaultName)} />
    </form>
  );
}

function SubmitButton({ signedIn }: { signedIn: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="space-y-1.5">
      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full justify-center")}>
        {pending ? (
          <>
            <Spinner size={15} /> Sending…
          </>
        ) : (
          "Send message"
        )}
      </button>
      <p className="text-[11.5px] leading-relaxed text-ink-3">
        {signedIn
          ? "We'll reply to the email above. Your account is already attached so we can see your request history."
          : "We only use your email to reply to this message. No newsletter, no follow-ups you didn't ask for."}
      </p>
    </div>
  );
}
