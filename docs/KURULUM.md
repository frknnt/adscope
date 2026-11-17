# AdScope üretim kurulumu

Bu belge AdScope'u kendi alan adında, gerçek Supabase veritabanıyla ve Vercel üzerinde yayına almak için gereken adımları sıralar. Kod tarafı hazırdır; aşağıdaki hesap ve anahtar adımları yalnızca senin yapabileceğin işlerdir.

Hizmetlerin fiyat ve plan koşulları değişebilir. Bir plana karar vermeden önce ilgili hizmetin güncel fiyat sayfasına bak.

## Senin yapman gerekenler (kontrol listesi)

Zorunlu:

- [ ] **Alan adı** al (ör. `adscope.com.tr`). DNS kayıtlarını düzenleyebildiğin bir panel gerekir.
- [ ] **Supabase** hesabı aç ve bir proje oluştur. Bölge olarak **Frankfurt (eu-central-1)** seç. Veritabanı şifresini bir şifre yöneticisine kaydet.
- [ ] **Vercel** hesabı aç ve GitHub deposunu (`frknnt/adscope`) içe aktar. Ücretli bir ürün için Hobby planı yetmez; Vercel'in kullanım koşulları Hobby'yi kişisel ve ticari olmayan kullanımla sınırlar. **Pro** plan gerekir.
- [ ] **Resend** hesabı aç ve gönderici alan adını doğrula (bölüm 4).
- [ ] **CRON_SECRET** üret: terminalde `openssl rand -hex 32`. Çıkan değeri yalnızca Vercel'e gir.
- [ ] **Şirket bilgileri**: şahıs şirketi unvanı, adres, vergi dairesi ve numarası, iletişim e-postası ve varsa KEP adresi. Yasal sayfalardaki yer tutucular bunlarla doldurulacak.
- [ ] **Shopier**: mağaza hesabı ve Shopier'in geliştirici belgesi ya da örnek bir ödeme bildirimi (callback). Belge olmadan ödeme bağlantısı açılmaz.

İsteğe bağlı (boş kalırsa ilgili özellik kapalı ya da sınırlı çalışır):

- [ ] **Anthropic API anahtarı**: yapay zekâ destekli analiz. Boşsa deterministik kural motoru çalışır.
- [ ] **Konuşmayı yazıya dökme anahtarı** (OpenAI uyumlu): videoda konuşma metni çıkarma.
- [ ] **Meta Reklam Kütüphanesi erişim anahtarı**: ilham panosu.

## 1. Supabase bulut projesi

### Şemayı yükle

Bilgisayarında, depo klasöründe:

```bash
npx supabase login                       # tarayıcıda giriş; CI için kapsamı daraltılmış bir erişim anahtarı kullan
npx supabase link --project-ref <proje-ref>
npx supabase db push                     # supabase/migrations altındaki tüm göçler
```

`<proje-ref>`, Supabase panelinde proje adresindeki kısa koddur (Project Settings → General).

### Kural kartlarını yükle

Kural motoru kartları veritabanındaki `rule_cards` ve `rule_versions` tablolarından okur. `db push` bunları yüklemez. Kartları yüklemek için `supabase/seed.sql` dosyasını üretim veritabanında bir kez çalıştır:

```bash
psql "<bağlantı-dizesi>" -f supabase/seed.sql
```

Bağlantı dizesini Supabase panelinde Connect düğmesinden al. Seed dosyası tekrar çalıştırılabilir; var olan kart sürümlerine dokunmaz, yeni sürümleri ekler ve eskilerini emekliye ayırır.

Uzman incelemesinden sonra (`npm run rules:review:apply docs/KURAL_INCELEME.md`) seed dosyası yeniden üretilir. Her inceleme turundan sonra aynı `psql` komutunu tekrar çalıştır.

### Kimlik doğrulama ayarları

Authentication → URL Configuration:

