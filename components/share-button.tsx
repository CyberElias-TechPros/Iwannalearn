"use client";

import { useState } from "react";
import { Link as LinkIcon, Check } from "@/components/icons";

export function ShareButton({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line-strong bg-card px-4 py-2 text-[13.5px] font-medium text-ink-2 transition hover:border-brand/40 hover:text-brand"
    >
      {copied ? <Check size={15} /> : <LinkIcon size={15} />}
      {copied ? "Link copied" : "Share this request"}
    </button>
  );
}
