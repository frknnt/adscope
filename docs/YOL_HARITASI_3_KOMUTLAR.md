# AdScope yol haritası 3: yeni görünüm (Faz 15–19)

Kaynak: `docs/TASARIM_YONU_2.md` (beyaz site, siyah panel, işaretleme imzası). Önceki yol haritaları: Faz 0–7 `docs/CLAUDE_KOMUTLARI.md`, Faz 8–14 `YOL_HARITASI_2_KOMUTLAR.md` (proje klasöründe). Bu dosya aynı biçimi kullanır.

Her komutu yeni bir Claude oturumunda, AdScope reposu bağlıyken yapıştır. Bir oturumda tek komut çalıştır. Fazlar sırayla gider; bir faz bitmeden sonrakine geçme. Köşeli parantezli yerleri kendin doldur.

## Sıra önerisi

Faz 11–14 henüz yapılmadı. **Önce Faz 15–17'yi yap**, sonra Faz 11–14'e dön. Böylece sesli video, ajans akışı ve diğer yeni ekranlar baştan yeni görünümle yazılır, iki kez elden geçmez. Faz 18–19 Faz 11–14'ten sonra da yapılabilir.

Bu fazlar işlev eklemez. Tek istisna landing'deki çalışan kontrol kutusudur; o da var olan ücretsiz kontrolü kullanır.

## Her oturumun başına

```text
Bu repo AdScope. Önce CLAUDE.md, DESIGN.md, docs/DURUM.md ve docs/TASARIM_YONU_2.md dosyalarını oku; CLAUDE.md'deki değişmez kurallar her şeyin üstündedir. Bu oturumdaki görev aşağıda ve yalnızca görünüm ve yerleşimle ilgilidir: mevcut işlevlerin, metinlerin anlamının, hukuki uyarıların ve testlerin kapsadığı davranışın hiçbiri kaybolmasın. Ortamda impeccable ve ui-ux-pro-max skill'leri varsa kullan (impeccable craft-floor kurallarına uy: eyebrow etiketi, gradyan metin, eşit ikon kartları, renkli sol kenar çizgisi yok). İşe başlamadan önce 5-10 maddelik kısa bir plan yaz: hangi dosyalara dokunacağını ve nasıl test edeceğini söyle. Belirsiz bir nokta varsa en makul yorumu seç ve hangisini seçtiğini yaz. Referans sitelerin (trypix, Photoroom, adject) adını, metnini, görselini, ikonunu, renk kodunu ya da birebir düzenini kopyalama. Uydurma kullanıcı sayısı, logo, yorum ya da yüzde koyma. Bitirince npm run typecheck, npm run lint, npm test ve dokunduğun alanın e2e testini çalıştır; değiştirdiğin her sayfanın 1440px ve 390px ekran görüntüsünü al, kendin bak, taşma ve kırık hizayı düzelt. docs/DURUM.md'yi güncelle ve neyin gerçekten test edildiğini açıkça raporla.

GÖREV:
```

## Başlamadan önce

- İstersen trypix panelinin, Photoroom web uygulamasının (koyu temada) ve adject uygulamasının birkaç ekran görüntüsünü hazır et ve Faz 16 ile Faz 17 oturumlarına ekle. Repoya koyma.
- Landing başlığı için tercihin varsa P16.1'deki `[BAŞLIK]` yerine yaz; yoksa Claude 3 seçenek önerir.

## Faz 15: Temel

Amaç: İki yüzeyi (beyaz site, siyah panel) aynı belirteç adlarıyla kurmak; bileşenleri bir kez güncelleyip her yerde doğru görünmesini sağlamak.

### P15.1 Belirteçler, iki yüzey ve yazı tipleri

