# AdScope tasarım yönü 2: beyaz vitrin, siyah stüdyo

Bu dosya AdScope'un ikinci görsel yönünü tanımlar ve `docs/TASARIM_YONU.md` ile `docs/PANEL_TASARIMI.md`'nin yerini alır. Herkese açık site (landing) **beyaz**, giriş gerektiren panel **siyah**. Uygulama sırası ve hazır komutlar: `docs/YOL_HARITASI_3_KOMUTLAR.md`. Uygulandıkça `DESIGN.md` bu dosyaya göre yeniden yazılır.

Referans siteler: trypix.ai, photoroom.com (ve web uygulaması), adject.ai. Bu siteler **tarz referansıdır**: ürün görselini öne koyma, az ama büyük bölüm, gerçek ürün ekranı, sade ve kendinden emin metin. Logo, ad, metin, slogan, görsel, video, ikon, renk kodu ve birebir sayfa düzeni alınmaz (CLAUDE.md kural 11).

## 1. Sorun: şu anki site neden "AI slop" görünüyor

Mevcut landing ve panel, yapay zekâ ile üretilmiş SaaS sayfalarının ortak kalıplarını taşıyor. Ziyaretçi bunları tanıyor ve "şablon" hissediyor:

| Kalıp | Nerede | Ne yapıyoruz |
|---|---|---|
| Her başlığın üstünde küçük büyük harfli "eyebrow" hap | Tüm bölümler | **Kaldırılır.** Başlık kendi ağırlığıyla durur. |
| Gradyan metin ("riskini **gör**") | Hero | **Kaldırılır.** Vurgu ağırlık ve boyutla yapılır. |
| Görselin üstünde yüzen sahte durum çipleri | Hero kolajı | **Kaldırılır.** Yerine ürünün kendi işaretleme dili gelir (bkz. İmza). |
| Aynı boyutta ikon + başlık + metin kartları | "Hepsi bir arada", "Hızlı başlat", "Nasıl çalışır" | **Kaldırılır.** Yerine gerçek ekran parçası taşıyan, farklı boyutlu bento. |
| 01 / 02 / 03 numaralı adımlar | "Yükle, kontrol et, düzelt" | **Kaldırılır.** Akış tek bir ürün ekranında gösterilir. |
| Büyük sayı + küçük etiket istatistik satırı | Landing, panel pano | **Kaldırılır.** Panelde tek cümlelik özet ve gerçek iş listesi. |
| Lacivertten maviye gradyan bantlar | Kapanış, fiyat kartı, mega menü | **Kaldırılır.** Siyah düz alan. |
| 13 bölüm, her biri ekrana girerken aynı kayma animasyonu | Landing | 9 bölüme iner; tek bir hareket anı (bkz. Hareket). |
| Okunmayacak kadar küçük ürün maketleri | Özellik blokları | Az sayıda, büyük ve okunur ekran. |
| Aktif menüde solda 3px renkli çizgi | Panel menü | Dolgu zeminiyle gösterilir. |
| Renkli ikon kutulu KPI kartları | Panel pano | Kaldırılır. |

## 2. Üç siteden ne öğreniyoruz

Bu ortamda tarayıcı bağlı değildi ve trypix.ai/user sayfası robot kuralıyla okumaya kapalıydı; inceleme sayfa yapısı, metin düzeni, yardım makaleleri ve ürün duyuruları üzerinden yapıldı. Renk kodları ve yazı tipleri doğrudan okunamadı. Daha yakın sonuç için bkz. 9. bölüm.

**trypix.ai (Türkçe, e-ticaret reklam stüdyosu)**
- Hero'da sütun sütun akan gerçek ürün ve manken görselleri duvarı. Ürünü anlatmak yerine sonucu gösteriyor.
- "Prompt yok" fikrini tek kelimelik, tekrar eden bir şeritle satıyor: tek ve net bir iddia.
- Kategori çipli önce/sonra karşılaştırması.
- "Eski yol / yeni yol" iki sütunlu karşılaştırma.
- Kredi fiyatlandırmasında "yaklaşık N görsel ya da N video" çevirisi: soyut krediyi somutlaştırıyor.

