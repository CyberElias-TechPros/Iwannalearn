"use client";

import { useState, useTransition } from "react";
import { addInternalNoteAction, togglePriorityAction, updateStatusAction } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { buttonClass } from "@/components/ui/button";
import { STATUS_META, type RequestStatus } from "@/lib/status";
import { Check, Sparkle } from "@/components/icons";

const FLOW: RequestStatus[] = [
  "submitted",
  "under_review",
  "planned",
  "in_production",
  "waitlisted",
  "fulfilled",
  "declined",
];

export function StatusControl({
  requestId,
  status,
  priorityFlag,
}: {
  requestId: string;
  status: string;
  priorityFlag: number;
}) {
  const [next, setNext] = useState(status);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [pinning, startPin] = useTransition();
  const { push } = useToast();

  function apply() {
    const formData = new FormData();
    formData.set("requestId", requestId);
    formData.set("status", next);
    if (next === "declined") formData.set("reason", reason);
    startTransition(async () => {
      const result = await updateStatusAction(formData);
      if (result?.error) push(result.error, "error");
      else push(result?.message ?? "Status updated.", "success");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1">
          <label htmlFor={`status-${requestId}`} className="mb-1 block text-[12px] font-semibold text-ink-2">
            Move this request
          </label>
          <select
            id={`status-${requestId}`}
            value={next}
            onChange={(event) => setNext(event.target.value)}
            className="h-10 w-full rounded-xl border border-line-strong bg-card px-3 text-[13.5px]"
          >
            {FLOW.map((value) => (
              <option key={value} value={value}>
                {STATUS_META[value].label} — {STATUS_META[value].learnerLabel}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={apply}
          disabled={pending || next === status}
          className={buttonClass("secondary", "md", "h-10")}
        >
          {pending ? "Saving…" : "Apply"}
        </button>
        <button
          type="button"
          onClick={() =>
            startPin(async () => {
              await togglePriorityAction(requestId);
              push(priorityFlag ? "Pin removed." : "Pinned to the top of the queue.", "info");
            })
          }
          disabled={pinning}
          className={buttonClass("ghost", "md", "h-10 border border-line")}
        >
          {priorityFlag ? "★ Unpin" : "☆ Pin"}
        </button>
      </div>

      {next === "declined" && (
        <div>
          <label htmlFor={`reason-${requestId}`} className="mb-1 block text-[12px] font-semibold text-ink-2">
            Reason shown to the learner (be plain and kind)
          </label>
          <textarea
            id={`reason-${requestId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="We can't cover financial advice — but we can teach you how to read a balance sheet."
            className="min-h-[68px] w-full rounded-xl border border-line-strong bg-card px-3 py-2 text-[13.5px] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
          />
        </div>
      )}
    </div>
  );
}

export function InternalNotes({
  requestId,
  notes,
}: {
  requestId: string;
  notes: { id: string; message: string; createdAt: string; authorName: string | null }[];
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  function save() {
    if (!value.trim()) return;
    const formData = new FormData();
    formData.set("requestId", requestId);
    formData.set("message", value);
    startTransition(async () => {
      const result = await addInternalNoteAction(formData);
      if (result?.error) push(result.error, "error");
      else {
        setValue("");
        push("Note saved — learners never see this.", "success");
      }
    });
  }

  return (
    <div>
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-3">
        <Sparkle size={12} /> Internal notes · never visible to learners
      </p>

      {notes.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg bg-warn-soft/70 px-3 py-2 text-[12.5px] leading-relaxed text-ink-2">
              {note.message}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex gap-2">
        <label htmlFor={`note-${requestId}`} className="sr-only">
          Add an internal note
        </label>
        <input
          id={`note-${requestId}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && save()}
          placeholder="Needs a follow-up question about their data…"
          className="h-9 flex-1 rounded-full border border-line-strong bg-card px-3.5 text-[13px] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
        />
        <button type="button" onClick={save} disabled={pending || !value.trim()} className={buttonClass("ghost", "sm", "border border-line h-9")}>
          {pending ? "Saving…" : <><Check size={13} /> Save</>}
        </button>
      </div>
    </div>
  );
}
