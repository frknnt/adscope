import Link from "next/link";
import { requirePanelUser } from "@/app/panel/guard";
import { formatDateTimeTr, formatDateTr } from "@/components/rule-status";
import { LevelPill } from "@/components/risk";
import { getRepo } from "@/lib/data";
import { SECTOR_LABEL } from "@/lib/sectors";
import { switchWorkspaceAction, teamAction } from "../agency-actions";
import { InviteForm } from "../agency-forms";
import { DataTable } from "@/components/ui";

export const metadata = { title: "Ekip" };

const NOTICE: Record<string, { ok: boolean; text: string }> = {
  kabul: { ok: true, text: "Ekibe katıldın. Ekibin analizleri aşağıda." },
  gecersiz: { ok: false, text: "Davet bağlantısı geçersiz ya da süresi dolmuş. Yeni bir davet iste." },
  "baska-eposta": { ok: false, text: "Bu davet başka bir e-posta adresine gönderilmiş. Davet edilen adresle giriş yap." },
  kendi: { ok: false, text: "Kendi davetini kabul edemezsin." },
};
const ALAN_NOTICE: Record<string, string> = {
  yetki: "Bu ekipte düzenleyici değilsin. Ekip sahibinden seni düzenleyici yapmasını iste.",
};

const ROLE_LABEL = { viewer: "Salt okunur", editor: "Düzenleyici" } as const;

