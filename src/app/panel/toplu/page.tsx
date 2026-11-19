import { requirePanelUser } from "@/app/panel/guard";
import { IconDoc, IconSpark } from "@/components/icons";
import { SegmentedLinks } from "@/components/panel-ui";
import { VariantPaste } from "@/components/variant-paste";
import { getRepo } from "@/lib/data";
import { PASTE_MAX } from "@/lib/variants/paste";
import { variantCheckAction } from "./actions";
import { BulkCheck } from "./bulk-check";

export const metadata = { title: "Toplu kontrol" };

export default async function BulkPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePanelUser();
  const repo = getRepo();
  const [brands, profile] = await Promise.all([repo.listBrands(), repo.getProfile()]);
  const variants = (await searchParams).mod === "varyant";
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">Toplu kontrol</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            {variants
              ? "Reklam platformlarının yapay zekâ araçları metin varyantı üretiyor ama Türk reklam mevzuatına bakmıyor. Ürettikleri varyantları satır satır yapıştır; riskli olanları ve güvenli sürümlerini gör."
              : "Ürün kataloğunun reklam metinlerini ya da bir müşterinin kampanya setini tek seferde tara. En riskli reklamlar üstte listelenir; tabloyu indirip ekibinle paylaşabilirsin."}
          </p>
        </div>
        <SegmentedLinks
          label="Kontrol türü"
          items={[
            { href: "/panel/toplu", label: "Reklam metinleri", active: !variants, Icon: IconDoc },
            { href: "/panel/toplu?mod=varyant", label: "Platform varyantları", active: variants, Icon: IconSpark },
          ]}
        />
      </div>
      <div className="mt-8">
        {variants ? (
          <VariantPaste action={variantCheckAction} max={PASTE_MAX.panel} brands={brands.map((b) => ({ id: b.id, name: b.name }))} defaultSector={profile?.defaultSector ?? "genel"} readHash />
        ) : (
          <BulkCheck brands={brands.map((b) => ({ id: b.id, name: b.name }))} defaultSector={profile?.defaultSector ?? "genel"} />
        )}
      </div>
    </div>
  );
}
