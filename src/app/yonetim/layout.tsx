import Link from "next/link";
import { Logo } from "@/components/logo";
import { requireAdmin } from "./guard";

export const metadata = { title: { default: "Yönetim", template: "%s · Yönetim" }, robots: { index: false, follow: false } };

const NAV = [
  ["/yonetim", "Özet"],
  ["/yonetim/kullanicilar", "Kullanıcılar ve krediler"],
  ["/yonetim/satin-almalar", "Satın almalar"],
  ["/yonetim/kuponlar", "Kupon ve ortaklık"],
  ["/yonetim/geri-bildirim", "Uyarı geri bildirimleri"],
  ["/yonetim/kurallar", "Kural kartları"],
  ["/yonetim/gunluk", "Denetim günlüğü"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="min-h-full bg-paper">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-meta font-bold text-paper">Yönetim</span>
          </span>
          <span className="text-meta text-muted">{user.email}</span>
        </div>
        <nav aria-label="Yönetim" className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6">
          <ul className="flex gap-1 pb-2">
            {NAV.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-small font-semibold text-ink no-underline hover:bg-paper-2">{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="icerik" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
