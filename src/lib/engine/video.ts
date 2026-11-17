/**
 * Video / Reels creative heuristics. These are production best-practice notes (creative_quality),
 * not platform policy: they never raise the Meta or legal risk scores.
 */
import type { AiAnalysis } from "@/lib/ai/schema";
import type { AdInput, CreativeSubScore, EngineFinding, VideoReview } from "./types";

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

export function videoFindings(input: AdInput, review?: VideoReview | null): EngineFinding[] {
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

  // Audio and the opening seconds (measured in the browser; speech from the optional speech-to-text step).
  const a = v.audio;
  if (a?.analyzed && !a.present) {
    out.push(note("info", "Videoda ses yok", "Videoda duyulabilir bir ses bulunamadı. Reels’in çoğu sesli izlense de sessiz videolarda mesajın tamamı ekran yazısıyla verilmelidir.", "Ana mesajı büyük, kısa ekran yazılarıyla verin; isterseniz müzik veya dış ses ekleyin."));
  } else if (a?.present && a.firstSoundSec !== null && a.firstSoundSec > 1.5) {
    out.push(note("info", "Ses geç başlıyor", `İlk ses yaklaşık ${a.firstSoundSec.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}. saniyede başlıyor. İzleyiciler çoğunlukla ilk 1–3 saniyede kaydırmaya karar verir.`, "Videoyu doğrudan ana mesajla, bir soru ya da sonuçla açın; sessiz girişleri kısaltın."));
  }
  const firstSpeech = input.speech?.segments.find((s) => s.start < 3);
  if (input.speech && input.speech.text.trim() && !firstSpeech) {
    out.push(note("info", "İlk 3 saniyede konuşma yok", "Yazıya dökülen seste ilk konuşma 3. saniyeden sonra başlıyor. Açılışta dikkat çeken bir cümle kaydırma oranını düşürür.", "Dış sesi ürünün ya da faydanın adıyla, ilk 3 saniye içinde başlatın."));
  }

  // AI review of the frames (hook, captions, sound-off, safe zones).
  if (review?.reviewedByAi) {
    if (review.hookStrength !== null && review.hookStrength <= 4) {
      out.push(note("yellow", "Açılış (kanca) zayıf", review.hookNote ?? "İlk 3 saniyedeki kareler dikkat çekmekte zorlanıyor.", "İlk karede ürünü, sonucu veya güçlü bir soruyu gösterin; logo ve marka girişlerini sona bırakın."));
    }
    if ((a?.present || input.speech?.text) && review.hasCaptions === false) {
      out.push(note("yellow", "Altyazı yok", "Konuşma var ama karelerde konuşmayı izleyen bir altyazı görünmüyor. Reels’i sesi kapalı izleyenler mesajı kaçırır.", "Konuşmayı altyazı olarak videoya ekleyin; Instagram’ın otomatik altyazı özelliğini de açabilirsiniz."));
    }
    if (review.worksWithoutSound === false) {
      out.push(note("info", "Ses kapalıyken mesaj anlaşılmıyor", "Karelerdeki ekran yazıları, ses olmadan ana mesajı anlatmaya yetmiyor.", "Teklifi ve ürünü 3–5 kelimelik ekran yazılarıyla da verin."));
    }
    if (review.safeZoneIssue) {
      out.push(note("yellow", "Yazılar güvenli alanın dışında", "Bazı yazı veya logolar dikey videonun üst ya da alt kenarına çok yakın. Reels arayüzü (profil adı, açıklama, düğmeler) bu bölgeleri kapatır.", "Önemli yazıları ve logoyu ekranın orta bölümüne taşıyın; üst ve alt kenarlarda boşluk bırakın."));
    }
  } else if (!input.transcript?.trim() && !input.speech?.text.trim()) {
    out.push(note("info", "Konuşma ve ekran yazıları girilmedi", "Videodaki seslendirme ve ekran yazıları girilmediği için kural kartlarına göre taranamadı. Yalnızca reklam metni ve kareler incelendi.", "Seslendirme metnini ve ekrandaki yazıları sihirbazdaki alana yapıştırın ya da sesi yazıya döktürün; sesi kapalı izleyenler için videoya altyazı da ekleyin."));
  }
  return out;
}

/** Combines the AI frame review (if any) with what was measured in the browser and the speech transcript. */
export function buildVideoReview(input: AdInput, ai: AiAnalysis["video"] | null | undefined): VideoReview | null {
  if (!input.video) return null;
  const first3 = input.speech?.segments.filter((s) => s.start < 3).map((s) => s.text.trim()).join(" ").trim() || null;
  return {
    reviewedByAi: Boolean(ai),
    hookStrength: ai?.hook_strength ?? null,
    hookNote: ai?.hook_note_tr ?? null,
    hasCaptions: ai?.has_captions ?? null,
    worksWithoutSound: ai?.works_without_sound ?? null,
    safeZoneIssue: ai?.safe_zone_issue ?? null,
    frameNotes: (ai?.frame_notes ?? []).filter((n) => n.frame <= input.video!.frameCount).map((n) => ({ frame: n.frame, note: n.note_tr })),
    audio: input.video.audio ?? null,
    speechFirst3s: first3 ? first3.slice(0, 300) : null,
    speechProvider: input.speech?.provider ?? null,
  };
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
