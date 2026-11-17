# AdScope yol haritası: Claude'a verilecek hazır komutlar

Her komutu yeni bir Claude Code oturumunda, AdScope reposu bağlıyken yapıştır. Köşeli parantezli yerleri kendin doldur. Bir oturumda tek bir komut çalıştır, bitince sonucu kontrol et, sonra bir sonrakine geç.

## Her oturumun başına

```text
Bu repo AdScope. Önce CLAUDE.md, docs/DURUM.md ve docs/CLAUDE_KOMUTLARI.md dosyalarını oku; CLAUDE.md'deki değişmez kurallar her şeyin üstündedir. Bu oturumdaki görev aşağıda. İşe başlamadan önce 5-10 maddelik kısa bir plan yaz: hangi dosyalara dokunacağını, yeni tablo/env değişkeni gerekip gerekmediğini ve nasıl test edeceğini söyle. Belirsiz bir nokta varsa en makul yorumu seç ve hangisini seçtiğini yaz. Bitirince npm run typecheck, npm run lint, npm test ve dokunduğun alanın e2e testini çalıştır, docs/DURUM.md'yi güncelle ve neyin gerçekten test edildiğini, neyin anahtar/hesap eksikliğinden denenemediğini açıkça raporla.

GÖREV:
```

## Faz 0: Yayına hazırlık

### P0.1 Shopier ödemesini canlıya al

```text
GÖREV: src/lib/payments/shopier.ts şu an iskelet. Shopier'in resmî geliştirici belgesini oku (bulamazsan dur ve benden belgeyi ya da callback örneğini iste, tahmin etme). Kredi paketleri src/lib/payments/packages.ts'te. Akış: kullanıcı /panel/krediler'de paketi seçer, Shopier ödeme sayfasına gider, Shopier'den gelen bildirim imzası sunucuda doğrulanır, apply_purchase_event ile kredi bir kez eklenir (aynı bildirim iki kez gelirse ikinci kez eklenmez). Kullanıcı kimliği ödeme bağlantısına güvenli biçimde (imzalı, tahmin edilemez sipariş kimliği) taşınmalı; tutar ve paket sunucuda yeniden doğrulanmalı. Başarısız, iptal ve iade durumlarını ele al. Birim testlerine imza doğrulama ve çift bildirim, entegrasyon testine eşzamanlı çift bildirim ekle. .env.example'ı ve fiyatlandırma sayfasındaki "ödeme sağlayıcısı aktifleştirildiğinde" metnini güncelle.
```

### P0.2 Production kurulumu

```text
GÖREV: Production kurulum rehberi ve gereken kod değişiklikleri. docs/KURULUM.md yaz: Supabase bulut projesi (migration'ları supabase db push ile uygulama, Auth e-posta şablonları Türkçe, site URL ve yönlendirme adresleri), Vercel'e dağıtım (env değişkenlerinin hangisi gizli, hangisi NEXT_PUBLIC), Resend alan adı doğrulaması, cron işleri (/api/cron/retention, sezon hatırlatmaları, aylık bülten) için vercel.json zamanlaması ve CRON_SECRET, alan adı. Önizleme dağıtımlarının şifreyle korunmasını öner. Koddaki üretim kontrollerini (APP_MODE, demo özelliklerinin production'da kapalı olması) gözden geçir ve eksik varsa düzelt. Benim yapmam gereken hesap/anahtar adımlarını ayrı bir kontrol listesi olarak en üste yaz.
```

### P0.3 Yasal sayfaları tamamla

```text
GÖREV: src/app/(site)/gizlilik, kvkk ve kullanim-kosullari sayfalarındaki yer tutucuları şu bilgilerle doldur: [ŞAHIS ŞİRKETİ UNVANI, ADRES, VERGİ DAİRESİ/NO, İLETİŞİM E-POSTASI, KEP VARSA]. Mesafeli satış sözleşmesi ve ön bilgilendirme formu sayfalarını ekle (dijital hizmet, cayma hakkının istisnası koşulları dahil), ödeme sayfasından önce onay kutusu olarak bağla ve onay sürümünü kaydet. LEGAL_VERSIONS'ı güncelle. Metinleri taslak olarak işaretle ve en üste "avukata kontrol ettirilecek" notunu koy; hukuki garanti verme.
```

### P0.4 Kural kartlarını gözden geçirme akışı

