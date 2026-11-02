import { getDb, row, rows } from "./db";
import { CATEGORIES } from "./status";

/**
 * Topic hubs.
 *
 * Category pages are how people actually arrive: "learn spreadsheets" is a
 * search, "/explore?category=Spreadsheets" is not. This maps human URLs to the
 * existing category column instead of inventing a second taxonomy — one source
 * of truth, better front door.
 */

export type Topic = {
  slug: string;
  category: string;
  title: string;
  blurb: string;
};

const BLURBS: Record<string, string> = {
  "Design & Canva": "Make things that look deliberate — posters, decks, social posts — without a design degree.",
  Spreadsheets: "Formulas, pivot tables and trackers that survive contact with real data.",
  "Data & Python": "Clean data, answer questions with it, and stop doing the same thing by hand.",
  "Web development": "Ship a real page: layout, a deploy, a domain, and fixes when it breaks.",
  "AI tools": "Use the tools that are actually useful, and know where they quietly get things wrong.",
  "Video & content": "Record, cut and publish without an editor, a studio or a budget.",
  "Marketing & social": "Say the thing clearly to the people who should hear it.",
  "Career & productivity": "CVs, applications, and systems that keep your week from collapsing.",
  Other: "Things that don't fit a category — the ones worth filming anyway.",
};

function slugifyCategory(category: string): string {
  return category
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function listTopics(): Topic[] {
  return CATEGORIES.map((category) => ({
    slug: slugifyCategory(category),
    category,
    title: category,
    blurb: BLURBS[category] ?? "Requests asking for this, and lessons that answer them.",
  }));
}

export function getTopic(slug: string): Topic | null {
  return listTopics().find((topic) => topic.slug === slug) ?? null;
}

export function topicCounts(): Record<string, { lessons: number; open: number }> {
  const db = getDb();
  const lessonRows = rows<{ category: string; n: number }>(
    db.prepare(
      `SELECT r.category, COUNT(*) AS n FROM requests r
       JOIN replies p ON p.request_id = r.id
       WHERE r.visibility = 'public' AND r.status = 'fulfilled'
         AND p.kind = 'external' AND p.video_url IS NOT NULL
       GROUP BY r.category`,
    ),
  );
  const openRows = rows<{ category: string; n: number }>(
    db.prepare(
      `SELECT category, COUNT(*) AS n FROM requests
       WHERE visibility = 'public' AND status IN ('submitted','under_review','planned','in_production','waitlisted')
       GROUP BY category`,
    ),
  );

  const out: Record<string, { lessons: number; open: number }> = {};
  for (const category of CATEGORIES) out[category] = { lessons: 0, open: 0 };
  for (const item of lessonRows) {
    if (out[item.category]) out[item.category].lessons = Number(item.n);
  }
  for (const item of openRows) {
    if (out[item.category]) out[item.category].open = Number(item.n);
  }
  return out;
}

/** Most-asked unanswered requests in a category — the "film this next" list. */
export function topWanted(category: string, limit = 6) {
  return rows<{ id: string; slug: string; title: string; upvote_count: number }>(
    getDb().prepare(
      `SELECT id, slug, title, upvote_count FROM requests
       WHERE visibility = 'public' AND category = ?
         AND status IN ('submitted','under_review','planned','in_production','waitlisted')
       ORDER BY upvote_count DESC LIMIT ?`,
    ),
    category,
    limit,
  );
}

export function relatedTopicStats(category: string) {
  const total = row<{ n: number }>(
    getDb().prepare("SELECT COUNT(*) AS n FROM requests WHERE visibility = 'public' AND category = ?"),
    category,
  );
  return Number(total?.n ?? 0);
}
