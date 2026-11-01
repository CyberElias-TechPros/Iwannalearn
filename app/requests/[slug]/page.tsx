import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getRequestBySlug, getRequestExtras, getViewerFeedback, similarRequests } from "@/lib/queries";
import { StatusPill } from "@/components/status-pill";
import { StatusTimeline } from "@/components/status-timeline";
import { UpvoteButton } from "@/components/upvote-button";
import { ShareButton } from "@/components/share-button";
import { LessonPlayer } from "@/components/lesson-player";
import { FeedbackPrompt } from "@/components/feedback-prompt";
import { RequestCard } from "@/components/request-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRight, Bell, Calendar, Check, Clock, Globe, Link as LinkIcon, Lock, Plus, Sparkle } from "@/components/icons";
import { levelLabel, plural, relativeTime, statusMeta, tierMeta } from "@/lib/status";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const request = getRequestBySlug(slug);
  if (!request || request.visibility !== "public") return { title: "Request" };
  return { title: request.title, description: request.goal };
}

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const user = await getCurrentUser();
  const request = getRequestBySlug(slug, user?.id);

  if (!request) notFound();

  const isOwner = user?.id === request.ownerId;
  const isCreator = user?.role === "creator";
  if (request.visibility === "private" && !isOwner && !isCreator) notFound();

  const { replies, events, feedback } = getRequestExtras(request.id);
  const viewerFeedback = getViewerFeedback(request.id, user?.id);
  const similar = similarRequests(request, user?.id, 3);
  const meta = statusMeta(request.status);
  const tier = tierMeta(request.tier);
  const justCreated = query.new === "1";
  const visibleEvents = events.filter((event) => isCreator || event.kind !== "note");
  const lessonReplies = replies.filter((reply) => reply.videoId);

  return (
    <div className="wrap py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3">
        <Link href="/explore" className="hover:text-brand">
          Explore
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/explore?tab=requests" className="hover:text-brand">
          Requests
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-ink">{request.ref}</span>
      </nav>

      {justCreated && isOwner && (
        <div className="rise-in mt-5 overflow-hidden rounded-2xl border border-brand/25 bg-brand-soft/70">
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
              <Check size={20} strokeWidth={3} />
            </span>
            <div className="flex-1">
              <h2 className="text-[19px] font-semibold text-brand-strong">Request received — you&apos;re in the queue</h2>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
                We&apos;ve emailed a copy to <strong>{user?.email}</strong> and this page always shows the latest
                status. Nothing else is needed from you — we&apos;ll only ask if something is unclear.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink href="/dashboard" size="sm">
                  Track it in My learning <ArrowRight size={15} />
                </ButtonLink>
                <ButtonLink href="/explore?tab=requests" size="sm" variant="secondary">
                  Back a similar request
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-5">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{request.category}</Badge>
              <StatusPill status={request.status} />
              {request.visibility === "private" ? (
                <Badge tone="neutral">
                  <Lock size={11} /> Private
                </Badge>
              ) : (
                <Badge tone="neutral">
                  <Globe size={11} /> Public
                </Badge>
              )}
              {request.tier !== "community" && <Badge tone="accent">{tier.label}</Badge>}
            </div>

            <h1 className="mt-3 text-[clamp(1.7rem,3.4vw,2.5rem)] font-semibold leading-[1.15]">{request.title}</h1>

            <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
              <span>
                Asked by {isOwner ? "you" : (request.ownerName ?? "a learner")} · {relativeTime(request.createdAt)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{levelLabel(request.level)}</span>
              <span aria-hidden="true">·</span>
              <span>{plural(request.upvoteCount, "person", "people")} waiting</span>
            </p>
          </header>

          <section className="surface p-5" aria-labelledby="progress-heading">
            <div className="flex items-center justify-between gap-3">
              <h2 id="progress-heading" className="text-[15px] font-semibold">
                Where this is
              </h2>
              <span className="text-[12.5px] text-ink-3">{meta.blurb}</span>
            </div>
            <div className="mt-4">
              <StatusTimeline status={request.status} />
            </div>
          </section>

          {request.status === "declined" && (
            <section className="rounded-2xl border border-danger/25 bg-danger-soft/70 p-5" aria-labelledby="declined-heading">
              <h2 id="declined-heading" className="text-[15px] font-semibold text-danger">
                Why we&apos;re not making this one
              </h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
                {request.declineReason ??
                  "This falls outside what we can teach responsibly. Take a look at the topics we don't cover."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink href="/requests/new" size="sm" variant="secondary">
                  Ask for something narrower <ArrowRight size={14} />
                </ButtonLink>
                <Link href="/legal/not-covered" className="inline-flex items-center px-2 text-[13px] font-medium text-ink-2 underline-offset-2 hover:underline">
                  What we don&apos;t cover
                </Link>
              </div>
            </section>
          )}

          <section className="surface p-5 md:p-6" aria-labelledby="ask-heading">
            <h2 id="ask-heading" className="text-[15px] font-semibold">
              What was asked for
            </h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{request.goal}</p>

            <dl className="mt-4 grid gap-3 border-t border-line/70 pt-4 sm:grid-cols-2">
              <div>
                <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Already tried</dt>
                <dd className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
                  {request.tried || "Nothing yet — starting from scratch."}
                </dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Starting level</dt>
                <dd className="mt-1 text-[13.5px] text-ink-2">{levelLabel(request.level)}</dd>
              </div>
              {request.contextLink && (
                <div className="sm:col-span-2">
                  <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Shared context</dt>
                  <dd className="mt-1 text-[13.5px]">
                    <a
                      href={request.contextLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline"
                    >
                      <LinkIcon size={14} /> Open the link
                    </a>
                  </dd>
                </div>
              )}
              {request.deadline && (
                <div className="sm:col-span-2">
                  <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Timing</dt>
                  <dd className="mt-1 text-[13.5px] text-ink-2">{request.deadline}</dd>
                </div>
              )}
            </dl>
          </section>

          {lessonReplies.length > 0 && (
            <section className="space-y-4" aria-labelledby="lesson-heading">
              <div className="flex items-center justify-between gap-2">
                <h2 id="lesson-heading" className="text-[15px] font-semibold">
                  The lesson
                </h2>
                {request.fulfilledAt && (
                  <span className="text-[12.5px] text-ink-3">published {relativeTime(request.fulfilledAt)}</span>
                )}
              </div>

              {lessonReplies.map((reply) => {
                const resources = parseResources(reply.resources);
                return (
                  <article key={reply.id} className="surface overflow-hidden">
                    <div className="space-y-4 p-4 md:p-5">
                      <LessonPlayer
                        videoId={reply.videoId}
                        videoUrl={reply.videoUrl}
                        title={reply.videoTitle ?? request.title}
                        category={request.category}
                        length={reply.videoLength}
                      />

                      <div>
                        <h3 className="text-[19px] font-semibold">{reply.videoTitle}</h3>
                        {reply.videoLength && (
                          <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3">
                            <Clock size={13} /> {reply.videoLength}
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl bg-paper-2/60 p-4">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">
                          A note from {reply.authorName ?? "the creator"}
                        </p>
                        <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-ink-2">{reply.message}</p>
                      </div>

                      {resources.length > 0 && (
                        <div>
                          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">Resources</p>
                          <ul className="mt-1.5 space-y-1.5">
                            {resources.map((resource) => (
                              <li key={resource.url}>
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand hover:underline"
                                >
                                  <LinkIcon size={14} /> {resource.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}

              {isOwner && <FeedbackPrompt requestId={request.id} signedIn={Boolean(user)} existing={viewerFeedback} />}

              {!isOwner && !viewerFeedback && (
                <div className="rounded-2xl border border-line bg-card p-4">
                  <p className="text-[14px] font-semibold">Want one built for your situation?</p>
                  <p className="mt-1 text-[13px] text-ink-3">
                    This lesson started as a request like yours. Ask for yours and it moves just as fast.
                  </p>
                  <ButtonLink href="/requests/new" size="sm" className="mt-3">
                    <Plus size={15} /> Ask for a lesson
                  </ButtonLink>
                </div>
              )}
            </section>
          )}

          {request.status !== "fulfilled" && request.status !== "declined" && (
            <section className="surface p-5" aria-labelledby="next-heading">
              <h2 id="next-heading" className="text-[15px] font-semibold">
                What happens next
              </h2>
              <ul className="mt-3 space-y-2.5">
                {[
                  "We review the details and flag anything unclear — usually within two working days.",
                  "It gets a filming slot. Priority and private requests go first.",
                  "You get an email and an in-app notification the moment it's published.",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-ink-2">
                    <Check size={15} className="mt-0.5 shrink-0 text-brand" />
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-paper-2/70 px-3 py-2 text-[12.5px] text-ink-3">
                <Clock size={14} /> Typical wait right now: about one week. If the queue is longer, you&apos;ll see it
                here — we don&apos;t hide it.
              </p>
            </section>
          )}

          {visibleEvents.length > 0 && (isOwner || isCreator) && (
            <section className="surface p-5" aria-labelledby="activity-heading">
              <h2 id="activity-heading" className="text-[15px] font-semibold">
                Activity
              </h2>
              <ol className="mt-3 space-y-3">
                {visibleEvents
                  .slice()
                  .reverse()
                  .map((event) => (
                    <li key={event.id} className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
                      <div>
                        <p className="text-[13.5px] text-ink-2">
                          {event.kind === "created" && "Request created"}
                          {event.kind === "status" &&
                            `Moved to ${statusMeta(event.toStatus ?? "").learnerLabel}`}
                          {event.kind === "fulfilled" && "Lesson published"}
                          {event.kind === "declined" && "Request declined"}
                          {event.kind === "note" && "Internal note added"}
                          {event.message ? ` — ${event.message}` : ""}
                        </p>
                        <p className="text-[11.5px] text-ink-3">{relativeTime(event.createdAt)}</p>
                      </div>
                    </li>
                  ))}
              </ol>
            </section>
          )}

          {similar.length > 0 && (
            <section aria-labelledby="similar-heading">
              <div className="flex items-center justify-between gap-2">
                <h2 id="similar-heading" className="text-[15px] font-semibold">
                  People are also asking for
                </h2>
                <Link href="/explore?tab=requests" className="text-[13px] font-medium text-brand hover:underline">
                  See all
                </Link>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {similar.slice(0, 2).map((item) => (
                  <RequestCard key={item.id} request={item} signedIn={Boolean(user)} compact />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-3 lg:sticky lg:top-24">
          {request.visibility === "public" && request.status !== "fulfilled" && (
            <div className="surface p-5">
              <p className="text-[14px] font-semibold">Want this too?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
                Every vote pushes it further up the filming queue. One tap, no account spam.
              </p>
              <div className="mt-3">
                <UpvoteButton
                  requestId={request.id}
                  initialCount={request.upvoteCount}
                  initialUpvoted={request.viewerUpvoted}
                  signedIn={Boolean(user)}
                  variant="wide"
                />
              </div>
            </div>
          )}

          <div className="surface p-5">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Request details</p>
            <dl className="mt-2.5 space-y-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Reference</dt>
                <dd className="font-medium">{request.ref}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Topic</dt>
                <dd className="text-right font-medium">{request.category}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Level</dt>
                <dd className="text-right font-medium">{levelLabel(request.level)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Delivery</dt>
                <dd className="text-right font-medium">{tier.label}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Asked</dt>
                <dd className="text-right font-medium">{relativeTime(request.createdAt)}</dd>
              </div>
            </dl>
          </div>

          {request.visibility === "private" && (
            <div className="rounded-2xl border border-line bg-paper-2/60 p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                <Lock size={14} /> Private request
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
                Only the person who asked and the creator can open this page. It never appears on the public board, in
                search or in the library.
              </p>
            </div>
          )}

          <ShareButton title={request.title} path={`/requests/${request.slug}`} />

          {isOwner && (
            <ButtonLink href="/dashboard" variant="ghost" size="sm" className="w-full justify-center border border-line">
              <Calendar size={15} /> Back to my learning
            </ButtonLink>
          )}

          {isCreator && (
            <ButtonLink href="/admin" variant="secondary" size="sm" className="w-full justify-center">
              <Bell size={15} /> Open creator studio
            </ButtonLink>
          )}

          <div className="rounded-2xl border border-line bg-card/60 p-4">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
              <Sparkle size={13} className="text-accent" /> Small print, plainly
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
              Public lessons stay free forever. Private lessons are yours alone and are never published.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function parseResources(raw: string | null): { label: string; url: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
