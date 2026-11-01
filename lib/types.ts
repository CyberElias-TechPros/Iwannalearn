export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: "learner" | "creator" | string;
};

export type RequestSummary = {
  id: string;
  ref: string;
  slug: string;
  title: string;
  goal: string;
  tried: string | null;
  contextLink: string | null;
  deadline: string | null;
  declineReason: string | null;
  category: string;
  level: string;
  status: string;
  tier: string;
  visibility: string;
  paymentStatus: string;
  revisionState: string;
  moderationFlag: boolean;
  moderationNote: string | null;
  priceKobo: number | null;
  upvoteCount: number;
  createdAt: string;
  fulfilledAt: string | null;
  deliveryConfirmedAt: string | null;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  priorityFlag: number;
  hasLesson: boolean;
  lessonTitle: string | null;
  videoId: string | null;
  videoLength: string | null;
  viewerUpvoted: boolean;
  replyCount: number;
};

export type AdminQueueItem = RequestSummary & {
  ageDays: number;
  internalNoteCount: number;
};

export type LessonSummary = {
  requestId: string;
  slug: string;
  title: string;
  goal: string;
  category: string;
  level: string;
  videoId: string | null;
  videoUrl: string | null;
  videoTitle: string | null;
  videoLength: string | null;
  cameraMessage: string;
  resources: { label: string; url: string }[];
  fulfilledAt: string | null;
  upvoteCount: number;
  ownerName: string | null;
};

export type ReplyRow = {
  id: string;
  kind: "external" | "internal";
  message: string;
  videoUrl: string | null;
  videoId: string | null;
  videoTitle: string | null;
  videoLength: string | null;
  resources: string | null;
  createdAt: string;
  authorName: string | null;
};

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  kind: string;
};
