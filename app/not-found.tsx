import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRight, Home, Search } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="wrap flex max-w-2xl flex-col items-center py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Search size={24} />
      </span>
      <h1 className="mt-5 text-[clamp(1.8rem,4vw,2.4rem)] font-semibold">That page isn&apos;t here</h1>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-2">
        It may have moved, or the request might be private. Either way, here are two good places to go next.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <ButtonLink href="/explore">
          <Search size={16} /> Explore lessons
        </ButtonLink>
        <ButtonLink href="/" variant="secondary">
          <Home size={16} /> Back home
        </ButtonLink>
      </div>
      <p className="mt-6 text-[13px] text-ink-3">
        Looking for something specific?{" "}
        <Link href="/requests/new" className="font-medium text-brand hover:underline">
          Ask for it <ArrowRight size={12} className="inline" />
        </Link>
      </p>
    </div>
  );
}