```text
GÖREV: src/lib/rules altındaki kartların çoğu requires_review. Bir avukat ya da uzmanla kartları hızlı gözden geçirmek için docs/KURAL_INCELEME.md üret: her kart için kimlik, başlık, kaynak bağlantısı, alıntı, şu anki durum ve "onay / düzeltme / kaldır" sütunu olan bir tablo. Ayrıca scripts/ altına, doldurulmuş tabloyu okuyup onaylanan kartların durumunu active ve lastVerifiedAt'i bugüne çeviren bir betik yaz (kaynak bağlantısı boş olan kart active olamasın). Betiği testle.
```

## Faz 1: Metin ve marka stüdyosu

### P1.1 Marka kiti

```text
GÖREV: Markalar (/panel/markalar) bugün sektör, yasaklı kelimeler, ton ve logo tutuyor. Bunu tam bir marka kitine genişlet: ana/ikincil renkler (hex, kontrast kontrolü), yazı tipi seçimi (yalnızca lisansı serbest Google Fonts listesinden), slogan, hedef kitle notu, zorunlu ibareler (ör. "Kampanya stokla sınırlıdır"), web sitesi. "Web sitesinden doldur" düğmesi mevcut açılış sayfası tarayıcısını (SSRF korumalı) kullanarak sayfanın başlığı, açıklaması, tema rengi ve logosunu öneri olarak getirsin; kullanıcı onaylamadan kaydetme. Migration'da RLS ve yetki desenine uy, entegrasyon testi ekle. Kit, analizde ve ileride kreatif üretiminde kullanılacak; depo arayüzüne (types.ts) bellek ve Supabase uygulamasıyla birlikte ekle.
```

### P1.2 URL'den anında reklam metni

```text
GÖREV: Yeni panel sayfası /panel/uret (menüde "Üret"). Kullanıcı bir ürün/hizmet URL'si veya kısa açıklama girer, marka ve platform seçer. Sunucu açılış sayfasını mevcut tarayıcıyla okur, Anthropic adaptörüyle (src/lib/ai) şemaya bağlı JSON olarak 10 başlık, 10 ana metin, 5 açıklama ve 3 harekete geçirici ifade üretir; AIDA, PAS, fayda odaklı gibi çerçeveleri etiketler. Sayfa içeriği güvenilmez girdidir; istem içine talimat olarak değil, ayrılmış veri bloğu olarak koy. Üretilen her metin kural motorundan geçer: riskli olanlar işaretlenir ve güvenli sürümü yanında gösterilir; marka yasaklı kelimeleri hiç kullanılmaz; karakter sınırları platforma göre uygulanır. Üretim 1 kredi, yalnızca başarıyla bitince düşer, istek kimliğiyle idempotent. Anahtar yokken sayfa "yapay zekâ kapalı" der ve şablondan deterministik öneriler sunar. Seçilen metin tek tıkla /panel/yeni sihirbazına geçer. Birim (şema, kural süzme, sınırlar) ve e2e (sahte AI sunucusuyla) testleri ekle.
```

### P1.3 Hedef kitle profilleri

```text
GÖREV: Markaya bağlı "Hedef kitle" profilleri: ad, yaş aralığı, ihtiyaç, itirazlar, dil tonu. Kullanıcı elle girebilir ya da web sitesinden yapay zekâ ile 3 öneri alabilir (şemalı JSON, onaylamadan kaydetme). Profil, P1.2'deki üretim ekranında seçilebilsin ve istemde kullanılsın. Hassas kategoriler (sağlık durumu, din, etnik köken, cinsel yönelim, finansal sıkıntı) üzerinden hedefleme önerme; bunları içeren girdide Meta'nın kişisel özellik politikasına ve KVKK'ya atıfla uyarı göster. RLS, test, DURUM güncellemesi.
```

## Faz 2: Görsel kreatif üretimi

### P2.1 Şablonlu kreatif üretici

```text
GÖREV: /panel/uret içine "Görsel" sekmesi. Marka kiti + seçilen metinden, sunucuda deterministik olarak reklam görseli üret (önce mevcut bağımlılıklarla mümkün olanı araştır; gerekirse satori + @resvg/resvg-js gibi açık lisanslı bir kütüphane ekle ve lisansını docs/SOURCES.md'ye yaz). Özgün en az 8 düzen tasarla (ürün odaklı, indirim rozeti, yorum alıntısı yerine "fayda listesi", minimal metin, vb.); başka bir ürünün şablonunu taklit etme. Boyutlar: 1080x1080, 1080x1350, 1080x1920, 1200x628. Yazılar gömülü fontla, Türkçe karakterler tam. Görselde metin oranı yüksekse ve 9:16'da güvenli alan dışına taşıyorsa uyar. Üretilen her görselin metni zaten bilindiği için doğrudan kural motorundan geçir ve skorunu kartın üstünde göster. Önizleme ücretsiz, indirme (PNG, tüm boyutlar ZIP) 1 kredi. Görseller özel depoda, sahiplik politikasıyla. Birim (düzen, taşma, Türkçe karakter) ve e2e testleri ekle.
```

