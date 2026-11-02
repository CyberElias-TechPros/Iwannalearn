"use server";

import { getCurrentUser } from "./auth";
import { logSearch, track } from "./service";
import { searchEverything } from "./queries";

/** Client-callable analytics and search logging (no PII in props). */

export async function recordSearch(term: string) {
  const clean = term.trim().slice(0, 120);
  if (clean.length < 2) return;
  const user = await getCurrentUser();
  const results = searchEverything(clean, user?.id);
  logSearch(clean, results.lessons.length + results.requests.length, user?.id);
}

export async function recordEvent(name: string, props?: Record<string, string | number | boolean>) {
  const allowed = ["request_started", "lesson_played", "pricing_viewed", "checkout_started", "support_opened"];
  if (!allowed.includes(name)) return;
  const user = await getCurrentUser();
  track(name, { userId: user?.id ?? null, data: props });
}