```text
GÖREV: docs/TASARIM_YONU_2.md'deki "Renk", "Yazı" ve "Biçim" bölümlerini src/app/globals.css'e uygula. Belirteç adları (paper, paper-2, card, field, line, line-strong, ink, ink-soft, muted, accent, accent-hover, on-accent ve risk renkleri) aynı kalsın; :root beyaz site değerlerini, [data-surface="panel"] koyu panel değerlerini taşısın. src/app/panel/layout.tsx kök öğesine data-surface="panel" ekle ve paneli color-scheme: dark yap; site ve yazdırma açık kalsın (@media print içinde panel de açık değerlere dönsün). navy-*, --gradient-brand ve .text-gradient sınıflarını kaldır, kullanıldıkları yerleri yeni belirteçlere çevir; coral yalnızca logo işaretinde kalsın. Bileşenlerde hex kodu bırakma. Yazı tipleri: başlık Schibsted Grotesk, arayüz Geist, veri Geist Mono (fontsource değişken paketleri ya da resmî paket; lisanslarını docs/SOURCES.md'ye yaz). Önce Türkçe glifleri (ç ğ ı İ ö ş ü) kontrol eden küçük bir sayfa ya da test yap; eksik varsa o aile yerine Manrope'u bırak ve söyle. font-display başlık sınıfı ve tabular-nums yardımcıları ekle. Metin seçimi, imleç, kaydırma çubuğu ve odak halkasını belirteçlerden ver. tests/e2e/theme.spec.ts'i iki yüzeye göre yeniden yaz: landing beyaz, panel koyu, yazdırma açık; ikisinde de axe kontrast ihlali yok. Henüz sayfa düzenlerini değiştirme.
```

### P15.2 Bileşenler ve işaretleme imzası

```text
GÖREV: src/components/ui.tsx, interactive.tsx, risk.tsx, panel-ui.tsx ve panel-client.tsx'teki bileşenleri docs/TASARIM_YONU_2.md "Biçim" bölümüne getir: düğme 44px ve 10px köşe (sitede birincil siyah, panelde birincil beyaz; kobalt yalnızca seçim, odak ve bağlantı), kart 16px köşe, sitede gölgesiz kenarlıklı kart, panelde gölgesiz katman. Bileşenleri yeniden yazma, sınıfları güncelle. Yeni bileşen: src/components/marker.tsx içinde Marker (metin içindeki bir ifadenin altına el çizimi hissi veren SVG darbe; level prop'u high/mid/info; rengi risk belirtecinden; yanında düzey adı ve kural kimliği gösteren isteğe bağlı MarginNote). Darbe her ifade uzunluğuna uysun, satır kırılınca her satırda ayrı çizilsin, reduced-motion'da animasyonsuz görünsün; ekran okuyucuya "Yüksek risk: <ifade>" olarak okunsun. live-check.tsx'teki dalgalı alt çizgiyi ve HighlightedText'i bu bileşene bağla ki işaretleme dili her yerde aynı olsun. LevelPill ve RiskBadge'de renk tek başına anlam taşımasın (düzey adı yazılı kalsın). Birim testi: Marker düzey ve etiket üretir; e2e: canlı uyum alanında işaret görünür, axe temiz.
```

### P15.3 DESIGN.md ve görsel referanslar

```text
GÖREV: DESIGN.md'yi docs/TASARIM_YONU_2.md ve P15.1–P15.2'de yapılanlara göre yeniden yaz: iki yüzey, belirteç tablosu (site ve panel değerleri yan yana, kontrast oranlarıyla), yazı ölçeği, biçim, Marker kullanımı, bileşen listesi ve yasaklar listesi (eyebrow, gradyan metin, eşit ikon kartları, renkli sol çizgi, sahte istatistik). docs/TASARIM_YONU.md ve docs/PANEL_TASARIMI.md'nin başına "Bu dosyanın yerini docs/TASARIM_YONU_2.md aldı" notu ekle, silme. tests/e2e altında görünüm referans testi kur: landing, panel ana sayfa, rapor ve yeni analiz için 1440px ve 390px ekran görüntüsü karşılaştırması (Playwright toHaveScreenshot, demo veriyle, animasyonlar kapalı, makul eşik). Referansları bu oturumda üret ve commit et; sonraki fazlar bilerek güncelleyecek.
```

## Faz 16: Beyaz site

Amaç: Landing'i "AI slop" görünümünden çıkarıp ürünün çıktısını gösteren, az ama güçlü bölümlü bir vitrine çevirmek.

### P16.1 Menü, hero, çalışan kontrol kutusu ve reklam duvarı

