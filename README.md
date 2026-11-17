# AdScope

Türk KOBİ'leri, e-ticaret markaları ve ajanslar için reklam ön kontrol aracı. Kullanıcı görsel ve reklam metnini yükler; AdScope tek raporda şunları gösterir:

- **Meta ret riski** (0–100 skor ve düşük/orta/yüksek),
- **Türk reklam mevzuatı riski** (seviye ve doğrulanmış bulgu sayısı),
- **Kreatif skoru** (0–100, alt skorların nedenleriyle).

Ayrıca her bulgu için kaynağı olan kural kartı ve düzeltme önerisi, güvenli metin, beş Türkçe varyant ve ret mesajı girilirse TR + EN itiraz taslağı üretir.

MVP sonrası eklenenler:

- **Video / Reels analizi (2 kredi).** Video dosyası sunucuya gönderilmez. Tarayıcı videodan 6 kare alır (üçü ilk 3 saniyeden: kanca), süreyi ve çözünürlüğü ölçer, sesi çözüp sesin ne zaman başladığını ve ne kadarının sessiz olduğunu hesaplar; yalnızca kareler ve ölçümler yüklenir. Yapay zekâ açıksa kareler kanca gücü (0–10), ekran yazısı/altyazı, sessiz izlemede anlaşılırlık ve güvenli alan için incelenir. `SPEECH_TO_TEXT_API_KEY` tanımlıysa ve kullanıcı onay verirse ilk 90 saniyelik ses (16 kHz mono WAV) bir kez konuşma tanıma hizmetine gönderilir; çıkan metin kural kartlarıyla taranır, ilk 3 saniyede ne söylendiği raporda gösterilir. Ses saklanmaz.
- **Açılış sayfası taraması.** Reklamın bağlantısı sunucudan bir kez, SSRF korumasıyla okunur (yalnızca herkese açık http/https; özel/yerel ağ adresleri, kimlik bilgili ve standart dışı portlu adresler reddedilir; her yönlendirme ve DNS çözümlemesi bağlantı anında yeniden denetlenir; 8 sn, 1,5 MB, yalnızca HTML). Reklamdaki indirim oranı, fiyat, marka, konu ve kampanya koşulları sayfayla karşılaştırılır; sayfa metni kural kartlarıyla da taranır. Sayfa içeriği saklanmaz, raporda yalnızca kontrol sonuçları tutulur. İçeriği JavaScript ile yüklenen (neredeyse boş HTML dönen) sayfalar tespit edilir ve karşılaştırma yapılmadığı açıkça yazılır. Sayfa okunamıyorsa kullanıcı bir ekran görüntüsü ekleyebilir: görüntü saklanır, yapay zekâ açıksa metni okunup aynı kontrollere girer.
- **Türk sezon takvimi** (`/panel/takvim`). Önümüzdeki 12 ayın özel günleri; her biri için hazırlığa başlama, incelemeye gönderme ve yayın tarihleri, kreatif önerileri ve kural kartlarına bağlı uyum hatırlatmaları. Sektöre göre süzülür, `.ics` olarak takvime eklenir. Her dönem için kural motorundan geçen kampanya metni şablonları (`/panel/yeni?sablon=...`), "Okula dönüş" dönemi, analiz sırasında döneme denk gelen reklamlar için bilgi notu ve isteğe bağlı e-posta hatırlatması (`/api/cron/season-reminders`, Resend) vardır. Dini bayram tarihleri ve okulların açılış günü resmî takvimle doğrulanmadı; arayüzde bu açıkça yazar.
- **Kural kartları 63.** 16 aktif, 46 doğrulama bekleyen (yalnızca bilgilendirme), 1 taslak. 17.11.2026'da eklenen kartların resmî metni okunmadığı için hepsi `requires_review`.
- **Sektör paketleri.** Genel, takviye gıda ve estetik/klinik yanına kozmetik, kurs/eğitim, emlak ve finans eklendi; her birinin kural kartları, çağrı cümlesi, DM soruları ve sezon hatırlatmaları var.
- **Platformlar.** Analiz Meta, Google Ads veya TikTok için yapılabilir. Türk mevzuatı kartları her platformda geçerlidir; Google Ads ve TikTok kartları doğrulama beklediği için yalnızca bilgilendirir.
- **WhatsApp / DM şablonu.** İlk mesaj, sık sorulara hazır yanıt soruları, karşılama ve mesai dışı mesajı; kural motorundan tekrar geçer.
- **Dışa aktarma.** Varyantlar ve DM metinleri CSV (Excel uyumlu, formül enjeksiyonuna karşı korumalı) olarak; rapor, sunucuda üretilen markalı PDF olarak indirilir. Her PDF sayfasının altında uyarı yazar.
- **Ajans modu.** Markalar (`/panel/markalar`: ton, yasaklı kelimeler, tercih edilen çağrı cümlesi, marka sesi notu, logo), salt okunur ekip üyeleri (`/panel/ekip`, tek kullanımlık e-posta daveti, en fazla 10 kişi), avukata salt okunur inceleme bağlantısı (`/inceleme/<anahtar>`, 1–30 gün, iptal edilebilir, sayaçlı).
- **Uyarı geri bildirimi.** Her bulgunun altında "Yararlı / Anlaşılmadı / Yanlış uyarı" seçenekleri; yanlış uyarı nedeni ve notu kural sürümüyle birlikte saklanır.
- **Ücretsiz kontrol** (`/reklamim-reddedilir-mi`). Üyeliksiz, yalnızca metin; kural motoruyla çalışır, hiçbir şey saklanmaz, IP özeti başına 10 dakikada 10 kontrol.
- **Kurumsal API** (`/api/v1/analyses`). `ads_live_…` anahtarıyla JSON + base64 görsel gönderilir, rapor JSON döner; anahtar başına dakikada 30 istek, panelle aynı kredi kuralları. Belgeler `/panel/api`.
- **Aylık mevzuat bülteni.** Ayarlardan açılır; son 30 günde doğrulanan veya güncellenen kural kartlarını sektöre göre listeler (`/api/cron/newsletter`).
- **İlham panosu** (`/panel/ilham`). Meta Reklam Kütüphanesi'nde AB'de gösterilen reklamları arar, metinleri AdScope kurallarıyla tarar, beğenilenleri panoya kaydeder. `META_AD_LIBRARY_TOKEN` yoksa kurulum adımlarını gösterir; örnek ya da uydurma reklam göstermez.
- **Tarayıcı eklentisi** (`extension/`). Chrome/Edge için sağ tık menüsü: seçili metni veya sayfanın adresini sihirbaza taşır. Veri göndermez; metin adresin `#` kısmında taşınır. Kurulum: [extension/README.md](extension/README.md).

