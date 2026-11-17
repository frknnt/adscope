import type { Metadata } from "next";
import { CONTROLLER, LegalDoc } from "@/components/legal-doc";

export const metadata: Metadata = { title: "Gizlilik politikası · AdScope" };

export default function PrivacyPage() {
  return (
    <LegalDoc title="Gizlilik politikası" updated="17.11.2026">
      <p>Bu politika AdScope&apos;un hangi verileri neden işlediğini, ne kadar sakladığını ve bu verileri nasıl silebileceğinizi açıklar. Veri sorumlusu: {CONTROLLER}.</p>
      <h2>Topladığımız veriler</h2>
      <ul>
        <li><strong>Hesap verileri:</strong> e-posta adresi, şifrenin tek yönlü özeti, isteğe bağlı ad ve şirket adı.</li>
        <li><strong>Reklam içerikleri:</strong> yüklediğiniz görsel, reklam metinleri, isteğe bağlı ret mesajı ve bunlardan üretilen rapor. Video analizinde video dosyası yüklenmez; tarayıcınızın videodan aldığı en fazla altı kare, süre, çözünürlük ve sesin ne zaman başladığına dair ölçümler ile yazdığınız video metni işlenir.</li>
        <li><strong>Video sesi (yalnızca onay verirseniz):</strong> &quot;Konuşmayı otomatik yazıya dök&quot; seçeneğini işaretlerseniz videonun ilk 90 saniyelik sesi bir kez konuşma tanıma sağlayıcısına gönderilir. Ses AdScope&apos;ta saklanmaz; çıkan metin raporla birlikte saklanır. Seçeneği işaretlemezseniz ses cihazınızdan çıkmaz.</li>
        <li><strong>Açılış sayfası ekran görüntüsü:</strong> eklerseniz görüntü raporla birlikte özel depoda saklanır ve saklama süresi sonunda silinir. Yapay zekâ açıksa görüntüdeki metin okunur.</li>
        <li><strong>Sezon hatırlatmaları (isteğe bağlı):</strong> açarsanız e-posta adresiniz ve varsayılan sektörünüz hatırlatma e-postası göndermek için kullanılır; hangi dönem için e-posta gönderildiği kaydedilir. Ayarlar sayfasından istediğiniz zaman kapatabilirsiniz.</li>
        <li><strong>Açılış sayfası bağlantısı:</strong> bağlantı verirseniz sayfa sunucumuzdan bir kez okunur. Sayfa metni yalnızca kontrol için kullanılır, saklanmaz; raporda bağlantı, sayfa başlığı ve kontrol sonuçları tutulur.</li>
        <li><strong>Kredi ve ödeme kayıtları:</strong> kredi hareketleri ve ödeme sağlayıcısından gelen sipariş numarası, paket ve tutar. Kart bilgileri AdScope&apos;a ulaşmaz.</li>
        <li><strong>Onay kayıtları:</strong> hangi metnin hangi sürümünü ne zaman onayladığınız.</li>
        <li><strong>Teknik kayıtlar:</strong> hata kodları ve süre ölçümleri. Bu kayıtlarda reklam içeriği, kişisel veri veya gizli anahtar tutulmaz.</li>
      </ul>
      <h2>Reklam içerikleriniz model eğitiminde kullanılmaz</h2>
      <p>Yüklediğiniz görsel ve metinler yalnızca sizin istediğiniz analizi üretmek için işlenir. AdScope bu içerikleri herhangi bir yapay zekâ modelini eğitmek için kullanmaz. Yapay zekâ değerlendirmesi açıksa içerik, analiz için yapay zekâ sağlayıcısına (Anthropic) API üzerinden gönderilir; sağlayıcının ticari API koşulları API verisinin model eğitiminde kullanılmamasını öngörür. Yapay zekâ kapalıyken içerik hiçbir üçüncü tarafa gönderilmez.</p>
      <h2>Saklama süresi</h2>
      <p>Analizler ve görseller varsayılan olarak 90 gün saklanır, ardından otomatik silinir. Bu süreyi Ayarlar sayfasından 7 ile 365 gün arasında değiştirebilirsiniz. Kredi hareketleri, muhasebe yükümlülükleri nedeniyle hesabınız silinene kadar tutulur.</p>
      <h2>Silme hakkınız</h2>
      <p>Her analizi ve görselini Geçmiş sayfasından tek tek silebilirsiniz. Ayarlar sayfasındaki &quot;Hesabımı sil&quot; işlemi hesabınızı, analizlerinizi ve yüklediğiniz dosyaları kalıcı olarak siler.</p>
      <h2>Hizmet sağlayıcılar</h2>
      <ul>
        <li>Barındırma ve veritabanı: Supabase (kimlik doğrulama, veritabanı, dosya depolama) ve uygulamanın yayınlandığı barındırma sağlayıcısı.</li>
        <li>Yapay zekâ değerlendirmesi (açıksa): Anthropic.</li>
        <li>Konuşmayı yazıya dökme (açıksa ve onay verdiyseniz): OpenAI uyumlu bir konuşma tanıma hizmeti.</li>
        <li>Hatırlatma e-postaları (açtıysanız): e-posta gönderim sağlayıcısı (Resend).</li>
        <li>Ödeme (aktifleştirildiğinde): seçilen ödeme sağlayıcısı.</li>
      </ul>
      <p>Bu sağlayıcıların bir kısmı yurt dışında veri işleyebilir. Yurt dışına aktarım koşulları KVKK aydınlatma metninde açıklanır.</p>
      <h2>Çerezler</h2>
      <p>Yalnızca oturumunuzu sürdürmek için zorunlu çerezler kullanılır. Reklam veya takip çerezi kullanılmaz.</p>
    </LegalDoc>
  );
}