- **Site URL**: `https://<alan-adın>` (sonunda eğik çizgi olmadan).
- **Redirect URLs**: `https://<alan-adın>/**`. Önizleme dağıtımlarında gerçek kayıt denemek istersen Vercel önizleme adresini de ekle; önerilen düzende önizlemeler Supabase'e bağlanmadığı için buna gerek yoktur (bölge 2).

Authentication → Sign In / Providers → Email:

- **Confirm email** açık olsun. Yerel geliştirmede kapalıdır, üretimde açık olmalı.

Authentication → Emails → SMTP Settings: Supabase'in yerleşik e-posta sunucusu yalnızca deneme içindir; saatlik gönderim sınırı çok düşüktür ve dışarıdaki adreslere gönderim kısıtlıdır. Resend'i SMTP olarak gir:

| Alan | Değer |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend API anahtarın |
| Sender email | `bildirim@<alan-adın>` (Resend'de doğruladığın alan adından) |
| Sender name | `AdScope` |

Authentication → Emails → Templates: Türkçe şablonları yapıştır.

| Şablon | Konu | İçerik dosyası |
| --- | --- | --- |
| Confirm signup | AdScope hesabını doğrula | `supabase/templates/onay.html` |
| Change email address | AdScope e-posta değişikliğini onayla | `supabase/templates/eposta-degisikligi.html` |

Şablonlardaki bağlantılar `/auth/confirm?token_hash=...` biçimindedir. Uygulama bu adresi sunucuda doğrular, bu yüzden şablonu değiştirirken bağlantı biçimine dokunma. Yerel geliştirmede aynı şablonlar `supabase/config.toml` üzerinden otomatik kullanılır.

### Kontrol

```bash
npx supabase db advisors --remote --level warn
```

Uyarı listesi boş olmalı.

## 2. Vercel'e dağıtım

### Proje

1. Vercel'de New Project → GitHub'dan `adscope` deposunu seç. Framework Next.js olarak algılanır; derleme komutunu değiştirme.
2. Production Branch: `main`.
3. Settings → Functions → Function Region: `fra1` (Frankfurt). `vercel.json` bunu zaten ister; amaç fonksiyonları Supabase ile aynı bölgede çalıştırmaktır.

### Ortam değişkenleri

Settings → Environment Variables. Gizli değerleri **Sensitive** olarak işaretle ve yalnızca **Production** ortamına ver.

`NEXT_PUBLIC_` ile başlayan her değer tarayıcıya gider. Bu öneki yalnızca aşağıdaki üç değer alır; gizli bir anahtarı asla bu önekle tanımlama.

**Herkese açık (tarayıcıya gider):**

| Değişken | Değer |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://<alan-adın>` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys → Publishable key |

**Gizli (yalnızca sunucu, Sensitive işaretle):**

| Değişken | Not |
| --- | --- |
| `SUPABASE_SECRET_KEY` | Supabase → API Keys → Secret key. Tüm satır güvenliğini aşar; yalnızca Production. |
| `CRON_SECRET` | `openssl rand -hex 32` çıktısı. Vercel bunu zamanlanmış çağrılara `Authorization: Bearer` başlığı olarak kendisi ekler. |
| `RESEND_API_KEY` | Resend → API Keys. Yalnızca gönderim yetkili bir anahtar yeter. |
| `ANTHROPIC_API_KEY` | İsteğe bağlı. |
| `SPEECH_TO_TEXT_API_KEY` | İsteğe bağlı. |
| `META_AD_LIBRARY_TOKEN` | İsteğe bağlı. |
| `SHOPIER_*` gizli değerleri | Shopier entegrasyonu tamamlanınca eklenecek; `.env.example` güncel listeyi tutar. |

**Gizli olmayan sunucu ayarları:**

| Değişken | Değer |
| --- | --- |
| `APP_MODE` | `production` |
| `EMAIL_FROM` | `AdScope <bildirim@<alan-adın>>` |
| `ANTHROPIC_MODEL` | Boş bırak (varsayılan kullanılır) ya da model kimliği. |
| `ANALYSIS_HOURLY_LIMIT` | `20` |
| `RETENTION_DAYS_DEFAULT` | `90` |
| `META_GRAPH_VERSION` | Boş bırak. |

**Üretimde boş kalması gerekenler:** `DEMO_SESSION_SECRET`, `DEMO_STORE_FILE`, `LANDING_SCAN_ALLOW_PRIVATE`, `META_GRAPH_BASE_URL`, `SPEECH_TO_TEXT_BASE_URL` (OpenAI dışında bir sağlayıcı kullanmıyorsan) ve `LEMONSQUEEZY_*`. Bunlar yalnızca yerel geliştirme ve testler içindir; üretimde zaten yok sayılırlar, ama hiç tanımlamamak en temizidir.

### Önizleme dağıtımları

Her dal ve çekme isteği için Vercel bir önizleme adresi üretir. Öneriler:

- Settings → Deployment Protection → **Vercel Authentication** açık olsun (Standard Protection). Önizlemeleri yalnızca Vercel ekibindeki kişiler açabilir. Şifreyle koruma (Password Protection) ayrıca ücretli bir eklentidir; tek kişilik ekip için Vercel Authentication yeterlidir.
- Önizleme ortamına Supabase anahtarlarını **verme**. `APP_MODE` değeri `demo` kalsın; önizleme bellek içi demo verisiyle açılır ve gerçek veritabanına dokunmaz. Supabase anahtarı verilmiş bir demo dağıtımı gerçek veritabanına demo kredisi yazabilir; bu yüzden üretim anahtarları yalnızca Production ortamında olmalı.
- Gerçek veriyle önizleme gerekirse ayrı bir Supabase projesi aç ve onun anahtarlarını yalnızca Preview ortamına ver.

## 3. Zamanlanmış işler (cron)

`vercel.json` üç işi tanımlar. Vercel zamanları UTC'dir; tabloda İstanbul saati de verilmiştir. Zamanlanmış işler yalnızca Production dağıtımında çalışır.

| Yol | Zaman (UTC) | İstanbul | Ne yapar |
| --- | --- | --- | --- |
| `/api/cron/retention` | Her gün 23:00 | 02:00 | Saklama süresi dolan analizleri ve görsellerini siler. |
| `/api/cron/season-reminders` | Her gün 04:00 | 07:00 | Hatırlatma açan kullanıcılara sezon e-postası gönderir. |
| `/api/cron/newsletter` | Her ayın 1'i, 06:00 | 09:00 | Pazarlama iznini veren kullanıcılara aylık mevzuat bültenini gönderir. |

Üç uç da `CRON_SECRET` en az 16 karakter değilse ya da başlık eşleşmezse 401 döner. Aynı gün ikinci kez çalışsalar bile bir kişiye aynı e-postayı iki kez göndermezler. `RESEND_API_KEY` ya da `EMAIL_FROM` boşsa e-posta işleri hiçbir şey göndermeden başarıyla biter.

Elle denemek için:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" https://<alan-adın>/api/cron/retention
```

Vercel → Settings → Cron Jobs ekranından bir işi "Run" ile de tetikleyebilirsin.

## 4. Resend alan adı doğrulaması

1. Resend → Domains → Add Domain. Ana alan adını ya da bir alt alan adını (ör. `bildirim.<alan-adın>`) gir. Alt alan adı, ana alan adının e-posta itibarını ayrı tutar.
2. Resend'in gösterdiği DNS kayıtlarını (SPF için TXT ve MX, DKIM için TXT) alan adı panelinde aynen ekle.
3. Ayrıca bir DMARC kaydı ekle: `_dmarc` adına `v=DMARC1; p=none; rua=mailto:<senin-adresin>` değerinde bir TXT kaydı. Birkaç hafta sorunsuz gönderimden sonra `p=quarantine` yapabilirsin.
4. Resend'de "Verify" düğmesine bas. DNS yayılımı birkaç dakika ile birkaç saat sürebilir.
5. `EMAIL_FROM` ve Supabase SMTP göndericisi bu doğrulanmış alan adından olmalı.

## 5. Alan adı

1. Vercel → Project → Settings → Domains → Add. Hem `<alan-adın>` hem `www.<alan-adın>` ekle; birini diğerine yönlendir.
2. Vercel'in gösterdiği A ve CNAME kayıtlarını alan adı panelinde gir. HTTPS sertifikası otomatik verilir.
3. Alan adı bağlandıktan sonra şu üç yerin aynı adresi gösterdiğini kontrol et: Vercel'deki `NEXT_PUBLIC_SITE_URL`, Supabase Site URL ve Redirect URLs, Resend gönderici alan adı.
4. `NEXT_PUBLIC_SITE_URL` değiştiyse Vercel'de yeniden dağıtım (Redeploy) yap; `NEXT_PUBLIC_` değerleri derleme anında koda gömülür.

## 6. Yayın sonrası kontrol

- [ ] Ana sayfada "Demo modu" bandı **görünmüyor**.
- [ ] Yeni bir e-postayla kayıt ol; Türkçe doğrulama e-postası geliyor ve bağlantı panele açılıyor.
- [ ] Krediler sayfasında demo satın alma düğmesi **yok**.
- [ ] Bir görselle analiz yap; rapor açılıyor, PDF iniyor ve "Risk değerlendirmesidir, hukuki görüş değildir" uyarısı görünüyor.
- [ ] `curl` ile cron ucuna gizli değer olmadan istek at; 401 dönüyor.
- [ ] Vercel → Logs ekranında reklam metni, e-posta adresi ya da anahtar görünmüyor.
- [ ] `npx supabase db advisors --remote --level warn` temiz.

## Koddaki üretim kontrolleri

Yayına almadan önce gözden geçirilen kontroller:

| Kontrol | Nerede | Üretimde davranış |
| --- | --- | --- |
| Uygulama modu | `src/lib/env.ts` `appMode()` | `APP_MODE=production` ya da Vercel Production dağıtımı (`VERCEL_ENV=production`) üretim sayılır. `APP_MODE` unutulsa bile canlı alan adında demo modu açılmaz. |
| Veri katmanı | `dataBackend()` | Üretimde Supabase değişkenleri yoksa uygulama başlamaz; bellek içi demo deposuna düşmez. |
| Demo kredi satın alma | `demoPurchasesAllowed()`, `demoPurchaseAction` | Üretimde kapalı; sunucu eylemi de reddeder. |
| Demo bandı | `src/app/layout.tsx` | Yalnızca demo modunda görünür. |
| E-posta | `src/lib/email/provider.ts` | Demo modunda bellek içi kutu; üretimde Resend yoksa gönderim atlanır, sahte kutu kullanılmaz. |
| Açılış sayfası taraması | `src/lib/landing/fetch.ts` | `LANDING_SCAN_ALLOW_PRIVATE` üretimde yok sayılır; özel ağ adresleri taranamaz. |
| Meta API adresi | `src/lib/ads-library/meta.ts` | `META_GRAPH_BASE_URL` üretimde yok sayılır; anahtar yalnızca Meta'ya gider. |
| Demo oturum çerezi | `src/lib/data/memory-repo.ts` | Yalnızca bellek içi depoda kullanılır; üretimde bu depo hiç açılmaz. |
| Cron uçları | `src/app/api/cron/*` | `CRON_SECRET` sabit zamanlı karşılaştırmayla doğrulanır; 16 karakterden kısa gizli değer kabul edilmez. |

Bilinen eksik: uygulamada henüz "şifremi unuttum" akışı yok. Kullanıcı şifresini unutursa Supabase panelinden elle sıfırlama bağlantısı gönderilmesi gerekir.