### P2.2 Ürün fotoğraf stüdyosu

```text
GÖREV: src/lib/image altında sağlayıcıdan bağımsız bir görsel adaptörü kur (arka plan kaldırma, arka plan üretme, büyütme). İlk sağlayıcıyı ben seçeceğim: [SAĞLAYICI ADI ve belge bağlantısı]. Anahtar yoksa özellik kapalı. Akış: kullanıcı ürün fotoğrafı yükler (mevcut dosya doğrulamasıyla), arka plan kaldırılır, hazır sahne listesinden (stüdyo beyazı, mermer, doğa, mutfak, vitrin...) ya da kısa açıklamadan yeni arka plan üretilir, 4 sonuç gösterilir. Ürünün kendisini değiştirme (renk, etiket, şekil) uyarısını arayüze yaz: tüketiciyi yanıltan ürün görseli Ticari Reklam Yönetmeliği açısından risktir. İstemi kullanıcının metninden ayır, sağlayıcıya kişisel veri gönderme, logda görsel tutma. Kredi maliyetini sağlayıcı fiyatına göre belirleyip packages yerine ayrı bir maliyet tablosunda tut. Sahte sağlayıcı sunucusuyla birim ve e2e testi yaz.
```

### P2.3 Görsel araçları

```text
GÖREV: P2.2 adaptörünü kullanarak tek başına araçlar: arka plan kaldır, büyüt (2x/4x), boyutlandır ve kırp (yerelde, sağlayıcısız), filigran/logo ekle (yerelde). Her araç /panel/araclar altında, sade bir yükle-işle-indir akışıyla. Yerel işlemler kredisiz, sağlayıcı kullananlar kredili. Mobilde tek elle kullanılabilir olsun. Testler ve DURUM güncellemesi.
```

## Faz 3: Video

### P3.1 Görselden kısa video

```text
GÖREV: P2.1 ile üretilen ya da yüklenen görsellerden 6-15 saniyelik dikey video. Birinci yol (sağlayıcısız): görseller + metin katmanları + basit geçişlerle sunucu dışı çalışan bir oluşturucu (tarayıcıda WebCodecs/MediaRecorder ile, ya da açık lisanslı bir kütüphane; lisansı ticari kullanıma uygun olmalı, SOURCES.md'ye yaz). İkinci yol: görselden videoya üreten bir sağlayıcı adaptörü [SAĞLAYICI], anahtar yoksa kapalı. Altyazıları güvenli alanda tut, ilk 3 saniyede marka ve teklif görünsün. Üretilen video mevcut video analiz akışından (src/lib/video) otomatik geçsin ve kanca notu gösterilsin. Testler.
```

### P3.2 Video senaryosu ve altyazı

```text
GÖREV: Ürün/hizmet ve hedef kitleden 15, 30 ve 45 saniyelik video senaryosu üret (sahne, ekrandaki yazı, dış ses, süre). Anthropic adaptörüyle şemalı JSON; her satır kural motorundan geçsin. "Gerçek müşteri yorumu" gibi görünen senaryo üretme; yapay zekâyla üretilmiş kişi veya ses kullanılacaksa senaryonun başına "yapay zekâ ile üretildiğini belirt" uyarısı ve Meta'nın yapay zekâ içerik etiketi notu eklensin. SRT altyazı dışa aktarımı ekle. Testler.
```

## Faz 4: İçgörü ve öğrenme

### P4.1 Reklam Yöneticisi raporunu içe aktarma

