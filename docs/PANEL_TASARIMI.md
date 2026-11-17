# AdScope paneli: yeniden tasarım (P6.3)

Bu dosya giriş yapılmış kullanıcının panelini, `docs/TASARIM_YONU.md`'deki lacivert ve açık tema diliyle yeniden tanımlar. Amaç: AdCreative.ai gibi modül odaklı, ferah, "araç kutusu" hissi veren bir müşteri paneli; içerik ve işlevler AdScope'un kendisi.

## Kaynak ve sınır

- AdCreative'in müşteri paneline giriş yapılmadı; hesap gerekiyor ve bu çalışma ortamından siteye bağlantı engelli. Aşağıdaki "AdCreative'den alınan desenler" bölümü, herkese açık incelemelerden (Hackceleration, Madgicx, Creatify, Dupple) ve AdCreative yardım merkezindeki makale başlıklarından çıkarılmış bir **özellik haritasıdır**. Ekranların birebir düzenini göstermez.
- Panelin ekran görüntülerini (masaüstü ve telefon) oturuma eklersen Claude yerleşimi o hisse yaklaştırabilir. Görüntüler yalnızca tarz referansıdır: metin, ikon, görsel ve marka alınmaz.
- Mevcut hiçbir işlev kaybolmaz. Değişen yalnızca yerleşim, gezinme ve görünümdür. Her raporda "Risk değerlendirmesidir, hukuki görüş değildir" uyarısı görünür kalır.

## AdCreative'den alınan desenler

| Desen | AdCreative'de (incelemelere göre) | AdScope'ta karşılığı |
|---|---|---|
| Modül odaklı menü | Ad Creatives, Product Shoots, Videos, Creative Scoring, Competitor Insights, Utility Suite ayrı modüller | Menü işe göre gruplanır: Kontrol et / Düzelt / Planla / Yönet |
| Marka merkezli çalışma | Her marka için logo, renk, yazı tipi, açıklama; plan başına marka sınırı | Üst çubukta **marka seçici**; seçili marka yeni analizde varsayılan olur, geçmişte süzgeç olur |
| Rehberli kurulum | Kayıttan sonra marka kurulumu | `/panel/baslangic` adımlı karşılama |
| Adımlı üretim akışı | Boyut, metin, görsel, üret | Yeni analiz sihirbazı + sağda canlı önizleme |
| Sonuç ızgarası ve skor | Üretilen kreatifler kart ızgarasında, 0-100 skor | Geçmiş ızgara görünümü; her kartta ret riski rozeti |
| Kredi hep görünür | Kredi indirmede harcanır | Üst çubukta kredi çipi; işlem düğmelerinde maliyet ("1 kredi") |
| Rakip ve ilham bankası | Competitor Insights, Ad Inspiration Bank | İlham panosu: arama, ızgara, "N gündür yayında" rozeti, panoya ekleme |
| Araçlar paketi | Arka plan silme, büyütme | Şimdilik yok; Faz 2'de "Araçlar" menüye eklenir |

## Kabuk (her panel sayfası)

**Masaüstü (1024px ve üstü)**

- **Sol menü**: 264px genişlik, beyaz zemin, sağda 1px `line` kenarlık, ekran yüksekliğinde sabit.
  - En üstte logo.
  - Gruplar ve öğeler:
    - (grupsuz) **Pano** `/panel`
    - **Kontrol et:** Yeni analiz `/panel/yeni`, Toplu kontrol `/panel/toplu`, Raporlar `/panel/gecmis` (rapor sayfasında da etkin)
    - **Düzelt:** İtiraz asistanı `/panel/itiraz`
    - **Planla:** Sezon takvimi `/panel/takvim`, İlham panosu `/panel/ilham`
    - **Yönet:** Markalar `/panel/markalar`, Ekip `/panel/ekip`, API `/panel/api` (bugün yalnızca ayarlardan erişiliyor, menüye taşınır)
  - Grup başlıkları 12px, büyük harf, `muted`.
  - Etkin öğe: `bg-tint` zemin, `ink` metin, solda 3px `blue` çizgi. Diğer öğeler: `ink-soft` metin, hover'da `paper-2` zemin.
  - En altta: kredi kartı (bakiye, "Kredi al" bağlantısı; bakiye 2 veya daha azsa `amber-tint` zemin), Ayarlar, kullanıcı e-postası ve Çıkış.