```text
GÖREV: docs/TASARIM_YONU_2.md "Site yapısı" 1-3. maddeleri uygula: site-nav.tsx (beyaz yapışkan menü, üç sütunlu mega menü, sağ sütunda Marker'lı küçük örnek rapor parçası; Esc, dışarı tıklama, klavye ve dokunmatik çalışsın) ve src/app/(site)/page.tsx hero. Başlık: [BAŞLIK — boşsa 3 seçenek öner, en iyisini kullan, garanti dili yok]. Hero'da çalışan kontrol kutusu: reklamim-reddedilir-mi sayfasındaki oturumsuz ücretsiz kontrolü bileşen olarak ayır ve burada kullan (aynı hız sınırı, kredisiz, saklama yok); sonuç aynı yerde Marker'lı metin, en kritik bulgu ve güvenli sürüm olarak açılsın, altında "Risk değerlendirmesidir, hukuki görüş değildir". Reklam duvarı: 3-4 sütun, farklı oranlarda (1:1, 4:5, 9:16) AdScope'un kendi örnek reklamları; şablonlu görsel üreticiyle derleme anında ya da betikle üretilip public/ornek altına WebP olarak konsun (gerçek marka yok, alt metinde "Örnek reklam"). Sütunlar yavaş ve ters yönlerde aksın; ortadaki bir reklamda iki ifade Marker ile işaretlensin, kenar notu çıksın, sonra güvenli sürüm yazılsın. Duraklat düğmesi olsun, reduced-motion'da duvar dursun ve işaretler sabit görünsün. Kanıt satırı: mevcut rule-trust-band, sayılar katalogdan. Eyebrow, gradyan metin, yüzen sahte çip kullanma. Lighthouse performans ve erişilebilirlik 90+, CLS < 0.1. site.spec.ts'i güncelle ve hero kontrol kutusu için e2e ekle (metin yapıştır, sonuç ve uyarı görünür, axe).
```

### P16.2 Önce/sonra, siyah ürün bandı ve bento

```text
GÖREV: docs/TASARIM_YONU_2.md "Site yapısı" 4-6. maddeleri uygula. Önce/sonra: sektör çipleri (tablist), her sektör için src/lib/sample.ts ve kampanya şablonlarından bir örnek; solda Marker'lı riskli metin, sağda kural motorunun ürettiği güvenli sürüm (derleme anında motorla hesaplansın, elle yazılmasın), arada sürüklenebilir ayraç (role="slider", ok tuşları, dokunmatik). Altında dayandığı kural kartının bağlantısı; kart requires_review ise "dikkat" düzeyinde kalsın. Siyah ürün bandı: tam genişlik ink zemin, sekmeler Kontrol et / Düzelt / Üret / Paketle, her sekmede koyu panelin gerçek ekranı. Ekranlar resim değil, demo veriyle çizilmiş sadeleştirilmiş HTML maketi olsun (erişilebilir metinli, panel bileşenlerini data-surface="panel" ile yeniden kullan). Bento: 5-6 farklı genişlikte kart (video kare incelemesi, itiraz taslağı, katmanlı düzenleyici, toplu kontrol ve platform varyantları, Chrome eklentisi ve API); her kartta gerçek bir ekran parçası ya da çıktı, ikon kutusu yok. Eski "Bugün neye ihtiyacın var", "Hepsi bir arada" ızgarası, numaralı adımlar ve istatistik satırını kaldır. 1440/768/390px ekran görüntüsü, site.spec.ts ve axe.
```

### P16.3 Sektörler, güven ve fiyat, SSS, kapanış, footer

```text
GÖREV: docs/TASARIM_YONU_2.md "Site yapısı" 7-9. maddeleri uygula. Sektörler: altı sektör kartı (ilk ikisi büyük), örnek reklam, o sektörde en sık işaretlenen iki risk türü (kural kataloğundan sektör etiketine göre derlensin) ve /kurallar sayfasına süzgeçli bağlantı. Güven ve fiyat: solda kaynak kurumlar düz metin ve bağlantı, verinin saklandığı yer ve süre (gizlilik sayfasıyla tutarlı), KVKK; sağda kredi paketleri ve "yaklaşık N analiz ya da N görsel seti" karşılıkları (src/lib/payments ve maliyet tablolarından otomatik), "abonelik yok, kredi yalnızca iş başarıyla bitince düşer" (kodda gerçekten böyle olduğunu kontrol et). Rakip adı ve fiyatı yok. SSS akordeonu (garanti vermediğimizi söyleyen soru dahil). Siyah kapanış bandı ve aynı çalışan kontrol kutusu; siyah footer, dört sütun, hukuki uyarı ve telif satırı. Eski gradyan kapanış bandını ve 4'lü fiyat kartlarını kaldır. Toplam bölüm sayısı 9'u geçmesin. site.spec.ts, axe, ekran görüntüleri; görünüm referanslarını bilerek güncelle.
```