```text
GÖREV: Meta hesabı bağlamadan performans verisi: kullanıcı Reklam Yöneticisi'nden dışa aktardığı CSV/XLSX'i /panel/performans sayfasına yükler. Sütun adlarını Türkçe ve İngilizce dışa aktarma biçimlerine göre eşle (eşleşmeyen sütunu kullanıcıya sor), harcama, gösterim, tıklama, TO, BGBM, dönüşüm, ROAS hesapla. Dosya güvenilmez girdidir: boyut sınırı, satır sınırı, formül hücrelerini metin olarak oku. Reklam metinlerini AdScope analizleriyle eşleştir ve "ret riski skoru ile performans" karşılaştırmasını göster; en iyi 5 ve en kötü 5 reklamı listele. Ham dosyayı saklama, yalnızca toplulaştırılmış satırları sakla (RLS). Bu veriden kreatif skor ağırlıklarını kalibre etmek için anonim, isteğe bağlı bir paylaşım onayı tasarla ama varsayılan kapalı olsun. Testler.
```

### P4.2 Rakip izleme

```text
GÖREV: İlham panosunu (src/lib/ads-library/meta.ts, /panel/ilham) rakip izlemeye genişlet: kullanıcı en fazla 10 sayfa adı/anahtar kelime kaydeder; haftalık cron her biri için yeni reklamları çeker (önbellek ve hız sınırına uy), "bu hafta yeni N reklam, en uzun yayında kalanlar" özetini panelde ve Resend tanımlıysa e-postayla gösterir. ad_snapshot_url'yi asla saklama veya gösterme. Rakip reklamlarını kopyalama aracı yapma: "Benzerini kontrol et" yalnızca kullanıcının kendi metnini sihirbaza taşısın, rakibin metnini değil. AB dışı ticari reklamların API'de olmadığını arayüzde açıkça yaz. Testler.
```

### P4.3 Yönetim paneli

```text
GÖREV: /yonetim altında yalnızca app_metadata.role = 'admin' olan kullanıcıların girebildiği yönetim paneli (user_metadata'ya güvenme). Ekranlar: kullanıcılar ve kredi bakiyeleri, kredi düzeltme (gerekçe zorunlu, kredi defterine yazılır, silinemez), satın almalar ve webhook olayları, uyarı geri bildirimleri (kural kartına göre gruplu, yanlış pozitif oranı), kural kartı listesi ve son doğrulama tarihleri, hata oranları. Yönetici işlemleri SECURITY DEFINER olmadan, sunucu tarafında secret anahtarla ve ayrı bir denetim günlüğüyle yapılmalı. Reklam kreatiflerini varsayılan olarak gösterme. Entegrasyon testi: admin olmayan erişemez.
```

### P4.4 Bütçe ve kâr hesaplayıcı

```text
GÖREV: Herkese açık /reklam-butce-hesaplama sayfası: ürün fiyatı, maliyet, kargo, hedef ROAS ya da günlük bütçeden başa baş TBM/BGBM, gereken dönüşüm oranı ve aylık kâr senaryolarını hesaplar. Tamamen istemci tarafında, veri saklamaz. Sonuçların tahmin olduğunu yaz. SEO için başlık, açıklama ve yapılandırılmış veri ekle; sayfanın altından ücretsiz reklam kontrolüne yönlendir. Birim testleri hesaplamalar için.
```

## Faz 5: Gelir ve büyüme

### P5.1 Davet ve ortaklık programı

```text
GÖREV: Her kullanıcıya bir davet kodu. Davet edilen kişi ilk satın alımını yaptığında iki tarafa da [N] kredi (kendine davet ve aynı kartla/e-postayla tekrar engellenir; ödeme iadesinde kredi geri alınır). Ajanslar için ayrı ortaklık kodu: satışların yüzde [X]'i kadar komisyon kaydı (ödeme elle yapılacak, yalnızca kayıt tut). Panelde davet sayfası, kazanılan kredi ve bekleyen komisyon. Kredi hareketleri kredi defterine yazılsın. RLS, eşzamanlılık testi, DURUM.
```

### P5.2 Kupon ve kampanya

```text
GÖREV: Kupon kodları: yüzde ya da sabit indirim veya ek kredi, son kullanma tarihi, toplam ve kişi başı kullanım sınırı, paket kısıtı. Shopier akışında indirimli tutarın sunucuda hesaplanıp ödeme bağlantısına doğru taşınmasını sağla (sağlayıcı desteklemiyorsa ek kredi tipini kullan ve bunu belgeye yaz). Yönetim panelinden kupon oluşturma. Fiyatlandırma sayfasında aktif kampanya şeridi (yalnızca gerçekten aktifken). Testler.
```

### P5.3 SEO rehber sayfaları

