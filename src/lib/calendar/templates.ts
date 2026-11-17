/**
 * Campaign text templates for season events. They are starting points written to pass the rule engine:
 * no outcome promises, no superiority claims, discounts always carry the pre-discount price and dates.
 * Square brackets are placeholders the user fills in; the analysis treats them as ordinary text.
 */
import type { Sector } from "@/lib/rules/catalog";

export interface CampaignTemplate {
  id: string;
  eventId: string;
  sector: Sector;
  title: string;
  headline: string;
  primaryText: string;
  description: string;
}

// The reference price must be the lowest price of the last 10 days before the campaign (TR-RY-INDIRIM-REFERANS).
const PRICE = "[ürün] [son 10 gündeki en düşük fiyat] TL yerine [kampanya fiyatı] TL.";
const DATES = "Kampanya [başlangıç tarihi] – [bitiş tarihi] arasında geçerlidir; koşullar kampanya sayfasında.";

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "yilbasi-genel",
    eventId: "yilbasi",
    sector: "genel",
    title: "Yılbaşı hediye seçkisi",
    headline: "Yeni yıla özenle seçilmiş hediyeler",
    primaryText: `Sevdiklerin için yılbaşı seçkimiz hazır. ${PRICE} ${DATES} Siparişlerin [son kargo tarihi] tarihine kadar kargoda.`,
    description: "Yılbaşı seçkisini incele",
  },
  {
    id: "sevgililer-gunu-genel",
    eventId: "sevgililer-gunu",
    sector: "genel",
    title: "Sevgililer Günü hediyesi",
    headline: "14 Şubat için küçük bir sürpriz",
    primaryText: `Sevgililer Günü’ne özel hediye kutuları hazır. ${PRICE} ${DATES}`,
    description: "Hediye kutularına göz at",
  },
  {
    id: "kadinlar-gunu-genel",
    eventId: "kadinlar-gunu",
    sector: "genel",
    title: "8 Mart içerik paylaşımı",
    headline: "8 Mart Dünya Kadınlar Günü",
    primaryText: "Ekibimizdeki kadınların hikâyelerini bu hafta paylaşıyoruz. [Kısa hikâye veya proje bilgisi]. Tüm hikâyeler web sitemizde.",
    description: "Hikâyeleri oku",
  },
  {
    id: "ramazan-bayrami-genel",
    eventId: "ramazan-bayrami",
    sector: "genel",
    title: "Bayram öncesi teslimat",
    headline: "Bayramdan önce kapında",
    primaryText: `Bayram ziyaretleri için hediyelik seçkimiz hazır. ${PRICE} ${DATES} Bayramdan önce teslimat için son sipariş günü [tarih].`,
    description: "Bayram seçkisini incele",
  },
  {
    id: "23-nisan-genel",
    eventId: "23-nisan",
    sector: "genel",
    title: "23 Nisan aile etkinliği",
    headline: "23 Nisan’da birlikte üretelim",
    primaryText: "Ulusal Egemenlik ve Çocuk Bayramı’nda velilerle çocuklar için [etkinlik adı] düzenliyoruz. Tarih: [tarih], yer: [yer]. Kayıt bilgileri web sitemizde.",
    description: "Etkinlik bilgileri",
  },
  {
    id: "anneler-gunu-genel",
    eventId: "anneler-gunu",
    sector: "genel",
    title: "Anneler Günü hediye rehberi",
    headline: "Anneler Günü hediye rehberi",
    primaryText: `Fiyat aralığına göre hazırladığımız Anneler Günü rehberi yayında. ${PRICE} ${DATES}`,
    description: "Rehbere göz at",
  },
  {
    id: "kurban-bayrami-genel",
    eventId: "kurban-bayrami",
    sector: "genel",
    title: "Bayram tatili hatırlatması",
    headline: "Bayram tatilinde siparişler",
    primaryText: "Bayram süresince siparişlerin [tarih] tarihinden itibaren kargoya verilecek. Bayram öncesi teslimat için son sipariş günü [tarih]. İyi bayramlar!",
    description: "Teslimat takvimini gör",
  },
  {
    id: "yaz-sezonu-takviye",
    eventId: "yaz-sezonu",
    sector: "takviye_gida",
    title: "Yaz rutini (takviye gıda)",
    headline: "Yaz rutinine [ürün] eşlik etsin",
    primaryText: "[Ürün], [içerik ve miktar] içeren bir takviye gıdadır. Günde [kullanım miktarı], dengeli beslenme ve aktif yaşamla birlikte kullanılabilir. Takviye gıdalar ilaç değildir; hastalıkların önlenmesi veya tedavisi amacıyla kullanılmaz.",
    description: "İçerik bilgilerini incele",
  },
  {
    id: "yaz-sezonu-klinik",
    eventId: "yaz-sezonu",
    sector: "estetik_klinik",
    title: "Yaz öncesi bilgilendirme (klinik)",
    headline: "Yaz öncesi cilt bakımı hakkında",
    primaryText: "Güneşli aylarda cilt bakımında nelere dikkat edilmesi gerektiğini [uzmanın unvanı ve adı] anlatıyor. Bilgilendirme yazımız web sitemizde; uygun yöntem için muayene gereklidir.",
    description: "Bilgilendirme yazısını oku",
  },
  {
    id: "babalar-gunu-genel",
    eventId: "babalar-gunu",
    sector: "genel",
    title: "Babalar Günü hediyesi",
    headline: "Babalar Günü için hızlı teslimat",
    primaryText: `Babalar Günü seçkimiz hazır. ${PRICE} ${DATES} [Şehir] içi siparişlerde [teslim süresi] içinde teslimat.`,
    description: "Seçkiyi incele",
  },
  {
    id: "okula-donus-genel",
    eventId: "okula-donus",
    sector: "genel",
    title: "Okula dönüş listesi",
    headline: "Okula dönüş listesi hazır",
    primaryText: `Velilere sınıf sınıf ihtiyaç listesi hazırladık. Paket içeriği: [ürünler]. ${PRICE} ${DATES}`,
    description: "Listeyi indir",
  },
  {
    id: "okula-donus-takviye",
    eventId: "okula-donus",
    sector: "takviye_gida",
    title: "Okul dönemi (takviye gıda)",
    headline: "Yeni dönemde ailenin rutini",
    primaryText: "[Ürün], [içerik ve miktar] içeren bir takviye gıdadır. Kullanım yaşı ve miktarı için etiketi okuyun. Takviye gıdalar ilaç değildir; hastalıkların önlenmesi veya tedavisi amacıyla kullanılmaz.",
    description: "Etiket bilgilerini gör",
  },
  {
    id: "11-11-genel",
    eventId: "11-11",
    sector: "genel",
    title: "11.11 kampanyası",
    headline: "11.11’e özel fiyatlar",
    primaryText: `11 Kasım’a özel seçili ürünlerde fiyatlar yenilendi. ${PRICE} ${DATES} Kampanya kapsamındaki ürünlerin listesi kampanya sayfasında.`,
    description: "Kampanya ürünlerini gör",
  },
  {
    id: "efsane-cuma-genel",
    eventId: "efsane-cuma",
    sector: "genel",
    title: "Efsane Cuma kampanyası",
    headline: "Efsane Cuma fiyatları",
    primaryText: `Efsane Cuma boyunca seçili ürünlerde yeni fiyatlar. ${PRICE} ${DATES} Stoklar ürün sayfasında güncel olarak gösterilir.`,
    description: "Kampanyayı incele",
  },
  {
    id: "siber-pazartesi-genel",
    eventId: "siber-pazartesi",
    sector: "genel",
    title: "Siber Pazartesi",
    headline: "Siber Pazartesi’ye özel",
    primaryText: `Yalnızca çevrim içi siparişlerde geçerli Siber Pazartesi fiyatları. ${PRICE} ${DATES}`,
    description: "Çevrim içi mağazaya git",
  },
  {
    id: "ogretmenler-gunu-genel",
    eventId: "ogretmenler-gunu",
    sector: "genel",
    title: "Öğretmenler Günü",
    headline: "24 Kasım Öğretmenler Günü",
    primaryText: "Öğretmenlerimize teşekkür etmek için küçük hediye önerilerimizi derledik: [ürünler]. Fiyatlar ve teslimat bilgileri ürün sayfalarında.",
    description: "Önerileri gör",
  },
];

export function templatesFor(eventId: string, sector?: Sector | null) {
  return CAMPAIGN_TEMPLATES.filter((t) => t.eventId === eventId && (!sector || t.sector === "genel" || t.sector === sector));
}

export function findTemplate(id: string | null | undefined) {
  return id ? CAMPAIGN_TEMPLATES.find((t) => t.id === id) ?? null : null;
}
