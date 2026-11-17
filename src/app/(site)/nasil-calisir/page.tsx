import type { Metadata } from "next";
import { ButtonLink, Disclaimer } from "@/components/ui";

export const metadata: Metadata = { title: "Nasıl çalışır? · AdScope" };

const STEPS = [
  { t: "Görseli veya videoyu seç", d: "Görsel: JPG, PNG veya WebP, en fazla 5 MB; dosya türü dosyanın kendi imzasından kontrol edilir. Video/Reels: MP4, MOV veya WebM; video cihazından çıkmaz; tarayıcın altı kare alır (üçü ilk 3 saniyeden) ve sesi ölçer, yalnızca kareler ve ölçümler gönderilir. Video analizi 2 kredidir." },
  { t: "Metni gir", d: "Ana metin, başlık ve açıklama. Videoda dış ses ve ekran yazılarını da yazabilirsin. İstersen açılış sayfası bağlantısını ekle; indirim, fiyat ve marka tutarlılığı kontrol edilir." },
  { t: "Sektörü seç", d: "Genel, takviye gıda veya estetik/klinik. Sektör paketi ilgili kural kartlarını ekler." },
  { t: "Beyanlarını işaretle", d: "Etkileyici paylaşımı mı, yapay zekâ ile üretilmiş insan karakteri var mı? Bu bilgiler görselden çıkarılamadığı için senden alınır." },
  { t: "Ret mesajı varsa yapıştır", d: "Daha önce reddedildiyse Meta'nın mesajını ekle; itiraz taslağı da hazırlansın." },
  { t: "Analizi başlat", d: "Kural motoru çalışır, yapay zekâ anahtarı tanımlıysa görsel ve metin ayrıca değerlendirilir. Kredi yalnızca rapor tamamlanınca düşer." },
  { t: "Raporu kullan", d: "Bulguları düzelt, güvenli metni veya varyantlardan birini kopyala, raporu PDF olarak kaydet." },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-[3.4rem]">Yaklaşık bir dakikada, yedi adımda ön kontrol.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
        AdScope bir reklam yöneticisi ya da hukuk danışmanı değildir. Yayına çıkmadan önce bakılması gerekenleri sıralayan, her bulguyu kaynağıyla gösteren bir kontrol listesidir.
      </p>

      <ol className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.t} className="grid grid-cols-[3rem_1fr] gap-4">
            <span className="font-display text-4xl font-semibold leading-none text-coral-deep tabular" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="text-lg font-bold">
                <span className="sr-only">Adım {i + 1}: </span>
                {s.t}
              </h2>
              <p className="mt-1.5 leading-relaxed text-ink-soft">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-20 grid gap-10 border-t border-line pt-14 lg:grid-cols-[1fr_1.4fr]">
        <h2 className="font-display text-3xl font-semibold leading-tight">Skorlar nasıl hesaplanır?</h2>
        <div className="space-y-8 leading-relaxed text-ink-soft">
          <div>
            <h3 className="text-lg font-bold text-ink">Meta ret riski (0–100)</h3>
            <p className="mt-2">
              Sektöre göre bir taban puanla başlar (genel 5, takviye gıda ve estetik/klinik 15). Doğrulanmış her Meta kural kartı bulgusu puan ekler: kırmızı bayrak 40, sarı bayrak 20. 65 ve üzeri yüksek, 35 ve üzeri orta risktir. Doğrulama bekleyen kurallar bilgi olarak gösterilir, puana eklenmez. Raporda hangi bulgunun kaç puan eklediği tek tek yazılır.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink">Türk mevzuatı riski</h3>
            <p className="mt-2">
              Yalnızca resmî kaynağı okunmuş, aktif kural kartlarından gelen bulgular sayılır. Bir kırmızı bayrak seviyeyi yüksek, sarı bayrak orta yapar. Aktif kural kartı olmayan hiçbir şey ihlal olarak gösterilmez.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink">Kreatif skoru (0–100)</h3>
            <p className="mt-2">
              Yedi alt skorun toplamıdır: harekete geçirici çağrı (20), başlık (15), ana metin uzunluğu (15), okunabilirlik (15), görsel çözünürlüğü (10), format oranı (10) ve görsel değerlendirme (15). Videoda çözünürlük ve format yerine video çözünürlüğü (5), süre (5) ve Reels formatı (10) puanlanır. Görsel değerlendirme yapay zekâ ile yapılır; yapay zekâ kapalıyken nötr puan verilir ve bu raporda belirtilir. Video ve açılış sayfası notları kreatif kalite önerisidir; Meta veya mevzuat riskini değiştirmez.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink">Yapay zekâ neyi yapamaz?</h3>
            <p className="mt-2">
              Yapay zekâ yalnızca sistemdeki kural kartlarını gösterebilir, yeni kural ya da madde uyduramaz. Çıktısı şemaya göre doğrulanır; işaret ettiği ifade metinde gerçekten geçmiyorsa bulgu atılır. Önerdiği metinler kural motorundan tekrar geçirilir.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-14 flex flex-wrap items-center gap-3">
        <ButtonLink href="/kayit" variant="accent" className="h-12 px-6">3 ücretsiz analizle başla</ButtonLink>
        <ButtonLink href="/kurallar" variant="ghost" className="h-12 px-6">Kural kartlarını incele</ButtonLink>
      </div>
      <Disclaimer className="mt-10" />
    </div>
  );
}
