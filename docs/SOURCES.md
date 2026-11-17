# Doğrulanmış kaynaklar ve kural kartı durumu

Doğrulama tarihi: **16.11.2026**. Bu liste `src/lib/rules/catalog.ts` dosyasının özetidir; tek doğru kaynak o dosyadır ve `supabase/seed.sql` ondan üretilir (`npm run db:seed:generate`).

## Durum kuralı

| Durum | Anlamı | Motor ne yapar |
|---|---|---|
| `active` | Kuralın özü resmî kaynak sayfasında okundu. | Kırmızı veya sarı bayrak üretebilir, skorları etkiler. |
| `requires_review` | Yaygın olarak aktarılıyor ama resmî metin bu ortamdan okunamadı. | Yalnızca "Bilgilendirme" üretir, "doğrulanmadı" etiketi taşır, ihlal sayılmaz, skoru değiştirmez. |
| `draft` | Kaynağı bulunamadı. | Hiç kullanılmaz; istemciye de gösterilmez (RLS). |

Hiçbir kart henüz bir hukukçu tarafından incelenmedi (`legal_review_status = pending`).

## Okunan resmî kaynaklar

| Kaynak | Adres | Ne için kullanıldı |
|---|---|---|
| T.C. Ticaret Bakanlığı duyurusu, 01.07.2026 | https://ticaret.gov.tr/haberler/ticaret-bakanligi-tarafindan-ticari-reklam-ve-haksiz-ticari-uygulamalar-yonetmeliginde-yapilan-degisikliklerle-tuketicilerin-aldatici-reklam-ve-ticari-uygulamalara-karsi-korunmasi-guclendiriliyor | Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği değişikliği (RG 01.07.2026, sayı 33297; yürürlük 01.08.2026): indirim referans fiyatı, şartlı indirim, etkileyici "Reklam" ibaresi, yapay zekâ karakter ve dijital kopya açıklaması, genel çevre beyanları, akademik unvan, tüketici yorumları, takviye gıda hükümleri. |
| Meta Advertising Standards: Unrealistic outcomes | https://transparency.meta.com/policies/ad-standards/deceptive-content/unrealistic-outcomes | Süreli sonuç vaadi, niteleyicisiz sağlık iddiası, tedavi iddiası, sansasyonel dil. |
| Meta Advertising Standards: Personal health and appearance | https://transparency.meta.com/policies/ad-standards/objectionable-content/personal-health-and-appearance | Olumsuz beden algısı, önce/sonra görselleri. |

## Okunamayan kaynaklar (kartlar `requires_review` veya `draft`)

