import { NextResponse, type NextRequest } from "next/server";
import { toIcs, upcomingEvents } from "@/lib/calendar/season";
import { getCurrentUser } from "@/lib/data";
import { isSector } from "@/lib/sectors";

/** Season calendar as an iCalendar file (all-day events plus a "submit for review" reminder per occasion). */
export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) return new NextResponse(null, { status: 401 });
  const s = req.nextUrl.searchParams.get("sektor");
  const sector = isSector(s) ? s : null;
  const body = toIcs(upcomingEvents({ days: 365, sector }));
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="adscope-sezon-takvimi${sector ? `-${sector}` : ""}.ics"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
