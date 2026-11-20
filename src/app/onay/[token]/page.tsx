import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { SECTOR_LABEL, formatDateTimeTr } from "@/components/rule-status";
import { ApprovalPill } from "@/components/approval-badge";
import { approvalBadge, approvalItems, latestDecisions } from "@/lib/approval";
import { getAdminRepo } from "@/lib/data";
import { PLATFORM_SHORT } from "@/lib/platforms";
import { hashToken, TOKEN_RE } from "@/lib/security/tokens";
import { ApprovalForm, type ApprovalFormItem } from "./approval-form";

export const metadata: Metadata = { title: "Müşteri onayı", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Client approval page (P12.1). No account: the token is checked on every request (hash lookup,
 * expiry, revocation). The customer only sees the items of this link and can only add decisions.
 */
export default async function ClientApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();
  const shared = await getAdminRepo().getApprovalLink(hashToken(token));
  if (!shared) notFound();
  const { analysis: a, branding, note, expiresAt, itemKeys, decisions } = shared;
  const logoSrc = branding.logo ? `data:${branding.logo.mime};base64,${Buffer.from(branding.logo.bytes).toString("base64")}` : null;
  const latest = latestDecisions(decisions);
  const base = `/onay/${token}/gorsel`;
  const items: ApprovalFormItem[] = approvalItems(a)
    .filter((it) => itemKeys.includes(it.key))
    .map((it) => {
      const d = decisions.find((x) => x.itemKey === it.key && latest.get(it.key) === x.decision) ?? null;
      return {
        ...it,
        current: d ? { decision: d.decision, comment: d.comment, reviewerName: d.reviewerName } : null,
        media:
          it.kind === "image"
            ? [{ src: base, alt: "Reklam görseli" }]
            : it.kind === "video"
              ? a.frames.map((f) => ({ src: `${base}?frame=${f.index}`, alt: `Videodan kare, ${Math.round(f.timeMs / 100) / 10}. saniye` }))
              : [],
      };
    });
  const badge = approvalBadge(itemKeys, decisions);
  const lastName = [...decisions].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))[0]?.reviewerName ?? "";

  return (
    <main id="icerik" className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div className="min-w-0">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt={branding.brandName ?? "Marka logosu"} className="h-10 w-auto max-w-[12rem] object-contain" />
          ) : (
            <Logo href="/" />
          )}
          <p className="mt-4 text-meta font-bold uppercase tracking-wide text-coral-deep">Müşteri onayı</p>
          <h1 className="mt-1 font-display text-3xl font-semibold leading-tight">{a.headline || a.primaryText.slice(0, 80) || "Reklam onayı"}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {[branding.brandName, branding.agencyName ? `Gönderen: ${branding.agencyName}` : null, SECTOR_LABEL[a.sector], PLATFORM_SHORT[a.platform]].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <ApprovalPill badge={badge} />
          <p className="text-meta text-muted">Bağlantı {formatDateTimeTr(expiresAt)} tarihine kadar geçerli.</p>
        </div>
      </header>
      {note ? (
        <aside className="mt-6 rounded-2xl bg-info-tint px-5 py-4">
          <p className="text-meta font-bold text-info">Ajansın notu</p>
          <p className="mt-1 whitespace-pre-line text-body">{note}</p>
        </aside>
      ) : null}
      <p className="mt-6 text-body text-ink-soft">
        Aşağıdaki her öğe için <strong className="text-ink">Onayla</strong>, <strong className="text-ink">Değişiklik iste</strong> ya da{" "}
        <strong className="text-ink">Reddet</strong> seç. Değişiklik istediğin ya da reddettiğin öğelere kısa bir yorum yaz.
      </p>
      <aside className="mt-4 rounded-2xl border border-line bg-card px-5 py-4 text-body leading-relaxed text-ink-soft">
        <strong className="text-ink">Risk değerlendirmesidir, hukuki görüş değildir.</strong> Metinler AdScope kural kartlarıyla ön kontrolden geçti; bu,
        reklamın platformda onaylanacağı anlamına gelmez. Senin onayın yalnızca ajansın için bir iş onayıdır.
      </aside>
      <div className="mt-8">
        <ApprovalForm token={token} items={items} defaultName={lastName} />
      </div>
    </main>
  );
}
