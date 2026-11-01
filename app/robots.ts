import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/explore", "/tutorials/", "/how-it-works", "/legal/"],
        disallow: ["/admin", "/dashboard", "/api/", "/requests", "/login"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
