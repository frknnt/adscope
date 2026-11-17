# AdScope arayüz yönü: lacivert, açık tema, modern reklam-teknoloji SaaS'ı

Bu dosya AdScope'un yeni görsel yönünü tanımlar. Hedef: AdCreative.ai gibi reklam-teknoloji SaaS'larının kullandığı modern, ferah, ürün odaklı tasarım dili; ana renk lacivert, yalnızca açık tema. Uygulandığında `DESIGN.md` bu dosyaya göre güncellenir.

## Sınır: aynı tarz, kopya değil

Aynı tasarım dilini kullanıyoruz: beyaz zemin, büyük ve kalın başlıklar, mega menü, örnek reklamlardan oluşan kolaj, alternatif özellik blokları, ürün ekranı maketleri, fiyat kartları. Şunları **almıyoruz**: logo, marka adı, metinler ve sloganlar, görseller ve videolar, ikonlar, birebir sayfa düzeni ve oranları. Hepsi AdScope'un kendi içeriğiyle üretilir. Bu hem hukuki risk (ticari görünüm, telif) hem de güven meselesi: kullanıcı "kopya" olduğunu fark ederse AdScope'a güvenmez.

**Uydurma kanıt yok.** Kullanıcı sayısı, müşteri logoları, yorumlar, puan rozetleri (G2, Trustpilot vb.) ve "%X daha fazla dönüşüm" gibi rakamlar ancak gerçek ve belgelenebilir olduğunda konur. O zamana kadar bu bölümlerin yerine aşağıdaki "gerçek veri yokken" alternatifleri kullanılır.

## Renk (yalnızca açık tema)

Otomatik koyu tema kaldırılır. Yazdırma ve PDF zaten açık.

| Belirteç | Değer | Kullanım |
|---|---|---|
| `bg` | #ffffff | Sayfa zemini |
| `bg-soft` | #f5f7fb | Alternatif bölüm zemini, panel zemini |
| `bg-tint` | #eef2fa | Maket arka planları, seçili satır, rozet zemini |
| `navy-950` | #071430 | Footer, en koyu bant |
| `navy-900` | #0b1b3f | Başlıklar, birincil düğme, aktif menü |
| `navy-800` | #13285a | Birincil düğme üzeri (hover) |
| `navy-700` | #1d3a7a | İkincil vurgu, grafik çizgisi |
| `blue-500` | #2f6bff | Bağlantı, odak halkası, gradyan ucu, "Yeni" rozeti |
| `blue-50` | #eaf0ff | Mavi rozet zemini |
| `text` | #0b1b3f | Başlık |
| `text-body` | #475069 | Gövde |
| `text-muted` | #6b7489 | Açıklama, ipucu |
| `border` | #e6e9f0 | Kart ve ayraç |
| `border-strong` | #cfd5e2 | Form alanı |
| `risk-high` / tint | #d93b2b / #fdecea | Yüksek risk, kırmızı bayrak, hata |
| `risk-mid` / tint | #b26b00 / #fff4dc | Orta risk, sarı bayrak |
| `risk-low` / tint | #15803d / #e7f6ec | Düşük risk, başarı |
| `coral` | #e2553a | Yalnızca logo işareti ve vurgulu işaretleyici (marka mirası) |

**Gradyan:** `linear-gradient(120deg, #0b1b3f 0%, #1d3a7a 50%, #2f6bff 100%)`. Kullanım yerleri: hero başlığındaki vurgulu ifade (metin gradyanı), kapanış CTA bandı, öne çıkan fiyat kartı. Başka yerde kullanma; gradyan çoğaldıkça ucuzlar.

Risk renkleri her zaman metin etiketi ve ikonla birlikte kullanılır. Tüm metin/zemin çiftleri WCAG AA (4.5:1) geçmeli.

## Tipografi

- Tek aile: **Manrope** (zaten yüklü). Fraunces arayüzden çıkar. PDF rapor bir sonraki adımda aynı yöne çekilir.
- Başlıklar 800 ağırlık, harf aralığı -0.03em, satır yüksekliği 1.05-1.15.

