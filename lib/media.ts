/** Direct delivery for the native Media3 player. Never accept arbitrary upstream
 * hosts: the authenticated range proxy must not become an SSRF primitive. */
export function validateStreamUrl(value: string, siteUrl = process.env.SITE_URL ?? "http://localhost:3000"): { ok: true; url: string } | { ok: false; error: string } {
  try {
    const url = new URL(value);
    const localDev = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname);
    if (url.protocol !== "https:" && !localDev) return { ok: false, error: "Direct video delivery requires HTTPS." };
    if (url.username || url.password) return { ok: false, error: "Video URLs must not contain credentials." };
    const allowed = (process.env.STREAM_ALLOWED_HOSTS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
    const siteHost = new URL(siteUrl).hostname.toLowerCase();
    if (!allowed.includes(url.hostname.toLowerCase()) && url.hostname.toLowerCase() !== siteHost) {
      return { ok: false, error: "Add this video's host to STREAM_ALLOWED_HOSTS on the server before publishing." };
    }
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, error: "Enter a complete HTTPS video or HLS URL." };
  }
}

export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}
