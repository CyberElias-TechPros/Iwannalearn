import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, row } from "@/lib/db";
import { hasEntitlement } from "@/lib/queries";
import { verifyAccess } from "@/lib/signed-url";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PrivatePlayer } from "@/components/private-player";
import { ArrowRight, Lock, Shield } from "@/components/icons";

export const metadata: Metadata = {
  title: "Private lesson",
  robots: { index: false, follow: false },
};

/**
 * Private delivery. Four checks before a single frame plays:
 *   1. signed in,
 *   2. token signature + expiry valid,
 *   3. an entitlement exists (purchase or creator grant),
 *   4. the token was signed for *this* viewer.
 * A refund revokes the entitlement, which closes the door even on a valid link.
 */
export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ exp?: string; sig?: string }>;
}) {
  const { requestId } = await params;
  const { exp, sig } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/watch/${requestId}?exp=${exp ?? ""}&sig=${sig ?? ""}`);

  const request = row<{
    id: string;
    slug: string;
    title: string;
    tier: string;
    status: string;
    created_by: string;
    payment_status: string;
  }>(
    getDb().prepare("SELECT id, slug, title, tier, status, created_by, payment_status FROM requests WHERE id = ?"),
    requestId,
  );
  if (!request) notFound();

  const isCreator = user.role === "creator";
  const isOwner = request.created_by === user.id;
  if (!isOwner && !isCreator) {
    return <Denied title="This isn't your lesson" body="Private lessons open only for the person who commissioned them." />;
  }

  const entitlement = hasEntitlement(user.id, request.id) || isCreator;
  if (!entitlement) {
    return (
      <Denied
        title="Access isn't active"
        body="No entitlement is attached to this lesson. If you paid for it, something went wrong — message us and we'll fix it the same day."
      />
    );
  }

  const check = verifyAccess(request.id, user.id, exp, sig);
  if (!check.ok) {
    return (
      <Denied
        title={check.reason === "expired" ? "That link has expired" : "That link doesn't work"}
        body={
          check.reason === "expired"
            ? "Private links last 15 minutes on purpose. Open the request and press play again — you'll get a fresh one."
            : "Signed links are tied to your account and can't be shared. Open the request and press play to get a new one."
        }
        slug={request.slug}
      />
    );
  }

  const reply = row<{ video_id: string; video_title: string; video_length: string | null; message: string }>(
    getDb().prepare(
      "SELECT video_id, video_title, video_length, message FROM replies WHERE request_id = ? AND kind = 'external' AND video_url IS NOT NULL ORDER BY created_at DESC LIMIT 1",
    ),
    request.id,
  );
  if (!reply) {
    return <Denied title="Not delivered yet" body="The lesson is still being made. You'll get a notification the moment it's ready." slug={request.slug} />;
  }

  const minutesLeft = Math.max(0, Math.round((Number(exp) * 1000 - Date.now()) / 60000));

  return (
    <div className="wrap max-w-4xl py-8 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/requests/${request.slug}`} className="text-[13px] font-medium text-ink-3 hover:text-brand">
          ← Back to the request
        </Link>
        <div className="flex items-center gap-2">
          <Badge tone="info">
            <Lock size={11} /> Private
          </Badge>
          <Badge tone="neutral">link expires in ~{minutesLeft} min</Badge>
        </div>
      </div>

      <h1 className="mt-4 text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight">{reply.video_title}</h1>
      <p className="mt-1 text-[13px] text-ink-3">
        Made for “{request.title}”
        {reply.video_length ? ` · ${reply.video_length}` : ""}
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-ink/95">
        <PrivatePlayer videoId={reply.video_id} title={reply.video_title} requestId={request.id} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.3fr_1fr]">
        <div className="surface p-4">
          <p className="text-[13px] font-semibold">What Elias said when sending it</p>
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{reply.message}</p>
        </div>
        <div className="rounded-2xl border border-info/25 bg-info-soft/40 p-4">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-info">
            <Shield size={13} /> Why the link dies
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
            Signed playback URLs stop working after 15 minutes and are bound to your account, so a forwarded link is
            useless. In production these are CDN playback tokens (Mux or Cloudflare Stream) — never an unlisted YouTube
            URL, which is not private.
          </p>
          <ButtonLink href={`/requests/${request.slug}`} variant="secondary" size="sm" className="mt-2 w-full justify-center">
            Request a revision <ArrowRight size={13} />
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

function Denied({ title, body, slug }: { title: string; body: string; slug?: string }) {
  return (
    <div className="wrap max-w-lg py-16">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <Lock size={22} />
      </span>
      <h1 className="mt-4 text-[24px] font-semibold">{title}</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{body}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {slug && (
          <ButtonLink href={`/requests/${slug}`}>
            Open the request <ArrowRight size={15} />
          </ButtonLink>
        )}
        <ButtonLink href="/contact" variant="secondary">
          Message us
        </ButtonLink>
      </div>
    </div>
  );
}
