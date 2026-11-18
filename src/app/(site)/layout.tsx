import { Announcement } from "@/components/announcement";
import { ConsentBanner } from "@/components/consent";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { analyticsConfig } from "@/lib/env";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const analytics = analyticsConfig();
  return (
    <>
      <Announcement text="20 reklamı tek seferde tarayan toplu kontrol ve ilham panosu yayında." href="/#hepsi" cta="Göz at" />
      <SiteHeader />
      <main id="icerik" className="flex-1">
        {children}
      </main>
      <SiteFooter consentSettings={Boolean(analytics)} />
      {analytics ? <ConsentBanner scriptUrl={analytics.scriptUrl} domain={analytics.domain} /> : null}
    </>
  );
}
