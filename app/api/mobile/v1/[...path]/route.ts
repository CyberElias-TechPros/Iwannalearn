import { handleMobileApi } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  const { path } = await context.params;
  return handleMobileApi(request, path);
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
