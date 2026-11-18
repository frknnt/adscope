import { NextResponse } from "next/server";
import { openApiDocument } from "@/lib/api/openapi";
import { siteUrl } from "@/lib/env";

export const dynamic = "force-static";

/** OpenAPI 3.1 description of the enterprise API (public: it contains no data, only the contract). */
export function GET() {
  return NextResponse.json(openApiDocument(siteUrl()), { headers: { "Cache-Control": "public, max-age=3600" } });
}
