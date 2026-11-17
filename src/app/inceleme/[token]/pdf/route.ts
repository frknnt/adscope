import { NextResponse } from "next/server";
import { getAdminRepo } from "@/lib/data";
import { buildReportPdf } from "@/lib/export/pdf";
import { hashToken, TOKEN_RE } from "@/lib/security/tokens";

export const runtime = "nodejs";

/** Branded PDF of the shared report (same content as the review page). */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) return new NextResponse(null, { status: 404 });
  const admin = getAdminRepo();
  const hash = hashToken(token);
  const shared = await admin.getSharedReview(hash);
  if (!shared) return new NextResponse(null, { status: 404 });
  const a = shared.analysis;
  try {
    const creative = a.mediaType === "video" ? await admin.getSharedAssetBytes(hash, 0) : a.asset ? await admin.getSharedAssetBytes(hash) : null;
    const pdf = await buildReportPdf(a, shared.branding, { creative });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="adscope-inceleme-${a.id.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    console.error("[review] pdf generation failed");
    return NextResponse.json({ error: "PDF şu an oluşturulamadı." }, { status: 500 });
  }
}
