import "server-only";
import { getAiProvider } from "@/lib/analysis/service";
import type { CopyAudience } from "@/lib/copy/generate";
import type { DataRepo } from "@/lib/data/types";
import { fetchLanding } from "@/lib/landing/fetch";
import { sensitiveHits } from "./sensitive";

/** Loads an audience for the copy generator; it must belong to the chosen brand (or any own brand when none). */
export async function audienceForGeneration(repo: DataRepo, audienceId: string, brandId: string | null): Promise<CopyAudience | null> {
  const a = (await repo.listAudiences(brandId ?? undefined)).find((x) => x.id === audienceId);
  if (!a) return null;
  return { name: a.name, ageMin: a.ageMin, ageMax: a.ageMax, need: a.need, objections: a.objections, tone: a.tone };
}

export type AudienceSuggestion = { name: string; ageMin: number; ageMax: number; need: string; objections: string; tone: string };

/**
 * Up to three audience suggestions from the brand's website. Suggestions that touch a sensitive
 * category are dropped, never shown. Nothing is stored here.
 */
export async function suggestAudiencesFromSite(website: string, sector: string): Promise<{ ok: true; items: AudienceSuggestion[]; dropped: number } | { ok: false; error: string }> {
  const ai = getAiProvider();
  if (!ai?.suggestAudiences) return { ok: false, error: "Yapay zekâ bu ortamda kapalı. Profili elle ekleyebilirsin." };
  const page = await fetchLanding(website);
  if (page.status !== "ok") return { ok: false, error: "Web sitesi okunamadı. Profili elle ekleyebilirsin." };
  const res = await ai.suggestAudiences({ siteName: page.title, summary: page.description, pageText: page.text, sector });
  if (!res.ok) return { ok: false, error: "Öneri alınamadı. Biraz sonra tekrar dene ya da profili elle ekle." };
  const all = res.data.audiences.map((a) => ({
    name: a.name.trim(),
    ageMin: Math.min(a.age_min, a.age_max),
    ageMax: Math.max(a.age_min, a.age_max),
    need: a.need.trim(),
    objections: a.objections.trim(),
    tone: a.tone.trim(),
  }));
  const items = all.filter((a) => !sensitiveHits(a.name, a.need, a.objections, a.tone).length);
  return { ok: true, items, dropped: all.length - items.length };
}
