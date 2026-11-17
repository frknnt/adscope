# Durum: yapılanlar, varsayımlar, üretim öncesi yapılacaklar

## Gerçek entegrasyon mu, demo mu?

| Parça | Durum |
|---|---|
| Supabase Auth (e-posta + şifre, e-posta doğrulama rotası) | **Gerçek.** Yerel Supabase'te uçtan uca test edildi. |
| Postgres şeması, RLS, kredi fonksiyonları, kredi defteri | **Gerçek.** Yerel Supabase'te entegrasyon ve tarayıcı testleriyle doğrulandı. |
| Supabase Storage (özel `creatives` bucket, sahiplik politikaları) | **Gerçek.** Yükleme kullanıcı oturumuyla yapılır, politikalar test edildi. |
| Kural motoru, skorlama, güvenli metin, 5 varyant, itiraz taslağı | **Gerçek, deterministik.** Yapay zekâ olmadan tam akış çalışır. |
| Yapay zekâ değerlendirmesi (Anthropic) | **Adaptör hazır, anahtar yok.** `ANTHROPIC_API_KEY` tanımlanınca devreye girer; yanıt şemayla doğrulanır, başarısız olursa kural motoruna düşer. Gerçek API ile denenmedi. |
| Lemon Squeezy ödeme | **Adaptör + webhook doğrulama hazır, hesap yok.** İmza doğrulama birim testli; gerçek ödeme denenmedi. |
| Shopier ödeme | **Yalnızca iskelet.** Resmî callback belgesi okunamadı; kapalı. |
| Demo satın alma | **Demo.** Yalnızca `APP_MODE=demo` iken görünür, kayıtlarda "Demo (ödeme alınmadı)" yazar. |
| Bellek içi veri katmanı | **Demo.** Supabase değişkenleri yokken kullanılır; aynı kredi ve sahiplik kurallarını taklit eder, süreç yeniden başlayınca silinir. |
| PDF rapor | **Gerçek, sunucuda.** pdfkit ile üretilir, Manrope/Fraunces gömülü (Türkçe karakterler tam), marka logosu başlıkta, her sayfada uyarı ve sayfa numarası. Tarayıcıdan yazdırma da duruyor. |
| CSV dışa aktarma | **Gerçek.** Varyantlar ve DM metinleri; UTF-8 BOM, `;` ayraç (Excel Türkçe), formül enjeksiyonuna karşı hücre koruması, her satırda uyarı. |
| Video / Reels analizi | **Gerçek.** 6 kare (3'ü ilk 3 saniyeden) tarayıcıda çıkarılır, sunucuda imzasından doğrulanır, özel depoda saklanır. Ses tarayıcıda ölçülür (başlangıç anı, sessiz oran). 2 kredi; maliyet her analizde `credit_cost` olarak saklanır ve `complete_analysis` tam o kadar düşer. Tarayıcının açamadığı formatlar (çoğu zaman MOV/HEVC) için MP4 (H.264) önerilir. |
| Video kanca incelemesi (kanca puanı, altyazı, sessiz izleme, güvenli alan) | **Yapay zekâ gerekir.** Anthropic adaptöründen şemayla istenir; anahtar yokken raporda "Değerlendirilmedi" yazar. Gerçek API ile denenmedi. |
| Konuşmayı yazıya dökme | **Adaptör hazır, anahtar yok.** OpenAI uyumlu `/v1/audio/transcriptions`; yerel sahte sunucuyla birim ve uçtan uca test edildi, gerçek hizmetle denenmedi. Kullanıcı onayı olmadan ses gönderilmez. |
| Açılış sayfası taraması | **Gerçek.** Sunucu tarafında tek istek; JavaScript çalıştırılmaz. JavaScript ile çizilen sayfalar tespit edilir. Ekran görüntüsü yedeği saklanır; metnini okumak yapay zekâ gerektirir. |
| Sezon hatırlatma e-postaları | **Adaptör hazır, hesap yok.** Resend adaptörü sahte sunucuyla test edildi; anahtar yokken demo modunda bellek kutusuna yazar, production'da göndermez. Zamanlayıcı kurulmadı. |
| Kampanya şablonları ve analizde sezon notu | **Gerçek.** Her şablon testte kural motorundan kırmızı/sarı bayraksız geçer. Sezon notu yalnızca bilgilendirmedir, skoru değiştirmez. |
| Sezon takvimi | **Hesaplanan.** Sabit ve kurala bağlı günler koddan hesaplanır. Ramazan ve Kurban Bayramı 2026–2027 tarihleri ikincil kaynaklardan alındı, **Diyanet'le doğrulanmadı**; 2028 ve sonrası eklenmedi. "Okula dönüş" eylülün ikinci pazartesi varsayılır, **MEB takvimiyle doğrulanmadı**. |
| Sektör paketleri (kozmetik, kurs/eğitim, emlak, finans) | **Gerçek, kartlar doğrulanmadı.** Kartların hepsi `requires_review`; yalnızca bilgilendirir. |
| Google Ads ve TikTok | **Gerçek, kartlar doğrulanmadı.** Platform seçimi, platforma göre kural süzme ve etiketler çalışır; 10 platform kartının hepsi `requires_review`. Platformların kendi inceleme sistemleriyle kalibre edilmedi. |
| WhatsApp / DM şablonu | **Gerçek, deterministik.** Kural motorundan tekrar geçer; marka yasaklı kelimeleri çıkarılır. |
| Ajans modu (markalar, ekip, avukat bağlantısı, logolu PDF) | **Gerçek.** Yerel Supabase'te RLS ve yetki testleri, tarayıcıda uçtan uca test edildi. Davet e-postası Resend tanımlıysa gider; yoksa bağlantı ekranda bir kez gösterilir. |
| Uyarı geri bildirimi | **Gerçek.** Kural sürümüyle birlikte saklanır. Geri bildirimleri okuyacak bir yönetim ekranı yok; veritabanından sorgulanır. |
| Ücretsiz kontrol sayfası | **Gerçek.** Kural motoru, yapay zekâ yok, saklama yok. Hız sınırı bellek içidir (tek sunucu). |
| Kurumsal API | **Gerçek.** Anahtar özeti veritabanında; anahtar başına dakikada 30 istek (bellek içi). OpenAPI belgesi yok, `/panel/api` sayfasında örnek var. |
| Aylık mevzuat bülteni | **Adaptör hazır, hesap yok.** İçerik katalogdaki `lastVerifiedAt` tarihlerinden üretilir; Resend ve zamanlayıcı kurulmadı. |
| Meta Reklam Kütüphanesi ilham panosu | **Adaptör hazır, anahtar yok.** Sahte Graph API sunucusuyla birim ve uçtan uca test edildi; gerçek API ile denenmedi. Ticari reklamlar API'de yalnızca AB için açık. |
| Tarayıcı eklentisi | **Gerçek, mağazada değil.** Geliştirici modunda yüklenir; Chrome Web Mağazası hesabı gerekir. Yardımcı işlevleri birim testli; eklentinin kendisi tarayıcıda otomatik test edilmedi. |
| Saklama süresi temizliği | `/api/cron/retention` uç noktası hazır; zamanlayıcı (ör. Vercel Cron) kurulmadı. |

## Kabul kriterleri ve test karşılığı

| Kriter | Nerede test edildi |
|---|---|
| Kayıt/giriş | `tests/e2e/analysis.spec.ts`, `tests/e2e/site.spec.ts` (demo ve Supabase modunda) |
| 3 ücretsiz kredi yalnızca bir kez | `tests/integration/supabase.test.ts`, `tests/unit/memory-repo.test.ts` |
| Kullanıcılar birbirinin analizini/dosyasını göremez | entegrasyon (RLS + storage), e2e (sayfa ve görsel 404) |
| Başarılı analiz 1 kredi, başarısız 0 kredi | entegrasyon, bellek testi, e2e bakiye kontrolü |
| Çift tıklama / aynı istek kimliği tek analiz, tek kredi | entegrasyon (eşzamanlı), e2e (dblclick + eşzamanlı API çağrısı) |
| Çift webhook tek kredi | entegrasyon (eşzamanlı `apply_purchase_event`), bellek testi |
| Kredi defteri değiştirilemez | entegrasyon |
| AI şema doğrulaması, uydurma kural reddi | `tests/unit/ai.test.ts` |
| Demo uçtan uca, itiraz taslağı, rapor | e2e |
| Hatalı/sahte görsel yükleme (istemci ve sunucu) | e2e, `tests/unit/security.test.ts` |
| Garanti ifadesi yok, uyarı her raporda | birim + e2e |
| Mobil ve masaüstü, taşma yok | e2e `demo-mobile` (Pixel 7) ve masaüstü |
| Klavye ve erişilebilirlik (axe, WCAG 2 A/AA ciddi/kritik ihlal yok) | e2e |
| Video: yalnızca kareler yüklenir, kare sayısı/biçimi sunucuda doğrulanır | e2e `video-landing.spec.ts`, bellek testi, entegrasyon (kare indeksleri, RLS) |
| Açılış sayfası: SSRF koruması, yönlendirme, zaman aşımı | `tests/unit/features.test.ts` (yerel fikstür sunucusu), e2e |
| Açılış sayfası ve video notları ihlal sayılmaz (yalnızca kreatif kalite) | birim |
| Sezon takvimi tarihleri, .ics biçimi, sektör süzgeci | birim + e2e |
| Video 2 kredi, bakiye 1 iken video başlamaz, kullanıcı maliyeti değiştiremez | entegrasyon, bellek testi, e2e |
| Ses yalnızca onayla gönderilir; konuşma metni kurallarla taranır | e2e (sahte konuşma sunucusu), birim (WAV doğrulama, adaptör) |
| JavaScript sayfası tespiti, ekran görüntüsü yedeği ve sahipliği | birim, e2e (başka kullanıcıya 404) |
| Şablonlar, sezon notu, hatırlatma e-postası ve tekrar göndermeme | birim, bellek testi, entegrasyon (`season_reminder_log` RLS), e2e |
| Sektör paketleri, DM şablonu, marka sesi, platform kural setleri, CSV kaçışları, PDF (gömülü yazı tipi) | `tests/unit/agency-export.test.ts` |
| Ekip salt okunur, geri bildirim yalnızca sahibine, inceleme bağlantısı süresi ve sütun yetkileri, API anahtarı gizliliği, logo yolu, ilham panosu | entegrasyon (yerel Supabase) |
| İstemci rollerinin yeni tablolarda genel yetkisi yok | entegrasyon |
| Ücretsiz kontrol, CSV/PDF indirme, DM bölümü, avukat bağlantısı oturumsuz, markalar, ekip daveti, API anahtarı ile JSON, ilham panosu (anahtar başlıkta, `ad_snapshot_url` sızmıyor), sihirbaza `#` ile metin taşıma | e2e `agency.spec.ts` (demo masaüstü, demo mobil, Supabase) |
| Meta Reklam Kütüphanesi adaptörü (alan süzme, AB ülkesi, hata eşleme, önbellek ve hız sınırı) | `tests/unit/ad-library.test.ts` |
| Eklenti: yalnızca https adres, metin `#` içinde, en az izin | `tests/unit/extension.test.ts` |
| Production build | `next build` temiz (uyarı yok) |
| Veritabanı danışmanı | `supabase db advisors --level warn`: sorun yok. Ekip politikaları sahip politikasıyla birleştirildi (tek SELECT politikası); yalnızca yeni veritabanında kullanılmamış indeks bilgileri kalıyor. |

Son çalıştırma (17.11.2026, ajans modu, platformlar, API, ilham panosu ve eklentiden sonra): tip denetimi ve lint temiz, birim + entegrasyon 118/118, uçtan uca 77 geçti + 1 bilerek atlandı (demo masaüstü, demo mobil, Supabase masaüstü). `next build` temiz, `supabase db advisors --level warn` sorun bulmadı. Bu turda entegrasyon testi gerçek bir açık buldu: Supabase'in varsayılan yetkileri yüzünden yeni tablolarda kullanıcı API anahtarının özetini ve inceleme bağlantısının sayacını değiştirebiliyordu; yetkiler tablo ve sütun bazında yeniden verildi ve test eklendi. E2E projeleri ayrı `X-Forwarded-For` adresleriyle kaydolur; böylece IP başına kayıt sınırı projeler arasında paylaşılmaz.

Tasarım sistemi (P6.1, 17.11.2026): `DESIGN.md` eklendi. Renkler belirteçlere taşındı, işletim sistemi tercihine göre koyu tema geldi (yalnızca ekranda; yazdırma ve PDF açık kalır). 20 farklı sabit yazı boyutu 5 ölçeğe indirildi. Yeni bileşenler: `EmptyState`, `Skeleton`, `Stepper`, `DataTable`, `selectClass` (kullanımda) ve `Tabs`, `Dialog`, `ToastProvider` (hazır, sonraki fazlarda kullanılacak). Yeni `tests/e2e/theme.spec.ts` koyu temada 8 sayfayı axe ile denetler. Bu sırada bir hata yakalandı: panelin tamamına konan yükleme ekranı yanıtı akışla gönderdiği için başkasının analizine giden istek 404 yerine 200 dönüyordu; yükleme ekranı yalnızca `ilham` ve `gecmis` sayfalarına alındı. Demo e2e (masaüstü + mobil) ve 99 birim testi geçti, `next build` temiz. Supabase modunda e2e ve entegrasyon testleri bu turda yeniden çalıştırılmadı (veritabanı değişikliği yok).

Landing yeniden tasarımı (17.11.2026): `docs/TASARIM_YONU.md`'ye göre lacivert, yalnızca açık tema. Koyu tema kaldırıldı, başlıklar Manrope 800 oldu (Fraunces arayüzden çıktı; PDF raporda hâlâ kullanılıyor). Yeni yapışkan menü ve mega menü, lacivert footer; landing 10 bölüm: hero (AdScope'un kendi örnek reklamlarından HTML kolaj, gerçek motor skorlarıyla), sektör şeridi, ihtiyaç sekmeleri, 4 özellik bloğu, gerçek rapor maketi, nasıl çalışır + kaynak şeridi, araç ızgarası ve ajans bandı, fiyat özeti, SSS, kapanış bandı. Kullanıcı sayısı, müşteri logosu, yorum ve puan rozeti bilerek yok. Demo e2e (masaüstü + mobil, axe dahil) geçti; `theme.spec.ts` artık açık temada 8 sayfayı denetliyor. Panel sayfaları yeni renkleri aldı ama yerleşimleri henüz yenilenmedi (TASARIM_YONU.md Oturum 3).

