"use client";

import { useEffect, useRef } from "react";
import { Close } from "@/components/icons";

export function Modal({
  open,
  onClose,
  labelledBy,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleClose = () => onClose();
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      className="z-[70] w-[min(94vw,42rem)] rounded-3xl border border-line bg-paper p-0 text-ink shadow-lift backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] open:pop-in"
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
    >
      <div className={wide ? "max-h-[86vh] overflow-y-auto p-5 md:p-7" : "max-h-[86vh] overflow-y-auto p-5 md:p-6"}>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="absolute right-4 top-4 rounded-full border border-line bg-card p-2 text-ink-2 hover:bg-paper-2"
          aria-label="Close"
        >
          <Close size={15} />
        </button>
        {children}
      </div>
    </dialog>
  );
}
