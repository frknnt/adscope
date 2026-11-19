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

/**
 * Words that point to a sector package. Matched on folded page text (ı→i, ş→s …) at word starts,
 * so Turkish suffixes count ("kremler") but a hint inside another word does not ("mikrofinans").
 */
const SECTOR_HINTS: Record<Exclude<Sector, "genel">, string[]> = {
  takviye_gida: ["takviye", "gida takviyesi", "vitamin", "mineral", "kolajen", "probiyotik", "omega", "kapsul", "multivitamin", "bitkisel"],
  estetik_klinik: ["klinik", "estetik", "botoks", "dolgu", "lazer epilasyon", "sac ekimi", "rinoplasti", "medikal", "op. dr", "uzm. dr"],
  kozmetik: ["kozmetik", "krem", "serum", "cilt bakim", "makyaj", "ruj", "sampuan", "parfum", "nemlendirici", "tonik"],
  kurs_egitim: ["kurs", "egitim", "sertifika", "dershane", "kocluk", "akademi", "online ders", "ogrenci", "sinava hazirlik", "mufredat"],
  emlak: ["emlak", "satilik", "kiralik", "daire", "konut", "rezidans", "villa", "arsa", "metrekare", "tapu"],
  finans: ["kredi", "faiz", "yatirim", "borsa", "kripto", "sigorta", "banka", "finans", "fon", "kredi karti"],
};

/**
 * Best guess of the sector package from a site's text (P9.2 onboarding). Returns "genel" unless one
 * sector clearly leads; the user always confirms or changes it before anything is saved.
 */
export function guessSector(foldedText: string): { sector: Sector; confident: boolean } {
  const scores = (Object.keys(SECTOR_HINTS) as Exclude<Sector, "genel">[]).map((s) => {
    let score = 0;
    for (const w of SECTOR_HINTS[s]) {
      const hits = foldedText.match(new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"))?.length ?? 0;
      score += Math.min(3, hits);
    }
    return { s, score };
  });
  scores.sort((a, b) => b.score - a.score);
  const [first, second] = scores;
  if (first.score >= 3 && first.score >= second.score * 2) return { sector: first.s, confident: true };
  if (first.score >= 2 && first.score > second.score) return { sector: first.s, confident: false };
  return { sector: "genel", confident: false };
}
