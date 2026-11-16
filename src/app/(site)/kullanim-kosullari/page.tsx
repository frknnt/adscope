import type { Metadata } from "next";
import { CONTROLLER, LegalDoc } from "@/components/legal-doc";

export const metadata: Metadata = { title: "Kullanım koşulları · AdScope" };

export default function TermsPage() {
  return (
    <LegalDoc title="Kullanım koşulları" updated="16.11.2026">
      <p>Bu koşullar AdScope hizmetini kullanımınızı düzenler. Hizmet sağlayıcı: {CONTROLLER}.</p>
      <h2>Hizmetin niteliği</h2>
      <p>AdScope, reklam içeriklerini yayın öncesinde sürümlü kural kartlarına göre tarayan bir ön kontrol aracıdır. <strong>Sonuçlar risk değerlendirmesidir, hukuki görüş değildir.</strong> AdScope bir reklamın Meta tarafından onaylanacağını, reddedilmeyeceğini veya mevzuata uygun olduğunu garanti etmez. Reklamın içeriğinden ve yayınından reklam veren sorumludur.</p>
      <h2>Kural kartları</h2>
      <p>Bulgular yalnızca aktif kural kartlarına dayanır. Kartlar resmî kaynaklardan derlenir ve son doğrulama tarihleriyle birlikte gösterilir; mevzuat ve platform politikaları değişebileceği için güncel olmayabilir.</p>
      <h2>Krediler</h2>
      <ul>
        <li>Yeni hesaplara bir kez 3 ücretsiz kredi verilir.</li>
        <li>Bir analiz bir kredidir. Kredi yalnızca rapor başarıyla tamamlandığında düşer.</li>
        <li>Satın alınan krediler, ödeme sağlayıcısından gelen doğrulanmış bildirim üzerine hesabınıza eklenir. İade ve cayma koşulları ödeme sağlayıcısı aktifleştirildiğinde bu bölüme eklenecektir.</li>
      </ul>
      <h2>Kabul edilemez kullanım</h2>
      <ul>
        <li>Başkasına ait olup kullanma hakkınız olmayan içerikleri yüklemek.</li>
        <li>Hizmeti otomatik araçlarla aşırı yüklemek, sınırlamaları aşmaya çalışmak veya başka kullanıcıların verilerine erişmeye çalışmak.</li>
        <li>Yasa dışı ürün ve hizmetlerin reklamlarını hazırlamak için kullanmak.</li>
      </ul>
      <h2>Yüklediğiniz içerikler</h2>
      <p>İçeriklerinizin hakları sizde kalır. AdScope içerikleri yalnızca analiz üretmek için işler ve model eğitiminde kullanmaz. Saklama ve silme koşulları Gizlilik politikasında açıklanır.</p>
      <h2>Değişiklikler</h2>
      <p>Koşullar değişirse yeni sürüm bu sayfada yayımlanır ve sonraki girişinizde onayınız istenir.</p>
    </LegalDoc>
  );
}
