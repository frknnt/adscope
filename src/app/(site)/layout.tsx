import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="icerik" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
