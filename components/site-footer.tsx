import Link from "next/link";
import { Logo } from "@/components/logo";

const columns = [
  {
    title: "Learn",
    links: [
      { href: "/explore", label: "Explore lessons" },
      { href: "/explore?tab=requests", label: "Open requests" },
      { href: "/requests/new", label: "Ask for a lesson" },
    ],
  },
  {
    title: "How it works",
    links: [
      { href: "/how-it-works", label: "The 4-step loop" },
      { href: "/how-it-works#private", label: "Private lessons" },
      { href: "/how-it-works#faq", label: "Questions" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/not-covered", label: "What we don't cover" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-paper-2/50 pb-24 md:pb-0">
      <div className="wrap grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-[14px] leading-relaxed text-ink-3">
            Tell us what you want to learn. We&apos;ll help you find it — or make it, one clear video at a time.
          </p>
          <p className="text-[12.5px] text-ink-3/80">Built in Lagos · © {new Date().getFullYear()} iwannalearn</p>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{column.title}</p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[14px] text-ink-2 hover:text-brand">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
