import Link from "next/link";
import { HighlightedText } from "@/components/highlighted-text";
import { IconExternal } from "@/components/icons";
import { LEVEL_LABEL, LevelPill } from "@/components/risk";
import { ButtonLink, Disclaimer } from "@/components/ui";
import { RULE_CATALOG } from "@/lib/rules/catalog";
import { SAMPLE_AD, sampleReport } from "@/lib/sample";

export default async function HomePage() {
  const report = await sampleReport();
  const activeCount = RULE_CATALOG.filter((r) => r.status === "active").length;
  const reviewCount = RULE_CATALOG.filter((r) => r.status === "requires_review").length;
  const shown = report.findings.slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-20">
        <div className="reveal">
          <h1 className="font-display text-[2.6rem] font-semibold leading-[1.02] sm:text-6xl lg:text-[4.4rem]">
            Reklamını yayınlamadan önce <span className="italic text-coral-deep">test et.</span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-soft">
            Görselini ve metnini yükle; AdScope Meta ret riskini, Türk reklam mevzuatı açısından riskli ifadeleri ve kreatif kalitesini tek raporda göstersin. Riskli cümleler için güvenli öneri ve beş doğal Türkçe varyant hazır gelsin.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/kayit" variant="accent" className="h-12 px-6 text-base">
              3 ücretsiz analizle başla
            </ButtonLink>
            <ButtonLink href="/nasil-calisir" variant="ghost" className="h-12 px-6 text-base">
              Nasıl çalışır?
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm text-muted">Kart bilgisi gerekmez. Yüklediğin içerikler model eğitiminde kullanılmaz.</p>
        </div>

        {/* Real engine output on a sample ad */}
        <figure className="sheet reveal relative rounded-[1.4rem] border border-line p-5 shadow-[0_30px_60px_-30px_rgba(19,33,60,.45)] sm:p-7" style={{ animationDelay: "120ms" }}>
          <figcaption className="flex items-center justify-between text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-muted">
            <span>Örnek rapor · takviye gıda</span>
            <span className="tabular">AdScope motoru</span>
          </figcaption>
          <blockquote className="mt-4 rounded-xl border border-line bg-white/80 p-4 text-[1.02rem] leading-relaxed">
            <HighlightedText text={SAMPLE_AD.primaryText} marks={report.findings.map((f) => ({ text: f.matched_text, severity: f.severity }))} animate />
          </blockquote>
          <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-paper-2 px-2 py-3">
              <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">Meta ret riski</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular">{report.meta_risk_score}</dd>
              <dd className="mt-1"><LevelPill level={report.meta_risk_level} /></dd>
            </div>
            <div className="rounded-xl bg-paper-2 px-2 py-3">
              <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">Mevzuat riski</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular">{report.legal_finding_count}<span className="text-sm font-normal text-muted"> bulgu</span></dd>
              <dd className="mt-1"><LevelPill level={report.legal_risk_level} /></dd>
            </div>
            <div className="rounded-xl bg-paper-2 px-2 py-3">
              <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">Kreatif skoru</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular">{report.creative_score}</dd>
              <dd className="mt-1 text-[0.75rem] text-muted">/ 100</dd>
            </div>
          </dl>
          <ul className="mt-5 space-y-2.5 text-[0.9rem]">
            {shown.map((f, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  className={`mt-1.5 size-2.5 shrink-0 rounded-full ${f.severity === "red" ? "bg-coral" : f.severity === "yellow" ? "bg-[#e9b43c]" : "bg-info"}`}
                  aria-hidden
                />
                <span>
                  <strong className="font-semibold">“{f.matched_text}”</strong> <span className="text-ink-soft">· {f.title}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-dashed border-line pt-3 text-[0.82rem] text-ink-soft">
            <span className="font-semibold text-ink">Güvenli öneri: </span>
            {report.safe_text}
          </p>
        </figure>
      </section>

      {/* Three questions */}
      <section className="border-y border-line/70 bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="max-w-2xl font-display text-3xl font-semibold leading-tight sm:text-[2.6rem]">Üç soruya tek raporda cevap.</h2>
          <div className="mt-10 divide-y divide-line">
            {[
              {
                q: "Meta bu reklamı reddeder mi?",
                a: "Gerçekçi olmayan sonuç vaadi, olumsuz beden algısı, önce/sonra kurgusu ve sansasyonel dil gibi Meta Reklam Standartları'ndaki risk işaretlerini tarar. 0–100 arası bir ret riski skoru ve düşük/orta/yüksek seviye verir.",
                tag: `Meta ret riski: ${LEVEL_LABEL[report.meta_risk_level]}`,
              },
              {
                q: "Türk reklam mevzuatı açısından riskli bir şey var mı?",
                a: "1 Ağustos 2026'da yürürlüğe giren Ticari Reklam Yönetmeliği değişikliklerinden indirim beyanı, etkileyici 'Reklam' ibaresi, yapay zekâ karakter açıklaması, çevre beyanı ve takviye gıda hükümlerini kontrol eder. Her bulgu resmî kaynağa bağlanır.",
                tag: `${report.legal_finding_count} doğrulanmış mevzuat bulgusu`,
              },
              {
                q: "Bu kreatif iyi performans gösterir mi?",
                a: "CTA netliği, başlık ve metin uzunluğu, ton, görsel çözünürlüğü ve format uyumunu 100 üzerinden puanlar; her alt skorun nedenini ve somut iyileştirme önerisini yazar.",
                tag: `Kreatif skoru: ${report.creative_score}/100`,
              },
            ].map((row) => (
              <div key={row.q} className="grid gap-3 py-7 md:grid-cols-[1fr_1.3fr] md:gap-10">
                <h3 className="font-display text-2xl font-medium leading-snug">{row.q}</h3>
                <div>
                  <p className="leading-relaxed text-ink-soft">{row.a}</p>
                  <p className="mt-3 text-sm font-semibold text-coral-deep">{row.tag}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rule cards: no invented law */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-start">
        <div>
          <h2 className="font-display text-3xl font-semibold leading-tight sm:text-[2.6rem]">Bulgu, kaynağı olan kurala dayanır.</h2>
          <p className="mt-5 leading-relaxed text-ink-soft">
            AdScope mevzuat maddesi uydurmaz. Her bulgu sürümlü bir kural kartına bağlıdır: kural kimliği, risk seviyesi, güvenli düzeltme yaklaşımı, kaynak kurum, resmî bağlantı, yürürlük ve son doğrulama tarihi. Resmî kaynaktan doğrulanamayan kurallar yalnızca bilgilendirme olarak gösterilir, ihlal sayılmaz.
          </p>
          <p className="mt-5 text-sm text-ink-soft">
            Şu an <strong className="text-ink">{activeCount} aktif</strong> ve <strong className="text-ink">{reviewCount} doğrulama bekleyen</strong> kural kartı var.{" "}
            <Link href="/kurallar" className="font-semibold text-coral-deep">Tüm kartları gör</Link>
          </p>
        </div>
        <article className="rounded-2xl border border-line bg-card p-6 shadow-[0_18px_40px_-28px_rgba(19,33,60,.5)]">
          <div className="flex items-center justify-between text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-muted">
            <span className="tabular">TR-RY-INDIRIM-REFERANS · v1</span>
            <span className="rounded-full bg-green-tint px-2 py-0.5 text-green">Aktif</span>
          </div>
          <h3 className="mt-3 font-display text-xl font-semibold">İndirim oranı ve indirim öncesi fiyat</h3>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">
            İndirimden önceki fiyat, indirimin başlangıcından önceki son on gün içinde uygulanan en düşük fiyat olarak alınmalıdır.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.85rem]">
            <dt className="text-muted">Kaynak</dt>
            <dd>T.C. Ticaret Bakanlığı</dd>
            <dt className="text-muted">Yürürlük</dt>
            <dd className="tabular">01.08.2026</dd>
            <dt className="text-muted">Son doğrulama</dt>
            <dd className="tabular">16.11.2026</dd>
            <dt className="text-muted">Hukukçu incelemesi</dt>
            <dd>Bekliyor</dd>
          </dl>
          <a
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-coral-deep"
            href="https://ticaret.gov.tr/haberler/ticaret-bakanligi-tarafindan-ticari-reklam-ve-haksiz-ticari-uygulamalar-yonetmeliginde-yapilan-degisikliklerle-tuketicilerin-aldatici-reklam-ve-ticari-uygulamalara-karsi-korunmasi-guclendiriliyor"
            target="_blank"
            rel="noopener noreferrer"
          >
            Resmî kaynak <IconExternal />
          </a>
        </article>
      </section>

      {/* Sector packs + roadmap */}
      <section className="bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight sm:text-[2.6rem]">Riskin en yüksek olduğu sektörler için ek kontroller.</h2>
            <dl className="mt-8 space-y-6">
              <div>
                <dt className="font-display text-xl">Takviye gıda paketi</dt>
                <dd className="mt-1.5 leading-relaxed text-paper/80">
                  Takviyenin normal beslenmenin yerine geçtiği izlenimi, sağlık etkisi üzerinden karşılaştırma ve sağlık beyanı ifadeleri.
                </dd>
              </div>
              <div>
                <dt className="font-display text-xl">Estetik ve klinik paketi</dt>
                <dd className="mt-1.5 leading-relaxed text-paper/80">
                  Önce/sonra kurgusu, işlem kampanyaları ve görünüm üzerinden olumsuz algı yaratan dil. Sağlık hizmetleri tanıtım kuralları hukukçu incelemesi bekliyor.
                </dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-paper/15 p-6">
            <p className="font-semibold">Yakında</p>
            <p className="mt-1 text-sm text-paper/75">Bu özellikler henüz çalışmıyor; MVP kapsamı dışında.</p>
            <ul className="mt-4 space-y-2.5 text-[0.95rem] text-paper/90">
              {["Video ve Reels kanca analizi", "Landing page uyumu", "AB rakip ilham panosu (Meta Ad Library)", "Ajans çalışma alanları ve ekip", "Türk sezon takvimi", "Meta reklam hesabı bağlama", "Google Ads ve TikTok politikaları"].map((x) => (
                <li key={x} className="flex items-center justify-between gap-3 border-b border-paper/10 pb-2.5">
                  <span>{x}</span>
                  <span className="rounded-full bg-paper/10 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide">Yakında</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ChatGPT comparison */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl font-semibold leading-tight sm:text-[2.6rem]">“Genel bir sohbet botuna sorsam olmaz mı?”</h2>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-card" tabIndex={0} role="region" aria-label="AdScope ve genel sohbet botu karşılaştırması">
          <table className="w-full min-w-[560px] text-left text-[0.95rem]">
            <thead className="border-b border-line bg-paper-2/70 text-[0.8rem] uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Konu</th>
                <th scope="col" className="px-5 py-3 font-semibold">Genel sohbet botu</th>
                <th scope="col" className="px-5 py-3 font-semibold text-ink">AdScope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[
                ["Mevzuat dayanağı", "Genel bilgi, kaynak göstermeyebilir", "Sürümlü kural kartı ve resmî kaynak bağlantısı"],
                ["Tutarlılık", "Aynı reklama farklı cevaplar", "Kural motoru deterministik; aynı girdiye aynı skor"],
                ["Çıktı", "Sohbet metni", "Rapor, güvenli metin, 5 varyant, itiraz taslağı, geçmiş"],
                ["Veri", "Belirsiz", "Model eğitiminde kullanılmaz, istediğinde silinir"],
              ].map(([a, b, c]) => (
                <tr key={a}>
                  <th scope="row" className="px-5 py-3.5 font-semibold">{a}</th>
                  <td className="px-5 py-3.5 text-ink-soft">{b}</td>
                  <td className="px-5 py-3.5">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-12 flex flex-col items-start gap-6 rounded-2xl bg-coral-tint p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-2xl font-semibold">İlk üç analiz bizden.</p>
            <p className="mt-1 text-ink-soft">Kayıt ol, reklamını yükle, sonucu yaklaşık bir dakikada gör.</p>
          </div>
          <ButtonLink href="/kayit" variant="primary" className="h-12 px-6 text-base">
            Ücretsiz hesap oluştur
          </ButtonLink>
        </div>
        <Disclaimer className="mt-8" />
      </section>
    </>
  );
}