Kapsam dışı (ürün kararı): **Meta reklam hesabı bağlama** (şirket ve işletme doğrulaması gerektirir), **iyzico** (ödeme için Shopier kullanılacak), **ikas / Ticimax** entegrasyonu (iş ortaklığı planlanmıyor).

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

- `supabase/migrations/`: 21 tablo (profiles, brands, analyses, analysis_assets, findings, rule_cards, rule_versions, generated_variants, appeal_drafts, credit_ledger, purchase_events, ai_runs, user_consents, season_reminder_log, team_members, team_invites, finding_feedback, review_shares, newsletter_log, api_keys, inspiration_pins), RLS politikaları, kredi fonksiyonları, `creatives` storage bucket'ı.
- İstemci rollerine (`anon`, `authenticated`) yetkiler tablo ve sütun bazında açıkça verilir; Supabase'in yeni tablolara otomatik verdiği tüm yetkiler kaldırıldı. Örneğin API anahtarı ve inceleme bağlantısında kullanıcı yalnızca `revoked_at` sütununu değiştirebilir, marka logosu yolunu yalnızca sunucu yazar.
- Ekip üyeleri sahibin verisini tek bir "sahip veya ekip" SELECT politikasıyla salt okunur görür; yazma, silme ve kredi işlemleri yalnızca sahibe açıktır. Davet, inceleme bağlantısı ve API anahtarı rastgele 32 bayttır; veritabanında yalnızca SHA-256 özeti tutulur.
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

