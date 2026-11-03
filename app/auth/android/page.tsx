import type { Metadata } from "next";
import Link from "next/link";
import { peekLoginToken } from "@/lib/auth";

export const metadata: Metadata = { title: "Open in Android", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** A tiny email hand-off, not an app WebView. The token stays single-use and is
 * exchanged by the native app only after the learner confirms. */
export default async function AndroidAuthPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const record = /^[a-f0-9]{32}$/.test(token) ? peekLoginToken(token) : null;
  const valid = record && record.client === "android" && !record.consumed_at && new Date(record.expires_at).getTime() > Date.now();
  return (
    <main className="wrap max-w-lg py-16">
      <p className="text-sm font-semibold text-brand">iwannalearn · Android</p>
      <h1 className="mt-4 text-4xl font-semibold">Back to your next little win.</h1>
      <p className="mt-4 text-ink-2">{valid ? `Open the Android app to sign in as ${record.email}. The link can only be used once.` : "This sign-in link has expired or already been used. Request a fresh link in the Android app."}</p>
      {valid ? <a className="mt-7 inline-flex min-h-12 items-center rounded-full bg-brand px-6 font-semibold text-white" href={`iwannalearn://auth?token=${token}`}>Open Android app</a> : <Link className="mt-6 inline-block font-semibold text-brand" href="/">Back to iwannalearn</Link>}
      <p className="mt-6 text-sm text-ink-3">Install the Android app first. Never forward this email — it is your sign-in key.</p>
    </main>
  );
}
