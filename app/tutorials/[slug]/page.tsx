import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getLessonBySlug, getRequestBySlug, getViewerFeedback, listLessons } from "@/lib/queries";
import { LessonPlayer } from "@/components/lesson-player";
import { LessonCard } from "@/components/lesson-card";
import { FeedbackPrompt } from "@/components/feedback-prompt";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRight, Check, Clock, Link as LinkIcon, Plus, Sparkle, Video } from "@/components/icons";
import { levelLabel, relativeTime } from "@/lib/status";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lesson = getLessonBySlug(slug);
  if (!lesson) return { title: "Lesson" };

  const title = lesson.videoTitle ?? lesson.title;
  return {
    title,
    description: lesson.goal,
    alternates: { canonical: `/tutorials/${slug}` },
    openGraph: {
      title,
      description: lesson.goal,
      type: "video.other",
    },
  };
}

export default async function TutorialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = getLessonBySlug(slug);
  if (!lesson) notFound();

  const user = await getCurrentUser();
  const request = getRequestBySlug(slug, user?.id);
  const feedback = request ? getViewerFeedback(request.id, user?.id) : null;
  const isOwner = Boolean(request && user && request.ownerId === user.id);
  const related = listLessons({ category: lesson.category, limit: 4 }).filter((item) => item.slug !== slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: lesson.videoTitle ?? lesson.title,
    description: lesson.goal,
    uploadDate: lesson.fulfilledAt ?? new Date().toISOString(),
    ...(lesson.videoId ? { embedUrl: `https://www.youtube.com/embed/${lesson.videoId}` } : {}),
    ...(lesson.videoLength ? { duration: lesson.videoLength } : {}),
    learningResourceType: "Tutorial",
    educationalLevel: levelLabel(lesson.level),
    teaches: lesson.title,
  };

  return (
    <div className="wrap py-8 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3">
        <Link href="/explore" className="hover:text-brand">
          Explore
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-ink">Lessons</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success" dot>
                Lesson ready
              </Badge>
              <Badge tone="neutral">{lesson.category}</Badge>
              {lesson.videoLength && (
                <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-3">
                  <Clock size={13} /> {lesson.videoLength}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold leading-[1.12]">
              {lesson.videoTitle ?? lesson.title}
            </h1>
            <p className="mt-2 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">{lesson.goal}</p>
          </header>

          <LessonPlayer
            videoId={lesson.videoId}
            videoUrl={lesson.videoUrl}
            title={lesson.videoTitle ?? lesson.title}
            category={lesson.category}
            length={lesson.videoLength}
            requestId={lesson.requestId}
            videoProvider={lesson.videoProvider}
          />

          <section className="surface p-5 md:p-6" aria-labelledby="note-heading">
            <h2 id="note-heading" className="text-[15px] font-semibold">
              A note from the creator
            </h2>
            <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-ink-2">{lesson.cameraMessage}</p>

            {lesson.resources.length > 0 && (
              <div className="mt-4 border-t border-line/70 pt-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">Goes with this lesson</p>
                <ul className="mt-2 space-y-1.5">
                  {lesson.resources.map((resource) => (
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
          </section>

          <section className="surface p-5 md:p-6" aria-labelledby="learn-heading">
            <h2 id="learn-heading" className="text-[15px] font-semibold">
              What you should be able to do afterwards
            </h2>
            <ul className="mt-2.5 space-y-2">
              <li className="flex items-start gap-2 text-[14px] leading-relaxed text-ink-2">
                <Check size={16} className="mt-0.5 shrink-0 text-brand" />
                {lesson.goal}
              </li>
              <li className="flex items-start gap-2 text-[14px] leading-relaxed text-ink-2">
                <Check size={16} className="mt-0.5 shrink-0 text-brand" />
                Understand why the obvious approach fails, so you can fix it yourself next time.
              </li>
            </ul>
          </section>

          {request && <FeedbackPrompt requestId={request.id} signedIn={Boolean(user)} existing={feedback} />}

          {related.length > 0 && (
            <section aria-labelledby="related-heading">
              <div className="flex items-center justify-between gap-2">
                <h2 id="related-heading" className="text-[15px] font-semibold">
                  More on {lesson.category}
                </h2>
                <Link href={`/explore?category=${encodeURIComponent(lesson.category)}`} className="text-[13px] font-medium text-brand hover:underline">
                  See all
                </Link>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {related.slice(0, 2).map((item) => (
                  <LessonCard key={item.requestId} lesson={item} showFromRequest={false} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24">
          <div className="surface p-5">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">This lesson answers</p>
            <p className="mt-1.5 text-[14.5px] font-medium leading-snug">“{lesson.title}”</p>
            <p className="mt-1.5 text-[12.5px] text-ink-3">
              Asked by {isOwner ? "you" : (lesson.ownerName ?? "a learner")}
              {lesson.fulfilledAt ? ` · answered ${relativeTime(lesson.fulfilledAt)}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
              <span className="rounded-full bg-paper-2 px-2 py-0.5 text-ink-2">{levelLabel(lesson.level)}</span>
              <span className="rounded-full bg-paper-2 px-2 py-0.5 text-ink-2">{lesson.upvoteCount} waiting</span>
            </div>
            {request && (
              <Link
                href={`/requests/${request.slug}`}
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline"
              >
                Open the request <ArrowRight size={14} />
              </Link>
            )}
          </div>

          <ShareButton title={lesson.videoTitle ?? lesson.title} path={`/tutorials/${slug}`} />

          <div className="surface p-5">
            <p className="flex items-center gap-1.5 text-[13.5px] font-semibold">
              <Sparkle size={14} className="text-accent" /> Want yours?
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
              Ask for a lesson built around your own files, your own workflow, your own stuck moment.
            </p>
            <ButtonLink href="/requests/new" size="sm" className="mt-3 w-full justify-center">
              <Plus size={15} /> Ask for a lesson
            </ButtonLink>
          </div>

          <div className="rounded-2xl border border-line bg-card/60 p-4">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">
              <Video size={14} /> Public and free
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
              This lesson is part of the public library, so it stays free for anyone who needs it. No sign-up wall.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
