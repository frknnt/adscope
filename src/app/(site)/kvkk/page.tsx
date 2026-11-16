import type { Metadata } from "next";
import { CONTROLLER, LegalDoc } from "@/components/legal-doc";

export const metadata: Metadata = { title: "KVKK aydınlatma metni · AdScope" };

export default function KvkkPage() {
  return (
    <LegalDoc title="KVKK aydınlatma metni" updated="16.11.2026">
      <p>6698 sayılı Kişisel Verilerin Korunması Kanunu&apos;nun 10. maddesi kapsamında, veri sorumlusu sıfatıyla {CONTROLLER} tarafından hazırlanmıştır.</p>
      <h2>İşlenen kişisel veriler ve amaçlar</h2>
      <ul>
        <li>Kimlik ve iletişim (e-posta, ad): hesap oluşturma ve oturum yönetimi, hizmetle ilgili bildirimler.</li>
        <li>Müşteri işlem (analizler, kredi hareketleri, siparişler): hizmetin sunulması, kredi bakiyesinin tutulması, faturalandırma.</li>
        <li>İşlem güvenliği (hata kodları, kötüye kullanım sınırlamaları): hizmetin güvenliğinin sağlanması.</li>
        <li>Reklam içerikleri: yalnızca talep ettiğiniz analizin üretilmesi. Bu içerikler model eğitiminde kullanılmaz.</li>
      </ul>
      <h2>Hukuki sebepler</h2>
      <p>Bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (m. 5/2-c), veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi (m. 5/2-ç) ve temel hak ve özgürlüklerinize zarar vermemek kaydıyla meşru menfaat (m. 5/2-f). Pazarlama iletileri yalnızca açık rızanız varsa gönderilir.</p>
      <h2>Aktarım</h2>
      <p>Veriler, hizmetin sunulması için barındırma, veritabanı, yapay zekâ değerlendirmesi ve ödeme hizmeti aldığımız sağlayıcılara aktarılabilir. Bu sağlayıcıların sunucuları yurt dışında bulunabilir; yurt dışına aktarım KVKK m. 9&apos;daki usullere uygun şekilde yapılır. Hangi aktarım mekanizmasının kullanılacağı yayına almadan önce hukukçu tarafından belirlenecektir.</p>
      <h2>Toplama yöntemi</h2>
      <p>Veriler, kayıt formu, analiz formu ve ödeme sağlayıcısından gelen elektronik bildirimler aracılığıyla otomatik yollarla toplanır.</p>
      <h2>Haklarınız</h2>
      <p>KVKK m. 11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme, aktarıldığı üçüncü kişileri bilme ve itiraz etme haklarına sahipsiniz. Analizlerinizi ve hesabınızı uygulama içinden kendiniz silebilirsiniz; diğer talepler için yukarıdaki iletişim adresine yazabilirsiniz.</p>
    </LegalDoc>
  );
}
