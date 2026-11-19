import { z } from "zod";
import { PLATFORM_IDS } from "@/lib/platforms";
import { SECTOR_IDS } from "@/lib/sectors";
import { LAYOUT_IDS } from "./layouts";
import { CREATIVE_SIZE_IDS } from "./sizes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (max: number) => z.string().trim().max(max * 2).catch("").transform((s) => [...s.replace(/\s+/g, " ")].slice(0, max).join(""));

/** Query keys of the creative studio (also used by the preview image URL). */
export const CreativeQuerySchema = z.object({
  marka: z.string().regex(UUID).nullable().catch(null),
  platform: z.enum(PLATFORM_IDS).catch("meta"),
  sektor: z.enum(SECTOR_IDS).catch("genel"),
  baslik: text(90),
  metin: text(220),
  cta: text(30),
  boyut: z.enum(CREATIVE_SIZE_IDS).catch("kare"),
  yerlesim: z.enum(LAYOUT_IDS).catch("manset"),
  /** A saved brand template (P10.3) instead of one of the eight layouts. */
  sablon: z.string().regex(UUID).nullable().catch(null),
});

export type CreativeQuery = z.infer<typeof CreativeQuerySchema>;

export function parseCreativeQuery(get: (key: string) => string | null | undefined): CreativeQuery {
  const pick = (k: string) => get(k) ?? undefined;
  return CreativeQuerySchema.parse({
    marka: pick("marka") || null,
    platform: pick("platform"),
    sektor: pick("sektor"),
    baslik: pick("baslik") ?? "",
    metin: pick("metin") ?? "",
    cta: pick("cta") ?? "",
    boyut: pick("boyut"),
    yerlesim: pick("yerlesim"),
    sablon: pick("sablon") || null,
  });
}

export function creativeQueryString(q: CreativeQuery, over: Partial<CreativeQuery> = {}): string {
  const v = { ...q, ...over };
  const p = new URLSearchParams({ platform: v.platform, sektor: v.sektor, baslik: v.baslik, metin: v.metin, cta: v.cta, boyut: v.boyut, yerlesim: v.yerlesim });
  if (v.marka) p.set("marka", v.marka);
  if (v.sablon) p.set("sablon", v.sablon);
  return p.toString();
}
