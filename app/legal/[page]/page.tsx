import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type Doc = {
  title: string;
  lede: string;
  sections: { heading: string; body: string[] }[];
};

const DOCS: Record<string, Doc> = {
  privacy: {
    title: "Privacy, in plain language",
    lede: "What we collect, why, and how to get rid of it. Written to be read, not skimmed past.",
    sections: [
      {
        heading: "What we collect",
        body: [
          "Your email address and the name you give us — so we can sign you in and tell you when your lesson is ready.",
          "The content of your requests: the skill, the outcome you described, your level, what you've tried, and any link you choose to share.",
          "Basic product events — that a request was created, a status changed, a lesson was watched. We don't use advertising trackers.",
        ],
      },
      {
        heading: "Private requests",
        body: [
          "A private request is visible only to you and the creator. It never appears on the public board, in search, in the sitemap, or in the public library.",
          "If you share files or links, they are used only to make your video. You can ask us to delete them at any time and we'll confirm when it's done.",
        ],
      },
      {
        heading: "What we never do",
        body: [
          "We don't sell your data. We don't publish your private context. We don't use your request text in marketing without asking.",
          "Public lessons may reuse the technique from a private lesson, but never your data, files, names or business details.",
        ],
      },
      {
        heading: "Deleting your data",
        body: [
          "Email the address below and we'll delete your account, requests and any shared context. Public lessons you inspired stay in the library, but they are detached from your identity.",
        ],
      },
      {
        heading: "The small print",
        body: [
          "This page is a pre-launch draft. Before payments go live it will be reviewed by a lawyer, and the date and contact details below will be real.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms, without the fog",
    lede: "The rules of the exchange: what we promise, what we don't, and what happens when something goes wrong.",
    sections: [
      {
        heading: "What we promise",
        body: [
          "For a community request: we review it, and if we take it on, we make a lesson and tell you when it's live. We don't promise a date for free requests, but we do promise an honest status at every stage.",
          "For a priority request: the same, with a place at the front of the queue.",
          "For a private request: a bespoke lesson built around the scope we agreed in writing before you were charged.",
        ],
      },
      {
        heading: "What we don't promise",
        body: [
          "Completion of every request. Some topics we can't teach responsibly, and some are too broad to film usefully. If we decline, we tell you why and usually suggest a narrower request.",
          "Employment, grades, income or any specific outcome. Lessons are educational, not guarantees.",
        ],
      },
      {
        heading: "Refunds and revisions",
        body: [
          "Private lessons include one revision within seven days of delivery. A second revision, or a change of scope, is a new request.",
          "If we fail to deliver the agreed scope, you get a full refund. If the lesson matches the agreed scope, custom digital work is generally non-refundable — that's why the scope is agreed in writing first.",
        ],
      },
      {
        heading: "Ownership",
        body: [
          "You own your files, your data and your project. We own the recordings we make. Private recordings are licensed to you for personal use and are never published.",
          "Public lessons are free for anyone to watch and may be reused by us in the library.",
        ],
      },
      {
        heading: "Payments",
        body: [
          "Payments are not enabled in this build. When they are, they'll run through a verified provider for our operating country, with prices shown in the currency you'll be charged, taxes included where required.",
        ],
      },
      {
        heading: "The small print",
        body: [
          "This is a pre-launch draft, not legal advice. The final version will be reviewed before any money changes hands.",
        ],
      },
    ],
  },
  "not-covered": {
    title: "What we won't cover",
    lede: "A short, honest list. It exists so nobody wastes a request — and so we don't teach something irresponsible.",
    sections: [
      {
        heading: "The list",
        body: [
          "Medical advice, diagnosis or treatment — including supplements and dosage.",
          "Legal advice or drafting contracts for your specific situation.",
          "Financial advice: which stock, fund or crypto to buy, or tax positions.",
          "Hacking, credential theft, or bypassing someone else's security.",
          "Adult content, or anything sexual involving minors.",
          "Academic dishonesty: doing your assignment, sitting your exam, or writing your thesis for you.",
          "Anything that helps harm a person, a business or a protected group.",
        ],
      },
      {
        heading: "What we can often do instead",
        body: [
          "Teach the skill underneath the request. Instead of “which stock should I buy”, we can teach how to read a company's financial statements.",
          "Teach the tool rather than the outcome. Instead of “write my assignment”, we can teach you how to structure an argument and cite sources properly.",
          "If you're not sure, ask anyway. A declined request gets a real reason, not silence.",
        ],
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((page) => ({ page }));
}

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