**Photoroom (site ve web uygulaması)**
- Kısa, iddialı başlık (2-4 kelime) ve hemen altında gerçek ürün videosu.
- Simgeli, açıklamalı mega menü; sağda öne çıkan bir örnek kartı.
- Farklı genişlikte kartlardan oluşan bento ızgara; her kartta gerçek görsel, ikon yok.
- Sekmeli "tam çözüm" bölümü (Oluştur / Ölçekle / Düzenle).
- Güvenlik ve uyum bölümü footer'dan hemen önce.
- Web uygulaması: Ana ekran bir "Oluştur" ekranıdır (yükleme alanı, şablon arama, kısayollar); düzenleyici üç bölgeli: araç çubuğu, ortada tuval, sağda ayarlar. Açık, koyu ve sistem teması var.

**adject.ai (yapay zekâ ürün stüdyosu)**
- Ortalanmış başlık, üstünde tek satırlık "yeni sürüm" duyurusu, altında geniş ürün ekranı.
- Ürün kategorilerine göre görsel kartlar ("sadece moda değil").
- Kategoriye göre düzenlenmiş büyük çıktı galerisi: ikna yükünü sonuçlar taşıyor.
- Uygulama, projelerin bağlı kaldığı sonsuz bir tuval olarak anlatılıyor.

**Ortak ders:** Üçü de ürünün *çıktısını* gösteriyor, *özellik listesini* değil. AdScope'un çıktısı bir rapor: işaretlenmiş riskli ifade ve yerine önerilen güvenli metin. Tasarımın merkezine bunu koyuyoruz.

## 3. Fikir ve imza

**Tez:** AdScope reklamı yayından önce "masaya yatırır". Site, reklamların asıldığı beyaz bir vitrin; panel, o reklamların incelendiği siyah bir stüdyo. Rakipler üretimi gösterir, AdScope incelemeyi gösterir.

**İmza hareket: işaretleme.** Reklam metnindeki riskli ifadenin altından el ile çekilmiş gibi bir işaretleyici darbesi geçer (SVG, hafif eğimli, uçları yuvarlak), rengi risk düzeyini söyler: kırmızı = yüksek, kehribar = orta, gri-mavi = bilgi. Darbenin yanında kenar notu gibi kısa bir açıklama ve kural kimliği durur (`TR-RY-SAGLIK-03` gibi, mono yazıyla). Bu dil her yerde aynıdır:
- Landing hero'da reklam duvarındaki bir reklam incelenir, işaretler çizilir.
- Önce/sonra karşılaştırmasında işaretli ifadeler güvenli sürüme dönüşür.
- Panelde rapor ekranı, canlı uyum göstergesi (`LiveTextField`) ve düzenleyici aynı işaretleri kullanır.

Renk hiçbir zaman tek başına anlam taşımaz: her işaretin yanında düzey adı ("Yüksek risk") yazılır.

## 4. Renk

İki yüzey, aynı belirteç adları. Bileşenler `bg-card`, `text-ink` gibi sınıfları kullanmaya devam eder; değerler yüzeye göre değişir. Panel kökü `data-surface="panel"` taşır ve belirteçleri koyu değerlerle ezer. Böylece bileşen kodu iki kez yazılmaz.

### Site (beyaz)

Strateji: sınırlı. Beyaz zemin, siyaha yakın mürekkep, tek eylem rengi (kobalt), iki tam genişlikli siyah bant (ürün ekranı bandı ve kapanış). Siyah bantlar siteden panele geçişi hissettirir.

