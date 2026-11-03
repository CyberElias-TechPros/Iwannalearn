import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_DOCS as DOCS, LEGAL_DOCS } from "@/lib/legal";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const { page } = await params;
  const doc = DOCS[page];
  return doc ? { title: doc.title, description: doc.lede } : { title: "Legal" };
}

export default async function LegalPage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const doc = DOCS[page];
  if (!doc) notFound();

  return (
    <div className="wrap max-w-3xl py-10 md:py-14">
      <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand">Trust</p>
      <h1 className="mt-3 text-[clamp(1.9rem,4vw,2.7rem)] font-semibold leading-tight">{doc.title}</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{doc.lede}</p>

      <div className="mt-5 rounded-xl border border-warn/25 bg-warn-soft/60 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
        <strong className="font-semibold">Draft.</strong> This page is accurate to how the product behaves today. It will
        be reviewed by a lawyer before paid requests open.
      </div>

      <div className="mt-8 space-y-7">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-[19px] font-semibold">{section.heading}</h2>
            <div className="mt-2 space-y-2.5">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-[14.5px] leading-relaxed text-ink-2">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3 border-t border-line pt-6 text-[13.5px]">
        <Link href="/legal/privacy" className="font-medium text-brand hover:underline">
          Privacy
        </Link>
        <Link href="/legal/terms" className="font-medium text-brand hover:underline">
          Terms
        </Link>
        <Link href="/legal/not-covered" className="font-medium text-brand hover:underline">
          What we don&apos;t cover
        </Link>
        <Link href="/how-it-works" className="font-medium text-brand hover:underline">
          How it works
        </Link>
      </div>
    </div>
  );
}

export function generateStaticParams() { return Object.keys(LEGAL_DOCS).map((page) => ({ page })); }
