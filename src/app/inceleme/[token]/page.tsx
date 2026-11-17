import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { SECTOR_LABEL, formatDateTimeTr } from "@/components/rule-status";
import { buttonClass } from "@/components/ui";
import { ReportView } from "@/app/panel/analiz/report-view";
import { getAdminRepo } from "@/lib/data";
import { PLATFORM_SHORT } from "@/lib/platforms";
import { hashToken, TOKEN_RE } from "@/lib/security/tokens";

export const metadata: Metadata = { title: "Avukat incelemesi", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Read-only report behind a lawyer review link. No account needed; the token is checked on every
 * request (hash lookup, expiry, revocation). Nothing here can change the analysis.
 */
export default async function SharedReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();
  const shared = await getAdminRepo().getSharedReview(hashToken(token));
  if (!shared) notFound();
  const { analysis: a, branding, note, expiresAt } = shared;
  const logoSrc = branding.logo ? `data:${branding.logo.mime};base64,${Buffer.from(branding.logo.bytes).toString("base64")}` : null;

  return (
    <main id="icerik" className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt={branding.brandName ?? "Marka logosu"} className="h-10 w-auto max-w-[12rem] object-contain" />
          ) : (
            <Logo href="/" />
          )}
          <p className="mt-4 text-meta font-bold uppercase tracking-wide text-coral-deep">Avukat incelemesi için gönderildi</p>
          <h1 className="mt-1 font-display text-3xl font-semibold leading-tight">{a.headline || a.primaryText.slice(0, 80) || "Reklam ön kontrol raporu"}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {[branding.brandName, branding.agencyName ? `Gönderen: ${branding.agencyName}` : null, SECTOR_LABEL[a.sector], PLATFORM_SHORT[a.platform], formatDateTimeTr(a.completedAt ?? a.createdAt)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <a href={`/inceleme/${token}/pdf`} className={buttonClass("primary")} download>PDF indir</a>
          <p className="text-meta text-muted">Bağlantı {formatDateTimeTr(expiresAt)} tarihine kadar geçerli.</p>
        </div>
      </header>
      {note ? (
        <aside className="mt-6 rounded-2xl bg-info-tint px-5 py-4">
          <p className="text-meta font-bold text-info">Gönderenin notu</p>
          <p className="mt-1 whitespace-pre-line text-body">{note}</p>
        </aside>
      ) : null}
      <aside className="mt-6 rounded-2xl border border-line bg-card px-5 py-4 text-body leading-relaxed text-ink-soft">
        <strong className="text-ink">Risk değerlendirmesidir, hukuki görüş değildir.</strong> Bu rapor, AdScope kural kartlarıyla otomatik üretilmiş bir ön
        kontroldür. Doğrulanmamış kurallar yalnızca bilgilendirme amaçlıdır. Her bulgunun kaynağı ve son doğrulama tarihi bulgunun altında yer alır.
      </aside>
      <div className="mt-8">
        <ReportView a={a} print assetBase={`/inceleme/${token}/gorsel`} />
      </div>
    </main>
  );
}
