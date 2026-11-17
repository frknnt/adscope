import Link from "next/link";
import { requirePanelUser } from "@/app/panel/guard";
import { formatDateTimeTr, formatDateTr } from "@/components/rule-status";
import { LevelPill } from "@/components/risk";
import { getRepo } from "@/lib/data";
import { SECTOR_LABEL } from "@/lib/sectors";
import { teamAction } from "../agency-actions";
import { InviteForm } from "../agency-forms";

export const metadata = { title: "Ekip" };

const NOTICE: Record<string, { ok: boolean; text: string }> = {
  kabul: { ok: true, text: "Ekibe katıldın. Ekibin analizleri aşağıda." },
  gecersiz: { ok: false, text: "Davet bağlantısı geçersiz ya da süresi dolmuş. Yeni bir davet iste." },
  "baska-eposta": { ok: false, text: "Bu davet başka bir e-posta adresine gönderilmiş. Davet edilen adresle giriş yap." },
  kendi: { ok: false, text: "Kendi davetini kabul edemezsin." },
};

export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePanelUser();
  const sp = await searchParams;
  const repo = getRepo();
  const [team, shared] = await Promise.all([repo.getTeam(), repo.listTeamAnalyses(50)]);
  const notice = sp.davet ? NOTICE[sp.davet] : null;

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">Ekip</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Ekip arkadaşların senin analizlerini, raporlarını ve markalarını <strong>salt okunur</strong> görür; analiz başlatmaz, silmez, kredini kullanmaz.
        Her davet tek kullanımlıktır ve yalnızca davet edilen e-posta ile kabul edilir.
      </p>
      {notice ? (
        <p role={notice.ok ? "status" : "alert"} className={`mt-5 rounded-xl px-4 py-3 text-[0.92rem] font-medium ${notice.ok ? "bg-green-tint text-green" : "bg-coral-tint text-coral-deep"}`}>{notice.text}</p>
      ) : null}

      <section aria-labelledby="davet" className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="davet" className="font-display text-2xl font-semibold">Ekibine davet et</h2>
        <div className="mt-5"><InviteForm /></div>
        {team.invites.length ? (
          <>
            <h3 className="mt-6 text-sm font-bold">Bekleyen davetler</h3>
            <ul className="mt-2 grid gap-2 text-[0.9rem]">
              {team.invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5">
                  <span>{i.email} <span className="text-muted">· {formatDateTr(i.expiresAt)} tarihine kadar</span></span>
                  <form action={teamAction}>
                    <input type="hidden" name="op" value="revoke-invite" />
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" className="font-semibold text-coral-deep">Daveti iptal et</button>
                  </form>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <h3 className="mt-6 text-sm font-bold">Ekip üyeleri · {team.members.length} / 10</h3>
        {team.members.length === 0 ? (
          <p className="mt-2 text-[0.9rem] text-muted">Henüz ekip üyesi yok.</p>
        ) : (
          <ul className="mt-2 grid gap-2 text-[0.9rem]">
            {team.members.map((m) => (
              <li key={m.memberId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5">
                <span>{m.email} <span className="text-muted">· İzleyici · {formatDateTr(m.createdAt)}</span></span>
                <form action={teamAction}>
                  <input type="hidden" name="op" value="remove-member" />
                  <input type="hidden" name="id" value={m.memberId} />
                  <button type="submit" className="font-semibold text-coral-deep">Ekipten çıkar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {team.memberships.length ? (
        <section aria-labelledby="uyelik" className="mt-8">
          <h2 id="uyelik" className="font-display text-2xl font-semibold">Üyesi olduğun ekipler</h2>
          <ul className="mt-3 grid gap-2 text-[0.9rem]">
            {team.memberships.map((m) => (
              <li key={m.ownerId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5">
                <span className="font-semibold">{m.ownerLabel}</span>
                <form action={teamAction}>
                  <input type="hidden" name="op" value="leave" />
                  <input type="hidden" name="id" value={m.ownerId} />
                  <button type="submit" className="font-semibold text-coral-deep">Ekipten ayrıl</button>
                </form>
              </li>
            ))}
          </ul>
          <h3 className="mt-6 text-sm font-bold">Ekip analizleri</h3>
          {shared.length === 0 ? (
            <p className="mt-2 text-[0.9rem] text-muted">Ekipte henüz analiz yok.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {shared.map((a) => (
                <li key={a.id}>
                  <Link href={`/panel/analiz/${a.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 no-underline hover:border-ink/40">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{a.headline || a.primaryText.slice(0, 70)}</span>
                      <span className="text-[0.82rem] text-muted">{a.ownerLabel} · {SECTOR_LABEL[a.sector]} · {formatDateTimeTr(a.createdAt)}</span>
                    </span>
                    {a.metaRiskLevel ? <LevelPill level={a.metaRiskLevel} /> : <span className="text-[0.82rem] text-muted">{a.status === "processing" ? "Sürüyor" : "Tamamlanmadı"}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