```text
GÖREV: docs/SOURCES.md'deki resmî kaynaklara ve active kural kartlarına dayanan, sektör başına bir rehber sayfası üret: /rehber/[sektor] (takviye gıda, estetik/klinik, kozmetik, kurs/eğitim, emlak, finans). Her sayfa: sık reddedilen ifadeler, güvenli yazım örnekleri, ilgili kartlar ve kaynak bağlantıları, son doğrulama tarihi, ücretsiz kontrol formu. Kaynağı olmayan iddia yazma; requires_review kartları "doğrulanmadı" etiketiyle göster. Sitemap, kanonik adres ve Open Graph görseli ekle. Her sayfada hukuki görüş değildir uyarısı. e2e: sayfalar açılıyor, axe temiz.
```

### P5.4 Karşılama e-posta dizisi

```text
GÖREV: Resend adaptörüyle kayıttan sonra 5 e-postalık dizi: 0. gün hoş geldin ve ilk analiz, 1. gün örnek rapor, 3. gün sektörüne özel 3 risk, 7. gün kalan kredi ve paketler, 14. gün geri bildirim. Gönderim cron ile, kullanıcı başına bir kez (log tablosu, RLS), her e-postada abonelikten çıkma bağlantısı ve İYS/ETK uyumu için ticari ileti onayı kontrolü (onay yoksa yalnızca bilgilendirme içerikli olanlar gider). Metinlerde garanti dili yok. Testler.
```

## Faz 6: UI/UX yeniden tasarım

### P6.1 Tasarım sistemi

```text
GÖREV: Önce mevcut arayüzü incele (src/components/ui, globals.css, birkaç sayfanın ekran görüntüsü). Sonra DESIGN.md yaz ve uygula: renk belirteçleri (lacivert, kırık beyaz, mercan; açık ve koyu tema), tipografi ölçeği (Fraunces başlık, Manrope gövde), boşluk ve köşe ölçüsü, gölge, hareket süreleri, durum renkleri (kırmızı/sarı/yeşil risk; renk körlüğü için ikon ve metinle birlikte). Bileşenler: Button, Input, Select, Tabs, Card, Badge, Dialog, Toast, EmptyState, Skeleton, DataTable, Stepper. Var olanları yeniden kullan, kopya bileşen üretme. Hesabımda bir tasarım becerisi (ör. impeccable) varsa onu kullan. WCAG AA kontrast, klavye odağı görünür. Tüm e2e ve axe testleri geçmeli.
```

### P6.2 Landing page

```text
GÖREV: src/app/(site)/page.tsx'i baştan tasarla. Hedef: Türkiye'de e-ticaret ve hizmet işletmesi sahibi, ajans. Mesaj: "Reklamını yayına almadan önce üret, kontrol et, düzelt." Bölümler: güçlü başlık ve sayfanın içinde çalışan canlı mini kontrol (mevcut ücretsiz kontrol eylemi), önce/sonra örneği (riskli metin, güvenli metin), 3 adımlı akış, sektör seçici (sektöre göre örnek riskler), özellik ızgarası (üret, kontrol, itiraz, takvim, ajans), fiyat özeti, SSS, kapanış CTA. Sahte müşteri yorumu, uydurma rakam veya logo kullanma; gerçek veri yoksa o bölümü koyma. Hiçbir yerde "reddedilmez" garantisi yok, uyarı görünür. Başka bir sitenin düzenini veya metnini taklit etme. Mobil öncelikli, Lighthouse performans ve erişilebilirlik 90+. Ekran görüntülerini masaüstü ve telefonda al, kendin kontrol et.
```

### P6.3 Panel deneyimi

```text
GÖREV: Paneli işletme sahibinin günlük aracı gibi yeniden düzenle: sol menüyü "Üret / Kontrol et / Yönet" gruplarına ayır, üstte kredi bakiyesi ve "Yeni" düğmesi, Ctrl+K komut paleti (sayfalar, son analizler, markalar), ilk girişte 4 adımlı başlangıç listesi (marka ekle, ilk kontrol, ilk üretim, raporu indir), her listede anlamlı boş durum, uzun işlemlerde iskelet ve ilerleme. Ana sayfa: son analizler, kural güncellemesi uyarısı, yaklaşan sezon günü, kalan kredi. Sihirbazı tek ekranda adımlı hale getir, taslağı otomatik sakla. Mobilde alt gezinme çubuğu. Mevcut e2e testlerini yeni yapıya göre güncelle, axe temiz kalsın.
```