Demo e2e sunucusu `LANDING_SCAN_ALLOW_PRIVATE=true` ile açılır; böylece açılış sayfası testi 127.0.0.1 üzerindeki fikstür sunucusunu okuyabilir. Bu değişken `APP_MODE=production` veya `NODE_ENV=production` iken yok sayılır. Supabase projesindeki e2e koşusu bu değişken olmadan çalıştığı için açılış sayfası adımını atlar.

## Dağıtım (gizli önizleme)

Önerilen: Vercel + Supabase Cloud.

1. Supabase'te proje açın; `npx supabase link --project-ref <ref>` ve `npx supabase db push`. Auth → URL Configuration: Site URL ve `https://<alan-adı>/auth/confirm` yönlendirmesi. E-posta doğrulamasını açık tutun ve bir SMTP sağlayıcısı tanımlayın.
2. Vercel'de projeyi içe aktarın, `.env.example`'daki değişkenleri girin (`APP_MODE=production` veya önizleme için `demo`).
3. Önizlemeyi **gizli** tutun: Vercel → Settings → Deployment Protection → Vercel Authentication (veya parola koruması) açık olsun. Uygulama ayrıca `noindex` gönderir.
4. Günlük saklama temizliği: Vercel Cron ile `/api/cron/retention` uç noktasını `Authorization: Bearer $CRON_SECRET` başlığıyla çağırın.
5. Sezon hatırlatmaları: `RESEND_API_KEY` ve `EMAIL_FROM` girin, `/api/cron/season-reminders` uç noktasını günde bir kez aynı başlıkla çağırın. Her kullanıcıya her dönem için en fazla bir e-posta gider (`season_reminder_log`).
6. Mevzuat bülteni: `/api/cron/newsletter` uç noktasını ayın ilk günü aynı başlıkla çağırın. Her kullanıcıya ayda en fazla bir bülten gider (`newsletter_log`).
7. İlham panosu: Meta for Developers'ta uygulama açıp Reklam Kütüphanesi API kimlik doğrulamasını tamamlayın, uzun ömürlü erişim anahtarını `META_AD_LIBRARY_TOKEN` olarak girin.

## Proje yapısı

```
src/app/(site)        pazarlama, kural kartları, yasal sayfalar
src/app/(auth)        giriş, kayıt, sunucu eylemleri
src/app/panel         panel, sihirbaz, rapor, itiraz, geçmiş, krediler, ayarlar, sezon takvimi, markalar, ekip, API, ilham panosu
src/app/inceleme      avukat için salt okunur rapor bağlantısı
src/app/api           analiz, görsel, dışa aktarma, kurumsal API (v1), webhook, cron uç noktaları
src/lib/engine        kural motoru, skorlama, güvenli metin, varyantlar, itiraz, video ve açılış sayfası kontrolleri
src/lib/landing       açılış sayfasını SSRF korumalı okuyan sunucu modülü
src/lib/video         tarayıcıda videodan kare çıkarma, ses ölçümü ve WAV üretimi
src/lib/speech        konuşmayı yazıya dökme adaptörü (OpenAI uyumlu)
src/lib/email         e-posta adaptörü (Resend) ve demo kutusu
src/lib/calendar      sezon takvimi tarihleri, .ics, kampanya şablonları, hatırlatma e-postası
src/lib/rules         kural kartı kataloğu (tek doğru kaynak)
src/lib/export        CSV ve PDF (pdfkit, gömülü Manrope/Fraunces)
src/lib/ads-library   Meta Reklam Kütüphanesi adaptörü
src/lib/api           kurumsal API kimlik doğrulama ve yanıt biçimi
src/lib/ai            sağlayıcıdan bağımsız yapay zekâ katmanı + Anthropic adaptörü
src/lib/data          DataRepo arayüzü: Supabase ve bellek içi uygulamaları
src/lib/payments      PaymentProvider arayüzü, Lemon Squeezy, Shopier iskeleti
supabase/             migration'lar, seed, config
extension/            Chrome/Edge eklentisi (Manifest V3)
tests/                birim, entegrasyon, uçtan uca
```
