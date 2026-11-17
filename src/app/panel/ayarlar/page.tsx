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
    <div className="max-w-3xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">Ayarlar</h1>
      <p className="mt-2 text-ink-soft">Hesap: {user?.email}</p>

      <section aria-labelledby="profil" className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="profil" className="font-display text-2xl font-semibold">Profil ve saklama</h2>
        <div className="mt-5"><SettingsForm profile={profile} retentionDefault={retentionDefaultDays()} emailEnabled={emailConfigured()} /></div>
      </section>

      <section aria-labelledby="bulten" className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="bulten" className="font-display text-2xl font-semibold">Aylık mevzuat bülteni</h2>
        <p className="mt-2 text-[0.93rem] text-ink-soft">
          Ayda bir e-posta: son 30 günde eklenen veya güncellenen kural kartları ve önümüzdeki sezon dönemleri. Reklam içeriğin e-postada yer almaz.
          İstediğin zaman buradan veya e-postadaki bağlantıdan kapatabilirsin.
        </p>
        <form action={setNewsletterAction} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="on" value={profile?.newsletter ? "0" : "1"} />
          <span className={`rounded-full px-3 py-1 text-[0.82rem] font-semibold ${profile?.newsletter ? "bg-green-tint text-green" : "bg-paper text-muted"}`}>
            {profile?.newsletter ? "Açık" : "Kapalı"}
          </span>
          <button type="submit" className="rounded-full border border-line-strong px-4 py-2 text-[0.88rem] font-semibold hover:bg-paper-2">
            {profile?.newsletter ? "Bülteni kapat" : "Bülteni aç"}
          </button>
          {!emailConfigured() ? <span className="text-[0.82rem] text-muted">E-posta gönderimi bu ortamda kapalı; tercih kaydedilir.</span> : null}
        </form>
      </section>

      <section aria-labelledby="api" className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="api" className="font-display text-2xl font-semibold">Kurumsal API ve tarayıcı eklentisi</h2>
        <p className="mt-2 text-[0.93rem] text-ink-soft">
          Kendi sistemlerinden analiz başlatmak için <Link href="/panel/api" className="font-semibold text-coral-deep">API anahtarı oluştur</Link>. Tarayıcı eklentisi, seçtiğin
          metni tek tıkla yeni analize taşır; kurulum adımları depodaki <code>extension/README.md</code> dosyasında.
        </p>
      </section>

      <section aria-labelledby="veri" className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="veri" className="font-display text-2xl font-semibold">Verilerin</h2>
        <ul className="mt-3 grid gap-1.5 text-[0.93rem] text-ink-soft">
          <li>Yüklediğin görseller ve metinler model eğitiminde kullanılmaz.</li>
          <li>Tek bir analizi Geçmiş sayfasından silebilirsin; görseli de silinir.</li>
          <li>Loglarda reklam içeriğin tutulmaz; yalnızca hata kodları kaydedilir.</li>
        </ul>
      </section>

      <section aria-labelledby="sil" className="mt-8 rounded-2xl border border-coral/40 bg-card p-5 sm:p-7">
        <h2 id="sil" className="font-display text-2xl font-semibold text-coral-deep">Hesabı sil</h2>
        <p className="mt-2 text-[0.93rem] text-ink-soft">
          Hesabın, tüm analizlerin, yüklediğin görseller ve kalan kredilerin kalıcı olarak silinir. Bu işlem geri alınamaz.
        </p>
        <div className="mt-5"><DeleteAccountForm /></div>
      </section>
    </div>
  );
}
