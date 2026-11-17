import type { Metadata } from "next";
import Link from "next/link";
import { CompanyDetails, LegalDoc } from "@/components/legal-doc";
import { PackageTable } from "@/components/legal-packages";

export const metadata: Metadata = { title: "Ön bilgilendirme formu · AdScope" };

export default function PreInfoPage() {
  return (
    <LegalDoc title="Ön bilgilendirme formu" updated="17.11.2026">
      <p>
        Bu form, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca, kredi paketi satın almadan önce bilmeniz gereken bilgileri içerir. Ödeme sayfasına geçmeden önce bu formu okuduğunuzu onaylamanız istenir.
      </p>
      <CompanyDetails heading="Satıcı" />

      <h2>Hizmetin temel nitelikleri</h2>
      <p>
        AdScope, reklam içeriklerini yayın öncesinde platform politikaları ve reklam mevzuatına göre risk açısından değerlendiren çevrim içi bir yazılım hizmetidir. Satın alınan şey, AdScope hesabınızda kullanılan analiz kredisidir. Bir görsel analizi bir kredi, bir video analizi iki kredi kullanır. Sonuçlar risk değerlendirmesidir, hukuki görüş değildir; bir reklamın platform tarafından onaylanacağı ya da mevzuata uygun olduğu garanti edilmez.
      </p>

      <h2>Fiyatlar</h2>
      <PackageTable />
      <p>Fiyatlar Türk lirasıdır. [KDV DURUMU: fiyatlara KDV dahil mi, muhasebeciyle netleştirilecek.] Ödeme sayfasında gösterilen toplam tutar dışında ek bir ücret alınmaz.</p>

      <h2>Ödeme</h2>
      <p>Ödeme, ödeme aracı hizmet sağlayıcısı Shopier&apos;in güvenli ödeme sayfasında kartla yapılır. Kart bilgileriniz AdScope&apos;a ulaşmaz ve AdScope tarafından saklanmaz.</p>

      <h2>İfa (teslim)</h2>
      <p>Ödeme Shopier tarafından onaylandığında krediler genellikle birkaç dakika içinde hesabınıza tanımlanır ve Krediler sayfasında görünür. Fiziksel teslimat yoktur.</p>

      <h2>Cayma hakkı</h2>
      <p>
        Mesafeli Sözleşmeler Yönetmeliği&apos;nin 15. maddesinin birinci fıkrasının (ğ) bendi uyarınca, elektronik ortamda anında ifa edilen hizmetlere ve tüketiciye anında teslim edilen gayrimaddi mallara ilişkin sözleşmelerde cayma hakkı kullanılamaz. Krediler ödeme onaylanır onaylanmaz hesabınıza tanımlandığı için <strong>bu satın alımda cayma hakkı bulunmaz</strong>. Ödeme öncesinde bunu ayrıca onaylamanız istenir.
      </p>
      <p>Ödemeniz alındığı hâlde krediler hesabınıza tanımlanmadıysa ya da hizmet ayıplıysa, kanundan doğan haklarınız saklıdır; aşağıdaki iletişim yollarıyla bize ulaşın.</p>

      <h2>Şikâyet ve itiraz</h2>
      <p>
        Taleplerinizi satıcının e-posta adresine iletebilirsiniz. Uyuşmazlıklarda, Ticaret Bakanlığınca her yıl ilan edilen parasal sınırlar içinde tüketici hakem heyetlerine, bu sınırların üzerinde tüketici mahkemelerine başvurabilirsiniz.
      </p>

      <p>
        Satın alımın tüm koşulları <Link href="/mesafeli-satis-sozlesmesi">Mesafeli satış sözleşmesi</Link>nde yer alır.
      </p>
    </LegalDoc>
  );
}
