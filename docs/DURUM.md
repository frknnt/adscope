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
| Video / Reels analizi | **Gerçek.** Kareler tarayıcıda çıkarılır, sunucuda imzasından doğrulanır, özel depoda saklanır. Tarayıcının açamadığı formatlar (çoğu zaman MOV/HEVC) için MP4 (H.264) önerilir. Ses ve konuşma otomatik çözümlenmez; kullanıcı yazar. |
| Açılış sayfası taraması | **Gerçek.** Sunucu tarafında tek istek; JavaScript çalıştırılmaz, giriş/çerez onayı arkasındaki içerik görülmez. |
| Sezon takvimi | **Hesaplanan.** Sabit ve kurala bağlı günler koddan hesaplanır. Ramazan ve Kurban Bayramı 2026–2027 tarihleri ikincil kaynaklardan alındı, **Diyanet'le doğrulanmadı**; 2028 ve sonrası eklenmedi. |
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
| Production build | `next build` temiz (uyarı yok) |
| Veritabanı danışmanı | `supabase db advisors`: güvenlik/performans sorunu yok; yalnızca yeni veritabanında kullanılmamış indeks bilgileri |

Son çalıştırma (16.11.2026, video/açılış sayfası/takvim eklendikten sonra): birim + entegrasyon 65/65, uçtan uca 65/65 (demo masaüstü, demo mobil, Supabase masaüstü; 1 mobil klavye testi bilerek atlandı). Uzun süre açık kalan bir demo sunucusu yeniden kullanılırsa kayıt hız sınırı (IP başına 10 dakikada 20) dolabilir; temiz sunucuyla çalıştırın.

## Varsayımlar (doğrulanmalı)

1. Fiyatlar (Başlangıç 199 ₺ / 30, Profesyonel 499 ₺ / 100) konsept belgesinden alındı; KDV dahil tüketici fiyatı varsayıldı.
2. Meta için skor ağırlıkları (kırmızı 40, sarı 20, sektör tabanı 5/15) ürün kararıdır; Meta'nın gerçek inceleme sistemiyle kalibre edilmedi.
3. Anthropic API verisinin model eğitiminde kullanılmadığı, sağlayıcının ticari koşullarına dayanıyor; sözleşme sürümü yayın öncesinde kontrol edilmeli.
4. Yasal sayfalar (gizlilik, KVKK, koşullar) taslaktır; veri sorumlusu bilgisi yer tutucu.
5. Saklama süresi varsayılanı 90 gün; kullanıcı 7–365 gün arası seçebilir.
6. Görsel metni (OCR) yapay zekâ kapalıyken okunmaz; görseldeki ifadeler yalnızca yapay zekâ açıkken değerlendirilir. Aynısı video kareleri için de geçerli.
7. Video için 5 kare, en uzun video 10 dakika ve yapay zekâya en fazla 4 kare gönderimi ürün kararıdır.
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

## Bitti

Video/Reels analizi, açılış sayfası taraması ve sezon takvimi (MVP sonrası). Pazarlama sitesi (ana sayfa, nasıl çalışır, fiyatlandırma, kural kartları), giriş/kayıt ve onaylar, başlangıç ayarı, pano, 7 adımlı analiz sihirbazı, sonuç sayfası (3 skor, bulgular, kaynak bağlantıları, skor dökümü, güvenli metin, 5 varyant), yazdırılabilir rapor, itiraz asistanı, geçmiş ve silme, krediler ve defter, ayarlar ve hesap silme, gizlilik/KVKK/koşullar taslakları, demo modu, ödeme adaptörleri, webhook ve saklama uç noktaları.

## Sonraya (backlog, arayüzde "Yakında")

Meta Reklam Kütüphanesi panosu, ajans çalışma alanı ve ekipler, Meta hesabı bağlama, videoda otomatik konuşma çözümleme, gerçek kampanya verisi, Google Ads ve TikTok desteği, sunucu tarafı PDF, varyantları CSV olarak dışa aktarma, şifre sıfırlama ekranı.