export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePanelUser();
  const sp = await searchParams;
  const repo = getRepo();
  const [team, shared] = await Promise.all([repo.getTeam(), repo.listTeamAnalyses(50)]);
  const notice = sp.davet ? NOTICE[sp.davet] : sp.alan && ALAN_NOTICE[sp.alan] ? { ok: false, text: ALAN_NOTICE[sp.alan] } : null;

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">Ekip</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        <strong>Salt okunur</strong> üyeler analizlerini, raporlarını ve markalarını görür; analiz başlatmaz, silmez, kredini kullanmaz.{" "}
        <strong>Düzenleyici</strong> üyeler senin alanında analiz başlatır ve kreatif üretir; kredi senin bakiyenden, yalnızca iş başarıyla bitince düşer.
        Düzenleyiciler markalarını, ekibi, bağlantıları ve ayarları değiştiremez, rapor silemez. Her davet tek kullanımlıktır ve yalnızca davet edilen e-posta ile kabul edilir.
      </p>
      {notice ? (
        <p role={notice.ok ? "status" : "alert"} className={`mt-5 rounded-xl px-4 py-3 text-body font-medium ${notice.ok ? "bg-green-tint text-green" : "bg-coral-tint text-coral-deep"}`}>{notice.text}</p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section aria-labelledby="uyeler" className="min-w-0">
          <h2 id="uyeler" className="font-display text-2xl font-semibold">Ekip üyeleri <span className="text-base font-normal text-muted tabular">· {team.members.length} / 10</span></h2>
          <DataTable label="Ekip üyeleri tablosu" className="mt-4">
            <table className="w-full min-w-[34rem] text-left text-body">
              <thead className="border-b border-line bg-paper-2 text-meta text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">E-posta</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Rol</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Katılma</th>
                  <th scope="col" className="px-5 py-3 font-semibold"><span className="sr-only">İşlem</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="px-5 py-3 font-semibold">{user?.email ?? "Sen"}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-ink px-2.5 py-0.5 text-meta font-bold text-paper">Sahip</span></td>
                  <td className="px-3 py-3 text-muted">—</td>
                  <td className="px-5 py-3" />
                </tr>
                {team.members.map((m) => (
                  <tr key={m.memberId}>
                    <td className="px-5 py-3">{m.email}</td>
                    <td className="px-3 py-3">
                      <form action={teamAction} className="flex items-center gap-2">
                        <input type="hidden" name="op" value="role" />
                        <input type="hidden" name="id" value={m.memberId} />
                        <input type="hidden" name="role" value={m.role === "editor" ? "viewer" : "editor"} />
                        <span className={`rounded-full px-2.5 py-0.5 text-meta font-bold ${m.role === "editor" ? "bg-green-tint text-green" : "bg-blue-tint text-blue"}`}>{ROLE_LABEL[m.role]}</span>
                        <button type="submit" className="inline-flex h-10 items-center text-meta font-semibold text-blue">
                          {m.role === "editor" ? "Salt okunur yap" : "Düzenleyici yap"}<span className="sr-only">: {m.email}</span>
                        </button>
                      </form>
                    </td>
                    <td className="px-3 py-3 text-ink-soft">{formatDateTr(m.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <form action={teamAction}>
                        <input type="hidden" name="op" value="remove-member" />
                        <input type="hidden" name="id" value={m.memberId} />
                        <button type="submit" className="inline-flex h-10 items-center font-semibold text-coral-deep">Ekipten çıkar<span className="sr-only">: {m.email}</span></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          {team.members.length === 0 ? <p className="mt-3 text-body text-muted">Henüz ekip üyesi yok. Sağdaki karttan davet gönder.</p> : null}
        </section>

        <section aria-labelledby="davet" className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6 lg:sticky lg:top-24">
          <h2 id="davet" className="text-lg font-bold">Ekibine davet et</h2>
          <div className="mt-4"><InviteForm /></div>
          {team.invites.length ? (
            <>
              <h3 className="mt-6 text-sm font-bold">Bekleyen davetler</h3>
              <ul className="mt-2 grid gap-2 text-small">
                {team.invites.map((i) => (
                  <li key={i.id} className="rounded-xl border border-line px-3 py-2.5">
                    <span className="block break-all">{i.email} <span className="text-muted">· {ROLE_LABEL[i.role]}</span></span>
                    <span className="flex items-center justify-between gap-2 text-muted">
                      {formatDateTr(i.expiresAt)} tarihine kadar
                      <form action={teamAction}>
                        <input type="hidden" name="op" value="revoke-invite" />
                        <input type="hidden" name="id" value={i.id} />
                        <button type="submit" className="inline-flex h-10 items-center font-semibold text-coral-deep">Daveti iptal et</button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>

      {team.memberships.length ? (
        <section aria-labelledby="uyelik" className="mt-10 rounded-2xl border border-line bg-card p-5 shadow-card sm:p-7">
          <h2 id="uyelik" className="font-display text-2xl font-semibold">Üyesi olduğun ekipler</h2>
          <ul className="mt-3 grid gap-2 text-body">
            {team.memberships.map((m) => (
              <li key={m.ownerId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5">
                <span>
                  <span className="font-semibold">{m.ownerLabel}</span> <span className="text-meta text-muted">· {ROLE_LABEL[m.role]}</span>
                </span>
                <span className="flex flex-wrap items-center gap-4">
                  {m.role === "editor" ? (
                    <form action={switchWorkspaceAction}>
                      <input type="hidden" name="ownerId" value={m.ownerId} />
                      <button type="submit" className="inline-flex h-10 items-center font-semibold text-blue">Bu ekibin alanında çalış<span className="sr-only">: {m.ownerLabel}</span></button>
                    </form>
                  ) : null}
                  <form action={teamAction}>
                    <input type="hidden" name="op" value="leave" />
                    <input type="hidden" name="id" value={m.ownerId} />
                    <button type="submit" className="inline-flex h-10 items-center font-semibold text-coral-deep">Ekipten ayrıl</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
          <h3 className="mt-6 text-sm font-bold">Ekip analizleri</h3>
          {shared.length === 0 ? (
            <p className="mt-2 text-body text-muted">Ekipte henüz analiz yok.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {shared.map((a) => (
                <li key={a.id}>
                  <Link href={`/panel/analiz/${a.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 no-underline hover:border-ink/40">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{a.headline || a.primaryText.slice(0, 70)}</span>
                      <span className="text-meta text-muted">{a.ownerLabel} · {SECTOR_LABEL[a.sector]} · {formatDateTimeTr(a.createdAt)}</span>
                    </span>
                    {a.metaRiskLevel ? <LevelPill level={a.metaRiskLevel} /> : <span className="text-meta text-muted">{a.status === "processing" ? "Sürüyor" : "Tamamlanmadı"}</span>}
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
