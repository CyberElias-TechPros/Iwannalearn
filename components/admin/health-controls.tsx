"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearErrorsAction } from "@/lib/actions";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/icons";

export function ClearErrorsButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass("ghost", "sm")}
      onClick={() =>
        startTransition(async () => {
          const result = await clearErrorsAction();
          push(result.message ?? "Error log cleared.", result.ok ? "success" : "error");
          router.refresh();
        })
      }
    >
      {pending ? <Spinner size={13} /> : null} Clear log
    </button>
  );
}
