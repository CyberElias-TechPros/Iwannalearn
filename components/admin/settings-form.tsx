"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveSettingsAction, type ActionState } from "@/lib/actions";
import { Field, Input, Select } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { Check, Spinner } from "@/components/icons";

const initial: ActionState = {};

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function SettingsForm({
  settings,
}: {
  settings: { vatRate: string; refundWindow: string; supportEmail: string; digestDay: string };
}) {
  const [state, formAction] = useActionState(saveSettingsAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="VAT rate (%)" htmlFor="vatRate" hint="Stored inclusive: a ₦25,000 price already contains it." error={state.fieldErrors?.vatRate}>
          <Input id="vatRate" name="vatRate" type="number" step="0.1" min="0" max="50" defaultValue={settings.vatRate} />
        </Field>
        <Field label="Refund / revision window (days)" htmlFor="refundWindow" hint="How long a learner has to ask for the included revision." error={state.fieldErrors?.refundWindow}>
          <Input id="refundWindow" name="refundWindow" type="number" min="0" max="90" defaultValue={settings.refundWindow} />
        </Field>
      </div>

      <Field label="Support email" htmlFor="supportEmail" hint="Shown on the contact page and used as the reply-to." error={state.fieldErrors?.supportEmail}>
        <Input id="supportEmail" name="supportEmail" type="email" defaultValue={settings.supportEmail} />
      </Field>

      <Field label="Digest day" htmlFor="digestDay" hint="When the weekly cron should run. The endpoint is idempotent per week.">
        <Select id="digestDay" name="digestDay" defaultValue={settings.digestDay}>
          {DAYS.map((day) => (
            <option key={day} value={day}>
              {day[0].toUpperCase() + day.slice(1)}
            </option>
          ))}
        </Select>
      </Field>

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

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>
      {pending ? (
        <>
          <Spinner size={15} /> Saving…
        </>
      ) : (
        "Save settings"
      )}
    </button>
  );
}