### P16.4 Diğer herkese açık sayfalar ve giriş

```text
GÖREV: Yeni beyaz dili src/app/(site) altındaki diğer sayfalara ve src/app/(auth) sayfalarına uygula: fiyatlandırma, kurallar (durum süzgeci ve kaynak bağlantıları korunsun), nasıl çalışır, rehber, reklam bütçe hesaplama, reklamim-reddedilir-mi (hero'daki bileşeni kullansın), yasal sayfalar (okunur metin sütunu, 68 karakter), e-posta tercihleri. Giriş ve kayıt: solda form, sağda ink zemin üstünde tek bir Marker'lı örnek reklam (aside.tsx). Eyebrow ve gradyanları temizle. İçerik ve hukuki metinler değişmesin. Tüm site e2e testleri, axe ve 390px ekran görüntüleri.
```

## Faz 17: Siyah panel kabuğu

Amaç: Paneli koyu, görseli öne çıkaran bir stüdyoya çevirmek; ana sayfayı KPI kartlarından "buradan başla" ekranına dönüştürmek.

### P17.1 Kabuk, menü ve komut paleti

```text
GÖREV: docs/TASARIM_YONU_2.md "Panel yapısı > Kabuk" bölümünü src/app/panel/shell.tsx üzerinde uygula: 232px sol menü (paper-2 zemin, logo, ajans modunda marka seçici, gruplar Kontrol et / Üret / Planla / Yönet, grup başlıkları büyük harf değil, aktif öğe card zemin, sol çizgi yok), altta mono rakamlı kredi bakiyesi ve hesap menüsü. Menü 64px ikon moduna daralsın (tooltip'li, tercih localStorage'da, try/catch ile). Üst çubuk 56px: konum izi, ortada arama/komut paleti tetikleyici, sağda kredi çipi ve beyaz "Yeni analiz" düğmesi. Komut paleti koyu yüzeye uysun. Demo modu şeridini ince, kehribar noktalı bir satıra çevir. Mobil: alt çubukta Oluştur, Raporlar, Üret, Menü; Menü tam ekran sayfa açar, odak yönetimi doğru. Hiçbir sayfa bağlantısı kaybolmasın. Panel e2e testlerinin seçicilerini güncelle (beklentiyi gevşetme), axe koyu yüzeyde temiz.
```

### P17.2 Oluştur ana sayfası

```text
GÖREV: src/app/panel/page.tsx'i docs/TASARIM_YONU_2.md "Oluştur" bölümüne göre yeniden düzenle. Üstte bırakma alanı: görsel ya da video bırakılırsa Yeni analiz sihirbazı o dosyayla, metin yapıştırılırsa metin kontrolüyle, adres yazılırsa kampanya paketiyle açılsın (mevcut akışlara yönlendir, yeni iş mantığı yazma; dosya sihirbaza mevcut yükleme yoluyla aktarılsın, yapılamıyorsa sihirbazı açıp dosyayı seçili getir ve yöntemini yaz). Altında hızlı eylem hapları (kredi bilgisi mono, maliyet tablolarından). Tek satırlık durum cümlesi (gerçek veriden; veri yoksa gösterme). Son çalışmalar: 4:5 küçük resimli büyük ızgara, RiskBadge, platform, tarih; ızgara/liste geçişi (SegmentedLinks). Sezon günleri sade satır listesi. 4'lü KPI kartlarını ve "Hızlı başlat" kartlarını kaldır. Başlangıç listesi (baslangic) yeni kullanıcıda bırakma alanının altında görünsün. E2e: her girdi türü doğru akışa gider, boş hesap ve dolu hesap görünümü, axe, 390px.
```

### P17.3 Raporlar ve listeler

