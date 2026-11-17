import "server-only";
import type { DataRepo } from "@/lib/data/types";
import { runRuleEngine } from "@/lib/engine/rule-engine";
import type { AdInput } from "@/lib/engine/types";
import { videoFindings, videoSubScores } from "@/lib/engine/video";
import { ruleAppliesTo, type Platform } from "@/lib/platforms";
import type { Sector } from "@/lib/rules/catalog";
import { buildTimeline, openingTexts, VIDEO_H, VIDEO_W, type VideoSpec } from "./timeline";

export interface VideoReviewOut {
  hookNote: string;
  hookStrong: boolean;
  notes: { severity: "red" | "yellow" | "info"; title: string; explanation: string; suggestion: string }[];
  issues: string[];
  scores: { label: string; score: number; max: number; reason: string }[];
}

/**
 * Runs a generated video through the same video heuristics as an uploaded one (format, length,
 * sound, opening seconds) and its on-screen text through the rule cards. Free: no AI, no credit.
 */
export async function reviewGeneratedVideo(repo: DataRepo, p: { spec: VideoSpec; mime: "video/mp4" | "video/webm"; sizeBytes: number; sector: Sector; platform: Platform }): Promise<VideoReviewOut> {
  const tl = buildTimeline(p.spec);
  const texts = tl.layers.filter((l) => l.role !== "endBrand").map((l) => l.text);
  const input: AdInput = {
    sector: p.sector,
    platform: p.platform,
    headline: tl.layers.find((l) => l.role === "offer")?.text ?? "",
    primaryText: texts.join(" "),
    description: "",
    flags: { influencerPost: false, aiHumanCharacter: false, aiRealPersonCopy: false },
    transcript: texts.join("\n"),
    video: {
      mime: p.mime,
      durationSec: tl.duration,
      width: VIDEO_W,
      height: VIDEO_H,
      sizeBytes: p.sizeBytes,
      frameCount: tl.slides.length,
      // The maker produces silent videos; the message is carried by on-screen text.
      audio: { analyzed: true, present: false, firstSoundSec: null, silentRatio: 1, meanDbFirst3s: null },
    },
  };
  const rules = (await repo.getRules(p.sector)).filter((r) => ruleAppliesTo(r, p.platform));
  const ruleHits = runRuleEngine(input, rules).filter((f) => f.matchedText && f.severity !== "info");
  const open = openingTexts(tl);
  const hookStrong = open.brand && open.offer;
  const hookNote = hookStrong
    ? `İlk 3 saniyede marka ve teklif ekranda: “${open.texts.join(" · ")}”. Ses yok; mesaj tamamen ekran yazısıyla veriliyor.`
    : open.offer
      ? `İlk 3 saniyede teklif ekranda (“${tl.layers.find((l) => l.role === "offer")!.text}”) ama marka adı yok. Marka adını ekle.`
      : "İlk 3 saniyede teklif yazısı yok. Videoyu teklif ya da fayda cümlesiyle aç; izleyiciler çoğunlukla ilk saniyelerde kaydırmaya karar verir.";
  return {
    hookNote,
    hookStrong,
    notes: videoFindings(input, null).map((f) => ({ severity: f.severity, title: f.title, explanation: f.explanation, suggestion: f.suggestion })),
    issues: [...new Set(ruleHits.map((f) => f.title))],
    scores: videoSubScores(input).map((s) => ({ label: s.label, score: s.score, max: s.max, reason: s.reason })),
  };
}
