import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
import { DemoBanner } from "@/components/ui";
import { appMode, siteIndexable, siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "AdScope · Reklamını yayınlamadan önce test et", template: "%s · AdScope" },
  description:
    "Türk KOBİ'leri ve ajanslar için Meta ret riski, Türk reklam mevzuatı risk değerlendirmesi ve kreatif kalite skorunu tek raporda veren ön kontrol aracı.",
  robots: siteIndexable() ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a href="#icerik" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">
          İçeriğe geç
        </a>
        {appMode() === "demo" ? <DemoBanner /> : null}
        {children}
      </body>
    </html>
  );
}