| Rol | Masaüstü | Mobil | Ağırlık |
|---|---|---|---|
| H1 (hero) | 60px | 38px | 800 |
| H2 (bölüm) | 42px | 30px | 800 |
| H3 (kart) | 22px | 20px | 700 |
| Eyebrow (bölüm üst etiketi) | 13px, büyük harf, 0.08em aralık | aynı | 700, `blue-500` metin, `blue-50` hap zemin |
| Gövde büyük (hero alt başlık) | 19px | 17px | 500 |
| Gövde | 16px | 16px | 400-500 |
| Küçük | 14px | 14px | 500 |

## Biçim

- Köşe: düğme ve form alanı 12px, kart 20px, büyük maket ve bant 28px, rozet tam yuvarlak.
- Gölge (kartlar): `0 1px 2px rgb(11 27 63 / .06), 0 12px 32px -16px rgb(11 27 63 / .22)`. Hover'da hafif yükselme (`translateY(-2px)`, gölge biraz büyür).
- Kenarlık: 1px `border`. Kart = beyaz zemin + kenarlık + hafif gölge.
- Düğmeler (48px yükseklik, 20-24px yatay boşluk, 600 ağırlık):
  - Birincil: `navy-900` zemin, beyaz metin.
  - İkincil: beyaz zemin, `border-strong` kenarlık, `navy-900` metin.
  - Metin bağlantısı: `blue-500`, sağa ok ikonu.
- İkonlar: tek çizgi kalınlığı (1.75px), yuvarlak uçlu, 20-24px; kart başında `bg-tint` zeminli 44px kare (12px köşe) içinde.
- Boşluk: bölümler arası masaüstünde 112px, mobilde 72px. İçerik genişliği en fazla 1200px. Yan boşluk mobilde 20px.
- Hareket: bölümler ekrana girerken 12px yukarıdan yumuşak giriş (bir kez), kolaj kartlarında çok yavaş yüzme (6-8 sn). `prefers-reduced-motion` ile hepsi kapanır.

## Site yapısı (landing)

