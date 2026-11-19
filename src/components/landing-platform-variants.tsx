import { ButtonLink } from "@/components/ui";
import { PASTE_MAX } from "@/lib/variants/paste";

const WRAP = "mx-auto max-w-[75rem] px-5 sm:px-6";

/**
 * Landing section for P9.3: platform AI tools write ad variants but do not check Turkish ad rules.
 * Platform and tool names are used only to describe where the text comes from; no logos and no
 * suggestion of partnership.
 */
export function LandingPlatformVariants() {
  const steps = [
    ["Platformda üret", "Reklam platformunun yapay zekâ aracı başlık ve metin varyantlarını yazsın."],
    ["AdScope'a yapıştır", `Varyantları satır satır yapıştır: üyeliksiz ${PASTE_MAX.public}, panelde ${PASTE_MAX.panel} varyanta kadar, kredisiz.`],
    ["En güvenlileri seç", "Her varyantın riskini, en kritik bulgusunu ve güvenli sürümünü gör; en güvenli 3'ünü tek tıkla kopyala."],
  ] as const;
  return (
    <section aria-labelledby="platform-varyant" className="border-y border-line bg-paper-2 py-20 lg:py-28">
      <div className={`${WRAP} grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center`}>
        <div className="max-w-2xl">
          <p className="inline-flex rounded-full bg-blue-tint px-3 py-1 text-fine font-bold uppercase tracking-[0.08em] text-blue">Platform araçlarıyla birlikte</p>
          <h2 id="platform-varyant" className="mt-4 font-display text-[1.9rem] leading-[1.1] text-ink sm:text-[2.6rem]">
            Platformun yazdığı metni yayından önce Türk mevzuatına göre kontrol et.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Meta Advantage+, Google Ads Asset Studio ve TikTok Symphony gibi araçlar hızlı varyant üretir, ama Ticaret Bakanlığı ve Reklam Kurulu kurallarına bakmaz. AdScope bu
            varyantları aynı kural kartlarıyla tarar. AdScope bu platformların iş ortağı değildir; adlar yalnızca metnin nereden geldiğini anlatmak için geçer.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/reklamim-reddedilir-mi#varyantlar" variant="accent">Varyantlarını üyeliksiz dene</ButtonLink>
            <ButtonLink href="/kayit" variant="ghost">Ücretsiz hesap aç</ButtonLink>
          </div>
        </div>
        <ol className="grid gap-4">
          {steps.map(([title, text], i) => (
            <li key={title} className="flex gap-4 rounded-2xl border border-line bg-card p-5 shadow-card">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-ink font-bold text-paper" aria-hidden>{i + 1}</span>
              <span>
                <span className="block font-bold text-ink">{title}</span>
                <span className="mt-1 block text-ink-soft">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