Panel kabuğu (P6.3 Oturum 1, 17.11.2026): `docs/PANEL_TASARIMI.md`'ye göre panelin çerçevesi yenilendi. 264px sabit sol menü beş grupta (Pano / Kontrol et / Düzelt / Planla / Yönet), altta kredi kartı, e-posta, Ayarlar ve Çıkış. Üst çubukta konum izi, Ctrl+K hızlı geçiş (komut paleti: sayfalar ve eylemler, ok tuşları ve Enter), kredi çipi (2 ve altında sarı) ve Yeni analiz düğmesi. Mobilde üst çubuk + açılır menü ve alt çubuk (Pano, Raporlar, ortada +, İtiraz, Menü). Eski `panel-nav.tsx` kaldırıldı. Marka seçici henüz yok (sonraki oturumlarda). Demo e2e (masaüstü + mobil, axe dahil) 55/55 geçti.

Pano ve Raporlar (P6.3 Oturum 2, 17.11.2026): Pano'da 4 özet kartı gerçek veriden (kalan kredi, İstanbul takvim ayına göre bu ay yapılan analiz, son 10 tamamlanmış analizin ortalama ret riski, yüksek riskli rapor sayısı; veri yoksa "—"), kural güncellemesi kutusu, maliyetli 4 hızlı başlat kutusu, son 6 rapor kartı ve en yakın 3 sezon günü ("Şablonla başla"). Hiç analiz yoksa 4 adımlı "Başlarken" listesi çıkar; marka ve ekip adımları gerçek veriden işaretlenir, "İlk kontrol" ve "Raporu indir" analiz olmadığı için doğal olarak açık kalır. Raporlar (`/panel/gecmis`): ızgara/liste görünümü, metin araması ve marka/platform/risk süzgeçleri ile sıralama URL parametresiyle (`q`, `marka`, `platform`, `risk`, `sirala`, `gorunum`; bilinmeyen değerler yok sayılır), kreatif küçük resimli kartlar, üç nokta menüsü (PDF, sil), toplu seçim, onay diyaloğuyla toplu silme ve CSV (formül enjeksiyonuna karşı korumalı, hukuki uyarı sütunlu). `AnalysisSummary`'ye `brandId` eklendi (bellek ve Supabase deposu birlikte; yeni tablo/izin yok). Sihirbaz `?tur=video` ile video modunda açılır. Yeni birim testi `tests/unit/panel-reports.test.ts` (süzgeç ayrıştırma, süzme, İstanbul ayı, CSV) ve yeni e2e (özet sayıları, süzgeçler, boş durum, liste görünümü + axe, toplu CSV ve silme); başka kullanıcının raporunun görünmediği test yeni boş durum metniyle sürüyor. 104 birim testi ve demo e2e (masaüstü + mobil) 57/57 geçti. Supabase modunda e2e bu turda çalıştırılmadı.

