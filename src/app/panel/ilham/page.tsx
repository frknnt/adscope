import Link from "next/link";
import { IconAlert, IconBoard, IconExternal, IconInfo, IconTrash } from "@/components/icons";
import { formatDateTr } from "@/components/rule-status";
import { buttonClass, Disclaimer, inputClass } from "@/components/ui";
import { requirePanelUser } from "@/app/panel/guard";
import { getAdLibrary, isLibraryCountry, LIBRARY_COUNTRIES, runningDays, type LibraryAd, type LibraryResult } from "@/lib/ads-library/meta";
import { getRepo } from "@/lib/data";
import { runRuleEngine } from "@/lib/engine/rule-engine";
import type { RuleRecord } from "@/lib/engine/types";
import { ruleAppliesTo } from "@/lib/platforms";
import { isSector, SECTOR_IDS, SECTOR_INFO, type Sector } from "@/lib/sectors";
import { hashKey, rateLimit } from "@/lib/security/rate-limit";
import { deletePinAction } from "./actions";
import { PinButton } from "./pin-button";

export const metadata = { title: "İlham panosu" };

type SP = Record<string, string | string[] | undefined>;
const str = (v: SP[string], max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001F]/g, " ").trim().slice(0, max) : "");

const ERRORS: Record<Exclude<LibraryResult, { ok: true }>["reason"], string> = {
  not_configured: "Meta Reklam Kütüphanesi bağlantısı kurulmamış.",
  token_invalid: "Meta erişim anahtarı geçersiz ya da süresi dolmuş. Yöneticinin yeni bir anahtar tanımlaması gerekiyor.",
  rate_limited: "Kısa sürede çok fazla arama yapıldı. Birkaç dakika sonra tekrar dene.",
  timeout: "Meta zamanında yanıt vermedi. Biraz sonra tekrar dene.",
  api_error: "Meta şu an arama sonucunu döndürmedi. Biraz sonra tekrar dene.",
  invalid_query: "En az 2 karakterlik bir arama terimi yaz.",
};

function signals(ad: { title: string; body: string }, rules: RuleRecord[]) {
  const found = runRuleEngine(
    { headline: ad.title, primaryText: ad.body, description: "", flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false } },
    rules,
  );
  return {
    red: found.filter((f) => f.severity === "red").length,
    yellow: found.filter((f) => f.severity === "yellow").length,
    titles: found.filter((f) => f.severity !== "info").slice(0, 2).map((f) => f.title),
  };
}

function checkHref(title: string, body: string) {
  const q = new URLSearchParams({ platform: "meta" });
  if (body) q.set("metin", body.slice(0, 1500));
  if (title) q.set("baslik", title.slice(0, 200));
  return `/panel/yeni#${q}`;
}

function SignalLine({ s }: { s: ReturnType<typeof signals> }) {
  if (!s.red && !s.yellow) return <p className="text-[0.82rem] text-muted">AdScope kural setinde eşleşme yok.</p>;
  return (
    <div className="grid gap-1 text-[0.82rem]">
      <p className="flex flex-wrap items-center gap-1.5 font-semibold">
        <IconAlert className="size-4 text-amber" aria-hidden />
        AdScope sinyali:
        {s.red ? <span className="rounded-full bg-coral-tint px-2 py-0.5 text-coral-deep">{s.red} kırmızı</span> : null}
        {s.yellow ? <span className="rounded-full bg-amber-tint px-2 py-0.5 text-amber">{s.yellow} sarı</span> : null}
      </p>
      {s.titles.length ? <p className="text-muted">{s.titles.join(" · ")}</p> : null}
    </div>
  );
}

