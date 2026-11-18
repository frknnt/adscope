import { requirePanelUser } from "@/app/panel/guard";
import { formatDateTimeTr } from "@/components/rule-status";
import { getAdminRepo, getRepo } from "@/lib/data";
import { siteUrl } from "@/lib/env";
import { revokeApiKeyAction } from "../agency-actions";
import { ApiKeyForm, WebhookForm } from "../agency-forms";
import { deleteWebhookAction } from "./webhook-actions";

const VERIFY_EXAMPLE = `// Node.js: gelen webhook'u doğrula
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(secret, rawBody, header) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const want = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest();
  return timingSafeEqual(want, Buffer.from(v1, "hex"));
}`;

function UsageChart({ rows }: { rows: { day: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((n, r) => n + r.count, 0);
  const label = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  return (
    <figure className="mt-5">
      <figcaption className="text-body text-ink-soft">
        Son 14 günde <span className="font-semibold text-ink tabular">{total.toLocaleString("tr-TR")}</span> istek
      </figcaption>
      <div aria-hidden className="mt-3 flex h-28 items-end gap-1 border-b border-line">
        {rows.map((r) => (
          <div key={r.day} className="flex h-full flex-1 flex-col justify-end" title={`${label(r.day)}: ${r.count}`}>
            <div className="rounded-t-[3px] bg-blue" style={{ height: r.count ? `${Math.max(4, (r.count / max) * 100)}%` : "0" }} />
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-1 flex justify-between text-fine text-muted tabular">
        <span>{label(rows[0].day)}</span>
        <span>{label(rows[rows.length - 1].day)}</span>
      </div>
      <table className="sr-only">
        <caption>Günlük API isteği</caption>
        <thead><tr><th scope="col">Gün</th><th scope="col">İstek</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.day}><td>{label(r.day)}</td><td>{r.count}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

export const metadata = { title: "API" };

export default async function ApiPage() {
  const user = await requirePanelUser();
  const admin = getAdminRepo();
  const [keys, hooks, usage] = await Promise.all([getRepo().listApiKeys(), admin.listWebhooks(user.id), admin.getApiUsage(user.id, 14)]);
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
        <p className="mt-1 text-body text-muted">En fazla 5 etkin anahtar. Anahtarın kendisi saklanmaz; yalnızca özeti tutulur, bu yüzden kaybedersen yenisini oluştur.</p>
        <div className="mt-5"><ApiKeyForm /></div>
        {keys.length ? (
          <ul className="mt-6 grid gap-2 text-body">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5">
                <span>
                  <span className="font-semibold">{k.name}</span> <code className="text-meta text-muted">{k.prefix}…</code>
                  <span className="block text-meta text-muted">
                    Oluşturuldu {formatDateTimeTr(k.createdAt)} · {k.lastUsedAt ? `son kullanım ${formatDateTimeTr(k.lastUsedAt)}` : "henüz kullanılmadı"}
                    {k.revokedAt ? ` · iptal edildi ${formatDateTimeTr(k.revokedAt)}` : ""}
                  </span>
                </span>
                {!k.revokedAt ? (
                  <form action={revokeApiKeyAction}>
                    <input type="hidden" name="id" value={k.id} />
                    <button type="submit" className="inline-flex min-h-11 items-center font-semibold text-coral-deep">İptal et</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="istekler" className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="istekler" className="font-display text-2xl font-semibold">İstek sayısı</h2>
        <UsageChart rows={usage} />
      </section>

      <section aria-labelledby="webhooklar" className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="webhooklar" className="font-display text-2xl font-semibold">Webhook</h2>
        <p className="mt-1 max-w-2xl text-body text-muted">
          Bir analiz tamamlandığında bu adrese <code>analysis.completed</code> olayı gönderilir. Olayda reklam metni yoktur; raporu analiz kimliğiyle API&apos;den çekersin.
          2xx dışındaki yanıtlar beş kez yeniden denenir.
        </p>
        <div className="mt-5"><WebhookForm /></div>
        {hooks.length ? (
          <ul className="mt-6 grid gap-2 text-body">
            {hooks.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5">
                <span className="min-w-0">
                  <code className="break-all text-meta">{h.url}</code>
                  <span className="block text-meta text-muted">
                    Eklendi {formatDateTimeTr(h.createdAt)} · {h.lastDeliveryAt ? `son gönderim ${formatDateTimeTr(h.lastDeliveryAt)} (${h.lastStatus})` : "henüz gönderim yok"}
                  </span>
                </span>
                <form action={deleteWebhookAction}>
                  <input type="hidden" name="id" value={h.id} />
                  <button type="submit" className="inline-flex min-h-11 items-center font-semibold text-coral-deep">Sil</button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <details className="mt-5 rounded-xl border border-line">
          <summary className="cursor-pointer px-4 py-3 font-semibold">İmzayı doğrulama</summary>
          <div className="px-4 pb-4">
            <p className="text-small text-ink-soft">
              Her istekte <code>X-AdScope-Signature: t=…,v1=…</code> başlığı bulunur. <code>v1</code>, zaman damgası ve ham gövdenin <code>t.gövde</code> biçiminde HMAC-SHA256 özetidir.
              Beş dakikadan eski damgaları reddet.
            </p>
            <pre tabIndex={0} aria-label="Doğrulama örneği" className="mt-3 overflow-x-auto rounded-xl bg-ink p-4 text-meta leading-relaxed text-paper"><code>{VERIFY_EXAMPLE}</code></pre>
          </div>
        </details>
      </section>

      <section aria-labelledby="kullanim" className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-7">
        <h2 id="kullanim" className="font-display text-2xl font-semibold">Kullanım</h2>
        <p className="mt-1 text-body text-ink-soft">
          Tüm alanlar ve yanıtlar <a href="/api/v1/openapi.json" className="inline-flex min-h-11 items-center font-semibold">OpenAPI 3.1 belgesinde</a> tanımlı; Postman, Insomnia ya da kod üreticilere doğrudan verebilirsin.
        </p>
        <dl className="mt-4 grid gap-3 text-body sm:grid-cols-[14rem_1fr]">
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
        <pre tabIndex={0} aria-label="Örnek istek" className="mt-5 overflow-x-auto rounded-xl bg-ink p-4 text-meta leading-relaxed text-paper"><code>{example}</code></pre>
        <p className="mt-3 text-small text-muted">Her yanıtta <code>disclaimer</code> alanı bulunur: risk değerlendirmesidir, hukuki görüş değildir. API yanıtını son kullanıcıya gösterirken bu uyarıyı da göster.</p>
      </section>
    </div>
  );
}