1. **Duyuru şeridi (isteğe bağlı):** yalnızca gerçekten aktif bir kampanya varken. Lacivert ince bant, tek cümle, bağlantı. Sahte geri sayım yok.
2. **Üst menü:** yapışkan, beyaz, kaydırınca alt kenarlık ve hafif bulanıklık. Solda logo. Ortada "Özellikler" mega menüsü ve Fiyatlar, Ajanslar, Kurallar. Sağda "Giriş" bağlantısı, "Ücretsiz kontrol" ikincil düğme, "Ücretsiz başla" birincil düğme.
   - Mega menü grupları (AdScope'un kendi akışı): **Kontrol et** (reklam ön kontrolü, video/Reels, açılış sayfası, toplu kontrol), **Düzelt** (güvenli metin ve varyantlar, itiraz asistanı, kısıtlama rehberi), **Planla** (sezon takvimi, ilham panosu, DM şablonu), **Yönet** (ajans modu, avukat bağlantısı, API, Chrome eklentisi). Yeni özelliklere `blue-50` zeminli "Yeni" rozeti. Sağ sütunda örnek rapor kartı.
3. **Hero (iki sütun):**
   - Sol: eyebrow hap ("Türkiye'ye özel reklam ön kontrolü"), H1 (ör. "Reklamını yayınlamadan önce **riskini gör**", vurgulu kısım gradyan metin), alt başlık (Meta, Google Ads, TikTok ve Türk reklam mevzuatı; güvenli metin, varyant, itiraz), iki düğme ("Ücretsiz başla", "Kayıt olmadan dene"), altında küçük not ("Kart gerekmez · 3 ücretsiz analiz").
   - Sağ: AdScope'un kendi örnek reklamlarından 5-7 kartlık kolaj (farklı oranlar: 1:1, 4:5, 9:16). Üzerlerinde yüzen küçük çipler: "Ret riski 18/100 · Düşük", "1 sarı bayrak: 'kesin sonuç'", "Güvenli metin hazır". Görseller `src/lib/sample.ts` ve kampanya şablonlarından üretilir, stok veya rakip görseli değil.
4. **Sektör şeridi** (müşteri logoları yerine): yavaş kayan şerit; ikon + sektör adı (takviye gıda, estetik/klinik, kozmetik, kurs/eğitim, emlak, finans, e-ticaret). Başlık: "Riskli sektörler için kural paketleri".
5. **"Bugün neye ihtiyacın var?" seçici:** 4 sekme (`Tabs` bileşeni): "Reklamım reddedildi", "Yeni reklam hazırlıyorum", "Ajansım, çok markam var", "Hesabım kısıtlandı". Her sekme: 3 maddelik çözüm, ilgili ürün ekranı, tek düğme.
6. **Alternatif özellik blokları (4 adet, görsel bir sağda bir solda):** her biri eyebrow, H2, kısa paragraf, 3 madde, metin bağlantısı. Görsel: `bg-tint` zemin üstünde tarayıcı çerçeveli gerçek ürün ekran görüntüsü.
   1. Ön kontrol ve risk skoru
   2. Güvenli metin ve 5 varyant (önce/sonra, işaretli ifadeler)
   3. Video/Reels analizi (kareler, kanca, altyazı güvenli alanı)
   4. İtiraz asistanı (TR + EN taslak)
7. **Rapor maketi bölümü:** geniş, ortalanmış; gerçek bir AdScope raporunun sadeleştirilmiş ekranı (risk göstergesi, bulgular, kural kartı bağlantısı). Çevresinde 3 açıklama çipi.
8. **Kanıt bölümü:**
   - Gerçek veri varken: kullanıcı sayısı, kontrol edilen reklam sayısı, izinli müşteri yorumu.
   - Gerçek veri yokken: "Nasıl çalışır" 3 adım (yükle, kontrol et, düzelt ve yayınla) ve "Kurallarımızın kaynakları" şeridi. Kurum adları düz metin olur, logo kullanılmaz; her birinin yanında "kaynak" etiketi bulunur.
9. **Hepsi bir arada ızgarası:** 6 kart (3x2; mobilde 1 sütun). Ön kontrol, video analizi, itiraz, sezon takvimi, ajans modu, API ve eklenti. Her kartta ikon, başlık, 2 satır metin ve bağlantı.
10. **Fiyat özeti:** 4 kart. Öne çıkan "Profesyonel" kartı lacivert gradyan zeminli, beyaz metinli ve "Önerilen" rozetli. Altında "Tüm fiyatlar" bağlantısı. Abonelik olmadığı vurgulanır.
11. **SSS:** akordeon, 6-8 soru. Hukuki uyarı ve "garanti vermiyoruz" açıklaması burada da yer alır.
12. **Kapanış bandı:** 28px köşeli, gradyan zeminli geniş kart. Beyaz H2, tek birincil düğme (beyaz zemin, lacivert metin).
13. **Footer:** `navy-950` zemin, 4 sütun (Ürün, Kaynaklar, Şirket, Yasal) ve logo. Altında hukuki uyarı satırı ("Risk değerlendirmesidir, hukuki görüş değildir") ve telif satırı.

## Panel yapısı

Ayrıntılı ve güncel tarif: `docs/PANEL_TASARIMI.md` (bu bölüm özet olarak kalır).

- Zemin `bg-soft`. Kartlar beyaz, kenarlıklı ve hafif gölgeli.
- **Sol menü:** beyaz, 260px genişlik. Gruplar: Üret / Kontrol et / Yönet. Aktif öğe `bg-tint` zemin ve `navy-900` metinle, solda 3px mavi çizgiyle gösterilir. Mobilde alt gezinme çubuğu.
- **Üst çubuk:** sayfa başlığı, kredi çipi (ör. "12 kredi"), "Yeni analiz" birincil düğmesi, hesap menüsü.
- **Ana sayfa:** 4 özet kutusu (son skor, kalan kredi, açık uyarı, yaklaşan sezon günü), son analizler tablosu, kural güncellemesi uyarısı.
- **Rapor:** üstte büyük risk göstergesi kartı, yanında "Önce bunu düzelt" kartı; altında sekmeler (Bulgular / Güvenli metin / Varyantlar / İtiraz / Paylaş).

## Claude'a verilecek uygulama komutu

Yeni bir Claude Code oturumunda, `docs/CLAUDE_KOMUTLARI.md`'deki "Her oturumun başına" metninin altına yapıştır. İş büyük olduğu için üç oturuma bölündü.

### Oturum 1: belirteçler ve bileşenler

```text
GÖREV: docs/TASARIM_YONU.md'yi oku ve "Renk", "Tipografi", "Biçim" bölümlerini uygula. src/app/globals.css'teki belirteçleri bu değerlere çevir. Otomatik koyu tema bloğunu ve tests/e2e/theme.spec.ts'teki koyu tema testini kaldır; yerine aynı sayfaları açık temada axe ile denetleyen bir test bırak. Yazdırmanın açık kalması testi dursun. Fraunces'i arayüzden çıkar, başlıkları Manrope 800 yap. Button, Field, Panel, EmptyState, Stepper, DataTable, Tabs ve Dialog bileşenlerini yeni biçime getir: 12px köşe, 48px düğme, kart gölgesi. Bileşenleri tek tek yeniden yazma, sınıfları güncelle. DESIGN.md'yi yeni değerlerle yeniden yaz. Tüm demo e2e ve axe testleri geçmeli. Ana sayfa, panel ve rapor için 1440px ve 390px ekran görüntüsü al ve kendin kontrol et.
```

### Oturum 2: landing page

```text
GÖREV: docs/TASARIM_YONU.md'deki "Site yapısı (landing)" bölümünü src/app/(site)/page.tsx ve site-chrome.tsx (menü, footer) üzerinde uygula. Mega menü klavyeyle ve dokunmatikle çalışmalı (Esc kapatır, odak yönetimi doğru). Hero kolajı için src/lib/sample.ts ve kampanya şablonlarından kendi örnek reklam kartlarını HTML/CSS ile üret; stok ya da başka bir sitenin görselini kullanma. Ürün ekran görüntüleri için gerçek panel sayfalarının sadeleştirilmiş HTML maketlerini kullan (resim dosyası değil, erişilebilir metinli). Kullanıcı sayısı, müşteri logosu, yorum, puan rozeti ve performans yüzdesi koyma; "gerçek veri yokken" alternatiflerini uygula. Hiçbir metin garanti vermesin, hukuki uyarı footer'da ve SSS'de görünsün. Başka bir sitenin metnini ya da sloganını kullanma, tüm metinler AdScope'un kendi Türkçe metni olsun. Lighthouse performans ve erişilebilirlik 90+ olmalı. site.spec.ts testleri geçmeli. 1440px, 768px ve 390px ekran görüntüsü al, taşma ya da kırık hizalama varsa düzelt.
```

### Oturum 3: panel

```text
GÖREV: docs/TASARIM_YONU.md'deki "Panel yapısı" bölümünü uygula: panel layout.tsx ve panel-nav.tsx (gruplu sol menü, mobil alt çubuk, üst çubukta kredi çipi ve Yeni analiz düğmesi), panel ana sayfası (4 özet kutusu ve son analizler tablosu) ve rapor sayfası (risk kartı, "Önce bunu düzelt", sekmeler). Mevcut işlevlerin hiçbiri kaybolmasın, yalnızca yerleşim ve görünüm değişsin. Rapor sayfasında hukuki uyarı her zaman görünür kalsın. Tüm e2e testlerini yeni yapıya göre güncelle (beklentiyi gevşetme, yalnızca seçicileri düzelt), axe temiz kalsın. 1440px ve 390px ekran görüntüsü al ve kontrol et.
```

## Daha yakın sonuç için

Claude'un çalıştığı ortam bazı sitelere doğrudan erişemeyebilir. Beğendiğin bir sitenin ekran görüntülerini (masaüstü ve telefon) oturuma eklersen, Claude boşluk, ölçek ve yerleşimi o hisse yaklaştırabilir. Görüntüleri yalnızca tarz referansı olarak kullanmasını, metin ve görsel almamasını iste.
