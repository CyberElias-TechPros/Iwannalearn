import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { rateLimit } from "@/lib/service";

export const dynamic = "force-dynamic";

/**
 * Staged upload endpoint. Files land unattached (`request_id NULL`) and are
 * claimed by the request form on submit, so an abandoned wizard leaves nothing
 * visible but does not lose an upload already in flight.
 *
 * Route handlers (not server actions) because the payload is binary.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in to attach files." }, { status: 401 });
  }

  const limit = rateLimit(`upload:${user.id}`, 20, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: `Too many uploads. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.` },
      { status: 429 },
    );
  }

  // Reject early on declared size before buffering the whole body.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 4096) {
    return NextResponse.json({ ok: false, error: "That file is larger than the 10 MB limit." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Upload couldn't be read. Try again." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file was attached." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "That file is larger than the 10 MB limit." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await saveUpload({
    userId: user.id,
    filename: file.name || "attachment",
    mime: file.type || "application/octet-stream",
    bytes,
    kind: form.get("kind") === "delivery" ? "delivery" : "brief",
    note: typeof form.get("note") === "string" ? String(form.get("note")).slice(0, 300) : null,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true, id: result.id, filename: file.name, size: bytes.byteLength });
}