function AdCard({ ad, country, rules, saved }: { ad: LibraryAd; country: string; rules: RuleRecord[]; saved: boolean }) {
  const body = ad.bodies[0] ?? "";
  const title = ad.titles[0] ?? "";
  const s = signals({ title, body }, rules);
  const days = runningDays(ad);
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold">{ad.pageName || "Sayfa adı yok"}</p>
        <p className="text-[0.78rem] text-muted">
          {ad.deliveryStart ? <>Başlangıç <time dateTime={ad.deliveryStart}>{formatDateTr(ad.deliveryStart)}</time></> : null}
          {ad.deliveryStop ? <> · bitiş <time dateTime={ad.deliveryStop}>{formatDateTr(ad.deliveryStop)}</time></> : ad.deliveryStart ? " · yayında" : null}
        </p>
      </div>
      {days >= 0 ? (
        <p className="w-fit rounded-full bg-paper-2 px-2.5 py-0.5 text-[0.78rem] font-semibold tabular">{days} gün{ad.deliveryStop ? " yayında kaldı" : "dür yayında"}</p>
      ) : null}
      {title ? <p className="font-semibold leading-snug">{title}</p> : null}
      {body ? <p className="line-clamp-6 whitespace-pre-line text-[0.9rem] text-ink-soft">{body}</p> : <p className="text-[0.88rem] text-muted">Metin yok (yalnızca görsel veya video).</p>}
      {ad.bodies.length > 1 ? <p className="text-[0.78rem] text-muted">+{ad.bodies.length - 1} metin varyantı daha</p> : null}
      <p className="text-[0.78rem] text-muted">
        {ad.platforms.length ? ad.platforms.map((p) => p.toLowerCase()).join(", ") : null}
        {ad.euReach ? ` · AB erişimi ≈ ${new Intl.NumberFormat("tr-TR").format(ad.euReach)}` : null}
      </p>
      <SignalLine s={s} />
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-3">
        <PinButton adArchiveId={ad.id} pageName={ad.pageName} title={title} body={body} country={country} deliveryStart={ad.deliveryStart} saved={saved} />
        <Link href={checkHref(title, body)} className="rounded-full border border-line-strong px-3 py-1.5 text-[0.82rem] font-semibold no-underline hover:bg-paper-2">
          Benzerini kontrol et
        </Link>
        <a href={ad.libraryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[0.82rem] font-semibold">
          Kütüphanede aç <IconExternal className="size-3.5" aria-hidden />
          <span className="sr-only">(yeni sekmede açılır)</span>
        </a>
      </div>
    </li>
  );
}

function SetupState() {
  return (
    <section aria-labelledby="kurulum" className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-7">
      <h2 id="kurulum" className="flex items-center gap-2 font-display text-2xl font-semibold">
        <IconInfo className="size-6 text-info" aria-hidden /> Meta Reklam Kütüphanesi bağlantısı kurulmamış
      </h2>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Arama yapabilmek için sunucuya bir Meta erişim anahtarı tanımlanmalı. Bu bir kez, uygulamayı yöneten kişi tarafından yapılır; anahtar tarayıcıya hiç gönderilmez.
        Bağlantı kurulana kadar burada örnek ya da uydurma reklam gösterilmez.
      </p>
      <ol className="mt-4 grid list-decimal gap-2 pl-5 text-[0.92rem]">
        <li>Meta for Developers üzerinde bir uygulama oluştur.</li>
        <li>Reklam Kütüphanesi API erişimi için kimlik doğrulamasını tamamla (facebook.com/ID).</li>
        <li>Graph API Explorer ile uzun ömürlü bir kullanıcı erişim anahtarı üret.</li>
        <li>
          Anahtarı sunucu ortamına <code className="rounded bg-paper px-1.5 py-0.5 text-[0.85rem]">META_AD_LIBRARY_TOKEN</code> olarak ekle ve uygulamayı yeniden başlat.
        </li>
      </ol>
      <p className="mt-4 text-[0.85rem] text-muted">
        Not: Meta, ticari reklamları API üzerinden yalnızca AB ülkelerinde gösterilmiş olanlar için açıyor. Bu yüzden arama AB ülkelerinde, istersen yalnızca Türkçe reklamlarla yapılır.
      </p>
      <a href="https://www.facebook.com/ads/library/api" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[0.9rem] font-semibold">
        Meta Reklam Kütüphanesi API sayfası <IconExternal className="size-3.5" aria-hidden />
        <span className="sr-only">(yeni sekmede açılır)</span>
      </a>
    </section>
  );
}

