/**
 * Sector packages. Single list used by the database constraints (see migration), the wizard,
 * settings, the calendar, the rule catalog and the scoring baseline.
 */
export const SECTOR_IDS = ["genel", "takviye_gida", "estetik_klinik", "kozmetik", "kurs_egitim", "emlak", "finans"] as const;
export type Sector = (typeof SECTOR_IDS)[number];

export const SECTOR_INFO: Record<Sector, { label: string; long: string; note: string }> = {
  genel: { label: "Genel", long: "Genel e-ticaret / hizmet", note: "E-ticaret, hizmet, perakende" },
  takviye_gida: { label: "Takviye gıda", long: "Takviye gıda", note: "Vitamin, mineral, bitkisel ürün" },
  estetik_klinik: { label: "Estetik / klinik", long: "Estetik / klinik", note: "Medikal estetik, güzellik merkezi" },
  kozmetik: { label: "Kozmetik", long: "Kozmetik ve kişisel bakım", note: "Cilt, saç, makyaj ürünleri" },
  kurs_egitim: { label: "Kurs / eğitim", long: "Kurs, eğitim ve koçluk", note: "Dershane, online kurs, sertifika programı" },
  emlak: { label: "Emlak", long: "Emlak ve konut", note: "Satılık/kiralık konut, proje satışı" },
  finans: { label: "Finans", long: "Finans, kredi ve yatırım", note: "Kredi, yatırım, sigorta, ödeme" },
};

export const SECTOR_LABEL = Object.fromEntries(SECTOR_IDS.map((s) => [s, SECTOR_INFO[s].label])) as Record<Sector, string>;

export function isSector(v: unknown): v is Sector {
  return typeof v === "string" && (SECTOR_IDS as readonly string[]).includes(v);
}
