import { ButtonLink } from "@/components/ui";
import { getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { AppealForm } from "../forms";

export const metadata = { title: "İtiraz asistanı" };

export default async function AppealPage({ searchParams }: { searchParams: Promise<{ analiz?: string }> }) {
  await requirePanelUser();
  const [items, sp] = await Promise.all([getRepo().listAnalyses(100), searchParams]);
  const completed = items.filter((a) => a.status === "completed");
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">İtiraz asistanı</h1>
      <p className="mt-2 text-lg text-ink-soft">
        Meta&apos;nın ret mesajını analiz ettiğin reklamla eşleştir. Bulgulara göre itiraz etmenin mi yoksa düzeltilmiş yeni bir reklam açmanın mı daha mantıklı olduğunu söyler, Türkçe ve İngilizce taslak hazırlar. Taslak garanti içermez; göndermeden önce kendi bilgilerinle düzenle.
      </p>
      <div className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-7">
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
    </div>
  );
}
