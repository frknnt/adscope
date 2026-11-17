import { requirePanelUser } from "@/app/panel/guard";
import { getRepo } from "@/lib/data";
import { BulkCheck } from "./bulk-check";

export const metadata = { title: "Toplu kontrol" };

export default async function BulkPage() {
  await requirePanelUser();
  const repo = getRepo();
  const [brands, profile] = await Promise.all([repo.listBrands(), repo.getProfile()]);
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">Toplu kontrol</h1>
      <p className="mt-2 mb-8 max-w-2xl text-ink-soft">
        Ürün kataloğunun reklam metinlerini ya da bir müşterinin kampanya setini tek seferde tara. En riskli reklamlar üstte listelenir; tabloyu indirip ekibinle paylaşabilirsin.
      </p>
      <BulkCheck brands={brands.map((b) => ({ id: b.id, name: b.name }))} defaultSector={profile?.defaultSector ?? "genel"} />
    </div>
  );
}
