# AdScope tasarım sistemi

Lacivert, beyaz zemin, yalnızca açık tema. Modern reklam-teknoloji SaaS dili: büyük kalın başlıklar, ferah bölümler, ürün ekranı maketleri. Yön ve landing yapısı: `docs/TASARIM_YONU.md`.

Kaynaklar: belirteçler `src/app/globals.css`, bileşenler `src/components/ui.tsx` (sunucu) ve `src/components/interactive.tsx` (istemci), menü `src/components/site-nav.tsx`, risk göstergeleri `src/components/risk.tsx`.

## Kipler

- **Pazarlama sayfaları** (`src/app/(site)`): ikna. Eyebrow hap + büyük başlık + tek belirgin eylem; bölümler arası 80-112px.
- **Panel** (`src/app/panel`): iş. Taranabilirlik ve tutarlılık önce gelir.

## Renk

Her renk bir CSS değişkeni ve aynı adlı Tailwind sınıfıdır (`bg-card`, `text-ink-soft`, `border-line`). Hex kodu bileşen içine yazılmaz. Koyu tema yok; `color-scheme: light`.

| Belirteç | Değer | Kullanım |
|---|---|---|
| `ink` | #0b1b3f | Başlık, birincil düğme zemini, aktif öğe |
| `ink-soft` / `muted` | #475069 / #626b80 | Gövde / açıklama |
| `paper` / `paper-2` / `tint` | #ffffff / #f5f7fb / #eef2fa | Sayfa / alternatif bölüm / ikon ve maket zemini |
| `card`, `field` | #ffffff | Kart, form alanı |
| `line` / `line-strong` | #e6e9f0 / #cfd5e2 | Ayraç / alan kenarı |
| `navy-950`, `navy-700` | #071430, #1d3a7a | Footer / ikon rengi |
| `blue`, `blue-tint` | #2456e6, #eaf0ff | Bağlantı, odak, "Yeni" rozeti, eyebrow; `accent` düğmesi |
| `coral`, `coral-deep`, `coral-tint` | #e2553a, #c2321f, #fdecea | Logo işareti, yüksek risk, hata |
| `amber`, `amber-tint`, `caution` | #9a5c00, #fff4dc, #e9b43c | Orta risk, sarı bayrak, işaretleyici |
| `green`, `green-tint` | #13703a, #e7f6ec | Düşük risk, başarı |
| `--gradient-brand` | lacivertten maviye | Yalnızca hero vurgusu (`.text-gradient`), öne çıkan fiyat kartı, kapanış bandı, mega menü kartı |

**Risk renkleri hiçbir zaman tek başına anlam taşımaz.** Her zaman metin etiketiyle ve nokta/ikonla birlikte kullanılır (`LevelPill`).

## Tipografi

- Tek aile: **Manrope**. `font-display` başlıklar için 800 ağırlık ve -0.03em aralık uygular (ağırlık sınıflarını ezer).
- Hero H1 60px (mobil 38px), bölüm H2 42px (mobil 30px), kart başlığı 18-22px `font-extrabold`.
- Eyebrow: 12px, büyük harf, 0.08em aralık, `bg-blue-tint text-blue` hap.
- Arayüz metin ölçeği (yeni `text-[0.xxrem]` değeri ekleme):

| Sınıf | Boyut | Kullanım |
|---|---|---|
| `text-fine` | 0.75rem | Ölçek etiketi, dipnot, eyebrow |
| `text-meta` | 0.8125rem | Rozet, ipucu, tablo başlığı |
| `text-small` | 0.875rem | Yoğun liste, tablo hücresi |
| `text-body` | 0.9375rem | Kart içi gövde, düğme, menü |
| `text-base` / `text-lg` | 1rem / 1.125rem | Form alanı / bölüm açıklaması |

## Boşluk, köşe, gölge

- İçerik genişliği 75rem (1200px), yan boşluk 20px (mobil) / 24px.
- Köşe: düğme ve form alanı `rounded-xl` (12px), kart `rounded-2xl` (20px), büyük maket ve bant `rounded-3xl` (28px), rozet `rounded-full`.
- Gölge: `shadow-card` (her kart), `shadow-raised` (hover, menü, maket), `shadow-float` (öne çıkan kart, rapor maketi).
- Düğmeler 48px; menüdeki küçük düğmeler 40px.

## Hareket

- Giriş: `.reveal`. Sektör şeridi: `.marquee` / `.marquee-track`. Yüzen çipler: `.float-chip`. Yükleme: `.skeleton`.
- Hepsi `prefers-reduced-motion` ile durur. Geçişler 200 ms; düzen canlandırılmaz.

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
| `Tabs` | interactive.tsx | Ok tuşları, Home/End; landing "ihtiyaç" bölümünde kullanılıyor |
| `SiteNav` | site-nav.tsx | Yapışkan menü, mega menü (Esc ve dışarı tıklama kapatır), mobil menü |
| `Dialog` | interactive.tsx | Yerel `<dialog>`; Esc ve arka plana tıklama kapatır |
| `ToastProvider`, `useToast` | interactive.tsx | Panelde kurulu; kısa durum mesajları, tek `aria-live` bölgesi |

Yeni bir bileşen yazmadan önce bu listeye bak; benzer bir şey varsa onu genişlet.

## Erişilebilirlik tabanı

WCAG 2.2 AA kontrast; görünür mercan odak halkası; dokunma hedefleri en az 44px; her form alanının etiketi; her sayfada "İçeriğe geç" bağlantısı. Uçtan uca testler axe ile ciddi ve kritik ihlal olmadığını doğrular.

## Ses ve metin

Türkçe, sade, tam cümle. Garanti dili yok ("onaylanır", "reddedilmez", "hukuken uygun" kullanılmaz). Hata mesajı ne olduğunu ve ne yapılacağını söyler, teknik ayrıntı vermez.