- **Üst çubuk**: 64px yükseklik, beyaz zemin, alt kenarlık, yapışkan.
  - Solda sayfa başlığı. Rapor gibi alt sayfalarda kırıntı: "Raporlar / Detoks çayı".
  - Ortada arama düğmesi: "Ara… Ctrl K" ile komut paleti açılır.
  - Sağda sırasıyla:
    - Marka seçici: "Tüm markalar" ya da marka adı; marka yoksa gizli.
    - Kredi çipi: "12 kredi", `/panel/krediler`'e gider.
    - "Yeni analiz" birincil düğmesi.
- **İçerik**: zemin `paper-2`, en fazla 1200px genişlik, 32px iç boşluk. Kartlar beyaz, `rounded-2xl`, `shadow-card`.

**Mobil**

- Üstte 56px çubuk: logo, kredi çipi, menü düğmesi. Menü düğmesi tam ekran bir çekmece açar ve sol menünün tamamını gösterir.
- Altta sabit gezinme çubuğu, 5 öğe: Pano, Raporlar, ortada büyük **+** (Yeni analiz), İtiraz, Menü. Güvenli alan boşluğu (`env(safe-area-inset-bottom)`) bırakılır.

**Komut paleti (Ctrl/Cmd + K)**

- İçerik: sayfalar, son 10 analiz (başlık ve ret riski), markalar.
- Eylemler: "Yeni analiz", "Toplu kontrol", "İtiraz taslağı".
- Klavye: ok tuşları ve Enter; Esc kapatır.
- Yerel `<dialog>` üzerine kurulur (`Dialog` bileşeni).

**Marka seçici**

- Seçim bir çerez ile saklanır (yalnızca marka kimliği). Sunucu tarafında doğrulanır: kullanıcının kendi markası ya da ekip olarak eriştiği marka değilse yok sayılır.
- Yeni analiz sihirbazında marka alanını önceden doldurur, Raporlar'da süzgeç olur.

## Sayfalar

Her sayfada dört durum tasarlanır: dolu, boş (`EmptyState`), yükleniyor (`Skeleton`, `notFound()` çağırmayan sayfalarda) ve hata (genel, teknik ayrıntısız mesaj).

### Pano `/panel`

1. **Karşılama satırı**: "Merhaba" ve tek cümlelik durum, ör. "2 raporda yüksek risk var."
2. **4 özet kartı** (gerçek veriden; veri yoksa kart "—" gösterir):
   - Kalan kredi
   - Bu ay yapılan analiz
   - Son 10 analizin ortalama ret riski
   - Yüksek riskli rapor sayısı
3. **Kural güncellemesi uyarısı**: mevcut yeniden tarama kutusu, `amber-tint` kart olarak.
4. **Hızlı başlat**: 4 kutu. Her kutuda ikon, başlık ve maliyet:
   - Görsel kontrol (1 kredi)
   - Video/Reels kontrol (2 kredi)
   - Toplu kontrol (kredisiz)
   - İtiraz taslağı (kredisiz)
5. **Son raporlar**: en fazla 6 kartlık ızgara (Raporlar sayfasındaki kartla aynı) ve "Tümünü gör" bağlantısı.
6. **Yaklaşan sezon günleri**: en yakın 3 gün ve "Şablonla başla".
7. **İlk kullanım**: hiç analiz yoksa 2-6 yerine 4 adımlı başlangıç listesi gelir:
   1. Marka ekle
   2. İlk kontrol
   3. Raporu indir
   4. Ekibini davet et
   
   Her adımın tamamlanma durumu gerçek veriden hesaplanır.

### Yeni analiz `/panel/yeni`

