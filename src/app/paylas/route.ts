import { NextResponse } from "next/server";

/**
 * Share target fallback. Normally the service worker answers POST /paylas on the device and the
 * shared item never reaches the server. If it does (worker not installed yet), the body is ignored
 * and the user is sent to the wizard.
 */
export function POST(request: Request) {
  return NextResponse.redirect(new URL("/panel/yeni", request.url), 303);
}

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/panel/yeni", request.url), 307);
}
