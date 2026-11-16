# AdScope

Türk KOBİ'leri, e-ticaret markaları ve ajanslar için reklam ön kontrol aracı. Kullanıcı görsel ve reklam metnini yükler; AdScope tek raporda şunları gösterir:

- **Meta ret riski** (0–100 skor ve düşük/orta/yüksek),
- **Türk reklam mevzuatı riski** (seviye ve doğrulanmış bulgu sayısı),
- **Kreatif skoru** (0–100, alt skorların nedenleriyle).

Ayrıca her bulgu için kaynağı olan kural kartı ve düzeltme önerisi, güvenli metin, beş Türkçe varyant ve ret mesajı girilirse TR + EN itiraz taslağı üretir.

> Risk değerlendirmesidir, hukuki görüş değildir. Ürün hiçbir çıktısında onay, hukuki uygunluk veya reddedilmeme garantisi vermez.

Ayrıntılar:
- [docs/DURUM.md](docs/DURUM.md): neyin gerçek entegrasyon, neyin demo olduğu; kabul kriterleri ve testleri, varsayımlar, üretim öncesi yapılacaklar, backlog.
- [docs/SOURCES.md](docs/SOURCES.md): doğrulanmış resmî kaynaklar ve her kural kartının durumu.

## Teknoloji

Next.js 16 (App Router, `src/proxy.ts`), React 19, TypeScript, Tailwind CSS 4, Supabase (Auth, Postgres, Storage; `@supabase/ssr`), Zod, Anthropic TypeScript SDK (isteğe bağlı). Testler: Vitest ve Playwright + axe. Paket sürümleri sabitlenmiştir, `package-lock.json` dahildir.

## Hızlı başlangıç: demo modu (hesap gerekmez)

```bash
npm ci
cp .env.example .env.local   # Supabase değişkenlerini boş bırakın
npm run dev
```

http://localhost:3000 açılır. Supabase değişkenleri boşken uygulama bellek içi veri katmanıyla çalışır: kayıt, 3 ücretsiz kredi, analiz, rapor, itiraz, geçmiş, demo kredi ekleme ve hesap silme tam çalışır. Veriler süreç yeniden başlayınca silinir (`DEMO_STORE_FILE` ile dosyaya yazılabilir). Ekranın üstünde "Demo modu" bandı görünür.

## Yerel Supabase ile

Gerekenler: Docker ve Supabase CLI (`supabase` dev bağımlılığı olarak kurulur).

```bash
npx supabase start
npx supabase db reset          # migration'lar + kural kartı seed'i
npx supabase status            # API URL, publishable ve secret anahtarlar
```

`.env.local` içine `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ve `SUPABASE_SECRET_KEY` değerlerini yazıp `npm run dev` çalıştırın. Secret anahtar yalnızca sunucuda kullanılır (`server-only` modülleri); `NEXT_PUBLIC_` ile başlayan hiçbir değişkene gizli değer koymayın.

Kural kartlarını değiştirdiğinizde `src/lib/rules/catalog.ts` dosyasını düzenleyin, ardından:

```bash
npm run db:seed:generate && npx supabase db reset
```

## Veritabanı ve güvenlik modeli

- `supabase/migrations/`: 13 tablo (profiles, brands, analyses, analysis_assets, findings, rule_cards, rule_versions, generated_variants, appeal_drafts, credit_ledger, purchase_events, ai_runs, user_consents), RLS politikaları, kredi fonksiyonları, `creatives` storage bucket'ı.
- Tüm `public` tablolarında RLS açık. Politikalar `(select auth.uid()) = user_id` ile satır sahipliğini kontrol eder; UPDATE politikalarında hem `USING` hem `WITH CHECK` var. Bulgular, varyantlar, kredi defteri gibi tablolar istemciden yazılamaz.
- Storage politikaları aynı sahiplik modelini kullanır: dosya yolu `<user_id>/...` ile başlamalıdır.
- Kredi: bakiye `credit_ledger` toplamıdır. Defter yalnızca eklemeye açıktır (tetikleyiciyle korunur). Kredi yalnızca `complete_analysis` içinde, sonuçlarla aynı işlemde düşer; başarısız analiz kredi harcamaz. Kayıt hediyesi, analiz düşümü ve satın alma, benzersiz `idempotency_key` ile korunur; çift tıklama ve çift webhook bir kez işlenir.
- Kredi fonksiyonları `SECURITY INVOKER`dır ve yalnızca `service_role` çalıştırabilir. Tek `SECURITY DEFINER` fonksiyon, kayıt tetikleyicisidir ve dışa açık olmayan `app_private` şemasındadır.
- Yükleme: JPG/PNG/WebP, en fazla 5 MB, dosya imzası (magic bytes) ve MIME uyumu, en kısa kenar 200 px. Reklam metni yapay zekâya `<ad>` etiketleri içinde veri olarak verilir; yapay zekâ yalnızca verilen kural kimliklerini gösterebilir, alıntıladığı ifade metinde geçmiyorsa bulgu atılır.
- Hız sınırı: Postgres'te kullanıcı başına saatlik analiz sınırı; uygulamada dakikalık ve giriş/kayıt sınırları.
- Loglarda reklam içeriği, kişisel veri veya gizli anahtar yazılmaz; yalnızca hata kodu ve analiz kimliği.
- Yanıt başlıkları: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Site `noindex` olarak işaretlidir.

## Yapay zekâ

`ANTHROPIC_API_KEY` tanımlanırsa her analizde metin ve görsel `claude-opus-5-5` modeline (değiştirmek için `ANTHROPIC_MODEL`) yapılandırılmış çıktı şemasıyla gönderilir. Yanıt Zod ile tekrar doğrulanır. Geçersiz yanıt, ret veya zaman aşımında analiz deterministik kural motoruyla tamamlanır ve bu raporda yazar. Sağlayıcı katmanı `src/lib/ai/provider.ts` arayüzünün arkasındadır; başka bir sağlayıcı aynı arayüzle eklenebilir.

## Ödemeler

Gerçek ödeme şu an **kapalı**. Hesap açılınca:

**Lemon Squeezy**
1. Mağaza ve iki ürün varyantı (Başlangıç, Profesyonel) oluşturun.
2. `LEMONSQUEEZY_STORE_URL`, `LEMONSQUEEZY_VARIANT_BASLANGIC`, `LEMONSQUEEZY_VARIANT_PROFESYONEL` değerlerini girin.
3. Webhook: `https://<alan-adı>/api/webhooks/lemonsqueezy`, olay `order_created`; imza gizli değerini `LEMONSQUEEZY_WEBHOOK_SECRET` olarak girin.
4. Krediler sayfasında "Lemon Squeezy ile öde" düğmesi görünür. Ödeme sayfası `checkout[custom][user_id]` taşır; webhook imzası doğrulanınca kredi bir kez eklenir.

