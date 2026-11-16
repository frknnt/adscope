import { NextResponse, type NextRequest } from "next/server";
import { getAdminRepo } from "@/lib/data";
import { getPaymentProvider } from "@/lib/payments";

/**
 * Payment webhooks: /api/webhooks/lemonsqueezy, /api/webhooks/shopier.
 * The raw body is verified by the provider adapter; only verified purchases reach the ledger,
 * and apply_purchase_event is idempotent on (provider, event id) so redeliveries add credit once.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await ctx.params;
  const provider = getPaymentProvider(id);
  if (!provider || !provider.isConfigured()) return new NextResponse(null, { status: 404 });

  const raw = await request.text();
  if (raw.length > 256 * 1024) return new NextResponse(null, { status: 413 });

  const outcome = provider.parseWebhook(raw, request.headers);
  if (outcome.kind === "invalid") {
    console.warn("[webhook] rejected", { provider: id, reason: outcome.reason });
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (outcome.kind === "ignored") return NextResponse.json({ ok: true, ignored: true });

  const p = outcome.purchase;
  try {
    const res = await getAdminRepo().applyPurchase({
      provider: p.provider,
      eventId: p.eventId,
      orderId: p.orderId,
      userId: p.userId,
      packageId: p.pkg.id,
      credits: p.pkg.credits,
      amountMinor: p.amountMinor,
      currency: p.currency,
      isDemo: false,
    });
    return NextResponse.json({ ok: true, applied: res.applied });
  } catch {
    console.error("[webhook] apply_failed", { provider: id });
    // 500 lets the provider retry; the idempotency key prevents double credit.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
