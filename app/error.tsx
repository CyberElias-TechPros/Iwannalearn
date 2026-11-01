"use client";

import { useEffect } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Home, Search } from "@/components/icons";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="wrap flex max-w-2xl flex-col items-center py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger">
        <Search size={24} />
      </span>
      <h1 className="mt-5 text-[clamp(1.8rem,4vw,2.4rem)] font-semibold">Something went sideways</h1>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-2">
        That&apos;s on us, not on you. Try again — if it keeps happening, the request itself is safe and still in the queue.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Button onClick={() => reset()}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          <Home size={16} /> Back home
        </ButtonLink>
      </div>
    </div>
  );
}
