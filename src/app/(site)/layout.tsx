import { Announcement } from "@/components/announcement";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Announcement text="20 reklamı tek seferde tarayan toplu kontrol ve ilham panosu yayında." href="/#hepsi" cta="Göz at" />
      <SiteHeader />
      <main id="icerik" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
