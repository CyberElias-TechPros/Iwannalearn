"use client";

import { useState, useTransition } from "react";
import { deleteAccountAction } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { buttonClass } from "@/components/ui/button";
import { Close, Spinner } from "@/components/icons";

export function DangerZone({ email, exportJson }: { email: string; exportJson: string }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportJson);
      push("Your data is on the clipboard — paste it anywhere safe.", "success");
    } catch {
      push("Copy failed. Use the download button instead.", "error");
    }
  }

  function downloadExport() {
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "iwannalearn-my-data.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-semibold">Your data is yours</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">
          Take a copy of everything we hold: your profile, requests, notifications and payments. No email required,
          no waiting.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button type="button" onClick={downloadExport} className={buttonClass("secondary", "sm")}>
            Download my data (JSON)
          </button>
          <button type="button" onClick={copyExport} className={buttonClass("ghost", "sm", "border border-line")}>
            Copy to clipboard
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-danger/25 bg-danger-soft/40 p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-danger">
          <Close size={14} /> Delete my account
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
          Deletes your sessions, notifications, votes, feedback and any private requests entirely. Public lessons you
          inspired stay in the library, detached from your identity. This cannot be undone.
        </p>

        {confirming ? (
          <div className="mt-3 space-y-2">
            <label htmlFor="confirm-delete" className="block text-[12px] font-medium text-ink-2">
              Type <span className="font-mono">{email}</span> to confirm
            </label>
            <input
              id="confirm-delete"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="h-9 w-full rounded-lg border border-danger/30 bg-card px-3 text-[13px] focus:border-danger focus:outline-none focus:ring-4 focus:ring-danger/10"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || typed.trim().toLowerCase() !== email.toLowerCase()}
                onClick={() => startTransition(async () => { await deleteAccountAction(); })}
                className={buttonClass("danger", "sm")}
              >
                {pending ? (
                  <>
                    <Spinner size={14} /> Deleting…
                  </>
                ) : (
                  "Delete permanently"
                )}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={buttonClass("ghost", "sm", "border border-line")}>
                Keep my account
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={buttonClass("ghost", "sm", "mt-2.5 border border-danger/30 text-danger hover:bg-danger-soft")}>
            Start deletion
          </button>
        )}
      </div>
    </div>
  );
}