```text
GÖREV: /panel/gecmis (Raporlar), /panel/toplu sonuç tablosu ve /panel/ilham listesini koyu panel diline getir: ızgara görünümünde büyük görsel kartlar, liste görünümünde 48px satırlı, yapışkan başlıklı DataTable; satır üzerine gelince card zemin, risk her zaman RiskBadge ile (renk + sayı + düzey adı). Süzgeçler üstte tek satır hap grubu. Boş durumlar: ne eksik, neden önemli, tek sonraki adım ve küçük Marker'lı örnek. Skeleton yükleme durumları koyu yüzeye uysun. E2e seçicileri ve görünüm referansları güncellensin, axe temiz.
```

## Faz 18: Çalışma ekranları

Amaç: Panelin asıl iş yapılan ekranlarını (rapor, sihirbaz, üretim, düzenleyici) üç bölgeli stüdyo düzenine taşımak.

### P18.1 Rapor inceleme ekranı

```text
GÖREV: /panel/analiz/[id] sayfasını ve report-view.tsx'i docs/TASARIM_YONU_2.md "Rapor" bölümüne göre düzenle: solda tuval (görsel ya da video kareleri büyük; görsel üstü metin ve reklam metninde Marker işaretleri; video için kare şeridi), sağda 380px inceleme paneli (büyük mono skor + düzey adı + tek cümlelik sonuç, "Önce bunu düzelt", sekmeler Bulgular / Güvenli metin / Varyantlar / İtiraz / Paylaş; mevcut hash'li sekme davranışı ve SeverityFilter korunur). Bir bulguya tıklayınca tuvaldeki işaret vurgulansın ve görünür alana kaysın; tersi de çalışsın. Hukuki uyarı panelin altında her zaman görünür. "Mevzuat ihlali" ifadesi yalnızca active karta dayanan bulguda kalsın (mevcut test korunur). Mobilde tuval üstte, panel altta, sekmeler yapışkan. PDF ve yazdırma açık kalsın, değişmesin. E2e: bulgu-işaret eşleşmesi, sekmeler, mobil, axe; görünüm referansları güncellensin.
```

### P18.2 Yeni analiz sihirbazı: odak modu

```text
GÖREV: /panel/yeni sihirbazını odak moduna al: sol menü gizlenir, üstte Stepper ve "Çık" (kaydedilmemiş girdi varsa onay sorar), solda form, sağda koyu zemin üstünde gerçek oranında önizleme (AdPreview) ve LiveTextField işaretleri. Adımlar arası geçişte odak başlığa gitsin. Mevcut adımlar, doğrulamalar ve kredi uyarıları aynı kalsın. E2e: tam akış, Çık onayı, klavye ile ilerleme, 390px, axe.
```

### P18.3 Üret, kampanya paketi, düzenleyici ve görsel araçları

```text
GÖREV: /panel/uret (kampanya paketi, metin, görsel, senaryo, video sekmeleri), /panel/uret/duzenle (CreativeEditor) ve /panel/araclar sayfalarını koyu stüdyo düzenine getir: düzenleyici ve görsel araçlarında solda araç çubuğu, ortada tuval, sağda ayarlar; önizlemeler koyu zeminde gerçek oranında; kampanya paketi adımları tek dikey akış, her varyant kartında RiskBadge. Düzenleyicide seçili katman çerçevesi ve tutamaçları accent renginde, kontrast uyarıları görünür. Metin katmanlarında canlı işaretler Marker ile. İşlev, kredi ve indirme kuralları değişmesin. E2e (mevcut düzenleyici ve paket senaryoları), axe, 390px.
```

### P18.4 Kalan panel sayfaları

```text
GÖREV: Kalan panel sayfalarını aynı dile getir: itiraz asistanı, sezon takvimi, performans (grafikler koyu yüzeyde okunur; dataviz kuralları: renk tek başına anlam taşımaz, eksen ve etiketler muted renkte), markalar, ekip ve davet, API (anahtar ve uç noktalar Geist Mono), krediler (paketler ve kredi defteri tablosu), ayarlar, davet et, başlangıç, herkese açık inceleme ve müşteri onay sayfaları (bunlar oturumsuz açıldığı için beyaz site yüzeyini kullanır). Formlar: etiket üstte, hata alanın altında role="alert", 44px alanlar. Kart içinde kart kullanma. Tüm panel e2e testleri, axe ve görünüm referansları.
```