- İki sütun: solda mevcut 6 adımlı sihirbaz, sağda yapışkan **önizleme kartı**.
- Önizleme kartı seçilen platformun akış görünümünü taklit eder: sayfa adı, ana metin, görsel ve başlık. Önizleme platformun gerçek arayüzünü kopyalamaz, sade bir taslaktır.
- Platform seçimi segment kontrol olur: Meta / Google Ads / TikTok.
- Gönder düğmesinin yanında maliyet görünür ("1 kredi" ya da "2 kredi") ve kalan bakiye yazar.
- Taslak tarayıcıda otomatik saklanır. Dosyalar saklanmaz, yalnızca metin alanları. Tekrar girişte "Taslağı geri yükle" sorulur.
- Mobilde önizleme, sihirbazın sonunda açılır-kapanır bir bölüm olur.

### Rapor `/panel/analiz/[id]`

- **Başlık bandı**:
  - Solda küçük kreatif görseli, başlık, platform, marka ve tarih.
  - Sağda "PDF indir" ve "Paylaş" menüsü. Paylaş menüsünün içinde: e-postayla gönder, avukat inceleme bağlantısı, CSV, yazdır.
- **Skor satırı**: üç kart (Meta ret riski, mevzuat riski, kreatif skoru). Her kartta büyük sayı, düzey rozeti ve ölçek çubuğu.
- **"Önce bunu düzelt" kartı**: `blue-tint` zemin; en kritik bulgu ve güvenli öneri, "Kopyala" düğmesi.
- **Sekmeler** (`Tabs`):
  - **Bulgular**: üstte düzey süzgeci (Tümü, Kırmızı, Sarı, Bilgi). Her bulgu kartında:
    - eşleşen ifade vurgulu
    - kural kartı başlığı ve durumu (Aktif / Doğrulama bekliyor)
    - kaynak bağlantısı
    - düzeltme önerisi
    - "Doğru / Yanlış uyarı" geri bildirimi
  - **Güvenli metin ve varyantlar**: önce/sonra yan yana, değişen kelimeler vurgulu; 5 varyant kart ızgarasında, her birinde "Kopyala" ve yeniden tarama sonucu.
  - **Video** ve **Açılış sayfası**: yalnızca o veri varsa görünür.
  - **DM şablonu**
  - **İtiraz**: ret mesajı formu ve taslak.
- Hukuki uyarı sekmelerin altında her zaman görünür.
- Bekleyen veya başarısız analiz için mevcut durum ekranları korunur.

### Raporlar `/panel/gecmis`

- **Araç çubuğu**:
  - metin araması
  - marka, platform ve risk düzeyi süzgeçleri
  - tarih sıralaması
  - ızgara/liste geçişi
- **Izgara kartı**:
  - kreatif görseli (video için ilk kare ve "Video" rozeti)
  - sol üstte ret riski rozeti (renk + sayı + düzey adı)
  - başlık, platform çipi, marka adı, tarih
  - "Aç" ve üç nokta menüsü: PDF, sil
