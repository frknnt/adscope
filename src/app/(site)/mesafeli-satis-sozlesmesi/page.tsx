import type { Metadata } from "next";
import Link from "next/link";
import { CompanyDetails, LegalDoc } from "@/components/legal-doc";
import { PackageTable } from "@/components/legal-packages";

export const metadata: Metadata = { title: "Mesafeli satış sözleşmesi · AdScope" };

export default function DistanceSalesPage() {
  return (
    <LegalDoc title="Mesafeli satış sözleşmesi" updated="17.11.2026">
      <h2>1. Taraflar</h2>
      <p>
        Bu sözleşme, aşağıda bilgileri yer alan satıcı ile AdScope hesabı üzerinden kredi paketi satın alan kişi (&quot;alıcı&quot;) arasında, alıcının ödeme sayfasına geçmeden önce sözleşmeyi elektronik ortamda onaylamasıyla kurulur. Alıcının bilgileri, hesabına kayıtlı e-posta adresi ve ödeme sırasında Shopier&apos;e verdiği bilgilerdir.
      </p>
      <CompanyDetails heading="Satıcı" />

      <h2>2. Konu</h2>
      <p>
        Sözleşmenin konusu, alıcının seçtiği AdScope kredi paketinin satışı ve kredilerin alıcının hesabına tanımlanmasıdır. Taraflar, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ile Mesafeli Sözleşmeler Yönetmeliği hükümlerine tabidir.
      </p>

      <h2>3. Hizmet ve fiyat</h2>
      <p>Paketin adı, kredi sayısı ve toplam fiyatı ödeme anında seçilen pakete göre belirlenir. Güncel paketler:</p>
      <PackageTable />
      <p>[KDV DURUMU: fiyatlara KDV dahil mi, muhasebeciyle netleştirilecek.] Ödeme sayfasında gösterilen tutar, alıcının ödeyeceği toplam tutardır.</p>
      <p>
        Bir görsel analizi bir kredi, bir video analizi iki kredi kullanır. Kredi yalnızca analiz başarıyla tamamlandığında düşer. Analiz sonuçları risk değerlendirmesidir, hukuki görüş değildir; satıcı bir reklamın platform tarafından onaylanacağını ya da mevzuata uygun olduğunu garanti etmez.
      </p>

      <h2>4. Ödeme</h2>
      <p>Ödeme, Shopier&apos;in güvenli ödeme sayfasında yapılır. Kart bilgileri satıcıya ulaşmaz. Satıcı, ödemenin tutarını ve paketini Shopier&apos;den gelen doğrulanmış bildirimle kendi kayıtlarıyla karşılaştırır; tutmayan bildirim üzerine kredi tanımlanmaz.</p>

      <h2>5. İfa</h2>
      <p>
        Krediler, ödemenin Shopier tarafından onaylandığı bildirimin satıcıya ulaşmasıyla birlikte alıcının hesabına tanımlanır. Teknik bir aksaklık nedeniyle krediler makul sürede tanımlanmazsa alıcı satıcıya e-postayla başvurur; satıcı ödemeyi doğruladıktan sonra kredileri tanımlar ya da ödemeyi iade eder.
      </p>

      <h2>6. Cayma hakkı</h2>
      <p>
        Mesafeli Sözleşmeler Yönetmeliği&apos;nin 15. maddesinin birinci fıkrasının (ğ) bendi uyarınca, elektronik ortamda anında ifa edilen hizmetlere ve tüketiciye anında teslim edilen gayrimaddi mallara ilişkin sözleşmelerde cayma hakkı kullanılamaz. Krediler ödeme onaylanır onaylanmaz hesaba tanımlandığından, alıcı bu sözleşmede <strong>cayma hakkının bulunmadığını</strong> ödeme öncesinde ayrıca onaylar.
      </p>

      <h2>7. Ayıplı hizmet ve iade</h2>
      <p>
        Ödeme alındığı hâlde kredi tanımlanmaması, mükerrer ödeme ya da hizmetin hiç sunulamaması durumlarında alıcının kanundan doğan hakları saklıdır. Ödeme sağlayıcısından iade ya da ters ibraz bildirimi geldiğinde, iade edilen tutara karşılık gelen krediler alıcının hesabından düşülür.
      </p>

      <h2>8. Kişisel veriler</h2>
      <p>
        Alıcının kişisel verileri <Link href="/kvkk">KVKK aydınlatma metni</Link> ve <Link href="/gizlilik">Gizlilik politikası</Link> uyarınca işlenir.
      </p>

      <h2>9. Uyuşmazlık</h2>
      <p>
        Uyuşmazlıklarda, Ticaret Bakanlığınca her yıl ilan edilen parasal sınırlar içinde alıcının yerleşim yerindeki ya da işlemin yapıldığı yerdeki tüketici hakem heyetleri, bu sınırların üzerinde tüketici mahkemeleri yetkilidir.
      </p>

      <h2>10. Yürürlük</h2>
      <p>
        Alıcı, ödeme sayfasına geçmeden önce <Link href="/on-bilgilendirme-formu">Ön bilgilendirme formu</Link>nu okuduğunu ve bu sözleşmeyi kabul ettiğini onaylar. Onayın tarihi ve sözleşmenin sürümü alıcının hesabına kaydedilir. Sözleşme, ödemenin onaylanmasıyla yürürlüğe girer.
      </p>
    </LegalDoc>
  );
}
