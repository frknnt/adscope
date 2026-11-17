import { NextResponse } from "next/server";
import { getCurrentUser, getRepo } from "@/lib/data";
import { parseCreativeQuery } from "@/lib/creative/request";
import { creativeContext, renderCreative } from "@/lib/creative/service";
import { rateLimit } from "@/lib/security/rate-limit";

/** Free, reduced-size preview of one layout. Full-size files come from the paid download. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  if (!rateLimit(`creative-preview:${user.id}`, 400, 3600_000).ok) return new NextResponse(null, { status: 429 });
  const q = parseCreativeQuery((k) => new URL(req.url).searchParams.get(k));
  if (!q.baslik) return new NextResponse(null, { status: 400 });
  try {
    const ctx = await creativeContext(getRepo(), { brandId: q.marka, platform: q.platform, sector: q.sektor, headline: q.baslik, body: q.metin, cta: q.cta });
    if (!ctx) return new NextResponse(null, { status: 404 });
    const png = await renderCreative(ctx, q.yerlesim, q.boyut, 0.4);
    return new NextResponse(Buffer.from(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" },
    });
  } catch {
    console.error("creative preview failed");
    return new NextResponse(null, { status: 500 });
  }
}
