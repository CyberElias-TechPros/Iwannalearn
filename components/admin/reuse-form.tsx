"use client";

import { useState, useTransition } from "react";
import { reuseLessonAction } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { buttonClass } from "@/components/ui/button";
import { Check, Spinner } from "@/components/icons";

type Lesson = {
  requestId: string;
  slug: string;
  videoTitle: string | null;
  replyId: string;
  category: string;
  reuseCount: number;
};

type OpenRequest = { id: string; ref: string; title: string; category: string };

export function ReuseForm({ lesson, requests }: { lesson: Lesson; requests: OpenRequest[] }) {
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState(requests[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const { push } = useToast();

  if (requests.length === 0) {
    return <p className="text-[12px] text-ink-3">No open requests need this lesson right now.</p>;
  }

  if (done) {
    return (
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-brand">
        <Check size={14} /> {done}
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary", "sm")}>
        Send to a request
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-2">
      <label htmlFor={`req-${lesson.replyId}`} className="block text-[11.5px] font-medium text-ink-2">
        Which request does this answer?
      </label>
      <select
        id={`req-${lesson.replyId}`}
        value={requestId}
        onChange={(event) => setRequestId(event.target.value)}
        className="h-9 w-full rounded-lg border border-line-strong bg-card px-2.5 text-[12.5px]"
      >
        {requests.map((request) => (
          <option key={request.id} value={request.id}>
            {request.ref} — {request.title.slice(0, 60)}
          </option>
        ))}
      </select>
      <label htmlFor={`note-${lesson.replyId}`} className="block text-[11.5px] font-medium text-ink-2">
        Note (optional — we&apos;ll add a sensible default)
      </label>
      <textarea
        id={`note-${lesson.replyId}`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="This already covers it — start at 4:20."
        className="min-h-[60px] w-full rounded-lg border border-line-strong bg-card px-2.5 py-1.5 text-[12.5px] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !requestId}
          onClick={() =>
            startTransition(async () => {
              const formData = new FormData();
              formData.set("requestId", requestId);
              formData.set("sourceReplyId", lesson.replyId);
              formData.set("note", note);
              const result = await reuseLessonAction(formData);
              if (result.error) {
                push(result.error, "error");
                return;
              }
              push(result.message ?? "Published from the library.", "success");
              setDone("Sent and the requester was notified.");
            })
          }
          className={buttonClass("primary", "sm")}
        >
          {pending ? (
            <>
              <Spinner size={13} /> Publishing…
            </>
          ) : (
            "Publish & notify"
          )}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "sm", "border border-line")}>
          Cancel
        </button>
      </div>
    </div>
  );
}