| Belirteç | Değer | Kullanım | Kontrast |
|---|---|---|---|
| `paper` | #FFFFFF | Sayfa zemini | |
| `paper-2` | #F6F6F7 | Alternatif bölüm, görsel çerçevesi | |
| `ink` | #0A0A0B | Başlık, birincil düğme zemini, siyah bantlar | 19.8:1 |
| `ink-soft` | #52525B | Gövde metni | 7.7:1 |
| `muted` | #71717A | Açıklama, dipnot | 4.8:1 |
| `line` / `line-strong` | #E7E7EA / #D4D4D8 | Ayraç / form alanı kenarı | |
| `accent` | #2F3CFF | Bağlantı, odak halkası, seçili sekme, ikincil vurgu | 6.5:1 |
| `accent-hover` | #2432E0 | Üzerine gelince | 8.0:1 |
| `risk-high` / tint | #C8321F / #FDECEA | Yüksek risk işareti | 5.3:1 |
| `risk-mid` / tint | #9A5C00 / #FFF4DC | Orta risk işareti | 5.4:1 |
| `risk-low` / tint | #13703A / #E7F6EC | Düşük risk, başarı | 6.2:1 |

Lacivert (`navy-*`), mavi-gradyan (`--gradient-brand`) ve `.text-gradient` kaldırılır. Mercan (`coral`) yalnızca logo işaretinde kalır.

### Panel (siyah)

Kullanım sahnesi: ajans çalışanı ya da e-ticaret sahibi, gün içinde uzun süre reklam görsellerine bakıyor. Koyu zemin görselin rengini öne çıkarır (yaratıcı araçların koyu tema seçmesinin nedeni bu). Zemin saf siyah değil, hafif sıcak nötr; katmanlar gölgeyle değil açıklıkla ayrılır.

| Belirteç | Değer | Kullanım | Kontrast |
|---|---|---|---|
| `paper` | #0B0B0D | Uygulama zemini, tuval arkası | |
| `paper-2` | #111114 | Sol menü, üst çubuk, ikincil yüzey | |
| `card` | #18181C | Kart, açılır menü, inceleme paneli | |
| `field` | #1F1F24 | Form alanı, basılı düğme | |
| `line` / `line-strong` | #26262C / #34343C | Ayraç / alan kenarı ve odaksız kenar | |
| `ink` | #EDEDEF | Başlık ve ana metin | 16.8:1 |
| `ink-soft` | #A1A1AA | Gövde, tablo hücresi | 7.7:1 (kartta 6.9:1) |
| `muted` | #8B8B96 | Açıklama, ipucu | 5.5:1 |
| `accent` | #7C8BFF | Seçili öğe, odak halkası, bağlantı, ilerleme | 6.6:1 |
| `on-accent` | #0B0B0D | Kobalt zemin üstü metin | 6.6:1 |
| `risk-high` | #FF6B5E | Yüksek risk | 7.0:1 |
| `risk-mid` | #FFB547 | Orta risk | 11.2:1 |
| `risk-low` | #3DD68C | Düşük risk | 10.5:1 |
| risk tint'leri | ilgili rengin %12 saydamlığı | Rozet ve satır zemini | |

