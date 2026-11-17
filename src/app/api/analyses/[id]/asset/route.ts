import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, getRepo } from "@/lib/data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Streams the creative (one video frame with ?frame=N, or the landing screenshot with ?screenshot=1).
 * Ownership is enforced by RLS / storage policies (or the memory repo).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const frameParam = req.nextUrl.searchParams.get("frame");
  if (frameParam !== null && !/^(?:[0-9]|1[01])$/.test(frameParam)) return new NextResponse(null, { status: 404 });
  const screenshot = req.nextUrl.searchParams.get("screenshot") === "1";
  if (!UUID.test(id) || !(await getCurrentUser())) return new NextResponse(null, { status: 404 });
  const asset = await getRepo().getAssetBytes(id, screenshot ? "screenshot" : frameParam === null ? undefined : Number(frameParam));
  if (!asset) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(asset.bytes), {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
