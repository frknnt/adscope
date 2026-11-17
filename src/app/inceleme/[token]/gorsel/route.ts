import { NextResponse, type NextRequest } from "next/server";
import { getAdminRepo } from "@/lib/data";
import { hashToken, TOKEN_RE } from "@/lib/security/tokens";

/** Creative, frame or landing screenshot behind a valid lawyer review link. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const frame = req.nextUrl.searchParams.get("frame");
  if (!TOKEN_RE.test(token) || (frame !== null && !/^(?:[0-9]|1[01])$/.test(frame))) return new NextResponse(null, { status: 404 });
  const which = req.nextUrl.searchParams.get("screenshot") === "1" ? "screenshot" : frame === null ? undefined : Number(frame);
  const asset = await getAdminRepo().getSharedAssetBytes(hashToken(token), which);
  if (!asset) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(asset.bytes), {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}
