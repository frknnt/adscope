import Link from "next/link";
import { requirePanelUser } from "@/app/panel/guard";
import { SegmentedLinks } from "@/components/panel-ui";
import { IconDoc, IconImage, IconPen, IconSpark, IconVideo } from "@/components/icons";
import { getAiProvider } from "@/lib/analysis/service";
import { CAMPAIGN_PACKAGE_CREDIT_COST, CAMPAIGN_PICK } from "@/lib/campaign/costs";
import type { CopyStored } from "@/lib/copy/service";
import { COPY_LIMITS } from "@/lib/copy/limits";
import { getRepo } from "@/lib/data";
import { PLATFORM_SHORT } from "@/lib/platforms";
import type { ScriptStored } from "@/lib/script/service";
import { CampaignPackage } from "./campaign-package";
import { CopyForm } from "./copy-form";
import { CopyResults } from "./copy-results";
import { CreativeStudio } from "./creative-studio";
import { ScriptForm } from "./script-form";
import { ScriptResults } from "./script-results";
import { VideoMaker } from "./video-maker";

export const metadata = { title: "Üret" };

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

export default async function GeneratePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePanelUser();
  const repo = getRepo();
  const sp = await searchParams;
  // The campaign package is the first tab; links to a copy result (?sonuc=) still open the text tab.
  const tab = sp.sekme === "gorsel" || sp.sekme === "video" || sp.sekme === "senaryo" || sp.sekme === "metin" ? sp.sekme : sp.sonuc ? "metin" : "paket";
  const [profile, brands, audiences, balance, recent] = await Promise.all([repo.getProfile(), repo.listBrands(), repo.listAudiences(), repo.getBalance(), repo.listGenerations(tab === "senaryo" ? "script" : tab === "paket" ? "campaign" : "copy", 8)]);
  const aiOn = Boolean(getAiProvider()?.generateCopy);
  const resultId = typeof sp.sonuc === "string" ? sp.sonuc : null;
  const result = resultId && /^[0-9a-f-]{36}$/i.test(resultId) ? await repo.getGeneration(resultId) : null;
  const stored = result?.kind === "copy" ? (result.output as unknown as CopyStored) : null;
  const storedScript = result?.kind === "script" ? (result.output as unknown as ScriptStored) : null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">Üret</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Ürün sayfandan tek akışta kampanya paketi hazırla ya da metin, görsel, video ve senaryoyu ayrı ayrı üret. Üretilen her metin kural motorundan geçer; riskli olanların yanında güvenli sürümü gösterilir.
          </p>
        </div>
        <SegmentedLinks
          label="Üretim türü"
          items={[
            { href: "/panel/uret", label: "Kampanya paketi", active: tab === "paket", Icon: IconSpark },
            { href: "/panel/uret?sekme=metin", label: "Metin", active: tab === "metin", Icon: IconPen },
            { href: "/panel/uret?sekme=gorsel", label: "Görsel", active: tab === "gorsel", Icon: IconImage },
            { href: "/panel/uret?sekme=video", label: "Video", active: tab === "video", Icon: IconVideo },
            { href: "/panel/uret?sekme=senaryo", label: "Senaryo", active: tab === "senaryo", Icon: IconDoc },
          ]}
        />
      </div>

      {tab === "paket" ? (
        <div className="mt-8 grid gap-8">
          <CampaignPackage
            brands={brands.map((b) => ({ id: b.id, name: b.name, sector: b.sector, website: b.website, primaryColor: b.primaryColor, secondaryColor: b.secondaryColor }))}
            audiences={audiences.map((a) => ({ id: a.id, brandId: a.brandId, name: a.name }))}
            defaultSector={profile?.defaultSector ?? "genel"}
            balance={balance}
            aiOn={aiOn}
            cost={CAMPAIGN_PACKAGE_CREDIT_COST}
            pick={CAMPAIGN_PICK}
            initial={{
              url: typeof sp.adres === "string" && /^https?:\/\//i.test(sp.adres) ? sp.adres.slice(0, 2048) : "",
              brandId: typeof sp.marka === "string" ? sp.marka : "",
              auto: sp.basla === "1",
            }}
          />
          {recent.length ? (
            <section aria-labelledby="son-paketler">
              <h2 id="son-paketler" className="text-lg font-bold">Son paketler</h2>
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {recent.map((g) => (
                  <li key={g.id}>
                    <a href={`/api/generations/${g.id}/files/0`} download className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-small no-underline hover:border-line-strong">
                      <span className="min-w-0 truncate font-semibold text-ink">{String(g.output.productName || "Kampanya paketi")}</span>
                      <span className="shrink-0 text-meta text-muted">
                        {g.platform ? PLATFORM_SHORT[g.platform] : ""} · {dateFmt.format(new Date(g.createdAt))}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-meta text-muted">Paketler 90 gün saklanır. Yeniden indirmek ücretsizdir; tarayıcıda hazırlanan video bu kopyada yer almaz.</p>
            </section>
          ) : null}
        </div>
      ) : tab === "senaryo" ? (
        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="grid content-start gap-6">
            <ScriptForm
              brands={brands.map((b) => ({ id: b.id, name: b.name, sector: b.sector }))}
              audiences={audiences.map((a) => ({ id: a.id, brandId: a.brandId, name: a.name }))}
              defaultSector={profile?.defaultSector ?? "genel"}
              aiOn={Boolean(getAiProvider()?.generateScript)}
              balance={balance}
            />
            {recent.length ? (
              <section aria-labelledby="son-senaryolar">
                <h2 id="son-senaryolar" className="text-lg font-bold">Son senaryolar</h2>
                <ul className="mt-3 grid gap-2">
                  {recent.map((g) => {
                    const s = g.output as unknown as ScriptStored;
                    return (
                      <li key={g.id}>
                        <Link href={`/panel/uret?sekme=senaryo&sonuc=${g.id}#senaryo`} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-small no-underline ${g.id === result?.id ? "border-blue bg-blue-tint/40" : "border-line bg-card hover:border-line-strong"}`}>
                          <span className="min-w-0 truncate font-semibold text-ink">{s.input?.productName || "Ürün"} · {s.script?.duration ?? ""} sn</span>
                          <span className="shrink-0 text-meta text-muted">{dateFmt.format(new Date(g.createdAt))}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>
          <section id="senaryo" aria-labelledby="senaryo-baslik" className="min-w-0">
            <h2 id="senaryo-baslik" className="font-display text-2xl font-semibold">{storedScript ? `Senaryo: ${storedScript.input.productName || "ürün"}` : "Senaryo"}</h2>
            <div className="mt-4">
              {storedScript ? (
                <ScriptResults script={storedScript.script} aiFailed={storedScript.aiFailed} />
              ) : (
                <p className="rounded-2xl border border-dashed border-line-strong bg-card px-6 py-10 text-center text-ink-soft">
                  Soldaki formu doldur. 15, 30 ya da 45 saniyelik senaryo sahne sahne listelenir: görüntü, ekran yazısı, dış ses ve süre. Dış sesi SRT altyazı olarak indirebilirsin.
                </p>
              )}
            </div>
          </section>
        </div>
      ) : tab === "video" ? (
        <div className="mt-8">
          <VideoMaker
            brands={brands.map((b) => ({ id: b.id, name: b.name, sector: b.sector, primaryColor: b.primaryColor, secondaryColor: b.secondaryColor, preferredCta: b.preferredCta }))}
            creatives={(await repo.listGenerations("creative", 12)).flatMap((g) => {
              const f = (g.output.files as { mime?: string }[] | undefined)?.[0];
              return f?.mime === "image/png" ? [{ href: `/api/generations/${g.id}/files/0`, label: `${String(g.output.layout ?? "Görsel")} · ${dateFmt.format(new Date(g.createdAt))}` }] : [];
            })}
            defaultSector={profile?.defaultSector ?? "genel"}
          />
        </div>
      ) : tab === "gorsel" ? (
        <div className="mt-8">
          <CreativeStudio sp={sp} brands={brands} defaultSector={profile?.defaultSector ?? "genel"} balance={balance} />
        </div>
      ) : (
        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="grid content-start gap-6">
            <CopyForm
              brands={brands.map((b) => ({ id: b.id, name: b.name, sector: b.sector, website: b.website }))}
              audiences={audiences.map((a) => ({ id: a.id, brandId: a.brandId, name: a.name }))}
              defaultSector={profile?.defaultSector ?? "genel"}
              aiOn={aiOn}
              balance={balance}
            />
            {recent.length ? (
              <section aria-labelledby="son-uretimler">
                <h2 id="son-uretimler" className="text-lg font-bold">Son üretimler</h2>
                <ul className="mt-3 grid gap-2">
                  {recent.map((g) => {
                    const s = g.output as unknown as CopyStored;
                    return (
                      <li key={g.id}>
                        <Link href={`/panel/uret?sonuc=${g.id}#sonuc`} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-small no-underline ${g.id === result?.id ? "border-blue bg-blue-tint/40" : "border-line bg-card hover:border-line-strong"}`}>
                          <span className="min-w-0 truncate font-semibold text-ink">{s.input?.productName || "Ürün"}</span>
                          <span className="shrink-0 text-meta text-muted">
                            {g.platform ? PLATFORM_SHORT[g.platform] : ""} · {dateFmt.format(new Date(g.createdAt))}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>
          <section id="sonuc" aria-labelledby="sonuc-baslik" className="min-w-0">
            <h2 id="sonuc-baslik" className="font-display text-2xl font-semibold">{stored ? `Öneriler: ${stored.input.productName || "ürün"}` : "Öneriler"}</h2>
            <div className="mt-4">
              {stored && result?.platform ? (
                <CopyResults copy={stored.copy} platform={result.platform} sector={brands.find((b) => b.id === result.brandId)?.sector ?? profile?.defaultSector ?? "genel"} limits={COPY_LIMITS[result.platform]} aiFailed={stored.aiFailed} brandId={result.brandId} />
              ) : (
                <p className="rounded-2xl border border-dashed border-line-strong bg-card px-6 py-10 text-center text-ink-soft">
                  Soldaki formu doldur. 10 başlık, 10 ana metin, 5 açıklama ve 3 harekete geçirici ifade burada listelenir; birini seçip tek tıkla analize aktarabilirsin.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
