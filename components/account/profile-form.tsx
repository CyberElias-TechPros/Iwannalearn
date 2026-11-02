"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfileAction, type ActionState } from "@/lib/actions";
import { Field, Input } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { Check, Spinner } from "@/components/icons";

const initial: ActionState = {};

export function ProfileForm({
  user,
}: {
  user: { name: string | null; email: string; phone: string | null; notifyEmail: number; notifyViaSms: number; digestOptIn: number };
}) {
  const [state, formAction] = useActionState(updateProfileAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="What should we call you?" htmlFor="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" defaultValue={user.name ?? ""} maxLength={80} required />
      </Field>

      <Field label="Email" htmlFor="email" hint="Where lesson notifications go. Changing it needs re-verification, so it's fixed for now.">
        <Input id="email" defaultValue={user.email} disabled />
      </Field>

      <Field
        label="Phone (for optional WhatsApp/SMS)"
        htmlFor="phone"
        optional
        error={state.fieldErrors?.phone}
        hint="Only used if you switch on SMS below. Numbers are stored unformatted and never shared."
      >
        <Input id="phone" name="phone" defaultValue={user.phone ?? ""} placeholder="+234 801 234 5678" maxLength={24} />
      </Field>

      <fieldset className="space-y-2 rounded-xl border border-line bg-paper-2/40 p-4">
        <legend className="px-1 text-[13px] font-semibold">How you want to hear from us</legend>

        <Toggle name="notifyEmail" defaultChecked={user.notifyEmail === 1} label="Email" hint="The return trigger. Recommended." />
        <Toggle
          name="notifySms"
          defaultChecked={user.notifyViaSms === 1}
          label="WhatsApp / SMS"
          hint="Needs a phone number. Instant, but we only send the important one: your lesson is ready."
        />
        <Toggle
          name="digest"
          defaultChecked={user.digestOptIn === 1}
          label="Occasional digest"
          hint="A short round-up of new lessons in topics you've asked about. Never marketing spam."
        />
      </fieldset>

      {state.error && (
        <p role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="flex items-center gap-1.5 rounded-lg border border-brand/25 bg-brand-soft px-3 py-2 text-[13px] font-medium text-brand-strong">
          <Check size={14} /> {state.message}
        </p>
      )}

      <SaveButton />
    </form>
  );
}

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
      />
      {/* Fallback value: appears after the checkbox so a checked box wins. */}
      <input type="hidden" name={name} value="0" />
      <span>
        <span className="block text-[13.5px] font-medium">{label}</span>
        <span className="block text-[12px] leading-snug text-ink-3">{hint}</span>
      </span>
    </label>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>
      {pending ? (
        <>
          <Spinner size={16} /> Saving…
        </>
      ) : (
        "Save preferences"
      )}
    </button>
  );
}
