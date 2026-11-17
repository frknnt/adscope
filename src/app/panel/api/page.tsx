import { requirePanelUser } from "@/app/panel/guard";
import { formatDateTimeTr } from "@/components/rule-status";
import { getRepo } from "@/lib/data";
import { siteUrl } from "@/lib/env";
import { revokeApiKeyAction } from "../agency-actions";
import { ApiKeyForm } from "../agency-forms";

export const metadata = { title: "API" };

export default async function ApiPage() {
  await requirePanelUser();
  const keys = await getRepo().listApiKeys();
  const base = siteUrl();
  const example = `curl -X POST ${base}/api/v1/analyses \\
  -H "Authorization: Bearer ads_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "platform": "meta",
    "sector": "takviye_gida",
    "headline": "Yazın en hafif desteği",
    "primary_text": "Günlük rutinine eşlik eden bitki çayı.",
    "image": { "mime": "image/jpeg", "data_base64": "<base64>" }
  }'`;
  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">Kurumsal API</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Kendi sistemlerinden reklam ön kontrolü başlat. Her analiz paneldeki gibi kredi kullanır (görsel 1 kredi) ve aynı rapor JSON olarak döner.
        Anahtar yalnızca senin hesabının verisine erişir; ekip analizlerine erişmez.
      </p>

      <section aria-labelledby="anahtarlar" className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="anahtarlar" className="font-display text-2xl font-semibold">API anahtarları</h2>
        <p className="mt-1 text-[0.9rem] text-muted">En fazla 5 etkin anahtar. Anahtarın kendisi saklanmaz; yalnızca özeti tutulur, bu yüzden kaybedersen yenisini oluştur.</p>
        <div className="mt-5"><ApiKeyForm /></div>
        {keys.length ? (
          <ul className="mt-6 grid gap-2 text-[0.9rem]">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5">
                <span>
                  <span className="font-semibold">{k.name}</span> <code className="text-[0.82rem] text-muted">{k.prefix}…</code>
                  <span className="block text-[0.8rem] text-muted">
                    Oluşturuldu {formatDateTimeTr(k.createdAt)} · {k.lastUsedAt ? `son kullanım ${formatDateTimeTr(k.lastUsedAt)}` : "henüz kullanılmadı"}
                    {k.revokedAt ? ` · iptal edildi ${formatDateTimeTr(k.revokedAt)}` : ""}
                  </span>
                </span>
                {!k.revokedAt ? (
                  <form action={revokeApiKeyAction}>
                    <input type="hidden" name="id" value={k.id} />
                    <button type="submit" className="font-semibold text-coral-deep">İptal et</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="kullanim" className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="kullanim" className="font-display text-2xl font-semibold">Kullanım</h2>
        <dl className="mt-4 grid gap-3 text-[0.92rem] sm:grid-cols-[14rem_1fr]">
          <dt className="font-semibold"><code>POST /api/v1/analyses</code></dt>
          <dd className="text-ink-soft">Görsel + metin analizi. Yanıt 201 ve rapor. Aynı <code>client_request_id</code> ile tekrar gönderirsen yeni kredi düşmez, aynı rapor döner.</dd>
          <dt className="font-semibold"><code>GET /api/v1/analyses</code></dt>
          <dd className="text-ink-soft">Son 50 analizin özeti.</dd>
          <dt className="font-semibold"><code>GET /api/v1/analyses/:id</code></dt>
          <dd className="text-ink-soft">Tek rapor: skorlar, bulgular (kural kartı ve kaynağıyla), güvenli metin, varyantlar, DM şablonları.</dd>
          <dt className="font-semibold">Sınırlar</dt>
          <dd className="text-ink-soft">Dakikada 30 istek, saatte en fazla 20 analiz; görsel en fazla 5 MB (JPG, PNG, WebP). Platform: <code>meta</code>, <code>google_ads</code>, <code>tiktok</code>.</dd>
          <dt className="font-semibold">Hatalar</dt>
          <dd className="text-ink-soft"><code>401</code> anahtar geçersiz · <code>402</code> kredi yetersiz · <code>429</code> sınır aşıldı · <code>400</code> istek hatalı. Gövde: <code>{"{ ok: false, error: { code, message } }"}</code>.</dd>
        </dl>
        <pre tabIndex={0} aria-label="Örnek istek" className="mt-5 overflow-x-auto rounded-xl bg-ink p-4 text-[0.8rem] leading-relaxed text-paper"><code>{example}</code></pre>
        <p className="mt-3 text-[0.85rem] text-muted">Her yanıtta <code>disclaimer</code> alanı bulunur: risk değerlendirmesidir, hukuki görüş değildir. API yanıtını son kullanıcıya gösterirken bu uyarıyı da göster.</p>
      </section>
    </div>
  );
}
