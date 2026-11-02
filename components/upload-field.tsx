"use client";

import { useRef, useState } from "react";
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES, humanSize } from "@/lib/upload-rules";
import { buttonClass } from "@/components/ui/button";
import { Check, Close, Spinner, Upload } from "@/components/icons";

export type StagedFile = { id: string; filename: string; size: number };

/**
 * Attachment picker. Uploads immediately (so a large file isn't lost when the
 * user navigates away), then hands the ids to the form on submit.
 */
export function UploadField({
  files,
  onChange,
  max = 5,
  label = "Add screenshots, data files or documents",
}: {
  files: StagedFile[];
  onChange: (files: StagedFile[]) => void;
  max?: number;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`${file.name} is ${humanSize(file.size)} — the limit is 10 MB.`);
      return;
    }

    setBusy((n) => n + 1);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body });
      const payload = (await response.json()) as { ok: boolean; id?: string; error?: string };

      if (!payload.ok || !payload.id) {
        setError(payload.error ?? "That upload didn't work. Try again.");
        return;
      }
      onChange([...files, { id: payload.id, filename: file.name, size: file.size }]);
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setBusy((n) => n - 1);
    }
  }

  async function remove(id: string) {
    onChange(files.filter((file) => file.id !== id));
    // Best-effort cleanup; the record is deleted on submit anyway if abandoned.
    void fetch(`/api/uploads/${id}`, { method: "DELETE" }).catch(() => {});
  }

  const full = files.length >= max;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14.5px] font-semibold">{label}</p>
        <span className="text-[12px] text-ink-3">Optional · up to {max} files, 10 MB each</span>
      </div>
      <p className="text-[13px] leading-snug text-ink-3">
        A screenshot of the error, the spreadsheet, the folder structure — whatever makes your situation concrete.
        Files stay private: only you and Elias can open them.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple
        className="sr-only"
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          event.target.value = "";
          for (const file of selected.slice(0, max - files.length)) void upload(file);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={full || busy > 0}
          onClick={() => inputRef.current?.click()}
          className={buttonClass("secondary", "sm")}
        >
          {busy > 0 ? (
            <>
              <Spinner size={14} /> Uploading {busy}…
            </>
          ) : (
            <>
              <Upload size={14} /> Choose files
            </>
          )}
        </button>
        <span className="text-[11.5px] text-ink-3">png · jpg · pdf · csv · xlsx · docx · zip · txt</span>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-[12.5px] font-medium text-danger">
          {error}
        </p>
      )}

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper-2/40 px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Check size={13} className="shrink-0 text-brand" />
                <span className="truncate text-[12.5px]">{file.filename}</span>
                <span className="shrink-0 text-[11px] text-ink-3">{humanSize(file.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => remove(file.id)}
                aria-label={`Remove ${file.filename}`}
                className="shrink-0 rounded-full p-1 text-ink-3 transition hover:bg-danger-soft hover:text-danger"
              >
                <Close size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Submitted with the form so the request can claim the staged files. */}
      <input type="hidden" name="uploadIds" value={files.map((file) => file.id).join(",")} />
    </div>
  );
}
