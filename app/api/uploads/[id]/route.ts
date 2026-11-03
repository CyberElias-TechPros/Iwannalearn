import { NextResponse } from "next/server";
import { requestUser as getCurrentUser } from "@/lib/request-auth";
import { getUpload, getObject } from "@/lib/uploads";
import { getDb, row } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Serves an attachment back. Same ownership rules as the request it belongs to:
 * the person who uploaded it, the owner of the request, and the creator.
 *
 * Everything downstream of this line is why uploads are not simply written to
 * /public: an unguessable filename is not an access control.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to open this file." }, { status: 401 });

  const upload = getUpload(id);
  if (!upload) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

  const isCreator = user.role === "creator";
  const isUploader = upload.user_id === user.id;

  let isRequestOwner = false;
  if (upload.request_id) {
    const requestRow = row<{ created_by: string }>(
      getDb().prepare("SELECT created_by FROM requests WHERE id = ?"),
      upload.request_id,
    );
    isRequestOwner = requestRow?.created_by === user.id;
  }

  if (!isCreator && !isUploader && !isRequestOwner) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const bytes = await getObject(upload.storage_key);
  if (!bytes) return NextResponse.json({ ok: false, error: "That file is no longer stored." }, { status: 410 });

  const inline = upload.mime.startsWith("image/") || upload.mime === "application/pdf" || upload.mime.startsWith("text/");

  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": upload.mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${upload.filename.replace(/["\\\r\n]/g, "")}"`,
      "Content-Length": String(bytes.byteLength),
      // Private to the viewer; never cache in a shared proxy.
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

/** Learners can remove a file they attached; the storage object goes with it. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const { deleteUpload } = await import("@/lib/uploads");
  const result = deleteUpload(id, user.id);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
  return NextResponse.json({ ok: true });
}