export default async function InspirationPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePanelUser();
  const sp = await searchParams;
  const repo = getRepo();
  const library = getAdLibrary();
  const [pins, allRules, profile] = await Promise.all([repo.listPins(), repo.listAllRules(), repo.getProfile()]);

  const searched = sp.ara === "1";
  const q = str(sp.q, 100);
  const country = isLibraryCountry(sp.ulke) ? sp.ulke : "DE";
  const turkishOnly = searched ? sp.tr === "1" : true;
  const activeOnly = searched ? sp.aktif === "1" : true;
  const sector: Sector = isSector(sp.sektor) ? sp.sektor : (profile?.defaultSector ?? "genel");
  const after = str(sp.sonra, 400) || null;
  const rules = allRules.filter((r) => (r.sector === "genel" || r.sector === sector) && ruleAppliesTo(r, "meta"));
  const pinned = new Set(pins.map((p) => p.adArchiveId));

  let result: LibraryResult | null = null;
  if (library.enabled && searched) {
    const key = `adlib:${await hashKey("adlib", user.id)}`;
    result = await library.search({ q, country, turkishOnly, activeOnly, after }, () => rateLimit(key, 30, 10 * 60_000).ok);
  }

  const nextHref = (cursor: string) => {
    const p = new URLSearchParams({ ara: "1", q, ulke: country, sektor: sector, sonra: cursor });
    if (turkishOnly) p.set("tr", "1");
    if (activeOnly) p.set("aktif", "1");
    return `/panel/ilham?${p}`;
  };

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">İlham panosu</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Meta Reklam Kütüphanesi&apos;nde sektöründeki reklamları ara, beğendiklerini panoya kaydet. Her reklamın metni AdScope kural setiyle taranır; böylece hangi ifadelerin risk
        taşıdığını yayından önce görürsün.
      </p>

      {library.enabled ? (
        <form method="get" action="/panel/ilham" className="mt-8 grid gap-4 rounded-2xl border border-line bg-card p-5 sm:p-6" role="search" aria-label="Reklam kütüphanesinde ara">
          <input type="hidden" name="ara" value="1" />
          <div className="grid gap-4 md:grid-cols-[1fr_12rem_12rem]">
            <label className="grid gap-1.5 text-[0.9rem] font-semibold">
              Arama terimi
              <input name="q" defaultValue={q} required minLength={2} maxLength={100} placeholder="ör. kolajen, diyetisyen, kampanya" className={inputClass} />
            </label>
            <label className="grid gap-1.5 text-[0.9rem] font-semibold">
              Gösterildiği ülke
              <select name="ulke" defaultValue={country} className={inputClass}>
                {Object.entries(LIBRARY_COUNTRIES).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-[0.9rem] font-semibold">
              Sinyal için sektör
              <select name="sektor" defaultValue={sector} className={inputClass}>
                {SECTOR_IDS.map((s) => <option key={s} value={s}>{SECTOR_INFO[s].label}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[0.9rem]">
            <label className="flex items-center gap-2"><input type="checkbox" name="tr" value="1" defaultChecked={turkishOnly} className="accent-ink" /> Yalnızca Türkçe reklamlar</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="aktif" value="1" defaultChecked={activeOnly} className="accent-ink" /> Yalnızca yayında olanlar</label>
            <button type="submit" className={buttonClass("accent", "ml-auto")}>Ara</button>
          </div>
          <p className="text-[0.8rem] text-muted">Meta ticari reklamları API&apos;de yalnızca AB ülkelerinde gösterilenler için açar. Arama terimin kaydedilmez.</p>
        </form>
      ) : (
        <SetupState />
      )}

      {result && !result.ok ? (
        <p role="alert" className="mt-6 rounded-xl bg-coral-tint px-4 py-3 text-[0.92rem] text-coral-deep">{ERRORS[result.reason]}</p>
      ) : null}

      {result?.ok ? (
        <section aria-labelledby="sonuclar" className="mt-8">
          <h2 id="sonuclar" className="font-display text-2xl font-semibold">
            {result.ads.length ? `“${q}” için ${result.ads.length} reklam` : `“${q}” için reklam bulunamadı`}
          </h2>
          {result.ads.length > 1 ? <p className="mt-1 text-[0.85rem] text-muted">En uzun süredir yayında olanlar üstte. Uzun süre yayında kalan reklam çoğu zaman kârlı reklamdır.</p> : null}
          {result.ads.length ? (
            <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.ads.map((ad) => <AdCard key={ad.id} ad={ad} country={country} rules={rules} saved={pinned.has(ad.id)} />)}
            </ul>
          ) : (
            <p className="mt-2 text-ink-soft">Başka bir terim dene ya da “Yalnızca Türkçe reklamlar” seçeneğini kaldır.</p>
          )}
          {result.after ? (
            <p className="mt-5">
              <Link href={nextHref(result.after)} className={buttonClass("ghost")}>Sonraki sayfa</Link>
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="pano" className="mt-10">
        <h2 id="pano" className="flex items-center gap-2 font-display text-2xl font-semibold">
          <IconBoard className="size-6" aria-hidden /> Panom
        </h2>
        {pins.length ? (
          <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pins.map((p) => {
              const s = signals(p, rules);
              return (
                <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold">{p.pageName || "Sayfa adı yok"}</p>
                    <p className="text-[0.78rem] text-muted">{LIBRARY_COUNTRIES[p.country as keyof typeof LIBRARY_COUNTRIES] ?? p.country} · kaydedildi {formatDateTr(p.createdAt)}</p>
                  </div>
                  {p.title ? <p className="font-semibold leading-snug">{p.title}</p> : null}
                  {p.body ? <p className="line-clamp-6 whitespace-pre-line text-[0.9rem] text-ink-soft">{p.body}</p> : null}
                  <SignalLine s={s} />
                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-3">
                    <Link href={checkHref(p.title, p.body)} className="rounded-full border border-line-strong px-3 py-1.5 text-[0.82rem] font-semibold no-underline hover:bg-paper-2">
                      Benzerini kontrol et
                    </Link>
                    <a href={`https://www.facebook.com/ads/library/?id=${p.adArchiveId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[0.82rem] font-semibold">
                      Kütüphanede aç <IconExternal className="size-3.5" aria-hidden />
                      <span className="sr-only">(yeni sekmede açılır)</span>
                    </a>
                    <form action={deletePinAction} className="ml-auto">
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="inline-flex items-center gap-1 text-[0.82rem] font-semibold text-coral-deep" aria-label={`${p.pageName || "Reklamı"} panodan kaldır`}>
                        <IconTrash className="size-4" aria-hidden /> Kaldır
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-ink-soft">Henüz kayıtlı reklam yok. Arama sonuçlarında “Panoya kaydet” ile buraya ekleyebilirsin.</p>
        )}
      </section>

      <div className="mt-10 grid gap-3 text-[0.82rem] text-muted">
        <p>
          Bir reklamın kütüphanede yayında görünmesi, Meta tarafından kalıcı olarak onaylandığı ya da mevzuata uygun olduğu anlamına gelmez. Sinyaller yalnızca AdScope kural setindeki
          eşleşmelerdir. Reklam metinleri sahiplerine aittir; birebir kopyalamak yerine fikir almak için kullan.
        </p>
        <Disclaimer />
      </div>
    </div>
  );
}
