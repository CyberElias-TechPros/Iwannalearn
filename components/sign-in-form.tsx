"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, type ActionState } from "@/lib/actions";
import { Field, Input } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { ArrowRight, Spinner } from "@/components/icons";

const initial: ActionState = {};

export function SignInForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signInAction, initial);

  return (
    <form action={formAction} className="space-y-3.5">
      <input type="hidden" name="next" value={next} />

      <Field label="Email" htmlFor="email" hint="We only use this for your requests and lesson notifications.">
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          invalid={Boolean(state.error)}
        />
      </Field>

      <Field label="Your name" htmlFor="name" optional>
        <Input id="name" name="name" autoComplete="name" placeholder="So we know who to greet" maxLength={80} />
      </Field>

      {state.error && (
        <p role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
      {pending ? (
        <>
          <Spinner size={16} /> Signing in…
        </>
      ) : (
        <>
          Continue <ArrowRight size={16} />
        </>
      )}
    </button>
  );
}
