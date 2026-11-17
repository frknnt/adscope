import { NextResponse } from "next/server";
import { getCurrentUser, getRepo } from "@/lib/data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Brand logo for the owner (and team viewers). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id) || !(await getCurrentUser())) return new NextResponse(null, { status: 404 });
  const logo = await getRepo().getBrandLogo(id);
  if (!logo) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(logo.bytes), {
    headers: { "Content-Type": logo.mime, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
}