## Faz 19: Cila ve ölçüm

Amaç: Yeni görünümün her durumda (boş, yükleme, hata, mobil, yazdırma) tutarlı olduğunu doğrulamak ve kalıcı hale getirmek.

### P19.1 Durumlar ve hareket

```text
GÖREV: Site ve panelde her etkileşimli öğenin durumlarını denetle ve tamamla: üzerine gelme, odak, basılı, devre dışı, yükleniyor, hata, boş. Hareketi docs/TASARIM_YONU_2.md "Hareket" bölümüne indir: sitede yalnızca hero'daki inceleme anı; panelde menü 150 ms, sekme, bildirim ve Marker çizimi 240 ms ease-out. Eski .reveal, .float-chip ve her bölümdeki giriş animasyonlarını kaldır. Tüm hareket prefers-reduced-motion ile dursun. Panelde hata ve 404 sayfaları ile çevrimdışı sayfayı koyu yüzeye, sitedekileri beyaz yüzeye getir. E2e: reduced-motion açıkken duvar ve işaretler sabit; hata sayfaları axe temiz.
```

### P19.2 Erişilebilirlik, performans ve son kontrol

```text
GÖREV: Tüm sayfalarda tam denetim: axe (iki yüzey), klavyeyle tam gezinme (menü, mega menü, komut paleti, önce/sonra ayracı, duvar duraklatma, düzenleyici), ekran okuyucu metinleri (Marker'ın okunuşu, RiskBadge), 200% yakınlaştırmada taşma, 320px genişlik. Lighthouse (site: landing, fiyatlandırma, kurallar; panel: ana sayfa, rapor) performans ve erişilebilirlik 90+ olsun; değilse nedenini bul ve düzelt (görsel boyutları, yazı tipi alt kümesi, ilk yüklemede gereksiz JS). Sonuç tablosunu docs/DURUM.md'ye yaz. Ardından impeccable skill'i varsa "critique" ve "audit" komutlarıyla landing ve rapor ekranını incele, çıkan önemli bulguları düzelt, kalanları listele.
```

### P19.3 PDF rapor ve e-postalar

```text
GÖREV: PDF raporu (pdfkit) ve e-posta şablonlarını yeni dile getir, açık zeminde kalsın: Schibsted Grotesk ve Geist TTF gömülü (Türkçe karakterler tam), lacivert yerine ink ve accent, risk işaretleri PDF'te de Marker benzeri alt çizgiyle ve düzey adıyla, her sayfada hukuki uyarı ve sayfa numarası, marka logosu başlıkta (ajans modu). E-postalar (davet, sezon hatırlatma, bülten, müşteri onayı) beyaz zemin, siyah düğme, düz metin alternatifi. Birim testi: PDF metni uyarıyı ve Türkçe karakterleri içerir; e-posta şablonu anlık görüntü testi.
```

### P19.4 (İsteğe bağlı) Panelde açık tema seçeneği

```text
GÖREV: Ayarlar sayfasına Görünüm seçeneği ekle: Koyu (varsayılan), Açık, Sistem. data-surface="panel" yanında data-theme ile açık panel değerlerini tanımla (site belirteçleriyle aynı aileden), seçim hesapta saklansın (yeni sütun gerekiyorsa migration, RLS mevcut profil politikasıyla), ilk boyamada yanıp sönme olmasın (çerez ya da sunucu tarafı okuma). E2e: üç seçenek, yenilemede korunur, iki temada axe temiz.
```

## İş bittiğinde kontrol (her komuttan sonra)

```text
Az önce yaptığın işi gözden geçir: Mevcut bir işlev, sayfa, bağlantı ya da hukuki uyarı kayboldu mu? Garanti dili, sahte istatistik, eyebrow etiketi, gradyan metin, eşit ikon kartı ya da renkli sol çizgi kaldı mı? Referans sitelerden kopyalanmış bir metin, görsel ya da düzen var mı? Renk tek başına anlam taşıyan bir yer var mı? Her iki yüzeyde axe temiz mi, 390px'te taşma var mı? Görünüm referansları bilerek mi güncellendi? docs/DURUM.md ve DESIGN.md güncel mi? Kısa bir liste halinde raporla ve bulduğun eksikleri düzelt.
```