| Kaynak | Durum |
|---|---|
| Resmî Gazete metni (https://www.resmigazete.gov.tr/eskiler/2026/07/20260701-9.htm) | Bu ortamdan erişim engelli. Madde numaraları Bakanlık duyurusundaki karşılaştırma tablosundan alındı; RG metniyle teyit edilmeli. |
| mevzuat.gov.tr (6502 sayılı Kanun) | Erişim engelli. Üstünlük iddiası ve "ücretsiz" kuralları bu yüzden doğrulama bekliyor / taslak. |
| Sağlık Bakanlığı yönetmelik sayfası | Estetik/klinik sektörü için önce/sonra ve fiyat kampanyası kuralları doğrulama bekliyor. |
| Tarım ve Orman Bakanlığı (takviye gıda) | Erişim engelli. Sağlık beyanı kuralı doğrulama bekliyor. |
| Meta: Personal attributes, Health and wellness | Sayfalar istemci tarafında oluşturulduğu için metin okunamadı. |

### Açık çelişki

Takviye gıdalarda karşılaştırmalı reklam: Bakanlık duyurusu sağlık beyanı dışında karşılaştırmaya izin verildiğini söylüyor, karşılaştırma tablosu ise yasak gösteriyor. `TR-RY-TAKVIYE-KARSILASTIRMA` kartının `verificationNote` alanında not edildi; hukukçu teyidi gerekli.

## Kartlar

| Kimlik | Durum | Kaynak | Atıf | Yürürlük |
|---|---|---|---|---|
| META-UO-TIMEFRAME | active | Meta | Unrealistic outcomes: results within specific timeframes | — |
| META-UO-HEALTH-QUALIFIER | active | Meta | Unrealistic health claims without qualifier | — |
| META-UO-CURE | active | Meta | Cures for incurable diseases | — |
| META-UO-CLICKBAIT | active | Meta | Sensational language | — |
| META-PHA-NEGATIVE-SELF | active | Meta | Negative self-perception | — |
| META-PHA-BEFORE-AFTER | active | Meta | Before/after weight-loss images | — |
| META-PA-PERSONAL-ATTRIBUTES | requires_review | Meta | — | — |
| META-HW-RESTRICTED | requires_review | Meta | — | — |
| TR-RY-INDIRIM-REFERANS | active | Ticaret Bakanlığı | Yönetmelik md. 14/3 (değişik) | 01.08.2026 |
| TR-RY-SARTLI-INDIRIM | active | Ticaret Bakanlığı | md. 14/7 (yeni) | 01.08.2026 |
| TR-RY-ETKILEYICI-IBARE | active | Ticaret Bakanlığı | md. 23/A (yeni) | 01.08.2026 |
| TR-RY-YZ-KARAKTER | active | Ticaret Bakanlığı | md. 18/8 (yeni) | 01.08.2026 |
| TR-RY-YZ-DIJITAL-KOPYA | active | Ticaret Bakanlığı | md. 27/12 (yeni) | 01.08.2026 |
| TR-RY-CEVRE-GENEL | active | Ticaret Bakanlığı | md. 17/5-6 (yeni) | 01.08.2026 |
| TR-RY-AKADEMIK-UNVAN | active | Ticaret Bakanlığı | md. 7/5-g (değişik) | 01.08.2026 |
| TR-RY-TUKETICI-YORUM | active | Ticaret Bakanlığı | md. 28/B (değişik) | 01.08.2026 |
| TR-RY-TAKVIYE-BESLENME | active | Ticaret Bakanlığı | md. 27/10 (yeni) | 01.08.2026 |
| TR-RY-TAKVIYE-KARSILASTIRMA | active | Ticaret Bakanlığı | md. 8/3 (değişik) | 01.08.2026 |
| TR-6502-USTUNLUK | requires_review | Mevzuat Bilgi Sistemi | 6502 md. 61 (teyit edilmedi) | — |
| TR-RY-SAGLIK-BEYANI | requires_review | Resmî Gazete | Ek liste md. 13 (ikincil kaynak) | 01.08.2026 |
| TR-ESTETIK-ONCE-SONRA | requires_review | Sağlık Bakanlığı | — | — |
| TR-ESTETIK-FIYAT-KAMPANYA | requires_review | Sağlık Bakanlığı | — | — |
| META-FIN-HIZLI-KAZANC | requires_review | Meta (genel standartlar sayfası) | Deceptive content / financial claims | — |
| META-KRIPTO | requires_review | Meta | Restricted: cryptocurrency | — |
| META-KUMAR | requires_review | Meta | Restricted: online gambling and gaming | — |
| META-TUTUN-VAPE | requires_review | Meta | Prohibited: tobacco and related products | — |
| META-ETKILESIM-TUZAGI | requires_review | Meta | Engagement bait | — |
| META-RECETELI-ILAC | requires_review | Meta | Restricted: prescription drugs | — |
| META-ARKADASLIK | requires_review | Meta | Restricted: dating | — |
| META-CINSEL-SAGLIK | requires_review | Meta | Adult products or services | — |
| TR-ALKOL-REKLAM | requires_review | Mevzuat Bilgi Sistemi | 4250 s. Kanun ek madde | — |
| TR-TUTUN-REKLAM | requires_review | Mevzuat Bilgi Sistemi | 4207 s. Kanun md. 3 | — |
| TR-RY-COCUK-DOGRUDAN | requires_review | Resmî Gazete | Ticari Reklam Yönetmeliği, çocuklar | — |
| TR-RY-KARSILASTIRMALI | requires_review | Resmî Gazete | Ticari Reklam Yönetmeliği, karşılaştırmalı reklam | — |
| TR-RY-ACELE-BASKISI | requires_review | Resmî Gazete | Ek liste (yanıltıcı süre/stok) | — |
| TR-RY-RESMI-ONAY | requires_review | Resmî Gazete | Ek liste (onay iddiası) | — |
| TR-ORGANIK | requires_review | Mevzuat Bilgi Sistemi | 5262 s. Kanun | — |
| TR-TAKVIYE-ILAC-IZLENIMI | requires_review | Resmî Gazete | Takviye gıda reklamları | — |
| TR-ESTETIK-RISKSIZ | requires_review | Resmî Gazete | Sağlık hizmetleri tanıtımı | — |
| TR-RY-UCRETSIZ | draft | Mevzuat Bilgi Sistemi | — | — |

17.11.2026'da eklenen 17 kartın hiçbirinin resmî metni bu güncellemede okunmadı; madde numaraları "teyit edilmedi" olarak işaretli. Hepsi yalnızca bilgilendirme üretir, risk seviyesini değiştirmez.

## Sektör paketleri ve Google Ads / TikTok kartları (17.11.2026)

Kozmetik, kurs/eğitim, emlak ve finans sektör paketleri ile Google Ads ve TikTok politika kartları eklendi. **Hepsi `requires_review`:** yalnızca bilgilendirme üretirler, skoru değiştirmezler, ihlal olarak gösterilmezler.

Google ve TikTok politika sayfaları bu ortamdaki vekil sunucudan okunamadı (403). Adreslerin doğru ve güncel olduğu arama sonuçlarıyla teyit edildi; kuralların özü genel bilinen politika başlıklarından yazıldı ve her kartta "bölüm teyit edilmedi" notu var.

| Kaynak | Adres |
|---|---|
| Google Ads: Misrepresentation | https://support.google.com/adspolicy/answer/6020955 |
| Google Ads: Unreliable claims | https://support.google.com/adspolicy/answer/15936857 |
| Google Ads: Healthcare and medicines | https://support.google.com/adspolicy/answer/176031 |
| Google Ads: Editorial | https://support.google.com/adspolicy/answer/6021546 |
| Google Ads: Financial services | https://support.google.com/adspolicy/answer/2464998 |
| TikTok Advertising Policies | https://ads.tiktok.com/help/article/tiktok-advertising-policies |
| TikTok: Weight management | https://ads.tiktok.com/help/article/tiktok-ads-policy-weight-management |
| TikTok: Misleading and false content | https://ads.tiktok.com/help/article/tiktok-ads-policy-misleading-and-false-content |
| TikTok: Healthcare and pharmaceuticals | https://ads.tiktok.com/help/article/tiktok-ads-policy-healthcare-and-pharmaceuticals |

| Kimlik | Durum | Kaynak | Atıf | Sektör / platform |
|---|---|---|---|---|
| META-OZEL-KAT-KONUT | requires_review | Meta Platforms | Special ad categories: housing (bölüm teyit edilmedi) | emlak |
| META-OZEL-KAT-KREDI | requires_review | Meta Platforms | Special ad categories: credit / financial products (bölüm teyit edilmedi) | finans |
| META-OZEL-KAT-ISTIHDAM | requires_review | Meta Platforms | Special ad categories: employment (bölüm teyit edilmedi) | genel |
| TR-EGITIM-BASARI-GARANTI | requires_review | T.C. Resmî Gazete | Ticari Reklam Yönetmeliği, aldatıcı reklam (madde numarası teyit edilmedi) | kurs_egitim |
| TR-EGITIM-IS-GARANTI | requires_review | T.C. Resmî Gazete | Ticari Reklam Yönetmeliği, aldatıcı reklam (madde numarası teyit edilmedi) | kurs_egitim |
| TR-EGITIM-SERTIFIKA | requires_review | T.C. Resmî Gazete | Yönetmelik eki haksız ticari uygulamalar listesi (onay iddiası; teyit edilmedi) | kurs_egitim |
| TR-EMLAK-YETKI-BELGESI | requires_review | T.C. Mevzuat Bilgi Sistemi | Taşınmaz Ticareti Hakkında Yönetmelik (madde numarası teyit edilmedi) | emlak |
| TR-EMLAK-GETIRI | requires_review | T.C. Resmî Gazete | Ticari Reklam Yönetmeliği, aldatıcı reklam (madde numarası teyit edilmedi) | emlak |
| TR-KOZMETIK-TIBBI | requires_review | T.C. Sağlık Bakanlığı Türkiye İlaç ve Tıbbi Cihaz Kurumu | Kozmetik Yönetmeliği, ürün iddiaları (madde numarası teyit edilmedi) | kozmetik |
| TR-KOZMETIK-KANIT | requires_review | T.C. Sağlık Bakanlığı Türkiye İlaç ve Tıbbi Cihaz Kurumu | Kozmetik ürün iddiaları (teyit edilmedi) | kozmetik |
| TR-FINANS-GETIRI | requires_review | T.C. Mevzuat Bilgi Sistemi | 6362 s. Kanun ve SPK reklam düzenlemeleri (madde numarası teyit edilmedi) | finans |
| TR-FINANS-LISANS | requires_review | T.C. Mevzuat Bilgi Sistemi | 6362 s. Kanun, izinsiz sermaye piyasası faaliyeti (teyit edilmedi) | finans |
| TR-KREDI-MALIYET | requires_review | T.C. Mevzuat Bilgi Sistemi | Tüketici Kredisi Sözleşmeleri Yönetmeliği, reklam (madde numarası teyit edilmedi) | finans |
| GADS-GUVENILMEZ-IDDIA | requires_review | Google | Misrepresentation → Unreliable claims (bölüm teyit edilmedi) | genel / google_ads |
| GADS-EDITORYAL-NOKTALAMA | requires_review | Google | Editorial → Punctuation and symbols (bölüm teyit edilmedi) | genel / google_ads |
| GADS-SAGLIK-ILAC | requires_review | Google | Healthcare and medicines (ülke tablosu teyit edilmedi) | takviye_gida / google_ads |
| GADS-FINANSAL-HIZMET | requires_review | Google | Financial services → country-specific requirements (Türkiye teyit edilmedi) | finans / google_ads |
| GADS-KISISEL-HITAP | requires_review | Google | Personalized advertising → sensitive categories (bölüm teyit edilmedi) | genel / google_ads |
| TT-KILO-YONETIMI | requires_review | TikTok | Weight Management (2026 güncellemesi teyit edilmedi) | takviye_gida / tiktok |
| TT-ONCE-SONRA | requires_review | TikTok | Weight Management / body image (bölüm teyit edilmedi) | genel / tiktok |
| TT-YANILTICI-IDDIA | requires_review | TikTok | Misleading and false content (bölüm teyit edilmedi) | genel / tiktok |
| TT-ESTETIK-ISLEM | requires_review | TikTok | Healthcare and Pharmaceuticals → cosmetic procedures (bölüm teyit edilmedi) | estetik_klinik / tiktok |
| TT-FINANSAL-HIZMET | requires_review | TikTok | Financial services (ülke tablosu teyit edilmedi) | finans / tiktok |

Toplam kart sayısı: 63.

## Meta Reklam Kütüphanesi API (17.11.2026)

İlham panosu Graph API `ads_archive` uç noktasını kullanır. Meta, siyasi olmayan (ticari) reklamları API üzerinden yalnızca AB'de gösterilmiş olanlar için açar; bu yüzden ülke listesi AB ülkeleriyle sınırlıdır ve Türkiye'ye özel reklamlar aranamaz. Erişim anahtarı için Meta geliştirici uygulaması ve kimlik doğrulaması gerekir. Gerçek API ile denenmedi; testler sahte sunucuyla yapıldı. `ad_snapshot_url` alanı erişim anahtarını içerdiği için hiç istenmez.

## Yazı tipleri

PDF raporda Manrope ve Fraunces gömülüdür. İkisi de SIL Open Font License 1.1 ile lisanslıdır; lisans metinleri `assets/fonts/OFL-Manrope.txt` ve `assets/fonts/OFL-Fraunces.txt` dosyalarındadır.

## Sezon takvimi tarihleri (16.11.2026)

| Tarih | Kaynak | Durum |
|---|---|---|
| Sevgililer Günü (14 Şubat), Dünya Kadınlar Günü (8 Mart), 23 Nisan, Öğretmenler Günü (24 Kasım), Yılbaşı, 11.11 | Sabit günler | Hesaplanır. |
| Anneler Günü (Mayıs'ın 2. pazarı), Babalar Günü (Haziran'ın 3. pazarı), Efsane Cuma (Kasım'ın son cuması), Siber Pazartesi (Efsane Cuma'dan sonraki pazartesi) | Yerleşik kural | Hesaplanır. |
| Ramazan Bayramı 2026: 20–22 Mart; 2027: 9–11 Mart (arife 8 Mart) | İkincil kaynaklar (yayımlanmış takvim siteleri, birbiriyle tutarlı) | **Doğrulanmadı.** Diyanet ve mevzuat.gov.tr bu ortamdan okunamadı. Arayüzde ve .ics'te uyarı var. |
| Kurban Bayramı 2026: 27–30 Mayıs; 2027: 16–19 Mayıs (arife 15 Mayıs) | İkincil kaynaklar | **Doğrulanmadı.** |

Takvimdeki uyum hatırlatmaları bulgu değildir; bağlı kural kartının durumu yanında gösterilir. Çocuklara yönelik reklamlar için `TR-RY-COCUK-DOGRUDAN` kartı eklendi ama doğrulama bekliyor; aktif kart yoktur. "Okula dönüş" tarihi eylülün ikinci pazartesi varsayılır ve MEB çalışma takvimiyle doğrulanmadı.

## Ödeme sağlayıcıları (16.11.2026)

| Sağlayıcı | Bulgu | Durum |
|---|---|---|
| Lemon Squeezy | Webhook imzası (`X-Signature`, ham gövdenin HMAC-SHA256 hex özeti) ve `order_created` olayı belgelerden okundu. Türkiye ödeme alınabilen ülkeler listesinde. Stripe'ın "merchant of record" ürününe geçiş duyurusu var; yeni kayıtların kapandığına dair bir ifade bulunamadı. Türkiye'deki bireysel satıcıların yeni hesap açıp açamayacağı bulunamadı. | Adaptör hazır, hesap bekliyor. |
| Shopier | Satıcı koşulları ve callback/API belgesi bu ortamdan okunamadı. Bireysel satıcıyı kabul ettiği ikincil kaynaklarda geçiyor. | Yalnızca iskelet; imza şeması yer tutucu. Resmî belge okunmadan açılmamalı. |
| iyzico, Stripe | Şirket kaydı istiyor; ürün kararıyla ödeme sağlayıcısı şimdilik Shopier. | Kapsam dışı. |