**Shopier**: `src/lib/payments/shopier.ts` yalnızca iskelettir. Resmî callback belgesine göre imza ve gövde alanları yazılmadan `SHOPIER_ENABLED=true` yapmayın.

Demo modunda "Demo: … kredi ekle (ödeme yok)" düğmesi deftere "Demo satın alma (gerçek ödeme alınmadı)" notuyla yazar. `APP_MODE=production` iken bu düğme görünmez ve sunucu tarafında da reddedilir.

## Testler

```bash
npm run typecheck && npm run lint
npm test                       # birim + entegrasyon (yerel Supabase yoksa entegrasyon atlanır)
npm run test:e2e               # Playwright: demo modunda masaüstü + mobil (3100 portunda ayrı sunucu açar)
E2E_SUPABASE_BASE_URL=http://localhost:3000 npm run test:e2e   # ek olarak Supabase modunda çalışan uygulamaya karşı
npm run db:advisors            # Supabase güvenlik ve performans danışmanı
```

Önceden kurulu bir Chromium kullanmak için `PW_CHROMIUM_PATH=/yol/chrome` verin.

## Dağıtım (gizli önizleme)

Önerilen: Vercel + Supabase Cloud.

1. Supabase'te proje açın; `npx supabase link --project-ref <ref>` ve `npx supabase db push`. Auth → URL Configuration: Site URL ve `https://<alan-adı>/auth/confirm` yönlendirmesi. E-posta doğrulamasını açık tutun ve bir SMTP sağlayıcısı tanımlayın.
2. Vercel'de projeyi içe aktarın, `.env.example`'daki değişkenleri girin (`APP_MODE=production` veya önizleme için `demo`).
3. Önizlemeyi **gizli** tutun: Vercel → Settings → Deployment Protection → Vercel Authentication (veya parola koruması) açık olsun. Uygulama ayrıca `noindex` gönderir.
4. Günlük saklama temizliği: Vercel Cron ile `/api/cron/retention` uç noktasını `Authorization: Bearer $CRON_SECRET` başlığıyla çağırın.

## Proje yapısı

```
src/app/(site)        pazarlama, kural kartları, yasal sayfalar
src/app/(auth)        giriş, kayıt, sunucu eylemleri
src/app/panel         panel, sihirbaz, rapor, itiraz, geçmiş, krediler, ayarlar
src/app/api           analiz, görsel, webhook, cron uç noktaları
src/lib/engine        kural motoru, skorlama, güvenli metin, varyantlar, itiraz
src/lib/rules         kural kartı kataloğu (tek doğru kaynak)
src/lib/ai            sağlayıcıdan bağımsız yapay zekâ katmanı + Anthropic adaptörü
src/lib/data          DataRepo arayüzü: Supabase ve bellek içi uygulamaları
src/lib/payments      PaymentProvider arayüzü, Lemon Squeezy, Shopier iskeleti
supabase/             migration'lar, seed, config
tests/                birim, entegrasyon, uçtan uca
```
