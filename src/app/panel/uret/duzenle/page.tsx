import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePanelUser } from "@/app/panel/guard";
import { BRAND_FONTS } from "@/lib/brand/kit";
import { INK, LAYOUTS, PAPER } from "@/lib/creative/layouts";
import { creativeQueryString, parseCreativeQuery } from "@/lib/creative/request";
import { allowedFonts, docFromLayout, docFromTemplate } from "@/lib/creative/editor-service";
import { creativeContext } from "@/lib/creative/service";
import { getRepo } from "@/lib/data";
import { CreativeEditor } from "./editor";

export const metadata = { title: "Görseli düzenle" };

export default async function EditorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePanelUser();
  const sp = await searchParams;
  const q = parseCreativeQuery((k) => (typeof sp[k] === "string" ? (sp[k] as string) : null));
  const repo = getRepo();
  const [profile, balance] = await Promise.all([repo.getProfile(), repo.getBalance()]);
  if (!sp.sektor) q.sektor = profile?.defaultSector ?? "genel";
  const ctx = await creativeContext(repo, { brandId: q.marka, platform: q.platform, sector: q.sektor, headline: q.baslik, body: q.metin, cta: q.cta });
  if (!ctx) notFound();
  const template = q.sablon ? await repo.getBrandTemplate(q.sablon) : null;
  if (q.sablon && (!template || template.brandId !== ctx.brandId)) notFound();
  const doc = template ? docFromTemplate(ctx, template.doc) : docFromLayout(ctx, q.yerlesim);
  if (!doc) notFound();
  const sourceLabel = template ? template.name : (LAYOUTS.find((l) => l.id === q.yerlesim)?.label ?? "Yerleşim");
  const fonts = allowedFonts(ctx).map((id) => ({ id, label: BRAND_FONTS.find((f) => f.id === id)!.label }));
  const swatches = [...new Set([ctx.kit.primary, ctx.kit.secondary, PAPER, INK, "#ffffff"])];

  return (
    <div>
      <nav aria-label="Konum" className="text-small text-muted">
        <Link href={`/panel/uret?sekme=gorsel&${creativeQueryString(q)}#gorseller`}>Görsele dön</Link>
      </nav>
      <h1 className="mt-2 font-display text-4xl font-semibold leading-tight">Görseli düzenle</h1>
      <p className="mt-2 max-w-3xl text-ink-soft">
        Başlangıç: {sourceLabel}. Katmanı seç, sürükle ya da ok tuşlarıyla taşı, köşesinden boyutlandır. Önizleme sunucuda, indirilecek PNG ile aynı çizimle hazırlanır ve ücretsizdir; tam boyutlu indirme 1 kredi.
      </p>
      <div className="mt-6">
        <CreativeEditor
          initialDoc={doc}
          initialSize={q.boyut}
          label={sourceLabel}
          fonts={fonts}
          swatches={swatches}
          hasLogo={Boolean(ctx.logoDataUrl)}
          brandName={ctx.kit.brandName}
          balance={balance}
          notes={ctx.notes}
        />
      </div>
    </div>
  );
}
