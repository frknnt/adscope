"use client";

import { useEffect, useState } from "react";

/**
 * Step-by-step checklist for a restricted ad account. Generic and source-agnostic: Meta's screens
 * change, so steps name what to look for rather than exact button paths. Progress stays in this
 * browser only (localStorage); nothing is sent to the server.
 */
const STEPS: { title: string; body: string }[] = [
  { title: "Neyin kısıtlandığını belirle", body: "Hesap Kalitesi ekranında kısıtlamanın reklam hesabına mı, Facebook sayfasına mı, yoksa kişisel profile mi uygulandığını ve gösterilen gerekçeyi not et. İtiraz bu varlık için yapılır." },
  { title: "Hesabını güvene al", body: "İki adımlı doğrulamayı aç, tanımadığın yöneticileri ve bağlı uygulamaları kaldır, şifreni değiştir. Ele geçirilmiş hesaptan verilen reklamlar en sık kısıtlama nedenlerinden biridir." },
  { title: "Son retleri tek tek incele", body: "Son haftalarda reddedilen reklamların metnini ve görselini AdScope'ta analiz et. Kırmızı bayrak taşıyan reklamları durdur veya sil; aynı reklamı değiştirmeden tekrar gönderme." },
  { title: "Açılış sayfasını düzelt", body: "Reklamdaki fiyat, indirim ve vaatlerin sayfayla aynı olduğunu, sayfada iletişim ve iade bilgisinin bulunduğunu kontrol et. Tutarsız sayfa, reklam metni temiz olsa bile ret sebebidir." },
  { title: "Ödeme yöntemini kontrol et", body: "Başarısız ödeme veya başkasına ait kart kısıtlamaya yol açabilir. Bakiyeyi kapat, kartın adının hesap sahibiyle uyumlu olduğundan emin ol." },
  { title: "İncelemeyi bir kez iste", body: "Hesap Kalitesi'nde inceleme iste. Açıklamaya hangi reklamları kaldırdığını ve neyi değiştirdiğini kısa ve kibar yaz. Aynı talebi tekrar tekrar göndermek süreci hızlandırmaz." },
  { title: "Beklerken yeni reklam verme", body: "İnceleme sürerken başka hesaptan aynı içerikle reklam açmak politika ihlali sayılabilir. Bu sürede yeni kreatiflerini AdScope ile hazırlayıp beklet." },
  { title: "Sonucu kaydet", body: "Kısıtlama kalktıysa ilk reklamları düşük bütçeyle ve ön kontrolden geçirerek başlat. Kalkmadıysa gerekçeyi ve tarihleri sakla; destek kanalına aynı bilgilerle başvur." },
];

const KEY = "adscope:restriction-steps";

export function RestrictionGuide() {
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only state
      if (Array.isArray(saved) && saved.length === STEPS.length) setDone(saved.map(Boolean));
    } catch {}
  }, []);
  function toggle(i: number) {
    setDone((d) => {
      const next = d.map((v, j) => (j === i ? !v : v));
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  const count = done.filter(Boolean).length;
  return (
    <section aria-labelledby="kisitlama" className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="kisitlama" className="font-display text-2xl font-semibold">Hesabın kısıtlandıysa: adım adım</h2>
        <p className="text-[0.85rem] font-semibold text-muted tabular" aria-live="polite">{count} / {STEPS.length} tamamlandı</p>
      </div>
      <p className="mt-1 text-[0.9rem] text-ink-soft">Sırayla ilerle. İşaretlerin yalnızca bu tarayıcıda saklanır. Meta&apos;nın ekranları değişebilir; adımlar ne arayacağını anlatır.</p>
      <ol className="mt-5 grid gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className={`rounded-xl border px-4 py-3 ${done[i] ? "border-line bg-paper-2/60" : "border-line-strong"}`}>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={done[i]} onChange={() => toggle(i)} className="mt-1 size-4 accent-ink" />
              <span>
                <span className={`font-semibold ${done[i] ? "text-muted line-through" : ""}`}>{i + 1}. {s.title}</span>
                <span className="mt-0.5 block text-[0.88rem] text-ink-soft">{s.body}</span>
              </span>
            </label>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[0.8rem] text-muted">Bu liste genel bir rehberdir; kısıtlamanın kalkacağını garanti etmez. Risk değerlendirmesidir, hukuki görüş değildir.</p>
    </section>
  );
}