- **Liste görünümü**: `DataTable` ile aynı alanlar.
- Toplu seçim: seçilenleri sil (onay `Dialog`'u ile), seçilenleri CSV indir.
- Boş durum: "Henüz rapor yok" ve "İlk analizi başlat".

### Toplu kontrol `/panel/toplu`

- İki bölme.
- Solda metin alanı (reklamlar boş satır ya da `---` ile ayrılır), marka seçimi ve "Kontrol et" (kredisiz) düğmesi.
- Sağda sonuç tablosu: en riskliden başlar, her satırda risk rozeti ve ilk bulgu; CSV indirme ve güvenli metni kopyalama.
- Mobilde iki bölme alt alta.

### İtiraz asistanı `/panel/itiraz`

- Solda form: ret mesajı, isteğe bağlı mevcut rapor seçimi.
- Sağda sonuç: tespit edilen politika, öneri (itiraz mı yeni reklam mı) ve TR/EN sekmeli taslak.
- Altta tam genişlikte kısıtlama rehberi; ilerleme çubuğu ile 8 adım.

### Sezon takvimi `/panel/takvim`

- Üstte önümüzdeki 12 ayın yatay zaman çizelgesi. Her gün bir nokta, sektör süzgeci.
- Altında "Yaklaşanlar" listesi ve her gün için kampanya şablonu kartları ("Bu şablonla başla").
- Hatırlatma e-postası açma/kapatma ve `.ics` indirme sağ üstte.

### İlham panosu `/panel/ilham`

- Sekmeler: **Ara** / **Panom**.
- Ara sekmesi:
  - Üstte geniş arama çubuğu, ülke seçimi, "yalnızca Türkçe" ve "yalnızca aktif" seçenekleri.
  - Sonuçlar ızgarada. Her kartta:
    - sayfa adı
    - metin özeti
    - "N gündür yayında" rozeti
    - platformlar
    - AdScope risk sinyali çipleri
    - "Panoya ekle"
    - "Benzerini kontrol et"
- Token yoksa açıklayıcı boş durum gösterilir. Ticari reklamların yalnızca AB için açık olduğu not olarak yazılır.

### Markalar `/panel/markalar`

- Marka kartları ızgarası. Her kartta logo ya da baş harf, ad, sektör, ton, yasaklı kelime sayısı, analiz sayısı ve "Düzenle".
- "Yeni marka" ve "Düzenle" aynı formu `Dialog` içinde açar.
- Plan sınırı varsa üstte "3 / 10 marka" göstergesi.

### Ekip `/panel/ekip` ve davet `/panel/ekip/katil`

- Üye tablosu: e-posta, rol rozeti (Sahip / Salt okunur), katılma tarihi, kaldır.
- Sağda davet kartı.
- "Üyesi olduğun ekipler" ayrı kart.
- Davet sayfası tek kartlık sade bir onay ekranı.

### Krediler `/panel/krediler`

- Üstte gradyan bakiye kartı: büyük sayı ve "yaklaşık N görsel analizi".
- Altında paket kartları (landing'deki fiyat kartlarıyla aynı bileşen).
- Kredi hareketleri `DataTable`, siparişler listesi.

### Ayarlar `/panel/ayarlar`

- Solda alt menü (mobilde üstte sekmeler): Profil ve saklama, Bülten, API ve eklenti, Verilerin, Hesabı sil.
- "Hesabı sil" kırmızı çerçeveli "tehlikeli bölge" kartı. Onay `Dialog` ile, e-posta yazdırarak alınır.

### API `/panel/api`

- Anahtar tablosu: ad, son kullanım, oluşturma tarihi, iptal.
- "Yeni anahtar" düğmesi. Anahtar yalnızca bir kez, kopyalama düğmeli bir `Dialog`'da gösterilir.
- Kullanım özeti ve örnek istek (kod bloğu, kopyala).

### Başlangıç `/panel/baslangic`

- Ortalanmış tek kart, 3 adımlı `Stepper`:
  1. Marka adı ve sektör
  2. Logo ve ton (isteğe bağlı)
  3. İlk analize geç
- Her adımda "Atla". Bitince Pano.

### Herkese açık inceleme `/inceleme/[token]`

- Panel kabuğu yok. Sade bir başlık: logo ve "Salt okunur inceleme".
- Rapor görünümünün sadeleştirilmiş hali ve hukuki uyarı.

## Eklenecek bileşenler

`AppShell`, `Sidebar`, `Topbar`, `MobileNav` (alt çubuk ve çekmece), `CommandPalette`, `BrandSwitcher`, `CreditChip`, `KpiCard`, `RiskBadge` (renk + sayı + düzey adı), `AdThumb` (görsel/video küçük resmi), `FilterBar`, `SegmentedControl`, `Menu` (üç nokta ve Paylaş; klavyeyle gezilebilir).

Var olanlar yeniden kullanılır: `Button`, `Field`, `Panel`, `EmptyState`, `Skeleton`, `Stepper`, `DataTable`, `Tabs`, `Dialog`, `ToastProvider`, `LevelPill`, `ScaleBar`, `Disclaimer`. Kopya bileşen yazılmaz; `DESIGN.md` bileşen tablosu güncellenir.

## Kurallar

- Pano ve özet kartlarındaki her sayı gerçek veriden gelir. Veri yoksa boş durum gösterilir, örnek rakam gösterilmez.
- Renk tek başına anlam taşımaz: risk rozetleri her zaman düzey adını yazar.
- Dokunma hedefleri en az 44px. Klavyeyle tüm menüler, sekmeler ve diyaloglar kullanılabilir. axe testleri temiz kalır.
- Yükleme sınırı (`loading.tsx`) `notFound()` çağıran sayfalara konmaz (rapor sayfası 404 yerine 200 döner).
- Rapor ve dışa aktarımda hukuki uyarı her zaman görünür.
- Testlerdeki seçiciler yeni yapıya göre güncellenir; beklentiler gevşetilmez.

## Claude'a verilecek komutlar

Her birini ayrı bir oturumda, `docs/CLAUDE_KOMUTLARI.md`'deki "Her oturumun başına" metninin altına yapıştır.

### Oturum 1: kabuk ve gezinme

```text
GÖREV: docs/PANEL_TASARIMI.md'deki "Kabuk" bölümünü uygula: src/app/panel/layout.tsx ve panel-nav.tsx yerine AppShell, Sidebar (gruplu menü, API menüye taşınır, altta kredi kartı), Topbar (başlık/kırıntı, Ctrl+K arama düğmesi, marka seçici, kredi çipi, Yeni analiz), MobileNav (alt çubuk + çekmece) ve CommandPalette. Marka seçici çerezde yalnızca marka kimliği tutar ve sunucuda sahiplik/ekip erişimiyle doğrulanır. Mevcut tüm sayfalar yeni kabukta çalışmalı. Tüm e2e ve axe testleri geçmeli; seçicileri güncelle, beklentiyi gevşetme. 1440px ve 390px ekran görüntüsü al, kontrol et, DESIGN.md bileşen tablosunu güncelle.
```

### Oturum 2: Pano ve Raporlar

```text
GÖREV: docs/PANEL_TASARIMI.md'deki "Pano" ve "Raporlar" bölümlerini uygula. Özet kartları gerçek veriden hesapla (gerekirse depo arayüzüne bellek ve Supabase uygulamasıyla birlikte toplulaştırma metodu ekle, RLS'e uy). Raporlar sayfasına ızgara/liste görünümü, arama, marka-platform-risk süzgeçleri (URL parametresiyle), AdThumb ve RiskBadge'li kartlar, toplu silme (Dialog onayı) ve CSV ekle. İlk kullanım başlangıç listesini gerçek veriye bağla. Testler: süzgeçler, boş durum, başka kullanıcının raporu görünmüyor. Ekran görüntüleriyle kontrol et.
```

### Oturum 3: Rapor ve Yeni analiz

```text
GÖREV: docs/PANEL_TASARIMI.md'deki "Rapor" ve "Yeni analiz" bölümlerini uygula. Rapor: başlık bandı, Paylaş menüsü (e-posta, avukat bağlantısı, CSV, yazdır), skor kartları, "Önce bunu düzelt", sekmeler (Bulgular süzgeçli; Güvenli metin önce/sonra ve kelime farkı vurgusu; Video/Sayfa yalnızca veri varsa; DM; İtiraz). Hukuki uyarı her zaman görünür. Yeni analiz: sağda yapışkan platform önizlemesi (sade taslak, platform arayüzünü kopyalama), segment platform seçimi, maliyet ve bakiye göstergesi, metin alanları için taslak saklama. PDF çıktısını (src/lib/export/pdf.ts) rapor hiyerarşisiyle uyumlu tut. analysis.spec.ts ve agency.spec.ts güncellenip geçmeli.
```

### Oturum 4: diğer sayfalar

```text
GÖREV: docs/PANEL_TASARIMI.md'deki Toplu kontrol, İtiraz asistanı, Sezon takvimi, İlham panosu, Markalar, Ekip, Krediler, Ayarlar, API, Başlangıç ve herkese açık inceleme sayfalarını tarif edildiği gibi yeniden düzenle. İşlevleri değiştirme; yalnızca yerleşim ve bileşenler. Markalar ve API anahtarı için Dialog kullan, hesap silme onayında e-posta yazdır. Tüm e2e ve axe testleri geçmeli. Her sayfanın 1440px ve 390px ekran görüntüsünü al, karşılaştırma için docs/ekran/ altına kaydetme, yalnızca kontrol et ve bana sorunlu olanları yaz.
```
