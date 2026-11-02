/**
 * One vocabulary for the whole product.
 * Internal status codes stay machine-friendly; everything a learner sees is
 * plain language with a clear next step.
 */

export type RequestStatus =
  | "submitted"
  | "under_review"
  | "planned"
  | "in_production"
  | "waitlisted"
  | "fulfilled"
  | "declined";

export type StatusMeta = {
  label: string;
  learnerLabel: string;
  blurb: string;
  tone: "neutral" | "info" | "accent" | "progress" | "success" | "warn" | "danger";
  step: number; // position on the 5-step journey, 0 = off-track
};

export const STATUS_META: Record<RequestStatus, StatusMeta> = {
  submitted: {
    label: "Submitted",
    learnerLabel: "Received",
    blurb: "We have your request. It's in the queue for a first look.",
    tone: "neutral",
    step: 1,
  },
  under_review: {
    label: "Under review",
    learnerLabel: "Being checked",
    blurb: "We're checking the details so the lesson actually fits what you asked.",
    tone: "info",
    step: 2,
  },
  planned: {
    label: "Scheduled",
    learnerLabel: "Scheduled",
    blurb: "It's on the filming calendar. You'll get a notification the moment it's ready.",
    tone: "info",
    step: 3,
  },
  in_production: {
    label: "In production",
    learnerLabel: "Being filmed",
    blurb: "Your lesson is being recorded right now — this is the exciting part.",
    tone: "progress",
    step: 4,
  },
  waitlisted: {
    label: "Waitlisted",
    learnerLabel: "On the waitlist",
    blurb: "We're at this week's filming capacity. Your request is safe and moves up automatically.",
    tone: "warn",
    step: 2,
  },
  fulfilled: {
    label: "Fulfilled",
    learnerLabel: "Lesson ready",
    blurb: "Your video is ready. Watch it now.",
    tone: "success",
    step: 5,
  },
  declined: {
    label: "Declined",
    learnerLabel: "Not this time",
    blurb: "We can't make a good lesson for this one. The reason is below.",
    tone: "danger",
    step: 0,
  },
};

export const STATUS_ORDER: RequestStatus[] = [
  "submitted",
  "under_review",
  "planned",
  "in_production",
  "waitlisted",
  "fulfilled",
  "declined",
];

export const OPEN_STATUSES: RequestStatus[] = [
  "submitted",
  "under_review",
  "planned",
  "in_production",
  "waitlisted",
];

export const JOURNEY = [
  { key: "submitted", label: "Received", detail: "Your request is in." },
  { key: "under_review", label: "Checked", detail: "We make sure it's filmable." },
  { key: "planned", label: "Scheduled", detail: "It gets a filming slot." },
  { key: "in_production", label: "Filmed", detail: "The lesson is recorded." },
  { key: "fulfilled", label: "Ready", detail: "You get a notification." },
] as const;

export const CATEGORIES = [
  "Design & Canva",
  "Spreadsheets",
  "Data & Python",
  "Web development",
  "AI tools",
  "Video & content",
  "Marketing & social",
  "Career & productivity",
  "Other",
] as const;

export const LEVELS = {
  new: { label: "New to this", hint: "Start from the beginning, no assumptions." },
  some: { label: "Know some basics", hint: "Skip the intro, focus on the tricky part." },
  confident: { label: "Confident", hint: "Go deep — I want specifics and edge cases." },
} as const;

export type Level = keyof typeof LEVELS;

export const TIERS = {
  community: {
    label: "Community",
    price: "Free",
    tagline: "You add a vote, the community does the rest.",
    detail: "Anyone can watch the lesson once it's made. This is how most requests work.",
  },
  priority: {
    label: "Priority",
    price: "₦4,000",
    tagline: "Jumps the queue.",
    detail: "Same public lesson, but filmed next. You're paying for speed, not secrecy.",
  },
  private: {
    label: "Private",
    price: "From ₦25,000",
    tagline: "Built around your own files.",
    detail:
      "A bespoke walkthrough of your actual project or data. Never published — access stays with you.",
  },
} as const;

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[(status as RequestStatus) ?? "submitted"] ?? STATUS_META.submitted;
}

export function tierMeta(tier: string) {
  return TIERS[(tier as keyof typeof TIERS) ?? "community"] ?? TIERS.community;
}

export function levelLabel(level: string) {
  return LEVELS[(level as Level) ?? "new"]?.label ?? "New to this";
}

export function relativeTime(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
