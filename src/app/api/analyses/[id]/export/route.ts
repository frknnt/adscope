import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, getRepo } from "@/lib/data";
import { VARIANT_CSV_HEADER, toCsv, variantRows } from "@/lib/export/csv";
import { buildReportPdf } from "@/lib/export/pdf";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Report exports: ?format=csv (variants table) or ?format=pdf (branded report).
 * Ownership is enforced by RLS (or the memory repo); other users get a 404.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const format = req.nextUrl.searchParams.get("format");
  if (!UUID.test(id) || (format !== "csv" && format !== "pdf")) return new NextResponse(null, { status: 404 });
  if (!(await getCurrentUser())) return new NextResponse(null, { status: 404 });
  const repo = getRepo();
  const a = await repo.getAnalysis(id);
  if (!a || a.status !== "completed") return new NextResponse(null, { status: 404 });
  const short = id.slice(0, 8);

  if (format === "csv") {
    const sep = req.nextUrl.searchParams.get("ayrac") === "virgul" ? "," : ";";
    return new NextResponse(toCsv([VARIANT_CSV_HEADER, ...variantRows(a)], sep), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="adscope-varyantlar-${short}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  try {
    const [branding, creative] = await Promise.all([
      repo.getReportBranding(a.id),
      a.mediaType === "video" ? repo.getAssetBytes(a.id, 0) : a.asset ? repo.getAssetBytes(a.id) : Promise.resolve(null),
    ]);
    const pdf = await buildReportPdf(a, branding, { creative });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="adscope-rapor-${short}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    console.error("[export] pdf generation failed");
    return NextResponse.json({ error: "PDF şu an oluşturulamadı. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
