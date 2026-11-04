import { z } from "zod";
import { CATEGORIES } from "./status";

/** Shared by server actions and the native Android API. Clients never set price,
 * visibility, ownership, payment status or entitlement: those are server decisions. */
export const requestSchema = z.object({
  title: z.string().trim().min(12, "Give your request a clear, specific title (at least 12 characters).").max(140, "Keep the title under 140 characters."),
  goal: z.string().trim().min(30, "Describe what you want to be able to do. A sentence or two is perfect.").max(1200, "Keep the goal under 1200 characters."),
  tried: z.string().trim().max(800, "Keep this under 800 characters.").optional(),
  category: z.enum(CATEGORIES, { message: "Pick the closest topic." }),
  level: z.enum(["new", "some", "confident"]),
  tier: z.enum(["community", "priority", "private"]),
  contextLink: z.string().trim().max(500).optional().refine((v) => !v || /^https?:\/\//.test(v), "Paste a full link starting with https://"),
  deadline: z.string().trim().max(80).optional(),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Tell us what to call you.").max(80),
  phone: z.string().trim().max(24).optional().refine((v) => !v || /^[+0-9 ()-]{7,24}$/.test(v), "Use digits, spaces and a leading + for country code."),
  notifyEmail: z.boolean(),
  notifySms: z.boolean(),
  digest: z.boolean(),
});

export const supportSchema = z.object({
  email: z.string().trim().email("We need a working email so we can reply."),
  subject: z.string().trim().min(3, "Give it a subject.").max(140),
  body: z.string().trim().min(10, "Tell us a little more — a sentence is fine.").max(2000),
});

export const replySchema = z.object({
  message: z.string().trim().min(10, "Add a short note so the learner knows where to start.").max(2000),
  videoUrl: z.string().trim().max(1000).optional(),
  streamUrl: z.string().trim().max(2000).optional(),
  videoTitle: z.string().trim().min(4, "Give the lesson a title.").max(140),
  videoLength: z.string().trim().max(20).optional(),
  resources: z.array(z.object({ label: z.string().max(140), url: z.string().url().max(1000).refine((v) => /^https?:\/\//.test(v)) })).max(10).optional(),
}).refine((v) => Boolean(v.videoUrl || v.streamUrl), { message: "Add a YouTube link or a direct video URL.", path: ["videoUrl"] });

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
