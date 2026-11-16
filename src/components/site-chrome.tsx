import Link from "next/link";
import { Logo } from "./logo";
import { ButtonLink } from "./ui";
import { getCurrentUser } from "@/lib/data";

const NAV = [
  { href: "/nasil-calisir", label: "Nasıl çalışır?" },
  { href: "/fiyatlandirma", label: "Fiyatlandırma" },
  { href: "/kurallar", label: "Kural kartları" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="no-print border-b border-line/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
        <Logo />
        <nav aria-label="Ana menü" className="order-3 flex w-full gap-5 overflow-x-auto text-[0.92rem] font-medium text-ink-soft sm:order-none sm:w-auto">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap py-1 no-underline hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <ButtonLink href="/panel" variant="primary" className="h-10 px-4">
              Panele git
            </ButtonLink>
          ) : (
            <>
              <Link href="/giris" className="px-3 py-2 text-[0.92rem] font-semibold text-ink no-underline hover:underline">
                Giriş
              </Link>
              <ButtonLink href="/kayit" variant="primary" className="h-10 px-4">
                Ücretsiz başla
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print mt-auto border-t border-line/70 bg-paper-2/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-[0.9rem] text-ink-soft sm:grid-cols-[1.4fr_1fr_1fr] sm:px-6">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 leading-relaxed">
            Reklam yayına çıkmadan önce Meta ret riskini, Türk reklam mevzuatı açısından riskleri ve kreatif kalitesini gösteren ön kontrol aracı.
          </p>
          <p className="mt-3 text-[0.8rem]">Risk değerlendirmesidir, hukuki görüş değildir.</p>
        </div>
        <div>
          <p className="font-semibold text-ink">Ürün</p>
          <ul className="mt-3 space-y-2">
            <li><Link href="/nasil-calisir">Nasıl çalışır?</Link></li>
            <li><Link href="/fiyatlandirma">Fiyatlandırma</Link></li>
            <li><Link href="/kurallar">Kural kartları ve kaynaklar</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-ink">Yasal</p>
          <ul className="mt-3 space-y-2">
            <li><Link href="/gizlilik">Gizlilik politikası</Link></li>
            <li><Link href="/kvkk">KVKK aydınlatma metni</Link></li>
            <li><Link href="/kullanim-kosullari">Kullanım koşulları</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