### P6.4 Rapor sayfası

```text
GÖREV: /panel/analiz/[id] raporunu sadeleştir: en üstte tek cümlelik sonuç, risk skoru göstergesi ve "önce bunu düzelt" kartı; altında bulgular (kural kartı bağlantısıyla, active olmayanlar "dikkat" etiketiyle), güvenli metin ve varyantlar yan yana karşılaştırmalı, değişen kelimeler vurgulu; tek tıkla kopyala; itiraz, PDF, CSV, e-posta ve avukat bağlantısı bir "Paylaş" menüsünde. Uyarı metni her zaman görünür. PDF çıktısını da aynı hiyerarşiye getir (src/lib/export/pdf.ts). Testleri güncelle.
```

### P6.5 Erişilebilirlik ve mobil denetimi

```text
GÖREV: Tüm herkese açık sayfalar ve panel için denetim: 360px, 768px, 1280px genişlikte ekran görüntüsü al; taşma, kesilen metin, 44px'ten küçük dokunma hedefi, odak sırası, form hata mesajları, renk kontrastı, hareket azaltma tercihi. Bulguları önem sırasına koy, düzelt, Playwright'a mobil görsel kontrolleri ekle. Değişmeyen her şeyi olduğu gibi bırak.
```

## Faz 7: Ölçek ve kurumsal

### P7.1 Dağıtık hız sınırı ve iş kuyruğu

```text
GÖREV: Bugün hız sınırları ve bazı önbellekler süreç belleğinde; birden fazla sunucuda çalışmaz. Sağlayıcıdan bağımsız bir sınırlayıcı arayüzü yaz; Postgres tabanlı (tek tablo, atomik artırım) ya da [Upstash Redis] uygulaması seç, anahtar yokken bellek içi uygulamaya düş. Uzun işler (video, görsel üretimi, toplu kontrol) için iş kuyruğu: durum tablosu, yeniden deneme, zaman aşımı, kullanıcıya ilerleme. Kredi yalnızca iş tamamlanınca düşsün. Eşzamanlılık testleri.
```

### P7.2 Kurumsal API belgesi ve webhook

```text
GÖREV: /api/v1 uçları için OpenAPI 3.1 belgesi üret (Zod şemalarından), /panel/api sayfasında göster. Analiz tamamlandığında müşterinin adresine imzalı webhook (HMAC, zaman damgası, yeniden deneme, yalnızca https ve özel ağ adreslerine SSRF koruması). Anahtar başına kullanım grafiği. Testler.
```

### P7.3 İzleme

```text
GÖREV: Hata izleme ve ürün analitiği ekle. Hata izleyiciye [Sentry vb.] giden olaylardan reklam metni, dosya, e-posta, IP ve token'ları temizleyen bir süzgeç yaz ve test et. Analitik için çerezsiz ya da KVKK çerez onayına bağlı bir araç kullan; onay vermeden hiçbir izleme betiği yüklenmesin. Huniyi ölç: kayıt, ilk analiz, ilk satın alma. Gizlilik sayfasını güncelle.
```

### P7.4 Mobil uygulama gibi kullanım (PWA)

```text
GÖREV: Siteyi yüklenebilir PWA yap: manifest, ikonlar, çevrimdışı sayfası, telefonda paylaş menüsünden görsel/metin alıp sihirbaza aktarma (Web Share Target). Oturum ve kişisel veri içeren yanıtları önbelleğe alma. iOS ve Android'de test adımlarını docs/DURUM.md'ye yaz.
```

## Hata çıktığında

```text
Şu hata çıktı: [HATA METNİ / TEST ADI / EKRAN GÖRÜNTÜSÜ]. Önce nedenini bul ve bana bir cümleyle söyle, sonra en küçük düzeltmeyi yap. Testi atlama, devre dışı bırakma ya da beklentiyi gevşetme. Düzeltmeden sonra ilgili testi ve npm run typecheck'i çalıştır.
```

## İş bittiğinde kontrol

```text
Bu oturumda yaptığın değişiklikleri gözden geçir: CLAUDE.md'deki değişmez kuralların her birine uyuyor mu (garanti dili, uyarı, kural kartı, secret, log, RLS, kredi idempotensi)? Uymayan varsa düzelt. Sonra bana 5 maddede ne yaptığını, neyin test edildiğini, neyin edilemediğini ve benim yapmam gereken bir şey olup olmadığını yaz.
```
