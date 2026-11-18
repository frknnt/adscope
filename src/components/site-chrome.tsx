import Link from "next/link";
import { getCurrentUser } from "@/lib/data";
import { Logo } from "./logo";
import { SiteNav } from "./site-nav";
import { ConsentSettingsButton } from "./consent";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return <SiteNav loggedIn={Boolean(user)} />;
}

const FOOTER = [
  {
    title: "Ürün",
    links: [
      ["/reklamim-reddedilir-mi", "Ücretsiz kontrol"],
      ["/nasil-calisir", "Nasıl çalışır?"],
      ["/fiyatlandirma", "Fiyatlar"],
      ["/#ajans", "Ajanslar için"],
    ],
  },
  {
    title: "Kaynaklar",
    links: [
      ["/kurallar", "Kural kartları ve kaynaklar"],
      ["/reklam-butce-hesaplama", "Reklam bütçe hesaplayıcı"],
      ["/rehber", "Sektör rehberleri"],
      ["/#sss", "Sık sorulan sorular"],
      ["/kayit", "Ücretsiz hesap aç"],
    ],
  },
  {
    title: "Yasal",
    links: [
      ["/gizlilik", "Gizlilik politikası"],
      ["/kvkk", "KVKK aydınlatma metni"],
      ["/kullanim-kosullari", "Kullanım koşulları"],
      ["/mesafeli-satis-sozlesmesi", "Mesafeli satış sözleşmesi"],
      ["/on-bilgilendirme-formu", "Ön bilgilendirme formu"],
    ],
  },
] as const;

export function SiteFooter({ consentSettings = false }: { consentSettings?: boolean }) {
  return (
    <footer className="no-print mt-auto bg-navy-950 text-paper">
      <div className="mx-auto grid max-w-[75rem] gap-10 px-5 pb-10 pt-16 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo tone="paper" />
          <p className="mt-4 text-body leading-relaxed text-paper/75">
            Türkiye&apos;de reklam verenler için yayın öncesi kontrol: Meta, Google Ads ve TikTok politikaları ile Türk reklam mevzuatı tek raporda.
          </p>
        </div>
        {FOOTER.map((col) => (
          <div key={col.title}>
            <p className="text-fine font-bold uppercase tracking-[0.08em] text-paper/60">{col.title}</p>
            <ul className="mt-4 space-y-2.5 text-body">
              {col.links.map(([href, label]) => (
                <li key={label}>
                  <Link href={href} className="text-paper/85 no-underline hover:text-paper hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-paper/10">
        <div className="mx-auto flex max-w-[75rem] flex-col gap-2 px-5 py-6 text-meta text-paper/70 sm:flex-row sm:justify-between sm:px-6">
          <p>
            <strong className="font-semibold text-paper">Risk değerlendirmesidir, hukuki görüş değildir.</strong> AdScope reklamın onaylanacağını garanti etmez.
          </p>
          <p className="flex flex-wrap items-center gap-x-4">
            {consentSettings ? <ConsentSettingsButton /> : null}
            <span>© {new Date().getFullYear()} AdScope</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
