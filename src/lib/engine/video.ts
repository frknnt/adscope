/**
 * Video / Reels creative heuristics. These are production best-practice notes (creative_quality),
 * not platform policy: they never raise the Meta or legal risk scores.
 */
import type { AdInput, CreativeSubScore, EngineFinding } from "./types";

export const MAX_VIDEO_FRAMES = 6;

function note(severity: EngineFinding["severity"], title: string, explanation: string, suggestion: string): EngineFinding {
  return { ruleId: null, ruleVersionId: null, ruleStatus: null, domain: "creative_quality", severity, field: "video", matchedText: null, title, explanation, suggestion, origin: "heuristic" };
}

export function aspectLabel(width: number, height: number) {
  const r = width / height;
  const known = [
    { label: "9:16", ratio: 9 / 16 },
    { label: "4:5", ratio: 4 / 5 },
    { label: "1:1", ratio: 1 },
    { label: "16:9", ratio: 16 / 9 },
  ];
  const best = known.map((k) => ({ ...k, diff: Math.abs(r - k.ratio) / k.ratio })).sort((a, b) => a.diff - b.diff)[0];
  return best.diff <= 0.04 ? best.label : `${width}×${height}`;
}

export function videoFindings(input: AdInput): EngineFinding[] {
  const v = input.video;
  if (!v) return [];
  const out: EngineFinding[] = [];
  const aspect = aspectLabel(v.width, v.height);
  if (aspect !== "9:16") {
    out.push(note("info", "Video dikey (9:16) değil", `Video oranı ${aspect}. Reels ve Hikâye yerleşimleri tam ekran dikey video için tasarlanmıştır; farklı oranlarda kenarlarda boşluk kalır veya görüntü kırpılır.`, "Reels için 1080×1920 (9:16) bir kurgu hazırlayın; önemli yazıları üst ve alt kenarlardan uzak tutun."));
  }
  if (Math.min(v.width, v.height) < 720) {
    out.push(note("yellow", "Video çözünürlüğü düşük", `Kısa kenar ${Math.min(v.width, v.height)} piksel. Düşük çözünürlük mobilde bulanık görünür.`, "Videoyu en az 1080 piksel kısa kenarla dışa aktarın."));
  }
  if (v.durationSec > 60) {
    out.push(note("info", "Video uzun", `Video ${Math.round(v.durationSec)} saniye. Kısa videolarda ana mesajın ilk saniyelerde verilmesi izlenme oranını artırır.`, "Ana mesajı ve ürünü ilk 3 saniyede gösterin; 15–30 saniyelik bir kısaltılmış sürüm de hazırlayın."));
  }
  if (!input.transcript?.trim()) {
    out.push(note("info", "Konuşma ve ekran yazıları girilmedi", "Videodaki seslendirme ve ekran yazıları girilmediği için kural kartlarına göre taranamadı. Yalnızca reklam metni ve kareler incelendi.", "Seslendirme metnini ve ekrandaki yazıları sihirbazdaki alana yapıştırın; sesi kapalı izleyenler için videoya altyazı da ekleyin."));
  }
  return out;
}

/** Replaces the image resolution/aspect sub-scores for videos (same 20-point budget). */
export function videoSubScores(input: AdInput): CreativeSubScore[] {
  const v = input.video!;
  const minSide = Math.min(v.width, v.height);
  const res = minSide >= 1080 ? 5 : minSide >= 720 ? 4 : 1;
  const d = v.durationSec;
  const dur = d <= 30 ? 5 : d <= 60 ? 4 : d <= 90 ? 2 : 1;
  const aspect = aspectLabel(v.width, v.height);
  const aspectScore = aspect === "9:16" ? 10 : aspect === "4:5" ? 7 : aspect === "1:1" ? 6 : 3;
  return [
    { key: "resolution", label: "Video çözünürlüğü", score: res, max: 5, reason: res === 5 ? `Çözünürlük yeterli (${v.width}×${v.height}).` : `Kısa kenar ${minSide}px; en az 1080px önerilir.` },
    { key: "duration", label: "Video süresi", score: dur, max: 5, reason: d <= 30 ? `${Math.round(d)} saniye; kısa ve odaklı.` : `${Math.round(d)} saniye; ana mesajı ilk saniyelere taşıyın, kısa bir sürüm de deneyin.` },
    { key: "aspect", label: "Reels formatı", score: aspectScore, max: 10, reason: aspect === "9:16" ? "Dikey 9:16, Reels ve Hikâye için uygun." : `Oran ${aspect}; Reels için 9:16 dikey önerilir.` },
  ];
}
