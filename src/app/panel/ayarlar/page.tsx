import { getCurrentUser, getRepo } from "@/lib/data";
import { requirePanelUser } from "@/app/panel/guard";
import { emailConfigured } from "@/lib/email/provider";
import { retentionDefaultDays } from "@/lib/env";
import Link from "next/link";
import { DeleteAccountForm, SettingsForm } from "../forms";
import { setNewsletterAction } from "../agency-actions";

export const metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  await requirePanelUser();
  const [user, profile] = await Promise.all([getCurrentUser(), getRepo().getProfile()]);
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">Ayarlar</h1>
      <p className="mt-2 text-ink-soft">Hesap: {user?.email}</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
      <nav aria-label="Ayarlar bölümleri" className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {[["#profil", "Profil ve saklama"], ["#bulten", "Bülten"], ["#api", "API ve eklenti"], ["#veri", "Verilerin"], ["#sil", "Hesabı sil"]].map(([href, label]) => (
          <a key={href} href={href} className={`inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-xl px-3 text-small font-semibold no-underline hover:bg-card ${href === "#sil" ? "text-coral-deep" : "text-ink-soft hover:text-ink"}`}>{label}</a>
        ))}
      </nav>
      <div className="max-w-3xl">

      <section aria-labelledby="profil" className="scroll-mt-24 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="profil" className="font-display text-2xl font-semibold">Profil ve saklama</h2>
        <div className="mt-5"><SettingsForm profile={profile} retentionDefault={retentionDefaultDays()} emailEnabled={emailConfigured()} /></div>
      </section>

      <section aria-labelledby="bulten" className="mt-8 scroll-mt-24 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="bulten" className="font-display text-2xl font-semibold">Aylık mevzuat bülteni</h2>
        <p className="mt-2 text-body text-ink-soft">
          Ayda bir e-posta: son 30 günde eklenen veya güncellenen kural kartları ve önümüzdeki sezon dönemleri. Reklam içeriğin e-postada yer almaz.
          İstediğin zaman buradan veya e-postadaki bağlantıdan kapatabilirsin.
        </p>
        <form action={setNewsletterAction} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="on" value={profile?.newsletter ? "0" : "1"} />
          <span className={`rounded-full px-3 py-1 text-meta font-semibold ${profile?.newsletter ? "bg-green-tint text-green" : "bg-paper text-muted"}`}>
            {profile?.newsletter ? "Açık" : "Kapalı"}
          </span>
          <button type="submit" className="min-h-11 rounded-full border border-line-strong px-4 text-small font-semibold hover:bg-paper-2">
            {profile?.newsletter ? "Bülteni kapat" : "Bülteni aç"}
          </button>
          {!emailConfigured() ? <span className="text-meta text-muted">E-posta gönderimi bu ortamda kapalı; tercih kaydedilir.</span> : null}
        </form>
      </section>

      <section aria-labelledby="api" className="mt-8 scroll-mt-24 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="api" className="font-display text-2xl font-semibold">Kurumsal API ve tarayıcı eklentisi</h2>
        <p className="mt-2 text-body text-ink-soft">
          Kendi sistemlerinden analiz başlatmak için <Link href="/panel/api" className="font-semibold text-coral-deep">API anahtarı oluştur</Link>. Tarayıcı eklentisi, seçtiğin
          metni tek tıkla yeni analize taşır; kurulum adımları depodaki <code>extension/README.md</code> dosyasında.
        </p>
      </section>

      <section aria-labelledby="veri" className="mt-8 scroll-mt-24 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="veri" className="font-display text-2xl font-semibold">Verilerin</h2>
        <ul className="mt-3 grid gap-1.5 text-body text-ink-soft">
          <li>Yüklediğin görseller ve metinler model eğitiminde kullanılmaz.</li>
          <li>Tek bir analizi Geçmiş sayfasından silebilirsin; görseli de silinir.</li>
          <li>Loglarda reklam içeriğin tutulmaz; yalnızca hata kodları kaydedilir.</li>
        </ul>
      </section>

      <section aria-labelledby="sil" className="mt-8 scroll-mt-24 rounded-2xl border-2 border-coral/50 bg-coral-tint/40 p-5 sm:p-7">
        <p className="text-meta font-bold uppercase tracking-[0.08em] text-coral-deep">Tehlikeli bölge</p>
        <h2 id="sil" className="mt-1 font-display text-2xl font-semibold text-coral-deep">Hesabı sil</h2>
        <p className="mt-2 text-body text-ink-soft">
          Hesabın, tüm analizlerin, yüklediğin görseller ve kalan kredilerin kalıcı olarak silinir. Bu işlem geri alınamaz.
        </p>
        <div className="mt-5"><DeleteAccountForm email={user?.email ?? ""} /></div>
      </section>
      </div>
      </div>
    </div>
  );
}
