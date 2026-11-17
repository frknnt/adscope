# AdScope tasarım sistemi

Lacivert mürekkep, sıcak kâğıt zemin, dikkat sinyali olarak mercan. Ürün bir "denetim raporu" hissi verir: sakin, okunaklı, kanıta dayalı. Gösterişten çok netlik.

Kaynaklar: belirteçler `src/app/globals.css`, bileşenler `src/components/ui.tsx` (sunucu) ve `src/components/interactive.tsx` (istemci), risk göstergeleri `src/components/risk.tsx`.

## Kipler

- **Pazarlama sayfaları** (`src/app/(site)`): ikna. Büyük Fraunces başlıklar, cömert boşluk, tek belirgin eylem.
- **Panel** (`src/app/panel`): iş. Taranabilirlik ve tutarlılık önce gelir; marka yalnızca ayrıntılarda (vurgulu işaretleyici, mercan odak halkası).

## Renk

Her renk bir CSS değişkeni ve aynı adlı Tailwind sınıfıdır (`bg-card`, `text-ink-soft`, `border-line`). Hex kodu bileşen içine yazılmaz.

| Belirteç | Açık | Koyu | Kullanım |
|---|---|---|---|
| `ink` | #13213c | #edf0f6 | Ana metin, birincil düğme zemini |
| `ink-soft` / `muted` | #3d4c6b / #56607a | #b4bdd0 / #97a1b8 | İkincil metin / açıklama |
| `paper` / `paper-2` | #f7f4ee / #efe9de | #0e1626 / #18233a | Sayfa zemini / ikincil yüzey |
| `card` / `field` | #fffdf9 / #fff | #131d31 / #0f192b | Kart / form alanı |
| `line` / `line-strong` | #ddd4c4 / #c7bca8 | #26334d / #3a4966 | Ayraç / alan kenarı |
| `accent`, `on-accent` | #e8603f, #13213c | #ef6c4e, #13213c | Vurgu düğmesi (metin her temada koyu) |
| `coral`, `coral-deep`, `coral-tint` | | | Yüksek risk, hata, odak |
| `amber`, `amber-tint`, `caution` | | | Orta risk, sarı bayrak, işaretleyici |
| `green`, `green-tint` | | | Düşük risk, başarı |
| `info`, `info-tint` | | | Bilgilendirme |

**Risk renkleri hiçbir zaman tek başına anlam taşımaz.** Her zaman metin etiketiyle ("Yüksek", "Sarı bayrak") ve nokta/ikonla birlikte kullanılır (`LevelPill`).

**Koyu tema** işletim sistemi tercihini izler (`prefers-color-scheme`), yalnızca ekranda. Yazdırma ve PDF her zaman açık temadır. Koyu temada `bg-ink` yüzeyler açık renge döner (ters çevrilmiş birincil düğme); bu bilinçlidir.

## Tipografi

- Başlık: **Fraunces** (`font-display`), yarı kalın, sıkı harf aralığı. Sayfa başlığı 2.6-3.4rem, bölüm başlığı `text-2xl`.
- Gövde ve arayüz: **Manrope**. Sayılar `tabular`.
- Arayüz metin ölçeği (yeni `text-[0.xxrem]` değeri ekleme):

| Sınıf | Boyut | Kullanım |
|---|---|---|
| `text-fine` | 0.75rem | Ölçek etiketi, dipnot |
| `text-meta` | 0.8125rem | Rozet, ipucu, tablo başlığı |
| `text-small` | 0.875rem | Yoğun liste, tablo hücresi |
| `text-body` | 0.9375rem | Kart içi gövde, düğme |
| `text-base` | 1rem | Form alanı, uzun metin |

## Boşluk, köşe, gölge

- Boşluk Tailwind'in 4px ölçeği. Kart iç boşluğu `p-5 sm:p-6` (büyük formlar `sm:p-8`), bölümler arası `mt-12`.
- Köşe: kart ve panel `rounded-2xl`, form alanı ve bilgi kutusu `rounded-xl`, düğme ve rozet `rounded-full`.
- Gölge az kullanılır: `shadow-raised` (öne çıkan kart), `shadow-float` (diyalog, rapor kâğıdı). Kenarlık çoğu durumda yeterlidir.

## Hareket

- Giriş: `.reveal` (0.7s, `ease-out-expo`). İşaretleyici çizimi: `.draw-mark`. Yükleme: `.skeleton`.
- Hepsi `prefers-reduced-motion` ile kapanır. Geçişler 200 ms; düzen (genişlik/yükseklik) canlandırılmaz.

## Bileşenler

| Bileşen | Dosya | Not |
|---|---|---|
| `Button`, `ButtonLink`, `buttonClass` | ui.tsx | `primary`, `accent`, `ghost`, `danger`, `quiet`; 44px yükseklik |
| `Field`, `inputClass`, `selectClass` | ui.tsx | Etiket zorunlu; hata `role="alert"` ile |
| `Panel` | ui.tsx | Kart yüzeyi |
| `EmptyState` | ui.tsx | Boş liste: ne eksik, neden önemli, tek sonraki adım |
| `Skeleton` | ui.tsx | `ilham` ve `gecmis` sayfalarının `loading.tsx` dosyaları kullanır. `notFound()` çağıran sayfalara yükleme sınırı koyma: yanıt akışla gider ve 404 yerine 200 döner |
| `Stepper` | ui.tsx | Analiz sihirbazı; `aria-current="step"` |
| `DataTable` | ui.tsx | Kaydırılabilir, klavyeyle odaklanabilir tablo çerçevesi |
| `Disclaimer` | ui.tsx | Her raporda zorunlu hukuki uyarı |
| `LevelPill`, `ScaleBar` | risk.tsx | Risk düzeyi ve 0-100 ölçek |
| `Tabs` | interactive.tsx | Ok tuşları, Home/End |
| `Dialog` | interactive.tsx | Yerel `<dialog>`; Esc ve arka plana tıklama kapatır |
| `ToastProvider`, `useToast` | interactive.tsx | Panelde kurulu; kısa durum mesajları, tek `aria-live` bölgesi |

Yeni bir bileşen yazmadan önce bu listeye bak; benzer bir şey varsa onu genişlet.

## Erişilebilirlik tabanı

WCAG 2.2 AA kontrast; görünür mercan odak halkası; dokunma hedefleri en az 44px; her form alanının etiketi; her sayfada "İçeriğe geç" bağlantısı. Uçtan uca testler axe ile ciddi ve kritik ihlal olmadığını doğrular.

## Ses ve metin

Türkçe, sade, tam cümle. Garanti dili yok ("onaylanır", "reddedilmez", "hukuken uygun" kullanılmaz). Hata mesajı ne olduğunu ve ne yapılacağını söyler, teknik ayrıntı vermez.
