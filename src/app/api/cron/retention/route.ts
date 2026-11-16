import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminRepo } from "@/lib/data";

/** Deletes analyses (and their files) past their retention date. Call daily with `Authorization: Bearer $CRON_SECRET`. */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new NextResponse(null, { status: 401 });
  const purged = await getAdminRepo().purgeExpired();
  return NextResponse.json({ ok: true, purged });
}

export const GET = handle; // Vercel Cron sends GET
export const POST = handle;
