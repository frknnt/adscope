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
| PDF rapor | Tarayıcının "PDF olarak kaydet" yazdırma akışı (yazdırmaya özel stil). Sunucu tarafı PDF üretimi yok. |
| Video / Reels analizi | **Gerçek.** 6 kare (3'ü ilk 3 saniyeden) tarayıcıda çıkarılır, sunucuda imzasından doğrulanır, özel depoda saklanır. Ses tarayıcıda ölçülür (başlangıç anı, sessiz oran). 2 kredi; maliyet her analizde `credit_cost` olarak saklanır ve `complete_analysis` tam o kadar düşer. Tarayıcının açamadığı formatlar (çoğu zaman MOV/HEVC) için MP4 (H.264) önerilir. |
| Video kanca incelemesi (kanca puanı, altyazı, sessiz izleme, güvenli alan) | **Yapay zekâ gerekir.** Anthropic adaptöründen şemayla istenir; anahtar yokken raporda "Değerlendirilmedi" yazar. Gerçek API ile denenmedi. |
| Konuşmayı yazıya dökme | **Adaptör hazır, anahtar yok.** OpenAI uyumlu `/v1/audio/transcriptions`; yerel sahte sunucuyla birim ve uçtan uca test edildi, gerçek hizmetle denenmedi. Kullanıcı onayı olmadan ses gönderilmez. |
| Açılış sayfası taraması | **Gerçek.** Sunucu tarafında tek istek; JavaScript çalıştırılmaz. JavaScript ile çizilen sayfalar tespit edilir. Ekran görüntüsü yedeği saklanır; metnini okumak yapay zekâ gerektirir. |
| Sezon hatırlatma e-postaları | **Adaptör hazır, hesap yok.** Resend adaptörü sahte sunucuyla test edildi; anahtar yokken demo modunda bellek kutusuna yazar, production'da göndermez. Zamanlayıcı kurulmadı. |
| Kampanya şablonları ve analizde sezon notu | **Gerçek.** Her şablon testte kural motorundan kırmızı/sarı bayraksız geçer. Sezon notu yalnızca bilgilendirmedir, skoru değiştirmez. |
| Sezon takvimi | **Hesaplanan.** Sabit ve kurala bağlı günler koddan hesaplanır. Ramazan ve Kurban Bayramı 2026–2027 tarihleri ikincil kaynaklardan alındı, **Diyanet'le doğrulanmadı**; 2028 ve sonrası eklenmedi. "Okula dönüş" eylülün ikinci pazartesi varsayılır, **MEB takvimiyle doğrulanmadı**. |
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
| Production build | `next build` temiz (uyarı yok) |
| Veritabanı danışmanı | `supabase db advisors`: güvenlik/performans sorunu yok; yalnızca yeni veritabanında kullanılmamış indeks bilgileri |

Son çalıştırma (17.11.2026, video kanca analizi, sezon şablonları ve 40 kural kartından sonra): birim + entegrasyon 93/93, uçtan uca 69 geçti + 1 bilerek atlandı (demo masaüstü, demo mobil, Supabase masaüstü); yalnızca axe'nin sayfa başlığı yüklenmeden çalıştığı bir zamanlama hatası çıktı, test başlığı bekleyecek şekilde düzeltildi ve ilgili dosya iki kez tekrarlanarak 36/36 geçti. `next build` temiz, `supabase db advisors` sorun bulmadı. E2E projeleri ayrı `X-Forwarded-For` adresleriyle kaydolur; böylece IP başına kayıt sınırı projeler arasında paylaşılmaz.

## Varsayımlar (doğrulanmalı)

1. Fiyatlar (Başlangıç 199 ₺ / 30, Profesyonel 499 ₺ / 100) konsept belgesinden alındı; KDV dahil tüketici fiyatı varsayıldı.
2. Meta için skor ağırlıkları (kırmızı 40, sarı 20, sektör tabanı 5/15) ürün kararıdır; Meta'nın gerçek inceleme sistemiyle kalibre edilmedi.
3. Anthropic API verisinin model eğitiminde kullanılmadığı, sağlayıcının ticari koşullarına dayanıyor; sözleşme sürümü yayın öncesinde kontrol edilmeli.
4. Yasal sayfalar (gizlilik, KVKK, koşullar) taslaktır; veri sorumlusu bilgisi yer tutucu.
5. Saklama süresi varsayılanı 90 gün; kullanıcı 7–365 gün arası seçebilir.
6. Görsel metni (OCR) yapay zekâ kapalıyken okunmaz; görseldeki ifadeler yalnızca yapay zekâ açıkken değerlendirilir. Aynısı video kareleri için de geçerli.
7. Video için 6 kare (3'ü ilk 3 saniyeden), en uzun video 10 dakika, video analizi 2 kredi, konuşma çevirisi için ilk 90 saniye ürün kararıdır.
8. Sezon takviminde hazırlık (yayından 14 gün önce), incelemeye gönderme (yayından 3 gün önce) ve dönem başına yayın süresi ürün varsayımıdır; Meta'nın inceleme süresi taahhüdü değildir.

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
16. 17.11.2026'da eklenen 17 kural kartının resmî metinleri okunup doğrulananlar `active` yapılsın.

## Bitti

17.11.2026: video kanca analizi (6 kare, ses ölçümü, onaylı konuşma çevirisi, kanca/altyazı/güvenli alan incelemesi), video 2 kredi, açılış sayfası ekran görüntüsü yedeği ve JavaScript sayfası tespiti, sezon takviminde kampanya şablonları, okula dönüş, analizde sezon notu ve e-posta hatırlatmaları, kural kartları 23'ten 40'a.

Video/Reels analizi, açılış sayfası taraması ve sezon takvimi (MVP sonrası). Pazarlama sitesi (ana sayfa, nasıl çalışır, fiyatlandırma, kural kartları), giriş/kayıt ve onaylar, başlangıç ayarı, pano, 7 adımlı analiz sihirbazı, sonuç sayfası (3 skor, bulgular, kaynak bağlantıları, skor dökümü, güvenli metin, 5 varyant), yazdırılabilir rapor, itiraz asistanı, geçmiş ve silme, krediler ve defter, ayarlar ve hesap silme, gizlilik/KVKK/koşullar taslakları, demo modu, ödeme adaptörleri, webhook ve saklama uç noktaları.

## Sonraya (backlog, arayüzde "Yakında")

Meta Reklam Kütüphanesi panosu, ajans çalışma alanı ve ekipler, Meta hesabı bağlama, gerçek kampanya verisi, Google Ads ve TikTok desteği, sunucu tarafı PDF, varyantları CSV olarak dışa aktarma, şifre sıfırlama ekranı.