**Birincil düğme panelde beyazdır** (#EDEDEF zemin, #0B0B0D metin). Kobalt, düğme rengi değil seçim ve odak rengidir; böylece ekranda tek bir "en önemli eylem" kalır.

PDF rapor, yazdırma ve e-postalar her zaman açık kalır. Panelde açık tema seçeneği bu yönün parçası değildir; ileride istenirse `data-surface` değerleri hazır olduğu için eklenebilir (yol haritasında isteğe bağlı madde).

## 5. Yazı

Manrope yerine iki aile. İkisi de açık lisanslı, değişken ve Türkçe karakterleri (ç, ğ, ı, İ, ö, ş, ü) destekler; uygulamadan önce glif kontrolü yapılır, eksik çıkarsa Manrope kalır.

- **Başlık: Schibsted Grotesk** (700-800). Haber manşeti kökenli, sıkı ve kararlı; "inceleme" fikrine uyuyor, her SaaS'ta görülen geometrik yuvarlaklıktan uzak. Harf aralığı -0.035em, satır yüksekliği 1.0-1.1.
- **Arayüz ve gövde: Geist** (400-600). Küçük boyutta net, tablo ve form için uygun.
- **Mono: Geist Mono** yalnızca gerçek veri için: kural kimliği, kredi miktarı, tarih, skor, API anahtarı. Süs olarak kullanılmaz.
- Rakamlar tablo ve skorlarda `font-variant-numeric: tabular-nums`.

| Rol | Masaüstü | Mobil | Not |
|---|---|---|---|
| Hero başlığı | 72-88px | 44px | En fazla iki satır, `text-wrap: balance` |
| Bölüm başlığı | 48px | 32px | |
| Kart / panel sayfa başlığı | 24px / 28px | 20px / 24px | Panelde sayfa başlığı 28px'i geçmez |
| Gövde büyük | 20px | 18px | Hero alt cümlesi, en fazla 60 karakter genişlik |
| Gövde | 16px | 16px | |
| Arayüz metni | 14-15px | 15px | Mevcut `text-body`, `text-small` ölçeği korunur |
| Dipnot | 12-13px | 13px | |

PDF raporu için aynı ailelerin TTF sürümleri gömülür (pdfkit).

## 6. Biçim

- **Köşe:** düğme ve alan 10px, kart 16px, büyük ürün ekranı ve görsel çerçevesi 20px, hap tam yuvarlak. Şu anki 28px "yumuşak balon" görünümü bırakılır.
- **Düğme:** 44px (sitede büyük düğme 52px). Birincil: sitede siyah, panelde beyaz. İkincil: kenarlıklı, zeminsiz. Metin bağlantısı: kobalt, altı çizgi `text-underline-offset: 3px`.
- **Gölge:** sitede yalnızca yüzen öğelerde (açılır menü, düzenleyicideki seçili katman): `0 1px 2px rgb(0 0 0 / .06), 0 16px 40px -20px rgb(0 0 0 / .25)`. Kartlar gölgesiz, 1px kenarlıklı. Panelde gölge yok; katman açıklıkla ayrılır, açılır öğe `card` + `line-strong` kenar.
- **Görsel çerçevesi:** reklam görselleri her yerde gerçek oranlarında (1:1, 4:5, 9:16) ve 20px köşeli, ince kenarlıkla durur. Telefon çerçevesi ya da sahte platform arayüzü çizilmez.
- **İkon:** tek kütüphane (mevcut `icons.tsx` çizgisi), 1.5px çizgi, 20px. İkon kutusu (renkli zeminli kare) kullanılmaz.
- **Tarayıcı yüzeyleri:** metin seçimi rengi (sitede kobalt %20, panelde kobalt %35), imleç rengi, kaydırma çubuğu (panelde ince ve koyu), odak halkası (2px kobalt, 2px boşluk) belirteçlerden gelir.
- **Boşluk:** sitede bölümler arası 128px (mobil 80px), içerik genişliği 1240px, metin sütunu en fazla 68 karakter. Panelde 8px ızgara, sayfa kenar boşluğu 32px (mobil 16px).

## 7. Site yapısı (beyaz)

Dokuz bölüm. Her bölüm tek bir şeyi kanıtlar.

1. **Üst menü.** Beyaz, yapışkan, kaydırınca 1px alt çizgi. Solda logo. Ortada "Ürün" (mega menü), "Sektörler", "Fiyatlar", "Kurallar". Sağda "Giriş" bağlantısı ve siyah "Ücretsiz başla" düğmesi. Mega menü üç sütun: **Kontrol et** (görsel, video, açılış sayfası, toplu), **Düzelt ve üret** (güvenli metin, varyant, kampanya paketi, düzenleyici, itiraz), **Ekip ve geliştirici** (ajans modu, müşteri onayı, API, Chrome eklentisi). Her öğe kalın ad + bir satır gri açıklama, küçük çizgi ikon. Sağ sütunda tek bir işaretli örnek rapor parçası.

2. **Hero: başlık, çalışan kutu, reklam duvarı.**
   - Sol üstte büyük başlık, iki satır. Yön: "Reklamın yayına girmeden önce bir kez daha bak." gibi kısa ve kendinden emin bir AdScope cümlesi (son metin metin yazımında belirlenir, garanti dili yok).
   - Altında tek cümle: Meta, Google Ads, TikTok politikaları ve Türk reklam mevzuatı; riskli ifadeyi işaretler, güvenli metni yazar.
   - Altında **çalışan kontrol kutusu**: çok satırlı metin alanı ("Reklam metnini yapıştır"), platform seçimi ve "Kontrol et" düğmesi. Oturumsuz ücretsiz kontrolün aynısıdır (`/reklamim-reddedilir-mi` mantığı), sonuç aynı sayfada işaretli metin olarak açılır. Altında küçük not: "Kayıt gerekmez. Risk değerlendirmesidir, hukuki görüş değildir."
   - Sağda ve aşağı taşan **reklam duvarı**: 3-4 sütun, farklı oranlarda AdScope'un kendi örnek reklamları, sütunlar ters yönlerde çok yavaş akar. Duvarın ortasındaki bir reklam belirginleşir; metnindeki iki ifadenin altından işaret çizilir, yanında kenar notu çıkar, sonra güvenli sürüm yazılır. Bu sayfadaki **tek** gösterişli hareket budur.
   - Duvardaki görseller şablonlu görsel üreticiden (ve anahtar varsa Gemini'den) üretilir, gerçek marka içermez, "Örnek reklam" etiketi `alt` metninde yazılır.

3. **Kanıt satırı.** Uydurma kullanıcı sayısı, logo ya da puan yok. Gerçek veriyle: "N kural kartı · M'si hukukçu tarafından doğrulandı · son güncelleme <tarih>" (mevcut `rule-trust-band`, sayılar katalogdan) ve platform adları düz metin.

4. **Önce / sonra.** Başlık: riskli ifade nasıl güvenli hale gelir. Üstte sektör çipleri (Takviye gıda, Kozmetik, Klinik, Kurs, Emlak, Finans, E-ticaret). Seçilen sektörde bir reklam iki halde: solda işaretli metin, sağda güvenli sürüm; arada sürüklenebilir ayraç (klavyeyle ok tuşları). Altında hangi kurala dayandığı ve kural kartı bağlantısı.

5. **Siyah ürün bandı: tek akış.** Tam genişlikli siyah bölüm. Üstte sekmeler: **Kontrol et / Düzelt / Üret / Paketle**. Altında koyu panelin gerçek, büyük ve okunur ekranı (tarayıcı çerçevesi yok, 20px köşe). Sekme değişince ekran değişir. Bu bant ziyaretçiye panelin neye benzediğini dürüstçe gösterir ve beyazdan siyaha geçişi kurar.

6. **Bento.** Farklı genişlikte 5-6 kart, her birinde gerçek bir ekran parçası ya da çıktı: Video ve Reels kare incelemesi (geniş), İtiraz taslağı (dar), Katmanlı düzenleyici (geniş), Toplu kontrol ve platform varyantları (dar), Chrome eklentisi ve API (dar). Kartlarda ikon kutusu yok; başlık, bir cümle ve görsel.

7. **Sektörler.** Altı sektör için büyük görsel kart: örnek reklam, o sektörde en sık işaretlenen iki risk türü ve "Bu sektörün kuralları" bağlantısı. Kartlar eşit değil; ilk ikisi büyük.

8. **Güven ve fiyat.** Solda güven: kuralların kaynakları (kurum adları düz metin, "kaynak" bağlantısı), verinin nerede saklandığı, KVKK, saklama süresi, hukuki uyarı. Sağda fiyat özeti: kredi paketleri ve her paketin "yaklaşık N analiz ya da N görsel seti" karşılığı (maliyet tablolarından otomatik), "abonelik yok, kredi yalnızca iş başarıyla bitince düşer". Rakip adı ve rakip fiyatı yok.

9. **SSS ve kapanış.** Akordeon SSS (6-8 soru, garanti vermediğimizi açıkça söyleyen soru dahil). Ardından tam genişlikli siyah kapanış: büyük başlık ve yine çalışan kontrol kutusu (beyaz düğmeli). Footer siyah devam eder: dört sütun, hukuki uyarı satırı, telif.

Diğer herkese açık sayfalar (fiyatlandırma, kurallar, nasıl çalışır, rehber, bütçe hesaplama, yasal sayfalar, giriş ve kayıt) aynı beyaz dili kullanır. Giriş ve kayıt sayfası: solda form, sağda siyah zemin üstünde tek bir işaretli örnek reklam.

## 8. Panel yapısı (siyah)

Modele göre: panel bir iş aracıdır. Düzen, gezinme ve kontroller alışılmış kalır; kimlik yazı, renk, yoğunluk ve işaretleme imzasıyla gelir. Mevcut işlevlerin ve sayfaların hepsi korunur, yalnızca görünüm ve yerleşim değişir.

### Kabuk
- **Sol menü** 232px, `paper-2` zemin, kenarlık sağda 1px. Üstte logo ve marka seçici (ajans modunda marka değiştirme). Gruplar: başlıksız "Oluştur" (ana sayfa), **Kontrol et** (Yeni analiz, Toplu kontrol, Raporlar), **Üret** (Üret, Görsel araçları, İtiraz asistanı), **Planla** (Sezon takvimi, İlham panosu, Performans), **Yönet** (Markalar, Ekip, API). Grup başlıkları büyük harf değil, küçük gri normal yazı. Aktif öğe: `card` zemin + `ink` metin, solda çizgi yok. Altta kredi bakiyesi (mono rakam, "Kredi al" bağlantısı) ve hesap menüsü.
- **Daraltılabilir menü:** 64px ikon modu, tercih tarayıcıda hatırlanır.
- **Üst çubuk** 56px: konum izi, ortada arama ve komut paleti (Ctrl/Cmd+K), sağda kredi çipi ve beyaz "Yeni analiz" düğmesi.
- **Mobil:** alt çubukta 4 öğe (Oluştur, Raporlar, Üret, Menü); "Menü" tam ekran sayfa açar.
- **Demo modu şeridi:** üstte ince, `card` zeminli, kehribar nokta ile; tüm genişliği kaplayan koyu lacivert bant kalkar.

### Oluştur (ana sayfa `/panel`)
Photoroom'un "her şey buradan başlar" fikrinden esinlenir, KPI kartları kalkar.
- Üstte büyük bir **bırakma alanı**: "Görsel ya da video bırak, metin yapıştır veya site adresi yaz." Girdinin türüne göre doğru akışa gider (görsel/video kontrolü, metin kontrolü, adresten kampanya paketi).
- Altında tek sıra **hızlı eylem hapları**: Görsel kontrol, Video kontrol, Kampanya paketi, Metin üret, İtiraz taslağı, Toplu kontrol. Her birinde kredi bilgisi mono yazıyla.
- **Durum cümlesi:** "1 raporda yüksek risk var" gibi tek satır; bağlantıyla ilgili rapora gider. Veri yoksa gösterilmez.
- **Son çalışmalar:** büyük görsel ızgara (4:5 küçük resimler), her kartta risk rozeti (renk + sayı + düzey adı), platform ve tarih. Izgara/liste geçişi.
- **Yaklaşan sezon günleri:** yatay, sade bir satır listesi (kart değil).

### Rapor `/panel/analiz/[id]` : inceleme ekranı
Düzenleyicinin üç bölgeli düzeni:
- **Sol: tuval.** Reklam görseli ya da video kareleri büyük, `paper` zemin üstünde. Görsel üstündeki metinde ve altındaki reklam metninde işaretler çizili; bir bulguya tıklayınca ilgili işaret vurgulanır.
- **Sağ: inceleme paneli** (380px). En üstte risk skoru (büyük mono rakam + düzey adı + tek cümlelik sonuç), "Önce bunu düzelt" kutusu, sonra sekmeler: Bulgular / Güvenli metin / Varyantlar / İtiraz / Paylaş. Bulgular düzeye göre gruplu, mevcut `SeverityFilter` korunur.
- **Hukuki uyarı** panelin altında her zaman görünür.
- Mobilde tuval üstte, inceleme paneli altta, sekmeler yapışkan.

### Yeni analiz sihirbazı
Odak modu: sol menü gizlenir, üstte adım çubuğu (Stepper) ve "Çık". Solda form, sağda canlı önizleme ve canlı uyum işaretleri (`LiveTextField`).

### Üret ve düzenleyici
Üç bölge: solda araç çubuğu, ortada tuval, sağda ayarlar. Önizlemeler koyu zemin üstünde gerçek oranında. Kampanya paketi adımları tek dikey akışta, her varyant kartında risk rozeti.

### Listeler ve diğer sayfalar
Raporlar, toplu kontrol, ilham, markalar, ekip, API, krediler ve ayarlar aynı kabuğu ve bileşenleri kullanır: tablo satırları 48px, başlık satırı yapışkan, satır üzerine gelince `card` zemin. Boş durum: ne eksik, neden önemli, tek sonraki adım; küçük bir işaretli örnek görsel.

## 9. Hareket

- Sayfada tek bir anlatılan an: landing hero'daki inceleme. Diğer bölümlerde giriş animasyonu yok ya da yalnızca opaklık (200 ms).
- Panelde hareket yalnızca geri bildirim içindir: menü açılışı 150 ms, sekme geçişi, kaydedildi bildirimi, işaret çizimi (240 ms, ease-out).
- `prefers-reduced-motion` açıkken duvar durur, işaretler animasyonsuz görünür.

## 10. Erişilebilirlik ve kalite tabanı

- WCAG 2.2 AA: yukarıdaki tüm metin/zemin çiftleri 4.5:1'i geçer; uygulamada axe her iki yüzeyde çalışır.
- Odak halkası her yerde görünür (kobalt, 2px). Dokunma hedefi en az 44px.
- Önce/sonra ayracı, reklam duvarı ve sekmeler klavyeyle kullanılır; duvar duraklatılabilir.
- Sitede Lighthouse performans ve erişilebilirlik 90+; duvar görselleri tembel yüklenir, boyutları ayrılır (CLS < 0.1).
- Garanti dili yok; hukuki uyarı raporda, dışa aktarımda, SSS'de ve footer'da görünür.

## 11. Uydurma yok, kopya yok

- Kullanıcı sayısı, müşteri logosu, yorum, puan, "%X daha hızlı" gibi rakamlar yalnızca gerçek ve belgelenebilirse konur.
- Örnek reklamlar AdScope'un kendi şablonlarından üretilir, gerçek marka içermez, örnek olduğu belirtilir.
- Referans sitelerin metni, sloganı, görseli, ikonu ve birebir düzeni kullanılmaz. Bölüm türleri (galeri, önce/sonra, bento, mega menü) sektörün ortak dilidir; içerik ve kompozisyon AdScope'a özgüdür.
- Platform adları (Meta, Google, TikTok) yalnızca tanımlayıcı olarak, logosuz kullanılır.

## 12. Daha yakın sonuç için

Bu dokümanı hazırlayan oturumda tarayıcı bağlı değildi; referans sitelerin renk kodları ve panel ekranları görülemedi. Uygulama oturumundan önce trypix panelinin, Photoroom web uygulamasının (koyu temada) ve adject uygulamasının birkaç ekran görüntüsünü (masaüstü ve telefon) oturuma eklersen, uygulama oturumu boşluk, yoğunluk ve ölçeği o hisse yaklaştırabilir. Görüntüler yalnızca tarz referansıdır ve başkasına ait olduğu için repoya commit edilmez.
