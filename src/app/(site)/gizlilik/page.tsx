import type { Metadata } from "next";
import { CompanyDetails, LegalDoc } from "@/components/legal-doc";
import { COMPANY } from "@/lib/legal";

export const metadata: Metadata = { title: "Gizlilik politikası · AdScope" };

export default function PrivacyPage() {
  return (
    <LegalDoc title="Gizlilik politikası" updated="17.11.2026">
      <p>Bu politika AdScope&apos;un hangi verileri neden işlediğini, ne kadar sakladığını ve bu verileri nasıl silebileceğinizi açıklar. Veri sorumlusu: {COMPANY.name}.</p>
      <CompanyDetails heading="Veri sorumlusu" />
      <h2>Topladığımız veriler</h2>
      <ul>
        <li><strong>Hesap verileri:</strong> e-posta adresi, şifrenin tek yönlü özeti, isteğe bağlı ad ve şirket adı.</li>
        <li><strong>Reklam içerikleri:</strong> yüklediğiniz görsel, reklam metinleri, isteğe bağlı ret mesajı ve bunlardan üretilen rapor. Video analizinde video dosyası yüklenmez; tarayıcınızın videodan aldığı en fazla altı kare, süre, çözünürlük ve sesin ne zaman başladığına dair ölçümler ile yazdığınız video metni işlenir.</li>
        <li><strong>Video sesi (yalnızca onay verirseniz):</strong> &quot;Konuşmayı otomatik yazıya dök&quot; seçeneğini işaretlerseniz videonun ilk 90 saniyelik sesi bir kez konuşma tanıma sağlayıcısına gönderilir. Ses AdScope&apos;ta saklanmaz; çıkan metin raporla birlikte saklanır. Seçeneği işaretlemezseniz ses cihazınızdan çıkmaz.</li>
        <li><strong>Açılış sayfası ekran görüntüsü:</strong> eklerseniz görüntü raporla birlikte özel depoda saklanır ve saklama süresi sonunda silinir. Yapay zekâ açıksa görüntüdeki metin okunur.</li>
        <li><strong>Sezon hatırlatmaları (isteğe bağlı):</strong> açarsanız e-posta adresiniz ve varsayılan sektörünüz hatırlatma e-postası göndermek için kullanılır; hangi dönem için e-posta gönderildiği kaydedilir. Ayarlar sayfasından istediğiniz zaman kapatabilirsiniz.</li>
        <li><strong>Açılış sayfası bağlantısı:</strong> bağlantı verirseniz sayfa sunucumuzdan bir kez okunur. Sayfa metni yalnızca kontrol için kullanılır, saklanmaz; raporda bağlantı, sayfa başlığı ve kontrol sonuçları tutulur.</li>
        <li><strong>Markalar:</strong> marka adı, sektör, ton, yasaklı kelimeler, tercih edilen çağrı cümlesi, marka sesi notu ve isteğe bağlı logo. Logo özel depoda saklanır ve yalnızca raporlarınızda ve sizin oluşturduğunuz inceleme bağlantılarında gösterilir.</li>
        <li><strong>Ekip (ajans modu):</strong> davet ettiğiniz kişinin e-posta adresi, davetin özeti ve süresi; davet kabul edilince üyelik kaydı. Ekip üyeleri analizlerinizi, raporlarınızı ve markalarınızı salt okunur görür. Davet bağlantısının kendisi saklanmaz.</li>
        <li><strong>Avukat inceleme bağlantıları:</strong> bağlantının özeti, süresi, isteğe bağlı notunuz ve kaç kez açıldığı. Bağlantıya sahip olan herkes o tek raporu süre dolana veya siz iptal edene kadar görebilir; bağlantıyı yalnızca güvendiğiniz kişiyle paylaşın.</li>
        <li><strong>Uyarı geri bildirimi:</strong> bir uyarıyı yararlı, anlaşılmadı veya yanlış olarak işaretlerseniz seçiminiz, nedeniniz ve isteğe bağlı notunuz kural kalitesini iyileştirmek için saklanır.</li>
        <li><strong>API anahtarları:</strong> anahtarın adı, ilk karakterleri, özeti ve son kullanım zamanı. Anahtarın kendisi saklanmaz.</li>
        <li><strong>İlham panosu:</strong> kaydettiğiniz Meta Reklam Kütüphanesi reklamlarının kimliği, sayfa adı ve metni. Arama terimleriniz saklanmaz; arama, sunucumuzun Meta erişim anahtarıyla yapılır.</li>
        <li><strong>Mevzuat bülteni (isteğe bağlı):</strong> açarsanız e-posta adresiniz ayda bir bülten göndermek için kullanılır ve hangi ay gönderildiği kaydedilir.</li>
        <li><strong>Ücretsiz hızlı kontrol:</strong> üyeliksiz kontrol sayfasına yazdığınız metin yalnızca o yanıt için işlenir, saklanmaz ve kayıtlara yazılmaz. Kötüye kullanımı önlemek için IP adresinizin tek yönlü özeti 10 dakika boyunca bellekte tutulur.</li>
        <li><strong>Tarayıcı eklentisi:</strong> eklenti veri göndermez; seçtiğiniz metni AdScope sihirbazına adresin <code>#</code> kısmında taşır, bu kısım sunucuya ulaşmaz.</li>
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
        <li>Hatırlatma, bülten ve ekip daveti e-postaları: e-posta gönderim sağlayıcısı (Resend).</li>
        <li>İlham panosu araması: Meta Platforms (Reklam Kütüphanesi API). Yalnızca arama terimi ve ülke gönderilir.</li>
        <li>Görsel araçları (açıksa ve siz bir işlem başlattığınızda): Photoroom. Arka plan kaldırma, büyütme ve ürün sahnesi için yalnızca yüklediğiniz fotoğraf, konum ve cihaz gibi dosya bilgileri silinerek gönderilir; ad, e-posta veya hesap bilgisi gönderilmez. Photoroom görselleri ABD&apos;deki sunucularda işler ve API görsellerini saklamadığını belirtir. Boyutlandırma, kırpma ve filigran cihazınızda yapılır, hiçbir yere gönderilmez.</li>
        <li>Kurumsal API webhook&apos;ları (siz bir adres eklediyseniz): yalnızca analiz kimliği, durum ve risk düzeyleri sizin belirlediğiniz adrese gönderilir; reklam metni gönderilmez.</li>
        <li>Ödeme (aktifleştirildiğinde): Shopier. Kart bilgilerinizi Shopier alır; AdScope&apos;a yalnızca sipariş numarası, paket ve tutar bildirilir.</li>
      </ul>
      <p>Bu sağlayıcıların bir kısmı yurt dışında veri işleyebilir. Yurt dışına aktarım koşulları KVKK aydınlatma metninde açıklanır.</p>
      <h2 id="cerezler">Çerezler ve istatistik</h2>
      <p>Oturumunuzu sürdürmek ve çerez tercihinizi hatırlamak için zorunlu çerezler kullanılır. Reklam veya takip çerezi kullanılmaz.</p>
      <p>Anonim ziyaret istatistiği açıksa, yalnızca siz &quot;İzin ver&quot; dedikten sonra ve yalnızca herkese açık sayfalarda çalışır; panel, raporlar ve inceleme bağlantıları istatistiğe dahil edilmez. Tercihinizi sayfanın altındaki &quot;Çerez tercihleri&quot; bağlantısından her zaman değiştirebilirsiniz.</p>
      <h2>Hata izleme</h2>
      <p>Bir sayfa beklenmedik bir hata verirse, hata izleme hizmetine (açıksa: Sentry) yalnızca hatanın türü, temizlenmiş hata mesajı ve sayfanın şablon yolu gönderilir. E-posta adresi, kimlik numarası, reklam metni, yüklenen dosyalar, form içerikleri, çerezler ve gizli anahtarlar gönderilmeden önce ayıklanır.</p>
    </LegalDoc>
  );
}
