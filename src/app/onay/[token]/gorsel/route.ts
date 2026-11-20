import { NextResponse, type NextRequest } from "next/server";
import { getAdminRepo } from "@/lib/data";
import { hashToken, TOKEN_RE } from "@/lib/security/tokens";

/** Creative image or a video frame behind a valid client approval link. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const frame = req.nextUrl.searchParams.get("frame");
  if (!TOKEN_RE.test(token) || (frame !== null && !/^(?:[0-9]|1[01])$/.test(frame))) return new NextResponse(null, { status: 404 });
  const asset = await getAdminRepo().getApprovalAssetBytes(hashToken(token), frame === null ? undefined : Number(frame));
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
