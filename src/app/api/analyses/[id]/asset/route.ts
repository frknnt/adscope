import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, getRepo } from "@/lib/data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Streams the creative for an analysis. Ownership is enforced by RLS / storage policies (or the memory repo). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id) || !(await getCurrentUser())) return new NextResponse(null, { status: 404 });
  const asset = await getRepo().getAssetBytes(id);
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
