import { ButtonLink } from "@/components/ui";
import { getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { AppealForm } from "../forms";
import { RestrictionGuide } from "./restriction-guide";

export const metadata = { title: "İtiraz asistanı" };

export default async function AppealPage({ searchParams }: { searchParams: Promise<{ analiz?: string }> }) {
  await requirePanelUser();
  const [items, sp] = await Promise.all([getRepo().listAnalyses(100), searchParams]);
  const completed = items.filter((a) => a.status === "completed");
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">İtiraz asistanı</h1>
      <p className="mt-2 max-w-3xl text-ink-soft">
        Meta&apos;nın ret mesajını analiz ettiğin reklamla eşleştir. Bulgulara göre itiraz etmenin mi yoksa düzeltilmiş yeni bir reklam açmanın mı daha mantıklı olduğunu söyler, Türkçe ve İngilizce taslak hazırlar. Taslak garanti içermez; göndermeden önce kendi bilgilerinle düzenle.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-7">
        {completed.length ? (
          <AppealForm analyses={completed.map((a) => ({ id: a.id, label: `${a.headline || a.primaryText.slice(0, 60)} · ${new Date(a.createdAt).toLocaleDateString("tr-TR")}` }))} defaultId={completed.find((a) => a.id === sp.analiz)?.id ?? completed[0].id} />
        ) : (
          <div>
            <p className="font-semibold">Önce reddedilen reklamı analiz et.</p>
            <p className="mt-1.5 text-ink-soft">Yeni analiz sihirbazının 5. adımında ret mesajını yapıştırırsan itiraz taslağı raporla birlikte gelir.</p>
            <ButtonLink href="/panel/yeni" className="mt-5">Yeni analiz</ButtonLink>
          </div>
        )}
      </div>
      <aside aria-labelledby="itiraz-nasil" className="rounded-2xl border border-line bg-paper-2 p-5">
        <h2 id="itiraz-nasil" className="font-bold text-ink">Nasıl çalışır?</h2>
        <ol className="mt-3 grid gap-3 text-small text-ink-soft">
          <li><strong className="text-ink">1. Ret mesajını yapıştır.</strong> Meta&apos;nın gönderdiği metni olduğu gibi kopyala.</li>
          <li><strong className="text-ink">2. Raporu seç.</strong> Bulgular ret gerekçesiyle eşleştirilir.</li>
          <li><strong className="text-ink">3. Öneriyi oku.</strong> İtiraz mı, düzeltilmiş yeni reklam mı daha mantıklı, gerekçesiyle yazar.</li>
          <li><strong className="text-ink">4. Taslağı düzenle.</strong> Türkçe ve İngilizce taslak raporun İtiraz sekmesine kaydedilir. Ek kredi düşmez.</li>
        </ol>
      </aside>
      </div>
      <RestrictionGuide />
    </div>
  );
}
