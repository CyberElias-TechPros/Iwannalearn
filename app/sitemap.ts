import type { MetadataRoute } from "next";
import { listRequestRefs } from "@/lib/queries";
import { listTopics } from "@/lib/topics";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL ?? "http://localhost:3000";
  const lessons = listRequestRefs();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/topics`, changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/explore`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/explore?tab=requests`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/requests/new`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/legal/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/legal/not-covered`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const lessonRoutes: MetadataRoute.Sitemap = lessons.map((lesson) => ({
    url: `${base}/tutorials/${lesson.slug}`,
    lastModified: lesson.createdAt,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const topicRoutes: MetadataRoute.Sitemap = listTopics().map((topic) => ({
    url: `${base}/topics/${topic.slug}`,
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  return [...staticRoutes, ...topicRoutes, ...lessonRoutes];
}