## Varsayımlar (doğrulanmalı)

1. Fiyatlar (Başlangıç 199 ₺ / 30, Profesyonel 499 ₺ / 100) konsept belgesinden alındı; KDV dahil tüketici fiyatı varsayıldı.
2. Meta için skor ağırlıkları (kırmızı 40, sarı 20, sektör tabanı 5/15) ürün kararıdır; Meta'nın gerçek inceleme sistemiyle kalibre edilmedi.
3. Anthropic API verisinin model eğitiminde kullanılmadığı, sağlayıcının ticari koşullarına dayanıyor; sözleşme sürümü yayın öncesinde kontrol edilmeli.
4. Yasal sayfalar (gizlilik, KVKK, koşullar) taslaktır; veri sorumlusu bilgisi yer tutucu.
5. Saklama süresi varsayılanı 90 gün; kullanıcı 7–365 gün arası seçebilir.
6. Görsel metni (OCR) yapay zekâ kapalıyken okunmaz; görseldeki ifadeler yalnızca yapay zekâ açıkken değerlendirilir. Aynısı video kareleri için de geçerli.
7. Video için 6 kare (3'ü ilk 3 saniyeden), en uzun video 10 dakika, video analizi 2 kredi, konuşma çevirisi için ilk 90 saniye ürün kararıdır.
8. Ajans modunda ekip üyeleri yalnızca görüntüleyicidir (analiz başlatamaz); ekip başına 10 üye, kullanıcı başına 5 API anahtarı ve 200 pano kaydı ürün kararıdır.
9. Ücretsiz kontrol 10 dakikada 10 istek, API dakikada 30 istek sınırı ürün kararıdır.
10. Sezon takviminde hazırlık (yayından 14 gün önce), incelemeye gönderme (yayından 3 gün önce) ve dönem başına yayın süresi ürün varsayımıdır; Meta'nın inceleme süresi taahhüdü değildir.

## Üretime geçmeden önce

1. Bir hukukçu tüm kural kartlarını ve yasal sayfaları incelesin; `legal_review_status` güncellensin.
2. Resmî Gazete metni ve mevzuat.gov.tr'den madde numaraları teyit edilsin; `requires_review` kartlar doğrulanırsa `active` yapılsın, yeni sürüm olarak eklensin.
3. Takviye gıda karşılaştırmalı reklam çelişkisi çözülsün.
4. Supabase projesi açılsın, migration'lar uygulansın (`supabase link` + `supabase db push`), Auth'ta e-posta doğrulaması açık kalsın, SMTP sağlayıcısı ayarlansın, "Site URL" ve yönlendirme adresleri girilsin.
5. Ödeme sağlayıcısı seçilip hesap açılsın; webhook adresi `https://<alan-adı>/api/webhooks/lemonsqueezy` olarak tanımlansın; iade/cayma metni koşullara eklensin.
6. Shopier kullanılacaksa resmî callback belgesine göre `src/lib/payments/shopier.ts` yeniden yazılsın.
7. `ANTHROPIC_API_KEY` eklenip örnek reklamlarla kalite ve maliyet ölçülsün.
8. `CRON_SECRET` ayarlanıp günlük saklama temizliği zamanlansın.
9. Bellek içi hız sınırlayıcı tek sunucu içindir; çok örnekli dağıtımda Postgres tabanlı saatlik sınır zaten devrede, dakikalık sınır için paylaşımlı bir depo (ör. Upstash) değerlendirilsin.
10. Hata izleme (ör. Sentry) eklenirse reklam içeriği ve kişisel veri gönderilmeyecek şekilde filtrelensin.
11. Alan adı, KVKK VERBİS yükümlülüğü ve fatura süreci netleşsin.
12. Ramazan ve Kurban Bayramı tarihleri Diyanet'in resmî takviminden teyit edilsin, sonraki yıllar eklensin (`src/lib/calendar/season.ts` → `RELIGIOUS_HOLIDAYS`).
13. Açılış sayfası taraması sunucunun ağından çıkar; üretimde çıkış trafiği bir egress proxy veya ayrı ağ üzerinden sınırlandırılabilir.
14. Konuşma tanıma sağlayıcısı seçilip `SPEECH_TO_TEXT_API_KEY` girilsin; Türkçe doğruluğu örnek videolarla ölçülsün, veri işleme sözleşmesi KVKK metnine eklensin.
15. Resend hesabı açılıp alan adı doğrulansın, `RESEND_API_KEY`/`EMAIL_FROM` girilsin ve `/api/cron/season-reminders` günlük zamanlansın.
16. 17.11.2026'da eklenen kural kartlarının (genel 17, sektör paketleri 13, Google Ads 5, TikTok 5) resmî metinleri okunup doğrulananlar `active` yapılsın.
17. `META_AD_LIBRARY_TOKEN` alınsın (Meta geliştirici uygulaması + kimlik doğrulaması); uzun ömürlü anahtar yaklaşık 60 günde yenilenmeli.
18. `/api/cron/newsletter` ayda bir zamanlansın; bülten metni bir hukukçuya gösterilsin.
19. Ücretsiz kontrol ve API hız sınırları bellek içidir; çok örnekli dağıtımda paylaşımlı depoya taşınsın. Ücretsiz kontrol için bot koruması (ör. Cloudflare Turnstile) değerlendirilsin.
20. Tarayıcı eklentisi mağazada yayımlanacaksa geliştirici hesabı açılsın, gizlilik politikası bağlantısı eklensin.
21. Uyarı geri bildirimleri için kural sahibinin okuyacağı bir yönetim görünümü eklensin.

## Bitti

17.11.2026 (3): toplu kontrol, kurallar değişince eski reklamları yeniden tarama, raporu e-postayla gönderme, hesap kısıtlaması adım adım rehberi, ajans paketi (400 kredi). Birim + entegrasyon 121/121; yeni uçtan uca testler demo ve Supabase modunda geçti.

17.11.2026 (2): sektör paketleri (kozmetik, kurs/eğitim, emlak, finans), WhatsApp/DM şablonu, varyantları CSV olarak dışa aktarma, sunucu tarafı markalı PDF, uyarı geri bildirimi, ajans modu (markalar, ekip, avukat inceleme bağlantısı), Google Ads ve TikTok kural setleri, kurumsal API, ücretsiz "Reklamım reddedilir mi?" sayfası, aylık mevzuat bülteni, Meta Reklam Kütüphanesi ilham panosu, tarayıcı eklentisi. Yeni tablolarda istemci rollerinin genel yetkileri kaldırıldı.

17.11.2026: video kanca analizi (6 kare, ses ölçümü, onaylı konuşma çevirisi, kanca/altyazı/güvenli alan incelemesi), video 2 kredi, açılış sayfası ekran görüntüsü yedeği ve JavaScript sayfası tespiti, sezon takviminde kampanya şablonları, okula dönüş, analizde sezon notu ve e-posta hatırlatmaları, kural kartları 23'ten 40'a.

Video/Reels analizi, açılış sayfası taraması ve sezon takvimi (MVP sonrası). Pazarlama sitesi (ana sayfa, nasıl çalışır, fiyatlandırma, kural kartları), giriş/kayıt ve onaylar, başlangıç ayarı, pano, 7 adımlı analiz sihirbazı, sonuç sayfası (3 skor, bulgular, kaynak bağlantıları, skor dökümü, güvenli metin, 5 varyant), yazdırılabilir rapor, itiraz asistanı, geçmiş ve silme, krediler ve defter, ayarlar ve hesap silme, gizlilik/KVKK/koşullar taslakları, demo modu, ödeme adaptörleri, webhook ve saklama uç noktaları.

## Sonraya (backlog)

Kapsam dışı (ürün kararı, 17.11.2026):

- **Meta reklam hesabı bağlama ve gerçek kampanya verisi:** şirket kurulmadan Meta uygulama incelemesi ve işletme doğrulaması yapılamıyor.
- **iyzico:** kullanılmayacak. Ödeme sağlayıcısı şimdilik **Shopier**; adaptör iskeleti hazır, resmî callback belgesi okunup imza doğrulaması yazılınca açılacak.
- **ikas ve Ticimax entegrasyonu:** iş ortaklığı planlanmıyor.

Yapılmayan PDF maddesi: **Reklam Kurulu ilke kararları** kural tabanına eklenmedi; resmî karar metinleri okunmadan kart yazmak uydurma kaynak riski taşıyor. Ajans paketi şimdilik tek seferlik kredi paketidir; aylık otomatik yenileme ödeme sağlayıcısı (Shopier) bağlanınca eklenecek.

Diğer: şifre sıfırlama ekranı, uyarı geri bildirimleri için yönetim görünümü, API için OpenAPI belgesi.
